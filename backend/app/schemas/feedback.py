"""Feedback & policy schemas - Feedback Loop + admin policy management."""
from __future__ import annotations

import enum
from datetime import datetime

from pydantic import BaseModel, Field


class FeedbackOutcome(str, enum.Enum):
    PAID_ON_TIME = "PAID_ON_TIME"
    DELAYED = "DELAYED"
    PARTIAL_DEFAULT = "PARTIAL_DEFAULT"
    NPA = "NPA"


class FeedbackRequest(BaseModel):
    decision_id: int
    outcome: FeedbackOutcome
    days_past_due: int = Field(default=0, ge=0, le=365)
    notes: str | None = None


class PolicyOut(BaseModel):
    id: int
    name: str
    description: str
    min_credit_score: int
    min_gst_compliance: float
    max_bounced_cheques: int
    min_vintage_years: float
    min_avg_monthly_revenue_inr: float
    max_customer_concentration_pct: float
    limit_multiplier_a: float
    limit_multiplier_b: float
    limit_multiplier_c: float
    limit_multiplier_d: float
    limit_multiplier_e: float
    limit_multiplier_f: float
    grade_thresholds: dict
    is_active: bool

    class Config:
        from_attributes = True


class PolicyUpdate(BaseModel):
    min_credit_score: int | None = None
    min_gst_compliance: float | None = None
    max_bounced_cheques: int | None = None
    min_vintage_years: float | None = None
    min_avg_monthly_revenue_inr: float | None = None
    max_customer_concentration_pct: float | None = None
    limit_multiplier_a: float | None = None
    limit_multiplier_b: float | None = None
    limit_multiplier_c: float | None = None
    limit_multiplier_d: float | None = None
    limit_multiplier_e: float | None = None
    limit_multiplier_f: float | None = None


class AuditLogOut(BaseModel):
    id: int
    action: str
    actor_user_id: int | None
    msme_id: int | None
    score_run_id: int | None
    decision_id: int | None
    endpoint: str | None
    status_code: int | None
    latency_ms: int | None
    details: dict
    created_at: datetime

    class Config:
        from_attributes = True


class ModelMonitorStats(BaseModel):
    model_version: str
    total_score_runs: int
    total_decisions: int
    total_feedback: int
    avg_credit_score: float
    grade_distribution: dict[str, int]
    decision_distribution: dict[str, int]
    feedback_distribution: dict[str, int]
