# CredLens

**AI Powered MSME Credit Intelligence Platform**

CredLens lets lenders, banks, and NBFCs verify an MSME and decide whether to extend credit **before** transacting. MSMEs upload their financial, business, alternative, and government data; the platform runs it through ingestion, AI scoring, and a business-logic decision engine; and returns a credit score (300-900), risk grade (A-F), recommended limit, decision (APPROVE / REVIEW / REJECT), and explainable reason codes.

This repository contains a runnable full-stack prototype that mirrors the architecture in [`docs/block_diagram.png`](docs/block_diagram.png).

---

## Design System

CredLens uses an **Institutional Light** design system with a first-class **dark mode** — clean, data-dense interfaces inspired by Bloomberg Terminal and NCDEX dashboards. Every color is a semantic CSS variable, so both themes stay in sync automatically.

| Token | Value |
|---|---|
| Primary | `#1e3ecc` navy-indigo (light) / `#637cee` (dark) |
| Background | `#f6f6f9` (light) / `#090d15` (dark) |
| Surface | `#ffffff` (light) / `#0d121c` (dark) |
| Semantic | success `#1c8252`, warning `#b15e0b`, danger `#b81e1e` (+ brighter dark variants) |
| Typography | Inter (UI) + JetBrains Mono (data/labels) |
| Icons | Lucide (`lucide-react`) |
| Layout | Fixed 248px sidebar at ≥1024px (slide-over drawer below) + sticky blurred header |
| Theming | HSL CSS variables in `index.css`; `.dark` class persisted to `localStorage` (`credlens_theme`) with an anti-flash bootstrap in `index.html` |

See [`docs/design-system.md`](docs/design-system.md) for the full specification.

---

## Architecture (mirrors the block diagram)

```
DATA SOURCES            CREDLENS PLATFORM                                 OUTPUTS
--------------          -------------------------------------------------  --------------
Financial Data    |    |  1. Data Ingestion Layer         |  |  -> Lenders / Banks / NBFCs
Business Data     | -> |  2. AI & Analytics Engine        |  |  -> MSMEs
Alternative Data  |    |  3. Business Logic & Decision    |  |  -> Government / Ecosystem
Government Data   |    |  4. Platform Infrastructure      |  |  -> Platform Admin
Manual Upload     |    |     (Cloud)                      |  |
                       |  Feedback Loop  <------------------|
```

| Layer | What it does | Backend code |
|---|---|---|
| **1. Data Ingestion** | parse -> clean -> validate -> dedup -> persist | `app/services/ingestion_service.py` + `app/api/ingestion.py` |
| **2. AI & Analytics** | Feature engineering + hybrid rule + ML scoring | `app/services/feature_engine.py` + `app/services/risk_scorer.py` + `app/ml/train_synthetic.py` |
| **3. Business Logic & Decision** | Policy evaluation, limit recommendation, decision | `app/services/policy_engine.py` + `app/services/orchestrator.py` |
| **4. Platform Infrastructure** | Auth, CORS, monitoring middleware, logging, audit | `app/core/*` + `app/main.py` |
| **Feedback Loop** | Lenders report outcomes -> audit log -> model retraining | `app/services/feedback_service.py` + `app/api/feedback.py` + `app/api/admin.py` |

---

## Tech Stack

- **Backend:** Python 3.13, FastAPI, SQLAlchemy 2.x, SQLite, scikit-learn
- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, Recharts, Axios
- **Design:** HSL CSS-variable design tokens, Inter + JetBrains Mono, Lucide icons, light + dark themes
- **Auth:** JWT (4 roles: LENDER, MSME, GOVERNMENT, ADMIN)
- **ML:** GradientBoosting classifier trained on 5,000 synthetic samples
- **Data:** Faker-generated 50 MSMEs seeded on first run

---

## Quick start

### 1. Backend setup

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The backend:
- Creates `backend/data/credlens.db` (SQLite) on first run
- Trains the synthetic ML model (one-time, ~12s) and saves it to `backend/app/ml/artifacts/risk_model.pkl`
- Seeds 4 demo users + 50 MSMEs + 1 default policy + 20 initial assessments
- Listens on `http://127.0.0.1:8000`
- API docs at `http://127.0.0.1:8000/docs`

### 2. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://127.0.0.1:5173`. Vite proxies `/api/*` to the backend on `:8000`.

### 3. One-command run (after both setups)

```bash
# from the repo root, with both already installed:
python run.py
```

This starts the backend and frontend together, with logs to `backend.log` and `frontend.log`. Press Ctrl+C to stop both.

---

## Demo accounts

| Role | Email | Password | Lands on |
|---|---|---|---|
| Lender / Bank / NBFC | `lender@credlens.in` | `lender123` | `/lender` |
| MSME Owner | `msme@credlens.in` | `msme123` | `/msme` |
| Government / Ecosystem | `govt@credlens.in` | `govt123` | `/government` |
| Platform Admin | `admin@credlens.in` | `admin123` | `/admin` |

Click any of the four demo account buttons on the login page to pre-fill the credentials.

---

## Demo flow (5 minutes)

1. **Login as Lender** at `http://127.0.0.1:5173`
2. **Click "MSME Search"** in the sidebar — 50 MSMEs are listed
3. **Click "Run Assessment"** on any unscored row (e.g. "Anand, Mistry and Chawla It Pvt Ltd")
4. **Inspect the credit report** — 300–900 score with grade A–F, red flags, recommended limit, and reason codes (exact figures vary with seed data and model version)
5. **Click "Paid on time"** (or any other outcome) under "Feedback Loop" — your feedback is recorded
6. **Sign out** (top right) and **sign in as Platform Admin**
7. **Visit Model Monitor** — your feedback shows up in the "Feedback outcomes" donut
8. **Click "Retrain model"** — retrains on your feedback labels when ≥30 labelled outcomes exist (falls back to synthetic data otherwise); the new model version loads immediately
9. **Visit Audit Log** — every action is recorded with timestamp, actor, and endpoint

---

## Pages by role

| Role | Sidebar nav | Key pages |
|---|---|---|
| **Lender** | Portfolio, MSME Search, Decision Queue | Dashboard with portfolio stats, search/filter MSMEs, run assessments, view credit reports, record feedback |
| **MSME** | Credit Health, Data Upload, Score History | Credit score gauge, improvement tips, upload financial/alternative data, track score trends |
| **Government** | Portfolio Insights | Ecosystem-level analytics — sector/state/grade distributions |
| **Admin** | Model Monitor, Audit Log | Model metrics, grade/decision/feedback distributions, retrain model, full audit trail |

---

## API tour (selection)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Login -> JWT |
| `GET`  | `/api/v1/msmes` | List MSMEs (filter by `q`, `sector`, `state`) |
| `POST` | `/api/v1/msmes` | Create MSME |
| `GET`  | `/api/v1/msmes/{id}` | Get one MSME |
| `POST` | `/api/v1/ingest/financial/{msme_id}` | Layer 1: ingest bank stmt / GST / ITR |
| `POST` | `/api/v1/ingest/business/{msme_id}` | Layer 1: ingest invoices / POs / bills |
| `POST` | `/api/v1/ingest/alternative/{msme_id}` | Layer 1: utility / telecom / digital |
| `POST` | `/api/v1/ingest/government/{msme_id}` | Layer 1: MCA / GSTN / Udyam / CIBIL |
| `POST` | `/api/v1/ingest/manual/{msme_id}` | Layer 1: manual upload |
| `POST` | `/api/v1/score/run` | Run Layer 2 + Layer 3 (full assessment) |
| `GET`  | `/api/v1/score/report/{msme_id}` | Latest credit report (no re-run) |
| `GET`  | `/api/v1/score/runs/{msme_id}` | Score history for an MSME |
| `GET`  | `/api/v1/decisions` | List decisions, filter by outcome / msme (each row includes `credit_score` + `risk_grade`) |
| `POST` | `/api/v1/feedback` | Lender reports actual outcome (Feedback Loop) |
| `GET`  | `/api/v1/admin/users` | Admin: list users |
| `GET`  | `/api/v1/admin/policies` | List active credit policies |
| `PUT`  | `/api/v1/admin/policies/{id}` | Admin: update policy thresholds |
| `GET`  | `/api/v1/admin/audit-log` | Admin: full audit trail |
| `GET`  | `/api/v1/admin/model-monitor` | Admin: model + scoring stats |
| `POST` | `/api/v1/admin/model/retrain` | Admin: retrain on feedback labels (synthetic fallback) |
| `GET`  | `/api/v1/government/portfolio-insights` | Ecosystem-level analytics |

Full auto-generated docs at `http://127.0.0.1:8000/docs`.

---

## Tests

```bash
cd backend
python -m pytest tests/ -v
```

Covers: grade mapping, feature engine shape, financial ingestion -> financials derivation, policy approve / hard-reject / violation, policy-driven decision bands and grade thresholds, PD/score consistency, reason-code deduplication, feedback retrain on real labels, model hot-reload, full assessment pipeline, seed-data sanity. All 22 tests pass.

---

## Project structure

```
CredLens/
+- run.py                          # one-command orchestrator
+- README.md
+- DEPLOY.md                       # deployment guide (Vercel+Render, VM, Docker, AWS/GCP)
+- docs/
|  +- architecture.md              # text version of the block diagram
|  +- design-system.md             # UI design system specification
|  +- sample_credit_report.md      # example credit report walkthrough
|  +- block_diagram.png
+- backend/
|  +- requirements.txt
|  +- data/                        # SQLite DB (gitignored)
|  +- app/
|  |  +- main.py                   # FastAPI entrypoint with CORS + audit middleware
|  |  +- config.py
|  |  +- database.py
|  |  +- seed.py                   # demo data + auto-train on first run
|  |  +- models/                   # SQLAlchemy: User, MSME, ScoreRun, Decision, Policy, AuditLog
|  |  +- schemas/                  # Pydantic request / response models
|  |  +- api/                      # FastAPI routers (one per layer)
|  |  +- services/                 # business logic, framework-free
|  |  +- core/                     # security (JWT, hashing), deps, structured logging
|  |  +- ml/
|  |     +- train_synthetic.py     # GradientBoosting on 5,000 synthetic samples
|  |     +- artifacts/risk_model.pkl
|  +- tests/                       # 22 pytest tests
+- frontend/
|  +- package.json
|  +- vite.config.ts
|  +- tailwind.config.js           # HSL design tokens mapped to Tailwind color utilities
|  +- index.html                   # Google Fonts (Inter, JetBrains Mono) + anti-flash theme bootstrap
|  +- src/
|     +- main.tsx
|     +- index.css                 # design tokens (light/dark), base + component styles
|     +- App.tsx                   # role-based router + providers (auth, theme, toasts, ErrorBoundary)
|     +- context.tsx               # auth context
|     +- theme.tsx                 # light/dark theme provider (localStorage)
|     +- api/client.ts             # typed axios + auth interceptor
|     +- utils/format.ts           # INR formatting, score/grade/outcome color maps
|     +- utils/cn.ts               # clsx class-name helper
|     +- components/
|     |  +- Layout.tsx             # sidebar/drawer + sticky header with breadcrumbs
|     |  +- UI.tsx                 # Card, Button, Badge, Alert, Stat, states, TableWrap
|     |  +- ScoreGauge.tsx         # circular score gauge with grade badge
|     |  +- ThemeToggle.tsx        # light/dark mode toggle
|     |  +- Toast.tsx              # ToastProvider + useToast
|     |  +- ErrorBoundary.tsx      # app-level error fallback
|     |  +- charts.tsx             # theme-aware Recharts helpers (ChartCard, ChartTooltip)
|     +- pages/
|        +- Login.tsx              # demo account selector, institutional login form
|        +- lender/                # Dashboard, MsmeSearch, MsmeReport, Decisions
|        +- msme/                  # Dashboard, UploadData, ScoreHistory
|        +- government/            # PortfolioInsights
|        +- admin/                 # ModelMonitor, AuditLog
+- designs/                        # Stitch design references (HTML + screenshots)
```

---

## Design references

The `designs/` folder contains 11 Google Stitch design references (brand explorations and page comps). Each folder holds reference assets — a self-contained `code.html` and/or a `screen.png`:

| Folder | Subject |
|---|---|
| `credlens_intelligence` | Brand + intelligence concept (includes `DESIGN.md`) |
| `credlens_wordmark_logo` | Wordmark / logo exploration |
| `credlens_enterprise_lender_platform` | Lender platform overview |
| `credlens_msme_search_underwriting_pipeline` | MSME search & underwriting |
| `credlens_lender_credit_report` | Credit report |
| `credlens_msme_borrower_self_serve_ingestion_portal` | MSME data upload |
| `credlens_credit_policies_underwriting_rules_engine` | Credit policies / rules |
| `credlens_ai_risk_model_governance_operations_hub` | Model governance / monitor |
| `credlens_system_audit_trail_cryptographic_governance` | Audit trail |
| `credlens_system_health_infrastructure_operations` | System health / operations |
| `credlens_user_access_roles_governance` | User access & roles |

---

## Out of scope (intentional)

- Real GSTN / MCA / CIBIL integrations (simulated with synthetic data)
- Production-grade encryption-at-rest, SOC2, KYC
- Mobile apps (web only)
- Multi-tenancy (single dealer org for demo)
- Real cloud deployment (code is cloud-ready, not deployed)

See [`docs/architecture.md`](docs/architecture.md) for a deeper writeup of the four layers and [`docs/sample_credit_report.md`](docs/sample_credit_report.md) for an example of what a real credit report looks like.
