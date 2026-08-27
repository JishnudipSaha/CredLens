"""Policy - dealer-configurable rules used by the Decision Engine."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    description: Mapped[str] = mapped_column(String(512), default="")

    # Thresholds
    min_credit_score: Mapped[int] = mapped_column(Integer, default=650)
    min_gst_compliance: Mapped[float] = mapped_column(Float, default=0.7)         # 0-1
    max_bounced_cheques: Mapped[int] = mapped_column(Integer, default=2)
    min_vintage_years: Mapped[float] = mapped_column(Float, default=1.0)
    min_avg_monthly_revenue_inr: Mapped[float] = mapped_column(Float, default=100000.0)
    max_customer_concentration_pct: Mapped[float] = mapped_column(Float, default=0.7)

    # Limit engine multipliers
    limit_multiplier_a: Mapped[float] = mapped_column(Float, default=0.5)
    limit_multiplier_b: Mapped[float] = mapped_column(Float, default=0.35)
    limit_multiplier_c: Mapped[float] = mapped_column(Float, default=0.2)
    limit_multiplier_d: Mapped[float] = mapped_column(Float, default=0.1)
    limit_multiplier_e: Mapped[float] = mapped_column(Float, default=0.05)
    limit_multiplier_f: Mapped[float] = mapped_column(Float, default=0.0)

    grade_thresholds: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "A": 800, "B": 740, "C": 680, "D": 620, "E": 560, "F": 300,
    })

    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
