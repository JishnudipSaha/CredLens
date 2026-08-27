"""Layer 2 - Scoring API + full credit report endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.decision import Decision
from app.models.msme import MSME
from app.models.score_run import ScoreRun
from app.models.user import User
from app.schemas.scoring import CreditReport, ScoreRequest, ScoreRunOut
from app.services.orchestrator import run_assessment


router = APIRouter(prefix="/score", tags=["scoring"])


@router.post("/run", response_model=CreditReport)
def run_score(
    payload: ScoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreditReport:
    msme = db.get(MSME, payload.msme_id)
    if not msme:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSME not found")
    result = run_assessment(db, msme, triggered_by_user_id=current_user.id)
    db.commit()
    db.refresh(result["score_run"])
    db.refresh(result["decision"])

    return CreditReport(
        msme=_msme_to_dict(msme),
        financials=_financials_to_dict(msme),
        score=ScoreRunOut.model_validate(result["score_run"]),
        decision=_decision_to_dict(result["decision"]),
        policy_used={
            "id": result["policy"].id,
            "name": result["policy"].name,
            "min_credit_score": result["policy"].min_credit_score,
            "min_gst_compliance": result["policy"].min_gst_compliance,
        },
    )


@router.get("/runs/{msme_id}", response_model=list[ScoreRunOut])
def list_score_runs(
    msme_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ScoreRunOut]:
    if not db.get(MSME, msme_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSME not found")
    rows = (
        db.query(ScoreRun)
        .filter(ScoreRun.msme_id == msme_id)
        .order_by(ScoreRun.id.desc())
        .limit(50)
        .all()
    )
    return [ScoreRunOut.model_validate(r) for r in rows]


@router.get("/report/{msme_id}", response_model=CreditReport)
def get_credit_report(
    msme_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreditReport:
    msme = db.get(MSME, msme_id)
    if not msme:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSME not found")
    score_run = (
        db.query(ScoreRun)
        .filter(ScoreRun.msme_id == msme_id)
        .order_by(ScoreRun.id.desc())
        .first()
    )
    decision = (
        db.query(Decision)
        .filter(Decision.msme_id == msme_id)
        .order_by(Decision.id.desc())
        .first()
    )
    return CreditReport(
        msme=_msme_to_dict(msme),
        financials=_financials_to_dict(msme),
        score=ScoreRunOut.model_validate(score_run) if score_run else None,
        decision=_decision_to_dict(decision) if decision else None,
        policy_used=None,
    )


def _msme_to_dict(m: MSME) -> dict:
    return {
        "id": m.id,
        "legal_name": m.legal_name,
        "trade_name": m.trade_name,
        "gstin": m.gstin,
        "pan": m.pan,
        "udyam_number": m.udyam_number,
        "sector": m.sector,
        "sub_sector": m.sub_sector,
        "state": m.state,
        "city": m.city,
        "incorporation_date": m.incorporation_date.isoformat() if m.incorporation_date else None,
        "employee_count": m.employee_count,
        "annual_turnover_inr": m.annual_turnover_inr,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def _financials_to_dict(m: MSME) -> dict | None:
    f = m.financials
    if not f:
        return None
    return {
        "avg_monthly_revenue_inr": f.avg_monthly_revenue_inr,
        "revenue_trend_pct": f.revenue_trend_pct,
        "ebitda_margin_pct": f.ebitda_margin_pct,
        "gst_filings_expected": f.gst_filings_expected,
        "gst_filings_done": f.gst_filings_done,
        "gst_compliance_ratio": f.gst_compliance_ratio,
        "avg_bank_balance_inr": f.avg_bank_balance_inr,
        "bounced_cheques_12m": f.bounced_cheques_12m,
        "existing_loan_obligations_inr": f.existing_loan_obligations_inr,
        "utility_payment_consistency": f.utility_payment_consistency,
        "telecom_footprint_score": f.telecom_footprint_score,
        "digital_footprint_score": f.digital_footprint_score,
        "top_customer_concentration_pct": f.top_customer_concentration_pct,
        "vintage_years": f.vintage_years,
    }


def _decision_to_dict(d) -> dict:
    return {
        "id": d.id,
        "msme_id": d.msme_id,
        "score_run_id": d.score_run_id,
        "outcome": d.outcome.value if hasattr(d.outcome, "value") else str(d.outcome),
        "recommended_limit_inr": d.recommended_limit_inr,
        "reason_codes": list(d.reason_codes or []),
        "rationale": d.rationale,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }
