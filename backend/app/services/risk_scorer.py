"""
Layer 2 - Risk Scorer.
Hybrid engine:
  1. Rule layer: hard constraints and transparent penalties
  2. ML layer: GradientBoosting trained on synthetic data (artifacts/risk_model.pkl)

Outputs: credit_score (300-900), risk_grade (A-F), pd_default_12m, red_flags, breakdown.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import joblib
import numpy as np
from sqlalchemy.orm import Session

from app.config import settings
from app.models.msme import MSME, MSMEFinancials
from app.services.feature_engine import FEATURE_NAMES, build_features, feature_vector

log = logging.getLogger(__name__)


# ---------- rule layer ----------

def _apply_rules(features: dict, breakdown: dict, red_flags: list[str]) -> int:
    """Return a 0-100 score penalty and populate red_flags. Higher = worse risk."""
    penalty = 0
    if features["gst_compliance_ratio"] < 0.6:
        penalty += 35
        red_flags.append("GST compliance below 60%")
    elif features["gst_compliance_ratio"] < 0.8:
        penalty += 15
        red_flags.append("Inconsistent GST filings")

    if features["bounced_cheques_12m"] >= 3:
        penalty += 30
        red_flags.append(f"High bounced cheques: {int(features['bounced_cheques_12m'])} in last 12 months")
    elif features["bounced_cheques_12m"] >= 1:
        penalty += 10

    if features["revenue_trend_pct"] < -20:
        penalty += 20
        red_flags.append(f"Revenue declined {abs(features['revenue_trend_pct']):.0f}% over period")
    elif features["revenue_trend_pct"] < -5:
        penalty += 8

    if features["top_customer_concentration_pct"] > 0.7:
        penalty += 15
        red_flags.append(f"Customer concentration risk: {features['top_customer_concentration_pct']*100:.0f}% from top customer")
    elif features["top_customer_concentration_pct"] > 0.5:
        penalty += 6

    if features["debt_to_revenue_ratio"] > 0.5:
        penalty += 20
        red_flags.append("Debt exceeds 50% of annual revenue")
    elif features["debt_to_revenue_ratio"] > 0.3:
        penalty += 8

    if features["liquidity_ratio"] < 0.05:
        penalty += 15
        red_flags.append("Low liquidity: bank balance <5% of annual revenue")

    if features["vintage_years"] < 1:
        penalty += 8
        red_flags.append("Business vintage under 1 year")
    elif features["vintage_years"] < 3:
        penalty += 3

    if features["utility_payment_consistency"] < 0.8:
        penalty += 10
        red_flags.append("Inconsistent utility payments")

    if features["avg_monthly_revenue_inr"] <= 0:
        penalty += 25
        red_flags.append("No revenue data available")

    breakdown["rules_penalty"] = penalty
    return min(penalty, 100)


# ---------- grade mapping ----------

GRADE_BANDS = [
    (800, "A"), (740, "B"), (680, "C"),
    (620, "D"), (560, "E"), (0,   "F"),
]


def score_to_grade(score: int) -> str:
    for threshold, grade in GRADE_BANDS:
        if score >= threshold:
            return grade
    return "F"


# ---------- ML model loading ----------

_model = None
_model_version: str = "v1.0-synthetic"


def _load_model() -> None:
    global _model
    if _model is not None:
        return
    if not settings.model_path.exists():
        log.warning("ML model not found at %s - run train_synthetic.py first", settings.model_path)
        return
    try:
        _model = joblib.load(settings.model_path)
        log.info("Loaded risk model from %s", settings.model_path)
    except Exception as exc:
        log.error("Failed to load model: %s", exc)
        _model = None


def model_version() -> str:
    return _model_version


# ---------- public entry ----------

def score_msme(
    db: Session, msme: MSME, financials: MSMEFinancials | None
) -> dict:
    """Return a dict with credit_score, risk_grade, pd_default_12m, red_flags, breakdown."""
    _load_model()
    features = build_features(msme, financials)
    breakdown: dict = {"model_version": model_version(), "features": {k: round(v, 4) for k, v in features.items()}}
    red_flags: list[str] = []

    rule_penalty = _apply_rules(features, breakdown, red_flags)

    # ML layer
    if _model is not None:
        try:
            x = np.array([feature_vector(features)], dtype=float)
            prob_default = float(_model.predict_proba(x)[0, 1])
            # Map PD -> 300-900 score
            ml_score = int(round(900 - (prob_default * 600)))
            ml_score = max(300, min(900, ml_score))
            breakdown["pd_default_12m"] = round(prob_default, 4)
            breakdown["ml_score"] = ml_score
        except Exception as exc:
            log.exception("Model inference failed: %s", exc)
            ml_score = 600
            prob_default = 0.5
    else:
        # Fallback heuristic if model is missing - still produce a reasonable score
        healthy_features = (
            features["gst_compliance_ratio"] * 100
            + features["utility_payment_consistency"] * 50
            + min(features["avg_monthly_revenue_inr"] / 100000, 100)
            - features["debt_to_revenue_ratio"] * 100
        )
        ml_score = int(max(300, min(900, 500 + healthy_features)))
        prob_default = float(max(0.0, min(1.0, 1.0 - (ml_score - 300) / 600)))
        breakdown["pd_default_12m"] = round(prob_default, 4)
        breakdown["ml_score"] = ml_score
        breakdown["fallback"] = "heuristic (no model)"

    # Combine: subtract rule penalty as a deduction on the ML score
    final_score = int(max(300, min(900, ml_score - rule_penalty)))
    grade = score_to_grade(final_score)
    breakdown["final_score"] = final_score
    breakdown["grade"] = grade

    return {
        "credit_score": final_score,
        "risk_grade": grade,
        "pd_default_12m": round(prob_default, 4),
        "red_flags": red_flags,
        "score_breakdown": breakdown,
        "model_version": model_version(),
    }
