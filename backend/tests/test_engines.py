"""Smoke tests for the four-layer engine pipeline.

These tests use a temporary SQLite DB so they don't pollute dev data.
"""
from __future__ import annotations

from datetime import datetime, timedelta

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
    ingest_financial,
    ingest_government,
)
from app.services.orchestrator import run_assessment
from app.services.policy_engine import (
    GRADE_TO_MULTIPLIER,
    decide,
    evaluate_policy,
    recommend_limit,
)
from app.services.risk_scorer import score_msme, score_to_grade
from app.schemas.msme import FinancialIngest, GovernmentIngest


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
