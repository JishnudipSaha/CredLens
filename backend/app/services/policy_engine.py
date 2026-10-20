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
REASON_HARD_REJECT_DSCR = "HARD_REJECT_DSCR_CRITICAL"
REASON_HARD_REJECT_BUREAU = "HARD_REJECT_BUREAU_DEFAULT"
REASON_DSCR_OK = "DSCR_BENCHMARK_OK"
REASON_LOW_DSCR = "DSCR_BELOW_BENCHMARK"
REASON_CIBIL_CMR_OK = "CIBIL_CMR_OK"
REASON_CIBIL_CMR_ELEVATED = "CIBIL_CMR_ELEVATED"


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
    financials: any = None,
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

    if financials is not None:
        dscr_val = float(getattr(financials, "dscr", 1.5) or 1.5)
        obligations_val = float(getattr(financials, "existing_loan_obligations_inr", 0) or 0)
        cmr_val = int(getattr(financials, "cibil_cmr_rank", 3) or 3)
        max_dpd_val = int(getattr(financials, "max_dpd_12m", 0) or 0)

        if dscr_val < 0.8 and obligations_val > 0:
            hard.append(REASON_HARD_REJECT_DSCR)
        if cmr_val >= 10 or max_dpd_val >= 90:
            hard.append(REASON_HARD_REJECT_BUREAU)

    if hard:
        # Hard-reject codes live only in hard_reject_reasons so the
        # orchestrator's reasons+violations+hard concat emits each once.
        return PolicyEvaluation(
            hard_reject=True, hard_reject_reasons=hard, violations=[], reasons=[],
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

    # Institutional banking soft covenants
    if financials is not None:
        if dscr_val < 1.25 and obligations_val > 0:
            violations.append(REASON_LOW_DSCR)
        else:
            reasons.append(REASON_DSCR_OK)

        if cmr_val >= 7:
            violations.append(REASON_CIBIL_CMR_ELEVATED)
        else:
            reasons.append(REASON_CIBIL_CMR_OK)

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
    policy: Policy | None = None,
) -> tuple[DecisionOutcome, str]:
    """Map policy evaluation + score into APPROVE / REVIEW / REJECT.

    Score bands come from the policy (auto_approve_score / review_min_score);
    falls back to 700/600 when no policy is supplied.
    """
    auto_score = policy.auto_approve_score if policy is not None else 700
    review_score = policy.review_min_score if policy is not None else 600

    if eval_result.hard_reject:
        rationale = "Hard reject triggered: " + ", ".join(eval_result.hard_reject_reasons)
        return DecisionOutcome.REJECT, rationale

    n_violations = len(eval_result.violations)
    if n_violations == 0 and score >= auto_score and limit > 0:
        rationale = f"Auto-approved. Grade {grade}, score {score}, recommended limit INR {limit:,.0f}."
        return DecisionOutcome.APPROVE, rationale

    if n_violations <= 1 and score >= review_score:
        reasons_str = "; ".join(eval_result.violations) if eval_result.violations else "borderline score"
        rationale = f"Sent for manual review. Grade {grade}, score {score}. {reasons_str}."
        return DecisionOutcome.REVIEW, rationale

    reasons_str = "; ".join(eval_result.violations) if eval_result.violations else "score below threshold"
    rationale = f"Rejected. Grade {grade}, score {score}. {reasons_str}."
    return DecisionOutcome.REJECT, rationale


# ---------- Nayak Committee Working Capital Assessment & Covenants ----------

def calculate_nayak_mpbf(avg_monthly_revenue_inr: float, grade: str) -> dict:
    """Nayak Committee Turnover Method for MSME Working Capital limits.

    Total Working Capital Requirement = 25% of Projected Annual Turnover.
    Borrower Margin Contribution = 5% of Turnover.
    Maximum Permissible Bank Finance (MPBF) = 20% of Turnover.
    Adjusted by Risk Grade Multiplier.
    """
    annual_turnover = max(0.0, avg_monthly_revenue_inr * 12.0)
    total_wc_req = round(annual_turnover * 0.25, 2)
    promoter_margin = round(annual_turnover * 0.05, 2)
    mpbf = round(annual_turnover * 0.20, 2)

    grade_factors = {
        "A": 1.00,
        "B": 0.85,
        "C": 0.65,
        "D": 0.40,
        "E": 0.20,
        "F": 0.00,
    }
    factor = grade_factors.get(grade, 0.0)
    sanctioned_limit = round(mpbf * factor, 2)

    return {
        "annual_turnover_inr": annual_turnover,
        "working_capital_requirement_inr": total_wc_req,
        "promoter_margin_inr": promoter_margin,
        "mpbf_inr": mpbf,
        "grade_multiplier": factor,
        "sanctioned_limit_inr": sanctioned_limit,
    }


def generate_sanction_covenants(
    outcome: DecisionOutcome,
    grade: str,
    limit: float,
    mpbf_data: dict | None = None,
) -> list[str]:
    """Generate institutional banking sanction covenants & Conditions Precedent (CP)."""
    if outcome == DecisionOutcome.REJECT:
        return []

    covenants = [
        "CP-1 (Primary Security): First exclusive charge by way of hypothecation on all current assets, stock-in-trade, and book debts of the MSME.",
        "CP-2 (Statutory Charge Creation): Creation and formal registration of charge on Ministry of Corporate Affairs portal (Form CHG-1) within 30 days of first drawdown.",
        "CP-3 (Promoter Guarantee): Unconditional, irrevocable, and continuous personal guarantee of all executive promoter directors.",
        "CP-4 (Cash Flow Routing): Minimum 75% of total business collection inflows to be strictly routed through the operative current account maintained with the lender.",
        "CP-5 (Statutory Covenants): Timely submission of quarterly stock and aged debtor statements certified by statutory auditors within 21 days from quarter end.",
    ]
    if grade in ("C", "D"):
        covenants.append("CP-6 (Enhanced Monitoring): Monthly submission of GST-3B challans and collateral coverage test maintenance of minimum 1.25x.")
    return covenants
