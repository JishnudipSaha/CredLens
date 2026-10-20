"""Top-level orchestrator: ingestion -> scoring -> decision in one call."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction, AuditLog
from app.models.decision import Decision, DecisionOutcome
from app.models.msme import MSME
from app.models.policy import Policy
from app.models.score_run import ScoreRun
from app.services import feature_engine
from app.services.ingestion_service import derive_financials
from app.services.policy_engine import (
    calculate_nayak_mpbf,
    decide,
    evaluate_policy,
    generate_sanction_covenants,
    recommend_limit,
)
from app.services.risk_scorer import score_msme


def get_default_policy(db: Session) -> Policy:
    policy = db.query(Policy).filter(Policy.is_active.is_(True)).first()
    if policy is None:
        # Fallback in case seed hasn't run yet
        policy = Policy(name="default-fallback", is_active=True)
        db.add(policy)
        db.flush()
    return policy


def run_assessment(db: Session, msme: MSME, triggered_by_user_id: int | None = None) -> dict:
    """Run ingestion derivation, scoring, and decision end-to-end.

    Returns a dict with score_run, decision, features, breakdown, policy.
    """
    # Step 1: ensure financials are derived from any newly ingested data
    financials = derive_financials(db, msme)

    # Policy is needed by scoring (grade bands) and decision (score bands)
    policy = get_default_policy(db)

    # Step 2: Layer 2 - scoring
    score_out = score_msme(db, msme, financials, policy=policy)
    features = feature_engine.build_features(msme, financials)

    score_run = ScoreRun(
        msme_id=msme.id,
        triggered_by_user_id=triggered_by_user_id,
        model_version=score_out["model_version"],
        credit_score=score_out["credit_score"],
        risk_grade=score_out["risk_grade"],
        pd_default_12m=score_out["pd_default_12m"],
        red_flags=score_out["red_flags"],
        feature_snapshot=features,
        score_breakdown=score_out["score_breakdown"],
    )
    db.add(score_run)
    db.flush()
    AuditLog.log(db, action=AuditAction.SCORE, msme_id=msme.id,
                 score_run_id=score_run.id,
                 details={"score": score_run.credit_score, "grade": score_run.risk_grade})

    # Step 3: Layer 3 - decision
    evaluation = evaluate_policy(
        score=score_run.credit_score,
        grade=score_run.risk_grade,
        features=features,
        policy=policy,
        financials=financials,
    )
    limit = recommend_limit(
        avg_monthly_revenue_inr=financials.avg_monthly_revenue_inr if financials else 0.0,
        grade=score_run.risk_grade,
        policy=policy,
    )
    outcome, rationale = decide(
        score=score_run.credit_score,
        grade=score_run.risk_grade,
        eval_result=evaluation,
        limit=limit,
        policy=policy,
    )
    reason_codes = evaluation.reasons + evaluation.violations + evaluation.hard_reject_reasons

    # Nayak Committee Working Capital MPBF & Institutional Covenants
    mpbf_data = calculate_nayak_mpbf(
        financials.avg_monthly_revenue_inr if financials else 0.0,
        score_run.risk_grade,
    )
    covenants = generate_sanction_covenants(
        outcome=outcome,
        grade=score_run.risk_grade,
        limit=limit,
        mpbf_data=mpbf_data,
    )
    term_loan_limit = (
        round(max(0.0, ((financials.avg_monthly_revenue_inr * 12 * (financials.ebitda_margin_pct / 100) * 0.75) / 1.25) * 2.5), 2)
        if financials and financials.ebitda_margin_pct > 0
        else 0.0
    )

    decision = Decision(
        msme_id=msme.id,
        score_run_id=score_run.id,
        decided_by_user_id=triggered_by_user_id,
        outcome=outcome,
        recommended_limit_inr=limit,
        reason_codes=reason_codes,
        rationale=rationale,
        covenants=covenants,
        working_capital_mpbf_inr=mpbf_data.get("sanctioned_limit_inr", 0.0),
        term_loan_limit_inr=term_loan_limit,
        underwriting_summary=mpbf_data,
    )
    db.add(decision)
    db.flush()
    AuditLog.log(db, action=AuditAction.DECIDE, msme_id=msme.id,
                 score_run_id=score_run.id, decision_id=decision.id,
                 details={"outcome": outcome.value, "limit": limit})

    return {
        "score_run": score_run,
        "decision": decision,
        "features": features,
        "policy": policy,
    }


def decide_existing_score_run(
    db: Session, score_run: ScoreRun, policy: Policy | None = None,
    decided_by_user_id: int | None = None,
) -> Decision:
    """Re-run only the decision step on an existing score_run (for policy changes)."""
    if policy is None:
        policy = get_default_policy(db)
    msme = db.get(MSME, score_run.msme_id)
    financials = msme.financials if msme else None
    features = feature_engine.build_features(msme, financials) if msme else {}
    evaluation = evaluate_policy(
        score=score_run.credit_score,
        grade=score_run.risk_grade,
        features=features,
        policy=policy,
        financials=financials,
    )
    limit = recommend_limit(
        avg_monthly_revenue_inr=financials.avg_monthly_revenue_inr if financials else 0.0,
        grade=score_run.risk_grade,
        policy=policy,
    )
    outcome, rationale = decide(
        score=score_run.credit_score,
        grade=score_run.risk_grade,
        eval_result=evaluation,
        limit=limit,
        policy=policy,
    )
    mpbf_data = calculate_nayak_mpbf(
        financials.avg_monthly_revenue_inr if financials else 0.0,
        score_run.risk_grade,
    )
    covenants = generate_sanction_covenants(
        outcome=outcome,
        grade=score_run.risk_grade,
        limit=limit,
        mpbf_data=mpbf_data,
    )
    decision = Decision(
        msme_id=score_run.msme_id,
        score_run_id=score_run.id,
        decided_by_user_id=decided_by_user_id,
        outcome=outcome,
        recommended_limit_inr=limit,
        reason_codes=evaluation.reasons + evaluation.violations + evaluation.hard_reject_reasons,
        rationale=rationale,
        covenants=covenants,
        working_capital_mpbf_inr=mpbf_data.get("sanctioned_limit_inr", 0.0),
        term_loan_limit_inr=0.0,
        underwriting_summary=mpbf_data,
    )
    db.add(decision)
    db.flush()
    AuditLog.log(db, action=AuditAction.DECIDE, msme_id=score_run.msme_id,
                 score_run_id=score_run.id, decision_id=decision.id,
                 details={"outcome": outcome.value, "limit": limit, "trigger": "policy_update"})
    return decision
