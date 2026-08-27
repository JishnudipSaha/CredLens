"""Feedback Loop - lenders report actual outcomes of decisions."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.database import get_db
from app.models.user import UserRole
from app.schemas.feedback import FeedbackRequest
from app.services.feedback_service import record_feedback

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.LENDER, UserRole.ADMIN)),
) -> dict:
    try:
        details = record_feedback(db, payload, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    db.commit()
    return {"status": "recorded", "details": details}
