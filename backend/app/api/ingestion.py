"""Layer 1 - Data Ingestion API endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.msme import MSME
from app.models.user import User
from app.schemas.msme import (
    AlternativeIngest,
    BusinessIngest,
    FinancialIngest,
    GovernmentIngest,
    IngestResult,
    ManualIngest,
)
from app.services.ingestion_service import (
    derive_financials,
    ingest_alternative,
    ingest_business,
    ingest_financial,
    ingest_government,
    ingest_manual,
)


router = APIRouter(prefix="/ingest", tags=["ingestion"])


def _load_msme(db: Session, msme_id: int) -> MSME:
    m = db.get(MSME, msme_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "MSME not found")
    return m


@router.post("/financial/{msme_id}", response_model=IngestResult)
def ingest_financial_endpoint(
    msme_id: int,
    payload: FinancialIngest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngestResult:
    msme = _load_msme(db, msme_id)
    result = ingest_financial(db, msme, payload)
    derive_financials(db, msme)
    db.commit()
    return result


@router.post("/business/{msme_id}", response_model=IngestResult)
def ingest_business_endpoint(
    msme_id: int,
    payload: BusinessIngest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngestResult:
    msme = _load_msme(db, msme_id)
    result = ingest_business(db, msme, payload)
    db.commit()
    return result


@router.post("/alternative/{msme_id}", response_model=IngestResult)
def ingest_alternative_endpoint(
    msme_id: int,
    payload: AlternativeIngest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngestResult:
    msme = _load_msme(db, msme_id)
    result = ingest_alternative(db, msme, payload)
    derive_financials(db, msme)
    db.commit()
    return result


@router.post("/government/{msme_id}", response_model=IngestResult)
def ingest_government_endpoint(
    msme_id: int,
    payload: GovernmentIngest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngestResult:
    msme = _load_msme(db, msme_id)
    result = ingest_government(db, msme, payload)
    derive_financials(db, msme)
    db.commit()
    return result


@router.post("/manual/{msme_id}", response_model=IngestResult)
def ingest_manual_endpoint(
    msme_id: int,
    payload: ManualIngest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngestResult:
    msme = _load_msme(db, msme_id)
    result = ingest_manual(db, msme, payload)
    db.commit()
    return result
