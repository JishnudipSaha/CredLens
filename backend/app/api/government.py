"""Government / Ecosystem router - portfolio-level credit insights."""
from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.database import get_db
from app.models.decision import Decision, DecisionOutcome
from app.models.msme import MSME
from app.models.score_run import ScoreRun
from app.models.user import User, UserRole

router = APIRouter(prefix="/government", tags=["government"])


@router.get("/portfolio-insights")
def portfolio_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.GOVERNMENT, UserRole.ADMIN)),
) -> dict:
    msmes = db.query(MSME).all()
    runs = db.query(ScoreRun).all()
    decisions = db.query(Decision).all()

    total_msmes = len(msmes)
    latest_run_by_msme: dict[int, ScoreRun] = {}
    for r in runs:
        if r.msme_id not in latest_run_by_msme or r.id > latest_run_by_msme[r.msme_id].id:
            latest_run_by_msme[r.msme_id] = r

    latest_decision_by_msme: dict[int, Decision] = {}
    for d in decisions:
        if d.msme_id not in latest_decision_by_msme or d.id > latest_decision_by_msme[d.msme_id].id:
            latest_decision_by_msme[d.msme_id] = d

    grade_dist = Counter(r.risk_grade for r in latest_run_by_msme.values())
    decision_dist = Counter(d.outcome.value for d in latest_decision_by_msme.values())
    sector_dist = Counter(m.sector for m in msmes)
    state_dist = Counter(m.state for m in msmes)
    avg_score = round(
        sum(r.credit_score for r in latest_run_by_msme.values()) / max(len(latest_run_by_msme), 1), 2
    )
    total_exposure_inr = round(
        sum(d.recommended_limit_inr for d in latest_decision_by_msme.values()), 2
    )

    return {
        "total_msmes": total_msmes,
        "scored_msmes": len(latest_run_by_msme),
        "avg_credit_score": avg_score,
        "total_recommended_exposure_inr": total_exposure_inr,
        "grade_distribution": dict(grade_dist),
        "decision_distribution": dict(decision_dist),
        "sector_distribution": dict(sector_dist),
        "state_distribution": dict(state_dist),
    }
