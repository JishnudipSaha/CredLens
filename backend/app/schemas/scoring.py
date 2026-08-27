"""Scoring & decision schemas - Layer 2 and Layer 3 outputs."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.decision import DecisionOutcome


class ScoreRequest(BaseModel):
    msme_id: int
    policy_id: int | None = None  # if None, use default active policy


class ScoreRunOut(BaseModel):
    id: int
    msme_id: int
    model_version: str
    credit_score: int
    risk_grade: str
    pd_default_12m: float
    red_flags: list[str]
    score_breakdown: dict
    created_at: datetime

    class Config:
        from_attributes = True


class DecisionRequest(BaseModel):
    score_run_id: int
    policy_id: int | None = None


class DecisionOut(BaseModel):
    id: int
    msme_id: int
    score_run_id: int
    outcome: DecisionOutcome
    recommended_limit_inr: float
    reason_codes: list[str]
    rationale: str
    created_at: datetime

    class Config:
        from_attributes = True


class CreditReport(BaseModel):
    """Composite output: full MSME snapshot + score + decision."""
    msme: dict
    financials: dict | None
    score: ScoreRunOut | None
    decision: DecisionOut | None
    policy_used: dict | None
