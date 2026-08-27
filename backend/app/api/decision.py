"""Layer 3 - Decision API: list/filter decisions, fetch single decision."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.decision import Decision, DecisionOutcome
from app.models.user import User
from app.schemas.scoring import DecisionOut


router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.get("", response_model=list[DecisionOut])
def list_decisions(
    outcome: DecisionOutcome | None = None,
    msme_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DecisionOut]:
    q = db.query(Decision)
    if outcome:
        q = q.filter(Decision.outcome == outcome)
    if msme_id:
        q = q.filter(Decision.msme_id == msme_id)
    rows = q.order_by(Decision.id.desc()).limit(limit).all()
    return [DecisionOut.model_validate(r) for r in rows]


@router.get("/{decision_id}", response_model=DecisionOut)
def get_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DecisionOut:
    d = db.get(Decision, decision_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Decision not found")
    return DecisionOut.model_validate(d)
