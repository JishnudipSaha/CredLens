"""ScoreRun - one record per scoring invocation (Layer 2 output snapshot)."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScoreRun(Base):
    __tablename__ = "score_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    msme_id: Mapped[int] = mapped_column(ForeignKey("msmes.id", ondelete="CASCADE"), index=True)
    triggered_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # model version (e.g. "v1.0-synthetic")
    model_version: Mapped[str] = mapped_column(String(32), default="v1.0-synthetic")

    # Output
    credit_score: Mapped[int] = mapped_column(Integer)             # 300-900
    risk_grade: Mapped[str] = mapped_column(String(2))             # A-F
    pd_default_12m: Mapped[float] = mapped_column(Float)           # probability of default
    red_flags: Mapped[list] = mapped_column(JSON, default=list)    # ["...", "..."]
    feature_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    score_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)  # rule + ml contributions

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
