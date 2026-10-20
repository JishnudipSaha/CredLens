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

def _apply_rules(features: dict, breakdown: dict, red_flags: list[str], financials: MSMEFinancials | None = None) -> int:
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

    # Institutional banking rules (DSCR, CIBIL CMR, DPD, Triangulation)
    if financials is not None:
        if financials.existing_loan_obligations_inr > 0:
            if getattr(financials, "dscr", 1.5) < 1.0:
                penalty += 20
                red_flags.append(f"DSCR critical: {financials.dscr:.2f}x (operating cash insufficient to service debt)")
            elif getattr(financials, "dscr", 1.5) < 1.25:
                penalty += 8
                red_flags.append(f"DSCR weak: {financials.dscr:.2f}x below banking benchmark 1.25x")

        cmr = getattr(financials, "cibil_cmr_rank", 3)
        if cmr >= 8:
            penalty += 20
            red_flags.append(f"CIBIL CMR Rank {cmr}: Elevated commercial bureau risk")
        elif cmr >= 6:
            penalty += 8
            red_flags.append(f"CIBIL CMR Rank {cmr}: Moderate bureau delinquency risk")

        max_dpd = getattr(financials, "max_dpd_12m", 0)
        if max_dpd >= 60:
            penalty += 20
            red_flags.append(f"Significant delinquency: {max_dpd} Days Past Due in bureau tradelines")
        elif max_dpd >= 30:
            penalty += 8
            red_flags.append(f"Minor delinquency: {max_dpd} Days Past Due in bureau tradelines")

        var_pct = getattr(financials, "gst_vs_bank_turnover_variance_pct", 0.0)
        if abs(var_pct) > 25.0:
            penalty += 12
            red_flags.append(f"Turnover reconciliation mismatch: GST vs Bank variance is {var_pct:.1f}%")

    breakdown["rules_penalty"] = penalty
    return min(penalty, 100)


def _compute_pillars(features: dict, financials: MSMEFinancials | None) -> dict[str, int]:
    """Compute 5 thematic sub-scores (0-100) according to banking standards."""
    dscr = getattr(financials, "dscr", 1.5) if financials else 1.5
    ebitda = features.get("ebitda_margin_pct", 10.0)
    debt_rev = features.get("debt_to_revenue_ratio", 0.1)
    curr_ratio = getattr(financials, "current_ratio", 1.33) if financials else 1.33

    # 1. Financial Strength
    fin_score = 100
    if dscr < 1.0: fin_score -= 35
    elif dscr < 1.25: fin_score -= 15
    if ebitda < 0: fin_score -= 30
    elif ebitda < 8: fin_score -= 12
    if debt_rev > 0.4: fin_score -= 20
    elif debt_rev > 0.25: fin_score -= 10
    if curr_ratio < 1.0: fin_score -= 15
    fin_strength = int(max(10, min(100, fin_score)))

    # 2. Banking Quality
    bank_score = 100
    bounced = features.get("bounced_cheques_12m", 0)
    bank_score -= int(bounced * 20)
    if features.get("liquidity_ratio", 0.1) < 0.05: bank_score -= 25
    cash_ratio = getattr(financials, "cash_withdrawal_ratio", 0.05) if financials else 0.05
    if cash_ratio > 0.20: bank_score -= 20
    banking_quality = int(max(10, min(100, bank_score)))

    # 3. Tax & Statutory Compliance
    gst_ratio = features.get("gst_compliance_ratio", 1.0)
    tax_score = int(gst_ratio * 100)
    var_pct = abs(getattr(financials, "gst_vs_bank_turnover_variance_pct", 0.0) if financials else 0.0)
    if var_pct > 25.0: tax_score -= 20
    elif var_pct > 15.0: tax_score -= 10
    tax_compliance = int(max(10, min(100, tax_score)))

    # 4. Bureau & Tradeline Record
    cmr = getattr(financials, "cibil_cmr_rank", 3) if financials else 3
    dpd = getattr(financials, "max_dpd_12m", 0) if financials else 0
    cmr_map = {1: 98, 2: 92, 3: 85, 4: 78, 5: 68, 6: 58, 7: 48, 8: 38, 9: 25, 10: 15}
    bureau_score = cmr_map.get(cmr, 70)
    if dpd >= 60: bureau_score -= 30
    elif dpd >= 30: bureau_score -= 15
    bureau_record = int(max(10, min(100, bureau_score)))

    # 5. Business Stability & Vintage
    stab_score = 100
    vintage = features.get("vintage_years", 3.0)
    if vintage < 1: stab_score -= 25
    elif vintage < 3: stab_score -= 10
    top_cust = features.get("top_customer_concentration_pct", 0.3)
    if top_cust > 0.65: stab_score -= 25
    elif top_cust > 0.45: stab_score -= 10
    business_stability = int(max(10, min(100, stab_score)))

    return {
        "financial_strength": fin_strength,
        "banking_quality": banking_quality,
        "tax_compliance": tax_compliance,
        "bureau_record": bureau_record,
        "business_stability": business_stability,
    }


# ---------- grade mapping ----------

GRADE_BANDS = [
    (800, "A"), (740, "B"), (680, "C"),
    (620, "D"), (560, "E"), (0,   "F"),
]


def score_to_grade(score: int, policy=None) -> str:
    """Map score -> grade using policy.grade_thresholds when available,
    falling back to the built-in GRADE_BANDS."""
    bands = None
    if policy is not None:
        thresholds = getattr(policy, "grade_thresholds", None)
        if thresholds:
            # thresholds: {"A": 800, ..., "F": 300} -> [(800,"A"), ...] desc
            bands = sorted(
                ((int(v), str(k)) for k, v in thresholds.items()),
                key=lambda kv: -kv[0],
            )
    if not bands:
        bands = GRADE_BANDS
    for threshold, grade in bands:
        if score >= threshold:
            return grade
    return "F"


# ---------- ML model loading ----------

_model = None
_model_version: str = "v1.0-synthetic"


def _load_model() -> None:
    global _model, _model_version
    if _model is not None:
        return
    if not settings.model_path.exists():
        log.warning("ML model not found at %s - run train_synthetic.py first", settings.model_path)
        return
    try:
        _model = joblib.load(settings.model_path)
        # Pick up the version recorded by the trainer (feedback retrains bump it)
        if settings.features_path.exists():
            try:
                meta = json.loads(settings.features_path.read_text())
                _model_version = meta.get("model_version", _model_version)
            except (OSError, ValueError):
                pass
        log.info("Loaded risk model from %s (%s)", settings.model_path, _model_version)
    except Exception as exc:
        log.error("Failed to load model: %s", exc)
        _model = None


def reload_model() -> str:
    """Force a reload from disk (call after retraining) and return the version."""
    global _model
    _model = None
    _load_model()
    return _model_version


def model_version() -> str:
    return _model_version


# ---------- public entry ----------

def score_msme(
    db: Session, msme: MSME, financials: MSMEFinancials | None, policy=None
) -> dict:
    """Return a dict with credit_score, risk_grade, pd_default_12m, red_flags, breakdown."""
    _load_model()
    features = build_features(msme, financials)
    breakdown: dict = {"model_version": model_version(), "features": {k: round(v, 4) for k, v in features.items()}}
    red_flags: list[str] = []

    rule_penalty = _apply_rules(features, breakdown, red_flags, financials=financials)
    breakdown["pillars"] = _compute_pillars(features, financials)
    breakdown["data_trust_score"] = getattr(financials, "data_trust_score", 85.0) if financials else 50.0
    breakdown["verification_badges"] = getattr(financials, "verification_badges", []) if financials else []

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
    grade = score_to_grade(final_score, policy)
    # Keep PD consistent with the final (penalised) score so the breakdown,
    # credit_score and pd_default_12m tell the same story. Raw model PD is
    # preserved in the breakdown for transparency.
    breakdown["pd_model_raw"] = breakdown.get("pd_default_12m", prob_default)
    prob_default = float(max(0.0, min(1.0, (900 - final_score) / 600.0)))
    breakdown["pd_default_12m"] = round(prob_default, 4)
    breakdown["rules_penalty"] = rule_penalty
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
