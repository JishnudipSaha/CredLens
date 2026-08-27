"""Feedback Loop - capture real-world outcomes of decisions for model retraining."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction, AuditLog
from app.models.decision import Decision
from app.schemas.feedback import FeedbackOutcome, FeedbackRequest


# Outcome -> numeric label for retraining (1 = default, 0 = good)
OUTCOME_LABEL = {
    FeedbackOutcome.PAID_ON_TIME: 0.0,
    FeedbackOutcome.DELAYED: 0.3,
    FeedbackOutcome.PARTIAL_DEFAULT: 0.7,
    FeedbackOutcome.NPA: 1.0,
}


def record_feedback(db: Session, payload: FeedbackRequest, user_id: int | None) -> dict:
    decision = db.get(Decision, payload.decision_id)
    if not decision:
        raise ValueError(f"Decision {payload.decision_id} not found")

    details = {
        "outcome": payload.outcome.value,
        "label": OUTCOME_LABEL[payload.outcome],
        "days_past_due": payload.days_past_due,
        "notes": payload.notes,
    }
    AuditLog.log(
        db, action=AuditAction.FEEDBACK,
        actor_user_id=user_id, msme_id=decision.msme_id,
        score_run_id=decision.score_run_id, decision_id=decision.id,
        details=details,
    )
    return details
