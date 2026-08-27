"""MSME profile + financials (Layer 1 of the block diagram)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MSME(Base):
    __tablename__ = "msmes"

    id: Mapped[int] = mapped_column(primary_key=True)
    legal_name: Mapped[str] = mapped_column(String(255), index=True)
    trade_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(15), unique=True, index=True, nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), unique=True, index=True, nullable=True)
    udyam_number: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)

    sector: Mapped[str] = mapped_column(String(64), index=True)  # manufacturing, retail, services, IT, ...
    sub_sector: Mapped[str | None] = mapped_column(String(128), nullable=True)
    state: Mapped[str] = mapped_column(String(64))
    city: Mapped[str] = mapped_column(String(64))

    incorporation_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    employee_count: Mapped[int] = mapped_column(Integer, default=0)
    annual_turnover_inr: Mapped[float] = mapped_column(Float, default=0.0)

    # raw ingested payloads
    raw_financial: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_business: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_alternative: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_government: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_manual: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    financials: Mapped["MSMEFinancials"] = relationship(
        "MSMEFinancials", back_populates="msme", uselist=False, cascade="all, delete-orphan"
    )


class MSMEFinancials(Base):
    """Computed / curated financial snapshot per MSME - input to Layer 2."""

    __tablename__ = "msme_financials"

    id: Mapped[int] = mapped_column(primary_key=True)
    msme_id: Mapped[int] = mapped_column(ForeignKey("msmes.id", ondelete="CASCADE"), unique=True)

    # Revenue & profitability (last 6 months average where applicable)
    avg_monthly_revenue_inr: Mapped[float] = mapped_column(Float, default=0.0)
    revenue_trend_pct: Mapped[float] = mapped_column(Float, default=0.0)  # 6m change
    ebitda_margin_pct: Mapped[float] = mapped_column(Float, default=0.0)

    # GST compliance
    gst_filings_expected: Mapped[int] = mapped_column(Integer, default=6)
    gst_filings_done: Mapped[int] = mapped_column(Integer, default=6)
    gst_compliance_ratio: Mapped[float] = mapped_column(Float, default=1.0)

    # Banking
    avg_bank_balance_inr: Mapped[float] = mapped_column(Float, default=0.0)
    bounced_cheques_12m: Mapped[int] = mapped_column(Integer, default=0)
    existing_loan_obligations_inr: Mapped[float] = mapped_column(Float, default=0.0)

    # Alternative data
    utility_payment_consistency: Mapped[float] = mapped_column(Float, default=1.0)  # 0-1
    telecom_footprint_score: Mapped[float] = mapped_column(Float, default=0.5)      # 0-1
    digital_footprint_score: Mapped[float] = mapped_column(Float, default=0.5)     # 0-1

    # Customer concentration
    top_customer_concentration_pct: Mapped[float] = mapped_column(Float, default=0.0)

    # Business vintage (years)
    vintage_years: Mapped[float] = mapped_column(Float, default=0.0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    msme: Mapped[MSME] = relationship("MSME", back_populates="financials")
