"""Decision - Layer 3 output: approve / review / reject + reason codes + limit."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DecisionOutcome(str, enum.Enum):
    APPROVE = "APPROVE"
    REVIEW = "REVIEW"
    REJECT = "REJECT"


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    msme_id: Mapped[int] = mapped_column(ForeignKey("msmes.id", ondelete="CASCADE"), index=True)
    score_run_id: Mapped[int] = mapped_column(ForeignKey("score_runs.id", ondelete="CASCADE"), index=True)
    decided_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    outcome: Mapped[DecisionOutcome] = mapped_column(Enum(DecisionOutcome), index=True)
    recommended_limit_inr: Mapped[float] = mapped_column(Float, default=0.0)
    reason_codes: Mapped[list] = mapped_column(JSON, default=list)   # ["GRADE_B_OK", ...]
    rationale: Mapped[str] = mapped_column(String(1024), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
