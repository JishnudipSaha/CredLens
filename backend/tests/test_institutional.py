"""Tests for market-standard institutional MSME underwriting features."""
from __future__ import annotations

from datetime import datetime, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.decision import DecisionOutcome
from app.models.msme import MSME, MSMEFinancials
from app.models.policy import Policy
from app.services.ingestion_service import derive_financials, ingest_financial
from app.services.orchestrator import run_assessment
from app.services.policy_engine import (
    calculate_nayak_mpbf,
    evaluate_policy,
    generate_sanction_covenants,
)
from app.services.risk_scorer import score_msme
from app.schemas.msme import FinancialIngest


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
        legal_name="Bharat Agro Tools Pvt Ltd",
        gstin="27AABCB1234F1Z1",
        pan="AABCB1234F",
        sector="manufacturing",
        state="Maharashtra",
        city="Pune",
        incorporation_date=datetime.now() - timedelta(days=365 * 4),
        employee_count=45,
        annual_turnover_inr=36_000_000.0,
        raw_government={
            "mca_data": {"cin": "U12345MH2020PTC123456", "status": "Active"},
            "cibil_score": 750,
            "cibil_cmr_rank": 3,
            "max_dpd_12m": 0,
            "active_credit_facilities": 2,
        },
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def test_nayak_mpbf_turnover_method():
    # 25% WC requirement, 5% borrower margin, 20% MPBF
    # For monthly 10 L -> annual 1.2 Cr -> MPBF 24 L
    res_a = calculate_nayak_mpbf(avg_monthly_revenue_inr=1_000_000, grade="A")
    assert res_a["annual_turnover_inr"] == 12_000_000.0
    assert res_a["working_capital_requirement_inr"] == 3_000_000.0
    assert res_a["promoter_margin_inr"] == 600_000.0
    assert res_a["mpbf_inr"] == 2_400_000.0
    assert res_a["sanctioned_limit_inr"] == 2_400_000.0

    # Grade B gets 85% of MPBF
    res_b = calculate_nayak_mpbf(avg_monthly_revenue_inr=1_000_000, grade="B")
    assert res_b["sanctioned_limit_inr"] == round(2_400_000.0 * 0.85, 2)


def test_institutional_financials_derivation(sample_msme, db):
    payload = FinancialIngest(
        bank_statements=[
            {"month": "2025-01", "closing_balance": 800_000, "bounced_cheques": 0, "credits": 3_000_000},
            {"month": "2025-02", "closing_balance": 850_000, "bounced_cheques": 0, "credits": 3_100_000},
            {"month": "2025-03", "closing_balance": 900_000, "bounced_cheques": 0, "credits": 2_900_000},
        ],
        gst_returns=[
            {"period": "2025-01", "taxable_value": 3_000_000, "tax_paid": 540_000},
            {"period": "2025-02", "taxable_value": 3_000_000, "tax_paid": 540_000},
            {"period": "2025-03", "taxable_value": 3_000_000, "tax_paid": 540_000},
        ],
        balance_sheet={
            "revenue": 36_000_000,
            "ebitda": 5_400_000, # 15% EBITDA
            "existing_loan_obligations_annual": 4_000_000,
        },
    )
    ingest_financial(db, sample_msme, payload)
    fin = derive_financials(db, sample_msme)
    db.refresh(sample_msme)

    assert fin.dscr >= 1.25
    assert fin.interest_coverage_ratio >= 2.0
    assert fin.cibil_cmr_rank == 3
    assert fin.data_trust_score >= 80.0
    assert "AA_VERIFIED" in fin.verification_badges
    assert "GSTN_VERIFIED" in fin.verification_badges
    assert "MCA_VERIFIED" in fin.verification_badges


def test_5_pillar_credit_scoring(sample_msme, db):
    fin = derive_financials(db, sample_msme)
    score_out = score_msme(db, sample_msme, fin)
    breakdown = score_out["score_breakdown"]

    assert "pillars" in breakdown
    pillars = breakdown["pillars"]
    assert "financial_strength" in pillars
    assert "banking_quality" in pillars
    assert "tax_compliance" in pillars
    assert "bureau_record" in pillars
    assert "business_stability" in pillars
    for v in pillars.values():
        assert 0 <= v <= 100


def test_sanction_covenants_generated():
    covenants = generate_sanction_covenants(DecisionOutcome.APPROVE, "B", limit=5_000_000)
    assert len(covenants) >= 5
    assert any("hypothecation" in c.lower() for c in covenants)
    assert any("chg-1" in c.lower() for c in covenants)
    assert any("personal guarantee" in c.lower() for c in covenants)


def test_dscr_hard_reject(sample_msme, db):
    policy = Policy(name="test_dscr")
    fin = MSMEFinancials(
        msme_id=sample_msme.id,
        avg_monthly_revenue_inr=1_000_000,
        existing_loan_obligations_inr=10_000_000,
        dscr=0.5, # critical default risk
        cibil_cmr_rank=9,
    )
    features = {"gst_compliance_ratio": 1.0, "bounced_cheques_12m": 0, "avg_monthly_revenue_inr": 1_000_000}
    eval_res = evaluate_policy(score=700, grade="B", features=features, policy=policy, financials=fin)
    assert eval_res.hard_reject
    assert "HARD_REJECT_DSCR_CRITICAL" in eval_res.hard_reject_reasons
