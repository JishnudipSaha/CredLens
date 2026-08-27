# CredLens Architecture

This document mirrors the block diagram in `CredLens_Block_Diagram.pdf` in text form. It explains the four layers, the data flow between them, and the cross-cutting infrastructure that ties them together.

## Big picture

```
+----------------+      +------------------------------------------------+      +----------------+
| DATA SOURCES   |  ->  |             CREDLENS PLATFORM                  |  ->  | OUTPUTS/USERS  |
+----------------+      +------------------------------------------------+      +----------------+
| Financial      |      | 1. Data Ingestion Layer                        |      | Lenders/Banks/ |
|  - bank stmts  |      |    - secure upload / API integration           |      |   NBFCs        |
|  - GST returns |      |    - data extraction & parsing                 |      |                |
|  - ITR         |      |    - cleaning & normalization                  |      | MSMEs          |
|  - balance sht |      |    - validation & de-duplication               |      |                |
|                |      |------------------------------------------------|      | Government /   |
| Business       |      | 2. AI & Analytics Engine                       |      |   Ecosystem    |
|  - invoices    |      |    - feature engineering                       |      |   Enablers     |
|  - POs         |      |    - AI risk scoring model                     |      |                |
|  - bills       |      |    - credit score generation                   |      | Platform Admin |
|                |      |    - risk grade & red flags                    |      |                |
| Alternative    |      |------------------------------------------------|      +----------------+
|  - utility     |      | 3. Business Logic & Decision Engine           |              ^
|  - telecom     |      |    - credit policy rules                       |              |
|  - digital     |      |    - limit recommendation engine               |              |  Feedback
|                |      |    - decision (Approve / Review / Reject)      |              |  Loop
| Government     |      |    - reason codes & recommendations           |              |
|  - MCA         |      |------------------------------------------------|              |
|  - GSTN        |      | 4. Platform Infrastructure (Cloud)            |              |
|  - Udyam       |      |    - security & privacy (encryption, access)   |              |
|  - CIBIL       |      |    - database (structured + unstructured)     |              |
|                |      |    - cloud hosting (scalable, HA)              |              |
| Manual         |      |    - APIs & integrations (Banking, GST, MCA)   |              |
|  - documents   |      |    - monitoring & logging (perf, audit)        |              |
|  - notes       |      |    - backup & disaster recovery                |              |
+----------------+      +------------------------------------------------+              |
                                                                                          |
                       Feedback Loop: Model Learning & Continuous Improvement  <----------+
```

## Layer 1: Data Ingestion

**Goal:** accept messy external data, clean and validate it, persist it on the MSME record.

**Code:** `app/services/ingestion_service.py`, `app/api/ingestion.py`.

**Flow:**

1. **Parse** - JSON payloads come in via REST (`POST /api/v1/ingest/{financial,business,alternative,government,manual}/{msme_id}`)
2. **Clean** - strip currency symbols, coerce to numbers, normalise dates
3. **Validate** - schema checks (required fields, numeric types) + format checks (GSTIN regex, PAN regex)
4. **De-duplicate** - drop repeated records by a stable key (e.g. `month` for bank statements, `period` for GST returns, `invoice_number` for invoices)
5. **Persist** - merge into the MSME's `raw_*` JSON column
6. **Derive financials** - recompute the `MSMEFinancials` snapshot that feeds Layer 2

**Example:**

```
POST /api/v1/ingest/financial/1
{
  "bank_statements": [
    {"month": "2025-01", "closing_balance": 500000, "bounced_cheques": 0}
  ],
  "gst_returns": [
    {"period": "2025-01", "taxable_value": 1000000, "tax_paid": 180000}
  ]
}
-> {"msme_id": 1, "data_type": "raw_financial", "accepted_records": 2, "rejected_records": 0}
```

After this, the MSME's `avg_monthly_revenue_inr`, `gst_compliance_ratio`, `avg_bank_balance_inr`, etc. are updated.

## Layer 2: AI & Analytics Engine

**Goal:** turn the cleaned data into a credit score, risk grade, and explainable red flags.

**Code:** `app/services/feature_engine.py`, `app/services/risk_scorer.py`, `app/ml/train_synthetic.py`.

**Step 1: Feature engineering** (`feature_engine.py`)

Build a 20-dimensional feature vector:
- Revenue & profitability: `avg_monthly_revenue_inr`, `revenue_trend_pct`, `ebitda_margin_pct`
- GST compliance: `gst_compliance_ratio`
- Banking: `avg_bank_balance_inr`, `bounced_cheques_12m`, `existing_loan_obligations_inr`
- Alternative: `utility_payment_consistency`, `telecom_footprint_score`, `digital_footprint_score`
- Business: `top_customer_concentration_pct`, `vintage_years`
- Engineered: `log_revenue`, `debt_to_revenue_ratio`, `liquidity_ratio`
- One-hot: `sector_manufacturing`, `sector_retail`, `sector_services`, `sector_it`, `sector_other`

**Step 2: Hybrid scoring** (`risk_scorer.py`)

Two complementary layers:

- **Rule layer (transparent):** 0-100 penalty based on hand-crafted red flags. Each penalty is also pushed to `red_flags[]` for explainability.
  - GST compliance < 60% -> +35 penalty
  - Bounced cheques >= 3 -> +30 penalty
  - Revenue declined > 20% -> +20 penalty
  - Customer concentration > 70% -> +15 penalty
  - Debt-to-revenue > 50% -> +20 penalty
  - Bank balance < 5% of annual revenue -> +15 penalty
  - Vintage < 1 year -> +8 penalty
  - Utility payment consistency < 80% -> +10 penalty
  - No revenue data -> +25 penalty

- **ML layer (data-driven):** GradientBoosting classifier trained on 5,000 synthetic samples. Produces `P(default in 12 months)` which is mapped to a 300-900 score: `score = 900 - pd * 600`.

- **Combine:** `final_score = max(300, min(900, ml_score - rule_penalty))`

- **Grade mapping:**
  - 800+ -> A
  - 740-799 -> B
  - 680-739 -> C
  - 620-679 -> D
  - 560-619 -> E
  - < 560 -> F

**Output:**

```json
{
  "credit_score": 859,
  "risk_grade": "A",
  "pd_default_12m": 0.0277,
  "red_flags": ["Low liquidity: bank balance <5% of annual revenue"],
  "score_breakdown": {
    "model_version": "v1.0-synthetic",
    "ml_score": 883,
    "rules_penalty": 24,
    "final_score": 859,
    "grade": "A",
    "features": {...}
  }
}
```

## Layer 3: Business Logic & Decision Engine

**Goal:** apply the dealer's credit policy, recommend a limit, and decide APPROVE / REVIEW / REJECT with reason codes.

**Code:** `app/services/policy_engine.py`, `app/services/orchestrator.py`.

**Step 1: Policy evaluation** (`policy_engine.evaluate_policy`)

Two tiers of rules:

- **Hard reject (no override):**
  - `HARD_REJECT_GST_BELOW_50` (GST compliance < 50%)
  - `HARD_REJECT_BOUNCED_OVER_5` (more than 5 bounced cheques)
  - `HARD_REJECT_NO_REVENUE` (zero revenue data)

- **Soft violations** (vs. policy thresholds):
  - `BELOW_MIN_SCORE_THRESHOLD`
  - `GST_COMPLIANCE_BELOW_POLICY`
  - `BOUNCED_CHEQUES_OVER_POLICY`
  - `VINTAGE_BELOW_POLICY`
  - `REVENUE_BELOW_POLICY`
  - `CONCENTRATION_OVER_POLICY`

**Step 2: Limit recommendation** (`policy_engine.recommend_limit`)

```
limit = min(annual_revenue * grade_multiplier, annual_revenue * 2)
```

Default multipliers: A=0.50, B=0.35, C=0.20, D=0.10, E=0.05, F=0.00

Editable by admin via `PUT /api/v1/admin/policies/{id}`.

**Step 3: Decision** (`policy_engine.decide`)

| Conditions | Decision |
|---|---|
| Hard reject triggered | REJECT |
| 0 violations AND score >= 700 AND limit > 0 | APPROVE |
| <=1 violation AND score >= 600 | REVIEW |
| Otherwise | REJECT |

**Output:**

```json
{
  "outcome": "APPROVE",
  "recommended_limit_inr": 21394272,
  "reason_codes": ["MIN_SCORE_OK", "GST_COMPLIANCE_OK", "BOUNCED_CHEQUES_OK", ...],
  "rationale": "Auto-approved. Grade A, score 859, recommended limit INR 21,394,272."
}
```

## Layer 4: Platform Infrastructure (cross-cutting)

These are implemented as middleware, dependencies, and configuration rather than as a discrete pipeline.

| Concern | Where it lives | What it does |
|---|---|---|
| Security & Privacy | `app/core/security.py` + `app/core/deps.py` | JWT with bcrypt-hashed passwords, role-based access control, 8-hour token expiry |
| Database | `app/database.py` | SQLAlchemy 2.x with both structured (tables) and unstructured (JSON columns for `raw_*` payloads) storage |
| Cloud Hosting | `app/config.py` | `DATABASE_URL` env var - defaults to SQLite, swap to Postgres for prod without code changes |
| APIs & Integrations | `app/api/*.py` | Versioned `/api/v1/*` endpoints, OpenAPI auto-generated at `/docs` |
| Monitoring & Logging | `app/core/logging.py` + `app/main.py` | Structured JSON logs, every request logged with user, latency, status, and `X-Response-Time-ms` header |
| Backup & DR | `app/seed.py` + SQLite file | First-run data can be re-seeded; SQLite file can be backed up with any filesystem snapshot tool |

## Feedback Loop

After the dealer extends credit, they report the actual outcome via `POST /api/v1/feedback`. The outcome is recorded in `audit_log` with a numeric label (PAID_ON_TIME=0, DELAYED=0.3, PARTIAL_DEFAULT=0.7, NPA=1.0). Admin can then click "Retrain model" to retrain the GradientBoosting on the augmented data; AUC and model version are surfaced on the Model Monitor.

In production, the feedback dataset grows over time, the model is retrained periodically (e.g. weekly), and the new version is A/B tested against the old one before promotion.
