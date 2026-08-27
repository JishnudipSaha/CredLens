"""
Layer 3 - Business Logic & Decision Engine.
Three steps: policy_engine -> limit_engine -> decision_engine.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.models.decision import DecisionOutcome
from app.models.policy import Policy


# ---------- reason codes ----------

REASON_MIN_SCORE_OK = "MIN_SCORE_OK"
REASON_BELOW_MIN_SCORE = "BELOW_MIN_SCORE_THRESHOLD"
REASON_GST_OK = "GST_COMPLIANCE_OK"
REASON_LOW_GST = "GST_COMPLIANCE_BELOW_POLICY"
REASON_BOUNCED_OK = "BOUNCED_CHEQUES_OK"
REASON_HIGH_BOUNCED = "BOUNCED_CHEQUES_OVER_POLICY"
REASON_VINTAGE_OK = "VINTAGE_OK"
REASON_LOW_VINTAGE = "VINTAGE_BELOW_POLICY"
REASON_REVENUE_OK = "REVENUE_OK"
REASON_LOW_REVENUE = "REVENUE_BELOW_POLICY"
REASON_CONCENTRATION_OK = "CONCENTRATION_OK"
REASON_HIGH_CONCENTRATION = "CONCENTRATION_OVER_POLICY"
REASON_HARD_REJECT_GST = "HARD_REJECT_GST_BELOW_50"
REASON_HARD_REJECT_BOUNCED = "HARD_REJECT_BOUNCED_OVER_5"
REASON_HARD_REJECT_NO_REVENUE = "HARD_REJECT_NO_REVENUE"


@dataclass
class PolicyEvaluation:
    hard_reject: bool
    hard_reject_reasons: list[str]
    violations: list[str]
    reasons: list[str]


def evaluate_policy(
    score: int,
    grade: str,
    features: dict,
    policy: Policy,
) -> PolicyEvaluation:
    """Apply policy thresholds. Returns a structured evaluation."""
    hard: list[str] = []
    violations: list[str] = []
    reasons: list[str] = []

    # Hard reject rules (no business case to override these)
    if features.get("gst_compliance_ratio", 1.0) < 0.5:
        hard.append(REASON_HARD_REJECT_GST)
    if features.get("bounced_cheques_12m", 0) > 5:
        hard.append(REASON_HARD_REJECT_BOUNCED)
    if features.get("avg_monthly_revenue_inr", 0) <= 0:
        hard.append(REASON_HARD_REJECT_NO_REVENUE)

    if hard:
        return PolicyEvaluation(
            hard_reject=True, hard_reject_reasons=hard, violations=hard, reasons=hard,
        )

    # Soft violations
    if score < policy.min_credit_score:
        violations.append(REASON_BELOW_MIN_SCORE)
    else:
        reasons.append(REASON_MIN_SCORE_OK)

    if features.get("gst_compliance_ratio", 1.0) < policy.min_gst_compliance:
        violations.append(REASON_LOW_GST)
    else:
        reasons.append(REASON_GST_OK)

    if features.get("bounced_cheques_12m", 0) > policy.max_bounced_cheques:
        violations.append(REASON_HIGH_BOUNCED)
    else:
        reasons.append(REASON_BOUNCED_OK)

    if features.get("vintage_years", 0) < policy.min_vintage_years:
        violations.append(REASON_LOW_VINTAGE)
    else:
        reasons.append(REASON_VINTAGE_OK)

    if features.get("avg_monthly_revenue_inr", 0) < policy.min_avg_monthly_revenue_inr:
        violations.append(REASON_LOW_REVENUE)
    else:
        reasons.append(REASON_REVENUE_OK)

    if features.get("top_customer_concentration_pct", 0) > policy.max_customer_concentration_pct:
        violations.append(REASON_HIGH_CONCENTRATION)
    else:
        reasons.append(REASON_CONCENTRATION_OK)

    return PolicyEvaluation(
        hard_reject=False,
        hard_reject_reasons=[],
        violations=violations,
        reasons=reasons,
    )


# ---------- limit engine ----------

GRADE_TO_MULTIPLIER = {
    "A": "limit_multiplier_a",
    "B": "limit_multiplier_b",
    "C": "limit_multiplier_c",
    "D": "limit_multiplier_d",
    "E": "limit_multiplier_e",
    "F": "limit_multiplier_f",
}


def recommend_limit(
    avg_monthly_revenue_inr: float,
    grade: str,
    policy: Policy,
) -> float:
    """Monthly revenue * grade multiplier (annualised, capped to 12 months of revenue * 2)."""
    if avg_monthly_revenue_inr <= 0:
        return 0.0
    mult_attr = GRADE_TO_MULTIPLIER.get(grade, "limit_multiplier_f")
    mult = float(getattr(policy, mult_attr))
    annual_revenue = avg_monthly_revenue_inr * 12.0
    limit = annual_revenue * mult
    # Cap at 2x annual revenue even for best grade
    return round(min(limit, annual_revenue * 2.0), 2)


# ---------- decision engine ----------

def decide(
    score: int,
    grade: str,
    eval_result: PolicyEvaluation,
    limit: float,
) -> tuple[DecisionOutcome, str]:
    """Map policy evaluation + score into APPROVE / REVIEW / REJECT."""
    if eval_result.hard_reject:
        rationale = "Hard reject triggered: " + ", ".join(eval_result.hard_reject_reasons)
        return DecisionOutcome.REJECT, rationale

    n_violations = len(eval_result.violations)
    if n_violations == 0 and score >= 700 and limit > 0:
        rationale = f"Auto-approved. Grade {grade}, score {score}, recommended limit INR {limit:,.0f}."
        return DecisionOutcome.APPROVE, rationale

    if n_violations <= 1 and score >= 600:
        reasons_str = "; ".join(eval_result.violations) if eval_result.violations else "borderline score"
        rationale = f"Sent for manual review. Grade {grade}, score {score}. {reasons_str}."
        return DecisionOutcome.REVIEW, rationale

    reasons_str = "; ".join(eval_result.violations) if eval_result.violations else "score below threshold"
    rationale = f"Rejected. Grade {grade}, score {score}. {reasons_str}."
    return DecisionOutcome.REJECT, rationale
