"""
Layer 2 - Feature Engine.
Builds the numeric feature vector consumed by the ML model and the rule layer.
"""
from __future__ import annotations

from typing import Any

from app.models.msme import MSME, MSMEFinancials
from app.models.decision import DecisionOutcome


# canonical feature list - keep order stable
FEATURE_NAMES: list[str] = [
    "avg_monthly_revenue_inr",
    "revenue_trend_pct",
    "ebitda_margin_pct",
    "gst_compliance_ratio",
    "avg_bank_balance_inr",
    "bounced_cheques_12m",
    "existing_loan_obligations_inr",
    "utility_payment_consistency",
    "telecom_footprint_score",
    "digital_footprint_score",
    "top_customer_concentration_pct",
    "vintage_years",
    "log_revenue",
    "debt_to_revenue_ratio",
    "liquidity_ratio",
    "sector_manufacturing",
    "sector_retail",
    "sector_services",
    "sector_it",
    "sector_other",
]


SECTOR_MAP: dict[str, str] = {
    "manufacturing": "sector_manufacturing",
    "retail": "sector_retail",
    "services": "sector_services",
    "it": "sector_it",
}


def _safe_log(x: float) -> float:
    import math
    return math.log1p(max(x, 0.0))


def build_features(msme: MSME, financials: MSMEFinancials | None) -> dict[str, Any]:
    """Return a dict of features. Missing values are zero-filled safely."""
    f: dict[str, Any] = {k: 0.0 for k in FEATURE_NAMES}

    if financials is None:
        return f

    f["avg_monthly_revenue_inr"] = financials.avg_monthly_revenue_inr
    f["revenue_trend_pct"] = financials.revenue_trend_pct
    f["ebitda_margin_pct"] = financials.ebitda_margin_pct
    f["gst_compliance_ratio"] = financials.gst_compliance_ratio
    f["avg_bank_balance_inr"] = financials.avg_bank_balance_inr
    f["bounced_cheques_12m"] = financials.bounced_cheques_12m
    f["existing_loan_obligations_inr"] = financials.existing_loan_obligations_inr
    f["utility_payment_consistency"] = financials.utility_payment_consistency
    f["telecom_footprint_score"] = financials.telecom_footprint_score
    f["digital_footprint_score"] = financials.digital_footprint_score
    f["top_customer_concentration_pct"] = financials.top_customer_concentration_pct
    f["vintage_years"] = financials.vintage_years

    f["log_revenue"] = _safe_log(financials.avg_monthly_revenue_inr)
    annual_rev = financials.avg_monthly_revenue_inr * 12.0
    f["debt_to_revenue_ratio"] = (
        financials.existing_loan_obligations_inr / annual_rev if annual_rev > 0 else 0.0
    )
    f["liquidity_ratio"] = (
        financials.avg_bank_balance_inr / annual_rev if annual_rev > 0 else 0.0
    )

    sector_key = SECTOR_MAP.get((msme.sector or "").lower(), "sector_other")
    f[sector_key] = 1.0

    return f


def feature_vector(features: dict[str, Any]) -> list[float]:
    """Stable ordered list for the ML model."""
    return [float(features.get(name, 0.0) or 0.0) for name in FEATURE_NAMES]
