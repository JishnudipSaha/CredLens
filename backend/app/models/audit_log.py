"""AuditLog - platform monitoring + Feedback Loop (lender-reported outcomes)."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditAction(str, enum.Enum):
    INGEST = "INGEST"
    SCORE = "SCORE"
    DECIDE = "DECIDE"
    LOGIN = "LOGIN"
    FEEDBACK = "FEEDBACK"
    POLICY_UPDATE = "POLICY_UPDATE"
    MODEL_RETRAIN = "MODEL_RETRAIN"


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), index=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    msme_id: Mapped[int | None] = mapped_column(
        ForeignKey("msmes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    score_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("score_runs.id", ondelete="SET NULL"), nullable=True
    )
    decision_id: Mapped[int | None] = mapped_column(
        ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True
    )

    endpoint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    @classmethod
    def log(
        cls,
        db: "Session",  # noqa: F821
        action: AuditAction,
        actor_user_id: int | None = None,
        msme_id: int | None = None,
        score_run_id: int | None = None,
        decision_id: int | None = None,
        endpoint: str | None = None,
        status_code: int | None = None,
        latency_ms: int | None = None,
        details: dict | None = None,
    ) -> "AuditLog":
        entry = cls(
            action=action,
            actor_user_id=actor_user_id,
            msme_id=msme_id,
            score_run_id=score_run_id,
            decision_id=decision_id,
            endpoint=endpoint,
            status_code=status_code,
            latency_ms=latency_ms,
            details=details or {},
        )
        db.add(entry)
        db.flush()
        return entry
