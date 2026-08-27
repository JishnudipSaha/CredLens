"""MSME CRUD + listing + detail."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.decision import Decision
from app.models.msme import MSME
from app.models.score_run import ScoreRun
from app.models.user import User, UserRole
from app.schemas.msme import MSMEFull, MSMEListItem, MSMEUpsert


router = APIRouter(prefix="/msmes", tags=["msmes"])


@router.get("", response_model=list[MSMEListItem])
def list_msmes(
    q: str | None = Query(default=None, description="Search by name / city / sector"),
    sector: str | None = None,
    state: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MSMEListItem]:
    query = db.query(MSME)
    if q:
        like = f"%{q}%"
        query = query.filter((MSME.legal_name.ilike(like)) | (MSME.city.ilike(like)) | (MSME.sector.ilike(like)))
    if sector:
        query = query.filter(MSME.sector == sector)
    if state:
        query = query.filter(MSME.state == state)
    rows = query.order_by(MSME.legal_name.asc()).limit(limit).all()

    out: list[MSMEListItem] = []
    for m in rows:
        latest_score_run = (
            db.query(ScoreRun).filter(ScoreRun.msme_id == m.id).order_by(ScoreRun.id.desc()).first()
        )
        latest_decision = (
            db.query(Decision).filter(Decision.msme_id == m.id).order_by(Decision.id.desc()).first()
        )
        out.append(MSMEListItem(
            id=m.id,
            legal_name=m.legal_name,
            sector=m.sector,
            state=m.state,
            city=m.city,
            annual_turnover_inr=m.annual_turnover_inr,
            latest_score=latest_score_run.credit_score if latest_score_run else None,
            latest_grade=latest_score_run.risk_grade if latest_score_run else None,
            latest_decision=latest_decision.outcome.value if latest_decision else None,
        ))
    return out


@router.post("", response_model=MSMEFull, status_code=status.HTTP_201_CREATED)
def create_msme(
    payload: MSMEUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MSMEFull:
    if payload.gstin and db.query(MSME).filter(MSME.gstin == payload.gstin).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "MSME with this GSTIN already exists")
    m = MSME(**payload.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return MSMEFull.model_validate(m)


@router.get("/{msme_id}", response_model=MSMEFull)
def get_msme(
    msme_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MSMEFull:
    m = db.get(MSME, msme_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSME not found")
    return MSMEFull.model_validate(m)


@router.put("/{msme_id}", response_model=MSMEFull)
def update_msme(
    msme_id: int,
    payload: MSMEUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MSMEFull:
    m = db.get(MSME, msme_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSME not found")
    for k, v in payload.model_dump().items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return MSMEFull.model_validate(m)
