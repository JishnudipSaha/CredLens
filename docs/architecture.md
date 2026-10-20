# CredLens Architecture

This document mirrors the block diagram in `docs/block_diagram.png` in text form. It explains the four layers, the data flow between them, and the cross-cutting infrastructure that ties them together.

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

## Layer 1: Data Ingestion & Provenance

**Goal:** accept data, clean and validate it, verify provenance rails (AA, GSTN, MCA, Bureau), derive institutional ratios, and persist it on the MSME record.

**Code:** `app/services/ingestion_service.py`, `app/api/ingestion.py`.

**Flow:**

1. **Parse** - JSON payloads come in via REST (`POST /api/v1/ingest/{financial,business,alternative,government,manual}/{msme_id}`)
2. **Clean** - strip currency symbols, coerce to numbers, normalise dates
3. **Validate** - schema checks (required fields, numeric types) + format checks (GSTIN regex, PAN regex)
4. **De-duplicate** - drop repeated records by a stable key (e.g. `month` for bank statements, `period` for GST returns, `invoice_number` for invoices)
5. **Provenance & Trust Index** - detects verified rails (Account Aggregator, active GSTN, MCA21 registration, Commercial CIBIL) and calculates a 0-100% **Data Trust Index** with verification badges (`AA_VERIFIED`, `GSTN_VERIFIED`, `MCA_VERIFIED`, `BUREAU_VERIFIED`)
6. **3-Way Triangulation & Financials Derivation** - recomputes `MSMEFinancials`:
   - **GST vs. Bank Turnover Reconciliation**: Measures `gst_vs_bank_turnover_variance_pct` to detect sales inflation or off-the-books transactions
   - **DSCR (Debt Service Coverage Ratio)**: $(EBITDA \times 0.75) / \text{Annual Debt Service}$
   - **Interest Coverage Ratio (ICR)**: $EBITDA / \text{Annual Interest}$
   - **Current Ratio**: Current Assets / Current Liabilities
   - **Commercial Bureau Tradelines**: Extracts CIBIL CMR rank (1-10) and max Days Past Due (DPD)

## Layer 2: AI & Analytics Engine

**Goal:** turn the cleaned data into an institutional credit score, risk grade, 5-pillar thematic sub-scores, and explainable red flags.

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

**Step 2: Hybrid scoring & 5-Pillar Sub-Scores** (`risk_scorer.py`)

Two complementary layers:

- **Rule layer (transparent):** tiered 0-100 penalty based on hand-crafted red flags and institutional benchmarks:
  - GST compliance < 60% -> +35 (60-80% -> +15 "Inconsistent GST filings")
  - Bounced cheques >= 3 -> +30 (1-2 -> +10)
  - Revenue declined > 20% -> +20 (> 5% -> +8)
  - Customer concentration > 70% -> +15 (> 50% -> +6)
  - Debt-to-revenue > 50% -> +20 (> 30% -> +8)
  - Bank balance < 5% of annual revenue -> +15
  - DSCR < 1.0x -> +20 (< 1.25x -> +8)
  - CIBIL CMR Rank 8-10 -> +20 (CMR 6-7 -> +8)
  - Delinquency in bureau tradelines (60+ DPD) -> +20 (30+ DPD -> +8)
  - GST vs Bank turnover variance mismatch > 25% -> +12
  - Vintage < 1 year -> +8 (< 3 years -> +3)
  - Utility payment consistency < 80% -> +10
  - No revenue data -> +25

- **5-Pillar Thematic Credit Sub-Scores (0-100 each):**
  1. *Financial Solvency & Coverage* (DSCR, ICR, EBITDA, Current Ratio)
  2. *Cash Flow & Banking Quality* (AMB, cheque bounces, cash withdrawal velocity)
  3. *Tax & Statutory Discipline* (GST filing regularity, turnover reconciliation)
  4. *Bureau & Tradeline Track Record* (CIBIL CMR Rank, DPD, active loan facilities)
  5. *Business Stability & Vintage* (Vintage years, customer concentration, employee base)

- **ML layer (data-driven):** GradientBoosting classifier trained on 5,000 synthetic samples. Produces `P(default in 12 months)` which is mapped to a 300-900 score: `ml_score = 900 - pd * 600`.

- **Combine:** `final_score = max(300, min(900, ml_score - rule_penalty))`

- **Consistency:** the reported `pd_default_12m` is recomputed from the final score (`pd = (900 - final_score) / 600`) so score, grade, and PD always tell the same story; the raw model probability is preserved as `pd_model_raw` in the breakdown.

- **Grade mapping** (defaults; overridable per policy via `policy.grade_thresholds`):
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
  "pd_default_12m": 0.0683,
  "red_flags": ["Low liquidity: bank balance <5% of annual revenue"],
  "score_breakdown": {
    "model_version": "v1.0-synthetic",
    "ml_score": 883,
    "rules_penalty": 24,
    "final_score": 859,
    "grade": "A",
    "pd_model_raw": 0.0277,
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
  - `HARD_REJECT_DSCR_CRITICAL` (DSCR < 0.8x with active debt obligations)
  - `HARD_REJECT_BUREAU_DEFAULT` (CIBIL CMR-10 or 90+ Days Past Due)

- **Soft violations** (vs. policy thresholds):
  - `BELOW_MIN_SCORE_THRESHOLD`
  - `GST_COMPLIANCE_BELOW_POLICY`
  - `BOUNCED_CHEQUES_OVER_POLICY`
  - `VINTAGE_BELOW_POLICY`
  - `REVENUE_BELOW_POLICY`
  - `CONCENTRATION_OVER_POLICY`
  - `DSCR_BELOW_BENCHMARK` (DSCR < 1.25x)
  - `CIBIL_CMR_ELEVATED` (CMR >= 7)

**Step 2: Limit recommendation & Nayak Committee MPBF Method** (`policy_engine.calculate_nayak_mpbf`)

Follows standard Indian Banking norms (Nayak Committee formula):
```
Annual Turnover = Avg Monthly Revenue * 12
Total Working Capital Requirement = 25% * Annual Turnover
Borrower Margin Contribution = 5% * Annual Turnover
Maximum Permissible Bank Finance (MPBF) = 20% * Annual Turnover
Sanctioned Limit = MPBF * Risk Grade Multiplier
```
Multipliers on MPBF: Grade A: 100%, B: 85%, C: 65%, D: 40%, E: 20%, F: 0%.

**Step 3: Decision & Sanction Covenants (CP)** (`policy_engine.decide`, `generate_sanction_covenants`)

When an approval is granted, institutional pre-disbursement conditions are automatically generated:
- **CP-1:** First exclusive hypothecation charge on all current assets, stock-in-trade, and book debts
- **CP-2:** Formal ROC charge creation on Ministry of Corporate Affairs portal (**Form CHG-1**) within 30 days
- **CP-3:** Unconditional joint and several personal guarantees from promoter directors
- **CP-4:** Minimum 75% business collection turnover routed through lender operative bank account
- **CP-5:** Quarterly submission of CA-certified stock and aged debtor audit statements

Score bands come from the policy (`auto_approve_score` / `review_min_score`, defaulting to 700 / 600 when no policy is supplied):

| Conditions | Decision |
|---|---|
| Hard reject triggered | REJECT |
| 0 violations AND score >= policy auto-approve band (default 700) AND limit > 0 | APPROVE |
| <=1 violation AND score >= policy review band (default 600) | REVIEW |
| Otherwise | REJECT |

**Output:**

```json
{
  "outcome": "APPROVE",
  "recommended_limit_inr": 21394272,
  "working_capital_mpbf_inr": 8560000,
  "covenants": ["CP-1 (Primary Security): ...", "CP-2 (Statutory Charge): ...", ...],
  "reason_codes": ["MIN_SCORE_OK", "GST_COMPLIANCE_OK", "DSCR_BENCHMARK_OK", "CIBIL_CMR_OK", ...],
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

After the dealer extends credit, they report the actual outcome via `POST /api/v1/feedback`. The outcome is recorded in `audit_log` with a numeric label (PAID_ON_TIME=0, DELAYED=0.3, PARTIAL_DEFAULT=0.7, NPA=1.0). Admin can then click "Retrain model": the trainer joins feedback rows to each decision's `ScoreRun.feature_snapshot` and, when at least 30 labelled samples with both classes exist, fits the GradientBoosting on those real labels (labels ≥0.5 count as default) and hot-reloads the new version; with insufficient feedback it falls back to the synthetic dataset. AUC, data source, and model version are surfaced on the Model Monitor.

In production, the feedback dataset grows over time, the model is retrained periodically (e.g. weekly), and the new version is A/B tested against the old one before promotion.

## Layer 5: Frontend UI

**Goal:** present credit intelligence in a clean, data-dense interface that institutional users can trust — in light and dark mode.

**Code:** `frontend/src/` (React + TypeScript + TailwindCSS)

### Design System

The frontend uses an **Institutional Light + Dark Mode** design system driven entirely by semantic CSS variables (HSL tokens in `index.css`, mapped through `tailwind.config.js`). See `docs/design-system.md` for the full specification.

Key principles:
- **Semantic tokens only** — components color themselves with `bg-card`, `text-muted-foreground`, `border-border`, etc., so light/dark parity is automatic; a `.dark` class toggle (persisted in localStorage, bootstrapped in `index.html`) switches themes
- **Fixed 248px sidebar** at ≥1024px with a slide-over drawer + hamburger below it
- **Inter** for UI text, **JetBrains Mono** for data values and labels
- **Navy-indigo primary** (`#1e3ecc` light / `#637cee` dark) with semantic success/warning/danger and grade colors
- **Lucide** icons (no icon-font CDN)
- **Global Command Palette (`⌘K` / `Ctrl+K`)** for fuzzy search over MSMEs, route jumping, and instant role switching
- **1-Click Demo Role Switcher** in header (`Lender`, `MSME`, `Govt`, `Admin`) with live engine status
- **Zero-Layout-Shift Skeletons** (`ReportSkeleton`, `TableSkeleton`, `CardSkeleton`, `StatSkeleton`) replacing spinners

### Component Architecture

```
App.tsx                   (providers: auth, theme, toasts + ErrorBoundary)
  context.tsx             (auth context, role-based routing)
  theme.tsx               (light/dark theme provider, localStorage)
  api/client.ts           (typed axios + JWT interceptor)
  components/
    Layout.tsx            (sidebar/drawer + sticky glassmorphic header + quick role switcher)
    CommandPalette.tsx    (global Cmd+K modal, MSME search, route navigation & actions)
    UI.tsx                (Card, Button, Badge, Alert, Stat, skeletons [Report, Table, Card, Stat],
                           EmptyState, Spinner, ErrorState, TableWrap)
    ScoreGauge.tsx        (300-900 SVG gauge with grade chip)
    ThemeToggle.tsx       (light/dark toggle)
    Toast.tsx             (ToastProvider + useToast)
    ErrorBoundary.tsx     (React error boundary)
    charts.tsx            (theme-aware Recharts helpers: ChartCard,
                           ChartTooltip, useChartColors, axisProps)
  utils/
    format.ts             (INR/date formatting, grade/outcome color maps)
    cn.ts                 (clsx class-name helper)
  pages/
    Login.tsx             (demo account selector, split brand panel)
    lender/               (Dashboard, MsmeSearch, MsmeReport, Decisions)
    msme/                 (Dashboard, UploadData, ScoreHistory)
    government/           (PortfolioInsights)
    admin/                (ModelMonitor, AuditLog)
```

### Role-Based Routing

Each role sees a different sidebar navigation and page set:

| Role | Sidebar items | Landing page |
|---|---|---|
| LENDER | Portfolio, MSME Search, Decision Queue | `/lender` |
| MSME | Credit Health, Data Upload, Score History | `/msme` |
| GOVERNMENT | Portfolio Insights | `/government` |
| ADMIN | Model Monitor, Audit Log | `/admin` |

### Data Flow (Frontend -> Backend)

1. User authenticates via `POST /api/v1/auth/login` -> JWT stored in localStorage
2. Axios interceptor attaches `Authorization: Bearer <token>` to all requests
3. Pages call typed API functions from `api/client.ts`
4. Vite dev server proxies `/api/*` to backend on `:8000`
5. In production, nginx or CDN handles the proxy
6. Theme preference persists in localStorage (`credlens_theme`) and is applied before first paint by an inline script in `index.html`
