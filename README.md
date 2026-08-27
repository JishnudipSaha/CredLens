# CredLens

**AI Powered MSME Credit Intelligence Platform**

CredLens lets lenders, banks, and NBFCs verify an MSME and decide whether to extend credit **before** transacting. MSMEs upload their financial, business, alternative, and government data; the platform runs it through ingestion, AI scoring, and a business-logic decision engine; and returns a credit score (300-900), risk grade (A-F), recommended limit, decision (APPROVE / REVIEW / REJECT), and explainable reason codes.

This repository contains a runnable full-stack prototype that mirrors the architecture in `CredLens_Block_Diagram.pdf`.

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
2. **Click "MSME Search"** in the top nav - 50 MSMEs are listed
3. **Click "Run Assessment"** on any unscored row (e.g. "Anand, Mistry and Chawla It Pvt Ltd")
4. **Inspect the credit report** - score 800+ Grade A typically, 1-3 red flags, recommended limit INR 1-3 Cr
5. **Click "Paid on time"** (or any other outcome) under "Feedback Loop" - your feedback is recorded
6. **Sign out** (top right) and **sign in as Platform Admin**
7. **Visit Model Monitor** - your feedback shows up in the "Feedback outcomes" donut
8. **Click "Retrain model"** to retrain the synthetic model on the augmented data
9. **Visit Audit Log** - every action is recorded with timestamp, actor, and endpoint

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
| `GET`  | `/api/v1/decisions` | List decisions, filter by outcome / msme |
| `POST` | `/api/v1/feedback` | Lender reports actual outcome (Feedback Loop) |
| `GET`  | `/api/v1/admin/users` | Admin: list users |
| `GET`  | `/api/v1/admin/policies` | List active credit policies |
| `PUT`  | `/api/v1/admin/policies/{id}` | Admin: update policy thresholds |
| `GET`  | `/api/v1/admin/audit-log` | Admin: full audit trail |
| `GET`  | `/api/v1/admin/model-monitor` | Admin: model + scoring stats |
| `POST` | `/api/v1/admin/model/retrain` | Admin: retrain synthetic model |
| `GET`  | `/api/v1/government/portfolio-insights` | Ecosystem-level analytics |

Full auto-generated docs at `http://127.0.0.1:8000/docs`.

---

## Tests

```bash
cd backend
python -m pytest tests/ -v
```

Covers: grade mapping, feature engine shape, financial ingestion -> financials derivation, policy approve / hard-reject / violation, full assessment pipeline, synthetic ML training. All 8 tests pass.

---

## Project structure

```
Credlens/
+- run.py                          # one-command orchestrator
+- README.md
+- docs/
|  +- architecture.md              # text version of the block diagram
|  +- sample_credit_report.md      # example credit report walkthrough
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
|  +- tests/                       # 8 pytest tests
+- frontend/
   +- package.json
   +- vite.config.ts
   +- tailwind.config.js
   +- index.html
   +- src/
      +- main.tsx
      +- App.tsx                   # role-based router
      +- context.tsx               # auth context
      +- api/client.ts             # typed axios + auth interceptor
      +- utils/format.ts
      +- components/               # Layout, UI primitives, ScoreGauge
      +- pages/
         +- Login.tsx
         +- lender/                # Dashboard, MsmeSearch, MsmeReport, Decisions
         +- msme/                  # Dashboard, UploadData, ScoreHistory
         +- government/            # PortfolioInsights
         +- admin/                 # ModelMonitor, AuditLog
```

---

## Out of scope (intentional)

- Real GSTN / MCA / CIBIL integrations (simulated with synthetic data)
- Production-grade encryption-at-rest, SOC2, KYC
- Mobile apps (web only)
- Multi-tenancy (single dealer org for demo)
- Real cloud deployment (code is cloud-ready, not deployed)

See `docs/architecture.md` for a deeper writeup of the four layers and `docs/sample_credit_report.md` for an example of what a real credit report looks like.
