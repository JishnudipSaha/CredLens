"""MSME schemas - profile + financial snapshot + ingestion payloads."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

import re


_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")


class FinancialIngest(BaseModel):
    """Layer 1 - financial data ingestion payload (bank stmt / GST / ITR / balance sheet)."""
    bank_statements: list[dict] = Field(default_factory=list)
    gst_returns: list[dict] = Field(default_factory=list)
    itr_filings: list[dict] = Field(default_factory=list)
    balance_sheet: dict | None = None


class BusinessIngest(BaseModel):
    """Layer 1 - business data: invoices, POs, bills."""
    invoices: list[dict] = Field(default_factory=list)
    purchase_orders: list[dict] = Field(default_factory=list)
    bills: list[dict] = Field(default_factory=list)


class AlternativeIngest(BaseModel):
    """Layer 1 - alternative data: utility, telecom, digital."""
    utility_payments: list[dict] = Field(default_factory=list)
    telecom_data: dict | None = None
    digital_footprint: dict | None = None


class GovernmentIngest(BaseModel):
    """Layer 1 - simulated MCA / GSTN / Udyam / CIBIL pulls."""
    mca_data: dict | None = None
    gstin_data: dict | None = None
    udyam_data: dict | None = None
    cibil_score: int | None = Field(default=None, ge=300, le=900)
    cibil_accounts: list[dict] = Field(default_factory=list)


class ManualIngest(BaseModel):
    """Layer 1 - anything uploaded manually by the MSME."""
    notes: str | None = None
    documents: list[dict] = Field(default_factory=list)


class IngestResult(BaseModel):
    msme_id: int
    data_type: str
    accepted_records: int
    rejected_records: int
    validation_errors: list[str] = Field(default_factory=list)


class MSMEProfile(BaseModel):
    id: int
    legal_name: str
    trade_name: str | None
    gstin: str | None
    pan: str | None
    sector: str
    state: str
    city: str
    annual_turnover_inr: float

    class Config:
        from_attributes = True


class MSMEFinancialsOut(BaseModel):
    avg_monthly_revenue_inr: float
    revenue_trend_pct: float
    ebitda_margin_pct: float
    gst_filings_expected: int
    gst_filings_done: int
    gst_compliance_ratio: float
    avg_bank_balance_inr: float
    bounced_cheques_12m: int
    existing_loan_obligations_inr: float
    utility_payment_consistency: float
    telecom_footprint_score: float
    digital_footprint_score: float
    top_customer_concentration_pct: float
    vintage_years: float

    class Config:
        from_attributes = True


class MSMEFull(MSMEProfile):
    financials: MSMEFinancialsOut | None = None
    created_at: datetime
    updated_at: datetime


class MSMEListItem(BaseModel):
    id: int
    legal_name: str
    sector: str
    state: str
    city: str
    annual_turnover_inr: float
    latest_score: int | None = None
    latest_grade: str | None = None
    latest_decision: str | None = None

    class Config:
        from_attributes = True


class MSMEUpsert(BaseModel):
    legal_name: str = Field(min_length=2, max_length=255)
    trade_name: str | None = None
    gstin: str | None = None
    pan: str | None = None
    udyam_number: str | None = None
    sector: str
    sub_sector: str | None = None
    state: str
    city: str
    incorporation_date: datetime | None = None
    employee_count: int = 0
    annual_turnover_inr: float = 0.0

    @field_validator("gstin")
    @classmethod
    def _validate_gstin(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper().strip()
        if not _GSTIN_RE.match(v):
            raise ValueError("Invalid GSTIN format")
        return v

    @field_validator("pan")
    @classmethod
    def _validate_pan(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.upper().strip()
        if not _PAN_RE.match(v):
            raise ValueError("Invalid PAN format")
        return v
