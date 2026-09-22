"""Smoke tests for the four-layer engine pipeline.

These tests use a temporary SQLite DB so they don't pollute dev data.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta

import numpy as np
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.database import Base
from app.models.msme import MSME, MSMEFinancials
from app.models.policy import Policy
from app.models.user import User, UserRole
from app.services.feature_engine import FEATURE_NAMES, build_features
from app.services.ingestion_service import (
    derive_financials,
    ingest_business,
    ingest_financial,
    ingest_government,
)
from app.services.orchestrator import run_assessment
from app.services.policy_engine import (
    GRADE_TO_MULTIPLIER,
    PolicyEvaluation,
    decide,
    evaluate_policy,
    recommend_limit,
)
from app.services.risk_scorer import score_msme, score_to_grade
from app.schemas.msme import BusinessIngest, FinancialIngest, GovernmentIngest


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def sample_msme(db) -> MSME:
    m = MSME(
        legal_name="Acme Textiles Pvt Ltd",
        gstin="27ABCDE1234F1Z5",
        pan="ABCDE1234F",
        sector="manufacturing",
        state="Maharashtra",
        city="Mumbai",
        incorporation_date=datetime.utcnow() - timedelta(days=365 * 5),
        employee_count=50,
        annual_turnover_inr=24_000_000.0,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def test_grade_mapping():
    assert score_to_grade(820) == "A"
    assert score_to_grade(770) == "B"
    assert score_to_grade(700) == "C"
    assert score_to_grade(650) == "D"
    assert score_to_grade(580) == "E"
    assert score_to_grade(500) == "F"


def test_feature_engine_shape(sample_msme, db):
    f = build_features(sample_msme, sample_msme.financials)
    assert set(f.keys()) == set(FEATURE_NAMES)
    # all numeric
    for v in f.values():
        assert isinstance(v, (int, float))


def test_financial_ingestion_drives_financials(sample_msme, db):
    payload = FinancialIngest(
        bank_statements=[
            {"month": "2025-01", "closing_balance": 500_000, "bounced_cheques": 0},
            {"month": "2025-02", "closing_balance": 520_000, "bounced_cheques": 0},
            {"month": "2025-03", "closing_balance": 540_000, "bounced_cheques": 1},
        ],
        gst_returns=[
            {"period": "2025-01", "taxable_value": 1_000_000, "tax_paid": 180_000},
            {"period": "2025-02", "taxable_value": 1_100_000, "tax_paid": 198_000},
            {"period": "2025-03", "taxable_value": 1_200_000, "tax_paid": 216_000},
        ],
    )
    res = ingest_financial(db, sample_msme, payload)
    assert res.accepted_records >= 3
    derive_financials(db, sample_msme)
    db.refresh(sample_msme)
    fin: MSMEFinancials = sample_msme.financials
    assert fin is not None
    assert fin.avg_monthly_revenue_inr > 0
    assert fin.gst_compliance_ratio == 1.0
    assert fin.bounced_cheques_12m == 1


def test_policy_engine_approve_happy_path(sample_msme, db):
    policy = Policy(
        name="test", min_credit_score=600, min_gst_compliance=0.6,
        max_bounced_cheques=2, min_vintage_years=1, min_avg_monthly_revenue_inr=100_000,
        max_customer_concentration_pct=0.8,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    features = {
        "gst_compliance_ratio": 1.0,
        "bounced_cheques_12m": 0,
        "revenue_trend_pct": 5,
        "top_customer_concentration_pct": 0.3,
        "debt_to_revenue_ratio": 0.1,
        "liquidity_ratio": 0.2,
        "vintage_years": 5,
        "utility_payment_consistency": 1.0,
        "avg_monthly_revenue_inr": 500_000,
    }
    evaluation = evaluate_policy(score=750, grade="B", features=features, policy=policy)
    assert not evaluation.hard_reject
    assert evaluation.violations == []
    limit = recommend_limit(avg_monthly_revenue_inr=500_000, grade="B", policy=policy)
    assert limit > 0
    outcome, rationale = decide(score=750, grade="B", eval_result=evaluation, limit=limit)
    assert outcome.value == "APPROVE"
    assert "Grade B" in rationale


def test_policy_engine_hard_reject_no_revenue(sample_msme, db):
    policy = Policy(name="test", min_credit_score=600)
    db.add(policy)
    db.commit()
    features = {"gst_compliance_ratio": 1.0, "bounced_cheques_12m": 0,
                "avg_monthly_revenue_inr": 0, "vintage_years": 5}
    evaluation = evaluate_policy(score=500, grade="F", features=features, policy=policy)
    assert evaluation.hard_reject
    assert "HARD_REJECT_NO_REVENUE" in evaluation.hard_reject_reasons


def test_policy_engine_low_gst_violation(sample_msme, db):
    policy = Policy(name="test", min_credit_score=600, min_gst_compliance=0.8)
    db.add(policy)
    db.commit()
    features = {
        "gst_compliance_ratio": 0.5, "bounced_cheques_12m": 0,
        "avg_monthly_revenue_inr": 500_000, "vintage_years": 5,
        "revenue_trend_pct": 5, "top_customer_concentration_pct": 0.3,
        "debt_to_revenue_ratio": 0.1, "liquidity_ratio": 0.2,
        "utility_payment_consistency": 1.0,
    }
    evaluation = evaluate_policy(score=700, grade="C", features=features, policy=policy)
    assert not evaluation.hard_reject
    assert "GST_COMPLIANCE_BELOW_POLICY" in evaluation.violations


def test_full_assessment_pipeline(sample_msme, db):
    """End-to-end: ingest + score + decision in one call."""
    # Pre-populate some financials so we don't have to ingest first
    fin = MSMEFinancials(
        msme_id=sample_msme.id,
        avg_monthly_revenue_inr=600_000,
        revenue_trend_pct=8.0,
        ebitda_margin_pct=15.0,
        gst_filings_expected=6,
        gst_filings_done=6,
        gst_compliance_ratio=1.0,
        avg_bank_balance_inr=1_200_000,
        bounced_cheques_12m=0,
        existing_loan_obligations_inr=1_000_000,
        utility_payment_consistency=0.95,
        telecom_footprint_score=0.7,
        digital_footprint_score=0.7,
        top_customer_concentration_pct=0.3,
        vintage_years=5.0,
    )
    db.add(fin)
    policy = Policy(name="default", is_active=True)
    db.add(policy)
    db.commit()

    result = run_assessment(db, sample_msme, triggered_by_user_id=None)
    score_run = result["score_run"]
    decision = result["decision"]

    assert 300 <= score_run.credit_score <= 900
    assert score_run.risk_grade in {"A", "B", "C", "D", "E", "F"}
    assert 0.0 <= score_run.pd_default_12m <= 1.0
    assert decision.outcome.value in {"APPROVE", "REVIEW", "REJECT"}
    assert decision.recommended_limit_inr >= 0
    assert isinstance(decision.reason_codes, list)
    assert isinstance(decision.rationale, str) and decision.rationale


# ---------- regression tests for identified business-logic errors ----------

def test_gst_compliance_calendar_gap(sample_msme, db):
    """Filing gaps must lower the ratio (Jan filed, Feb missed, Mar filed)."""
    payload = FinancialIngest(
        gst_returns=[
            {"period": "2025-01", "taxable_value": 1_000_000, "tax_paid": 180_000},
            {"period": "2025-03", "taxable_value": 1_200_000, "tax_paid": 216_000},
        ],
    )
    ingest_financial(db, sample_msme, payload)
    derive_financials(db, sample_msme)
    fin = sample_msme.financials
    assert fin.gst_filings_expected == 3   # Jan..Mar calendar span
    assert fin.gst_filings_done == 2       # Feb missing
    assert fin.gst_compliance_ratio == pytest.approx(2 / 3, abs=1e-4)


def test_concentration_not_overwritten_by_cibil(sample_msme, db):
    """CIBIL lender outstandings are not customer revenue - seeded value must survive."""
    fin = MSMEFinancials(msme_id=sample_msme.id, top_customer_concentration_pct=0.72)
    db.add(fin)
    db.commit()
    ingest_government(
        db, sample_msme,
        GovernmentIngest(
            cibil_score=750,
            cibil_accounts=[{"outstanding": 900_000}, {"outstanding": 100_000}],
        ),
    )
    derive_financials(db, sample_msme)
    assert sample_msme.financials.top_customer_concentration_pct == pytest.approx(0.72)


def test_concentration_derived_from_invoices(sample_msme, db):
    """Customer-attributed invoices drive concentration (80/20 split -> 0.8)."""
    ingest_business(
        db, sample_msme,
        BusinessIngest(invoices=[
            {"invoice_number": "A1", "amount": 800_000, "date": "2025-01-05", "customer_id": "X"},
            {"invoice_number": "A2", "amount": 200_000, "date": "2025-02-05", "customer_id": "Y"},
        ]),
    )
    derive_financials(db, sample_msme)
    assert sample_msme.financials.top_customer_concentration_pct == pytest.approx(0.8, abs=1e-4)


def test_incremental_ingest_merges_lists(sample_msme, db):
    """Second ingest must append new periods and update same-period records, not replace the list."""
    ingest_financial(db, sample_msme, FinancialIngest(gst_returns=[
        {"period": "2025-01", "taxable_value": 100_000, "tax_paid": 18_000},
        {"period": "2025-02", "taxable_value": 110_000, "tax_paid": 19_800},
    ]))
    ingest_financial(db, sample_msme, FinancialIngest(gst_returns=[
        {"period": "2025-02", "taxable_value": 111_000, "tax_paid": 19_980},
        {"period": "2025-03", "taxable_value": 120_000, "tax_paid": 21_600},
    ]))
    returns = sample_msme.raw_financial["gst_returns"]
    periods = [r["period"] for r in returns]
    assert periods == ["2025-01", "2025-02", "2025-03"]
    feb = next(r for r in returns if r["period"] == "2025-02")
    assert feb["taxable_value"] == 111_000  # incoming wins on key collision


def test_rejected_records_not_persisted(sample_msme, db):
    """Validation failures must not be written to raw_financial."""
    res = ingest_financial(db, sample_msme, FinancialIngest(gst_returns=[
        {"period": "2025-01", "taxable_value": 500_000, "tax_paid": 90_000},
        {"taxable_value": 100, "tax_paid": 18},  # missing period -> rejected
    ]))
    assert res.rejected_records == 1
    assert res.accepted_records == 1
    stored = sample_msme.raw_financial["gst_returns"]
    assert len(stored) == 1
    assert all("period" in r for r in stored)


def test_reason_codes_not_duplicated_on_hard_reject(sample_msme, db):
    """Hard codes must appear once in reasons+violations+hard concat."""
    policy = Policy(name="t-hard")
    db.add(policy)
    db.commit()
    features = {"gst_compliance_ratio": 0.3, "bounced_cheques_12m": 0,
                "avg_monthly_revenue_inr": 500_000, "vintage_years": 5}
    ev = evaluate_policy(score=720, grade="C", features=features, policy=policy)
    assert ev.hard_reject
    codes = ev.reasons + ev.violations + ev.hard_reject_reasons
    assert len(codes) == len(set(codes))
    assert set(codes) == set(ev.hard_reject_reasons)


def test_decide_uses_policy_thresholds(sample_msme, db):
    """auto_approve_score/review_min_score must replace the hardcoded 700/600."""
    ev = PolicyEvaluation(hard_reject=False, hard_reject_reasons=[], violations=[], reasons=[])
    policy = Policy(name="t-bands", auto_approve_score=780, review_min_score=700)
    db.add(policy)
    db.commit()

    outcome, _ = decide(score=750, grade="B", eval_result=ev, limit=100_000, policy=policy)
    assert outcome.value == "REVIEW"  # below auto_approve 780

    outcome, _ = decide(score=750, grade="B", eval_result=ev, limit=100_000)  # no policy
    assert outcome.value == "APPROVE"  # legacy fallback 700

    outcome, _ = decide(score=800, grade="A", eval_result=ev, limit=100_000, policy=policy)
    assert outcome.value == "APPROVE"


def test_grade_thresholds_policy_driven(sample_msme, db):
    """score_to_grade must honour policy.grade_thresholds over GRADE_BANDS."""
    policy = Policy(
        name="t-grades",
        grade_thresholds={"A": 750, "B": 700, "C": 650, "D": 600, "E": 550, "F": 300},
    )
    db.add(policy)
    db.commit()
    assert score_to_grade(760, policy) == "A"   # policy band (fallback would say B)
    assert score_to_grade(760) == "B"           # built-in fallback unchanged
    assert score_to_grade(500, policy) == "F"


def test_sector_other_when_no_financials(sample_msme, db):
    """Sector one-hot must not be skipped when financials is None."""
    sample_msme.sector = "agriculture"  # not in SECTOR_MAP
    db.flush()
    f = build_features(sample_msme, None)
    assert f["sector_other"] == 1.0
    assert f["sector_manufacturing"] == 0.0


def test_pd_matches_final_score(sample_msme, db):
    """pd_default_12m must be consistent with the penalised final score."""
    fin = MSMEFinancials(
        msme_id=sample_msme.id,
        avg_monthly_revenue_inr=500_000,
        gst_compliance_ratio=1.0,
        utility_payment_consistency=0.95,
        avg_bank_balance_inr=2_000_000,
        existing_loan_obligations_inr=0.0,
        bounced_cheques_12m=0,
        top_customer_concentration_pct=0.3,
        vintage_years=5.0,
    )
    db.add(fin)
    db.flush()
    out = score_msme(db, sample_msme, fin, policy=None)
    expected = max(0.0, min(1.0, (900 - out["credit_score"]) / 600.0))
    assert out["pd_default_12m"] == pytest.approx(expected, abs=1e-4)


def test_model_reload_picks_up_new_version(tmp_path, monkeypatch):
    """reload_model() must clear the cache and read the version from features.json."""
    from app import config
    cfg = config.settings
    monkeypatch.setattr(cfg, "model_path", tmp_path / "risk_model.pkl")
    monkeypatch.setattr(cfg, "features_path", tmp_path / "features.json")

    from app.ml import train_synthetic
    from app.services import risk_scorer

    old_model, old_ver = risk_scorer._model, risk_scorer._model_version
    try:
        risk_scorer._model = None
        train_synthetic.train_and_save()
        assert risk_scorer.reload_model() == train_synthetic.SYNTHETIC_VERSION
        assert risk_scorer._model is not None

        meta = json.loads(cfg.features_path.read_text())
        meta["model_version"] = "v9-test"
        cfg.features_path.write_text(json.dumps(meta))
        assert risk_scorer.reload_model() == "v9-test"
    finally:
        risk_scorer._model, risk_scorer._model_version = old_model, old_ver


def test_feedback_retrain_uses_labels(db, sample_msme, tmp_path, monkeypatch):
    """Feedback rows must join to feature snapshots and drive training."""
    from app.ml import train_synthetic
    from app.models.audit_log import AuditAction, AuditLog
    from app.models.decision import Decision, DecisionOutcome
    from app.models.score_run import ScoreRun

    snap = {name: 0.4 for name in FEATURE_NAMES}
    run = ScoreRun(
        msme_id=sample_msme.id, model_version="t", credit_score=700, risk_grade="C",
        pd_default_12m=0.3, red_flags=[], feature_snapshot=snap, score_breakdown={},
    )
    db.add(run)
    db.flush()
    dec = Decision(
        msme_id=sample_msme.id, score_run_id=run.id, outcome=DecisionOutcome.APPROVE,
        recommended_limit_inr=100_000, reason_codes=[], rationale="ok",
    )
    db.add(dec)
    db.flush()

    # Below the minimum sample count -> not enough data
    AuditLog.log(db, action=AuditAction.FEEDBACK, decision_id=dec.id, details={"label": 0.0})
    db.flush()
    assert train_synthetic.collect_feedback_samples(db) is None

    # 30+ labels with both classes -> usable
    for i in range(31):
        AuditLog.log(
            db, action=AuditAction.FEEDBACK, decision_id=dec.id,
            details={"label": 1.0 if i % 2 else 0.0},
        )
    db.flush()
    samples = train_synthetic.collect_feedback_samples(db)
    assert samples is not None
    x, y = samples
    assert x.shape == (32, len(FEATURE_NAMES))
    assert set(np.unique(y).tolist()) == {0, 1}

    # Full train path persists a feedback-versioned model
    from app import config
    cfg = config.settings
    monkeypatch.setattr(cfg, "model_path", tmp_path / "risk_model.pkl")
    monkeypatch.setattr(cfg, "features_path", tmp_path / "features.json")
    result = train_synthetic.train_and_save_feedback(db)
    assert result is not None
    assert result["model_version"].startswith("v1.1-feedback-")
    assert cfg.model_path.exists()


def test_seed_liquidity_healthy_not_flagged():
    """Seed balances are now a fraction of ANNUAL revenue - healthy profiles
    must not trip the <5% liquidity rule (previously 20/20 did)."""
    import app.seed as seed_mod

    random.seed(42)
    below = 0
    n = 20
    for i in range(n):
        rec = seed_mod._gen_msme_record(i)
        stmts = rec["raw_financial"]["bank_statements"]
        avg_bal = sum(s["closing_balance"] for s in stmts) / len(stmts)
        liquidity = avg_bal / rec["annual_turnover_inr"]
        if liquidity < 0.05:
            below += 1
        assert liquidity >= 0.009  # even risky profiles keep some runway
    # Before the fix every record tripped (20/20); only ~30% risky should now.
    assert 1 <= below <= 10


def test_seed_gst_gaps_match_filings_done():
    """Seed GST returns must contain real filing gaps so calendar compliance < 1.0 for risky."""
    import app.seed as seed_mod

    random.seed(42)
    saw_gap = False
    for i in range(20):
        rec = seed_mod._gen_msme_record(i)
        done = rec["_financials_kwargs"]["gst_filings_done"]
        returns = rec["raw_financial"]["gst_returns"]
        assert len(returns) == done
        periods = sorted(r["period"] for r in returns)
        if done < 6:
            saw_gap = True
            # calendar span must still be Jan..Jun so expected stays 6
            assert periods[0] == "2025-01"
            assert periods[-1] == "2025-06"
    assert saw_gap  # at least one risky profile among 20 draws (p ~ 0.999)
