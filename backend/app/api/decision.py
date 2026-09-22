"""Layer 3 - Decision API: list/filter decisions, fetch single decision."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.decision import Decision, DecisionOutcome
from app.models.score_run import ScoreRun
from app.models.user import User
from app.schemas.scoring import DecisionOut


router = APIRouter(prefix="/decisions", tags=["decisions"])


def _with_scores(db: Session, rows: list[Decision]) -> list[DecisionOut]:
    """Attach credit_score / risk_grade from the related score runs."""
    run_ids = {r.score_run_id for r in rows}
    runs = db.query(ScoreRun).filter(ScoreRun.id.in_(run_ids)).all() if run_ids else []
    run_map = {r.id: r for r in runs}
    out: list[DecisionOut] = []
    for row in rows:
        item = DecisionOut.model_validate(row)
        score_run = run_map.get(row.score_run_id)
        if score_run is not None:
            item.credit_score = score_run.credit_score
            item.risk_grade = score_run.risk_grade
        out.append(item)
    return out


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
    return _with_scores(db, rows)


@router.get("/{decision_id}", response_model=DecisionOut)
def get_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DecisionOut:
    d = db.get(Decision, decision_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Decision not found")
    return _with_scores(db, [d])[0]
