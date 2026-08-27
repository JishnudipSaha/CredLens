# Sample Credit Report

This is an example of what a full credit report looks like in CredLens, produced by running the demo flow on `Anand, Mistry and Chawla It Pvt Ltd` (MSME #31). The lender logged in, ran the assessment, and got back a complete credit decision.

---

## 1. MSME profile

| Field | Value |
|---|---|
| Legal name | Anand, Mistry and Chawla It Pvt Ltd |
| GSTIN | 52KLQWC5293PLZ0 |
| PAN | WWCZQ6873N |
| Udyam | UDYAM-84-325187-87-0680 |
| Sector | IT |
| Sub-sector | Morph One-To-One Platforms |
| Location | Chennai, West Bengal |
| Incorporation | 14-Apr-2024 (2.4 years vintage) |
| Employees | 242 |
| Annual turnover | INR 4.37 Cr |

## 2. Financial snapshot (derived from Layer 1 ingestion)

| Metric | Value | Reading |
|---|---|---|
| Avg monthly revenue | INR 35.66 L | healthy |
| Revenue trend (6m) | -4.17% | mild decline |
| EBITDA margin | 24.29% | strong |
| GST compliance | 100% (6/6) | excellent |
| Bank balance | INR 13.44 L | low relative to revenue |
| Bounced cheques (12m) | 0 | clean |
| Existing debt | INR 33.38 L | low |
| Utility payment consistency | 83% | slightly below ideal |
| Telecom footprint | 0.86 | strong |
| Digital footprint | 0.47 | mediocre |
| Top customer concentration | 56% | elevated |
| Debt / revenue | 7.8% | very low |
| Liquidity (cash / annual rev) | 3.1% | low |
| Vintage | 2.4 years | young but past the 1-year policy minimum |

## 3. Credit score (Layer 2 - AI & Analytics)

| Output | Value |
|---|---|
| Credit score | **859** |
| Risk grade | **A** |
| Probability of default (12m) | **2.77%** |
| Model version | v1.0-synthetic |
| ML raw score | 883 |
| Rule-layer penalty | -24 |
| Final score | 859 |

### Red flags raised

> ! Low liquidity: bank balance <5% of annual revenue

The rule layer penalised the MSME 24 points for the liquidity ratio (3.1%) being below the 5% threshold. The ML layer was still confident the business is healthy because the underlying revenue, margins, GST compliance, and absence of bounced cheques more than compensate.

## 4. Decision (Layer 3 - Business Logic & Decision Engine)

| Output | Value |
|---|---|
| Outcome | **APPROVE** |
| Recommended limit | **INR 2.14 Cr** (annual revenue 4.37 Cr x Grade A multiplier 0.50) |
| Policy | Default Bank Policy |

### Reason codes (6 of 6 - "OK" reasons)

| Code | Meaning |
|---|---|
| `MIN_SCORE_OK` | 859 >= policy min of 650 |
| `GST_COMPLIANCE_OK` | 100% >= policy min of 70% |
| `BOUNCED_CHEQUES_OK` | 0 <= policy max of 2 |
| `VINTAGE_OK` | 2.4 yrs >= policy min of 1 year |
| `REVENUE_OK` | 35.66 L monthly >= policy min of 1 L |
| `CONCENTRATION_OK` | 56% <= policy max of 70% |

### Rationale

> Auto-approved. Grade A, score 859, recommended limit INR 21,394,272.

## 5. What a REJECT would look like

For comparison, here's what a borderline MSME typically sees:

| Field | Value |
|---|---|
| Score | 480 |
| Grade | F |
| PD (12m) | 78% |
| Outcome | **REJECT** |
| Reason codes | `BELOW_MIN_SCORE_THRESHOLD`, `GST_COMPLIANCE_BELOW_POLICY`, `BOUNCED_CHEQUES_OVER_POLICY` |
| Rationale | Rejected. Grade F, score 480. Below min score threshold; GST compliance below policy; Bounced cheques over policy. |

And a hard reject (e.g. zero revenue data):

| Field | Value |
|---|---|
| Outcome | **REJECT** |
| Reason codes | `HARD_REJECT_NO_REVENUE` |
| Rationale | Hard reject triggered: HARD_REJECT_NO_REVENUE |

## 6. After the lender extends credit - Feedback Loop

A few months later, the lender comes back to the credit report and reports the actual outcome:

```
POST /api/v1/feedback
{
  "decision_id": 25,
  "outcome": "PAID_ON_TIME",
  "days_past_due": 0
}
```

This is recorded in `audit_log` with a numeric label (0 = good, 1 = default). The Platform Admin sees the new feedback in their Model Monitor dashboard. Over time, the model is retrained on the augmented data so it can learn the patterns specific to this lender's portfolio.

In production, this loop runs continuously:
1. Lender runs an assessment
2. Lender extends credit (or doesn't, based on the decision)
3. Lender reports actual outcomes
4. Admin retrains the model monthly
5. New model version is A/B tested
6. Winning version is promoted; loser is archived
