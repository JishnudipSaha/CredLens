"""Admin router - user management, policy management, model monitoring, audit log."""
from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.audit_log import AuditAction, AuditLog
from app.models.decision import Decision, DecisionOutcome
from app.models.policy import Policy
from app.models.score_run import ScoreRun
from app.models.user import User, UserRole
from app.schemas.auth import UserOut
from app.schemas.feedback import (
    AuditLogOut,
    ModelMonitorStats,
    PolicyOut,
    PolicyUpdate,
)


router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- users ----------

@router.get("/users", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[UserOut]:
    rows = db.query(User).order_by(User.id.asc()).all()
    return [UserOut.model_validate(u) for u in rows]


# ---------- policies ----------

@router.get("/policies", response_model=list[PolicyOut])
def list_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.LENDER)),
) -> list[PolicyOut]:
    rows = db.query(Policy).order_by(Policy.id.asc()).all()
    return [PolicyOut.model_validate(p) for p in rows]


@router.put("/policies/{policy_id}", response_model=PolicyOut)
def update_policy(
    policy_id: int,
    payload: PolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> PolicyOut:
    p = db.get(Policy, policy_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Policy not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    AuditLog.log(db, action=AuditAction.POLICY_UPDATE, actor_user_id=current_user.id,
                 details={"policy_id": policy_id, "changes": payload.model_dump(exclude_unset=True)})
    db.commit()
    db.refresh(p)
    return PolicyOut.model_validate(p)


# ---------- audit log ----------

@router.get("/audit-log", response_model=list[AuditLogOut])
def list_audit_log(
    action: AuditAction | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[AuditLogOut]:
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    rows = q.order_by(AuditLog.id.desc()).limit(limit).all()
    return [AuditLogOut.model_validate(r) for r in rows]


# ---------- model monitor ----------

@router.get("/model-monitor", response_model=ModelMonitorStats)
def model_monitor(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.LENDER)),
) -> ModelMonitorStats:
    runs = db.query(ScoreRun).all()
    decisions = db.query(Decision).all()
    feedback_rows = db.query(AuditLog).filter(AuditLog.action == AuditAction.FEEDBACK).all()

    grade_counter: Counter = Counter(r.risk_grade for r in runs)
    decision_counter: Counter = Counter(d.outcome.value for d in decisions)
    feedback_counter: Counter = Counter(
        (r.details or {}).get("outcome", "UNKNOWN") for r in feedback_rows
    )
    avg_score = round(sum(r.credit_score for r in runs) / len(runs), 2) if runs else 0.0
    model_version = runs[-1].model_version if runs else "v1.0-synthetic"

    return ModelMonitorStats(
        model_version=model_version,
        total_score_runs=len(runs),
        total_decisions=len(decisions),
        total_feedback=len(feedback_rows),
        avg_credit_score=avg_score,
        grade_distribution=dict(grade_counter),
        decision_distribution=dict(decision_counter),
        feedback_distribution=dict(feedback_counter),
    )


# ---------- retrain trigger ----------

@router.post("/model/retrain")
def retrain(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict:
    from app.ml import train_synthetic
    result = train_synthetic.train_and_save()
    AuditLog.log(db, action=AuditAction.MODEL_RETRAIN, actor_user_id=current_user.id,
                 details=result)
    db.commit()
    return {"status": "ok", "metrics": result}
