# Sample Credit Report — Institutional Underwriting Memorandum

This is an example of what an institutional credit memorandum looks like in CredLens, produced by running the assessment on `Anand, Mistry and Chawla It Pvt Ltd` (MSME #31). The lender logged in, ran the assessment, and received a complete, market-standard institutional credit appraisal.

> **Note:** The specific figures below are from a representative run. Demo data is Faker-seeded and the model can be retrained, so your exact figures will vary with seed data — the structure, institutional ratios, Nayak MPBF calculations, and sanction covenants remain consistent.

---

## 1. MSME profile & Verification Provenance

| Field | Value |
|---|---|
| Legal name | Anand, Mistry and Chawla It Pvt Ltd |
| GSTIN | 52KLQWC5293PLZ0 |
| PAN | WWCZQ6873N |
| Udyam | UDYAM-84-325187-87-0680 |
| Sector / Sub-sector | IT · Morph One-To-One Platforms |
| Location | Chennai, West Bengal |
| Incorporation | 14-Apr-2024 (2.4 years vintage) |
| Employees | 242 |
| Annual turnover | INR 4.37 Cr |

### Verification Provenance Badges & Data Trust Index
- **Account Aggregator (AA):** Verified (ReBIT encrypted banking pull)
- **GSTN Registry:** Active & Filed (Regular monthly GSTR-3B filings)
- **MCA21 Registry:** Active ROC Entity (Form AOC-4 / MGT-7 verified)
- **Credit Bureau:** CIBIL Commercial Scored (Tradelines & CMR verified)
- **Data Trust Index:** **95%** (High verification confidence)

---

## 2. 3-Way Cross-Reconciliation & Triangulation

| Underwriting Metric | Value | Institutional Reading |
|---|---|---|
| Declared GST Turnover (Annual) | INR 4.28 Cr | GSTR-3B monthly sales |
| Bank Statement Inflows (Annualized) | INR 4.17 Cr | Account Aggregator verified credits |
| Turnover Variance % | **-2.5%** | **Reconciled (<15%)** — cash inflows corroborate declared sales |

---

## 3. Institutional Banking Ratios & Solvency

| Ratio | Value | Banking Norm / Benchmark | Status |
|---|---|---|---|
| **DSCR (Debt Service Coverage Ratio)** | **2.15x** | Banking Benchmark $\ge 1.25x$ | Strong |
| **Interest Coverage Ratio (ICR)** | **4.20x** | Banking Benchmark $\ge 2.0x$ | High |
| **Current Ratio** | **1.42x** | Tandon Committee Norm $\ge 1.33x$ | Adequate |
| **EBITDA Margin** | **24.29%** | Operating Profitability | Strong |
| **Debt / Revenue** | **7.8%** | Leverage Threshold $\le 40\%$ | Low Risk |
| **Liquidity Ratio (Cash / Annual Rev)** | **3.1%** | Internal Policy Minimum 5% | Minor Flag |

---

## 4. Credit Score & 5-Pillar Sub-Scores (Layer 2)

| Output | Value |
|---|---|
| **Credit score** | **859** |
| **Risk grade** | **A** |
| **Probability of default (12m)** | **6.83%** |
| **Raw ML Score** | 883 |
| **Rule & Ratio Penalty** | -24 (Low liquidity flag) |
| **Model version** | v1.0-synthetic |

### 5-Pillar Credit Sub-Scores (0-100)
1. **Financial Solvency & Coverage:** **92 / 100** (Robust DSCR & EBITDA)
2. **Banking & Cash Flow Quality:** **85 / 100** (Zero cheque bounces, healthy throughput)
3. **Tax & Statutory Compliance:** **98 / 100** (100% GST filing regularity, -2.5% turnover variance)
4. **Bureau Track Record:** **92 / 100** (CIBIL CMR-2, 0 DPD in 12m)
5. **Business Stability & Vintage:** **82 / 100** (2.4 years vintage, manageable concentration)

### Commercial Bureau Tradelines Summary
- **CIBIL Commercial Rank:** **CMR-2** (Prime Credit Risk)
- **Max Days Past Due (12m):** **0 DPD** (Punctual debt repayment)
- **Active Credit Facilities:** 2 Commercial Facilities
- **MCA Registered Charges:** 1 Active Charge (Clean ROC Index of Charges)

---

## 5. Working Capital Assessment — Nayak Committee Turnover Method

Under standard Indian banking guidelines (Nayak Committee formula for credit limits up to INR 5 Crores):

| Underwriting Step | Formula / Banking Norm | Computed Amount |
|---|---|---|
| **1. Projected Annual Turnover** | Validated revenue base | INR 4.28 Cr |
| **2. Total Working Capital Requirement** | 25% of Annual Turnover | INR 1.07 Cr |
| **3. Promoter Margin Contribution** | 5% of Annual Turnover (Borrower Equity) | INR 21.40 L |
| **4. Maximum Permissible Bank Finance (MPBF)** | 20% of Turnover (Turnover Method Cap) | **INR 85.60 L** |
| **5. Sanctioned Working Capital Limit** | MPBF $\times$ Grade A Multiplier (100%) | **INR 85.60 L** |

*Overall Credit Limit (including term facility capacity based on free cash flows): **INR 2.14 Cr**.*

---

## 6. Sanction Terms & Pre-Disbursement Conditions (CP)

When the underwriting decision is `APPROVE`, the decision engine generates institutional sanction covenants:

1. **CP-1 (Primary Security):** First exclusive charge by way of hypothecation on all current assets, stock-in-trade, and book debts of the MSME.
2. **CP-2 (Statutory Charge Registration):** Creation and formal registration of charge on Ministry of Corporate Affairs portal (**Form CHG-1**) within 30 days of first drawdown.
3. **CP-3 (Promoter Guarantee):** Unconditional, irrevocable, and continuous personal guarantee of all executive promoter directors.
4. **CP-4 (Cash Flow Routing):** Minimum 75% of total business collection inflows to be strictly routed through the operative current account maintained with the lender.
5. **CP-5 (Statutory Covenants):** Timely submission of quarterly stock and aged debtor statements certified by statutory auditors within 21 days from quarter end.

---

## 7. What a REJECT or Solvency Failure Looks Like

For an MSME experiencing liquidity distress:

| Field | Value |
|---|---|
| Score / Grade | 460 / Grade F |
| DSCR | 0.65x (Critical Solvency Failure) |
| CIBIL CMR Rank | CMR-9 (High Risk / 60+ DPD) |
| Outcome | **REJECT** |
| Reason codes | `HARD_REJECT_DSCR_CRITICAL`, `HARD_REJECT_BUREAU_DEFAULT`, `BELOW_MIN_SCORE_THRESHOLD` |
| Rationale | Hard reject triggered: HARD_REJECT_DSCR_CRITICAL; CIBIL CMR elevated; DSCR below 0.8x. |

---

## 8. Feedback Loop

After credit disbursement, the lender records repayment outcomes:
```bash
POST /api/v1/feedback
{
  "decision_id": 25,
  "outcome": "PAID_ON_TIME",
  "days_past_due": 0
}
```
Recorded in `audit_log`, this data feeds into model retraining once $\ge 30$ real-world labels accumulate.
