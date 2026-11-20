# CredLens — Standalone Vercel Demo

**Institutional MSME Credit Intelligence Platform (Zero-Backend Demo Edition)**

This is an independent, 100% self-contained demo edition of CredLens engineered specifically for deployment on **Vercel** with zero server infrastructure, zero cold starts, and zero external database dependencies.

It features an in-browser client-side underwriting engine that mirrors the Python backend, pre-seeded with 50 MSMEs, 4 demo accounts, realistic financial/banking/tax/bureau profiles, and full interactive assessments.

---

## Features Included in the Demo

- **50 Realistic Indian MSMEs**: Across Manufacturing, Retail, Services, IT, and Other sectors spanning 8 major states.
- **Full Underwriting & Decisioning**:
  - **3-Way Triangulation**: GSTR-3B sales vs Account Aggregator bank inflows reconciliation (`gst_vs_bank_turnover_variance_pct`).
  - **Institutional Solvency Ratios**: DSCR ($\ge 1.25\times$), ICR ($\ge 2.0\times$), Current Ratio ($\ge 1.33\times$).
  - **Nayak Committee Working Capital (MPBF)**: Turnover method (25% WC requirement, 5% borrower margin, 20% MPBF limit cap adjusted by risk grade).
  - **5-Pillar Credit Sub-Scores**: Financial Solvency, Banking Quality, Tax Compliance, Bureau Record, and Business Stability.
  - **Sanction Conditions Precedent (CP-1 to CP-5)**: Hypothecation, MCA Form CHG-1 charge registration, Promoter Guarantee, 75% operative cash flow routing, CA stock audit.
  - **Verification Provenance Badges**: `AA_VERIFIED`, `GSTN_VERIFIED`, `MCA_VERIFIED`, `BUREAU_VERIFIED` with dynamic Trust Index (0-100%).
- **Interactive Role Switching & Navigation**:
  - **Global Command Palette (`⌘K` / `Ctrl+K`)**: Live search across MSMEs with risk grade badges, route jumping, theme toggle, and account switching.
  - **1-Click Header Role Switcher**: Instant switching between Lender, MSME, Government, and Admin without manual logout/login cycles.
  - **Skeleton Shimmer Loaders**: Zero-layout-shift loaders simulating cards, tables, and full underwriting memorandums.
  - **First-Class Dark & Light Modes**: Bloomberg/institutional design tokens with seamless theme toggle.
  - **Model Governance & Feedback Loop**: Submit loan repayment outcomes, view feedback donuts, simulate model retraining, and inspect compliance audit logs.

---

## Deploying to Vercel in 60 Seconds

### Method 1: Via Vercel Dashboard (Recommended)

1. Push this repository to GitHub.
2. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** → **"Project"**.
3. Import your `CredLens` repository.
4. In the **Configure Project** screen:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click `Edit` and select `demo`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `dist` (default)
   - **Environment Variables:** *Leave completely empty! No API keys or databases needed.*
5. Click **"Deploy"**.
6. Your standalone demo will be live at `https://your-project.vercel.app` in ~30 seconds!

### Method 2: Via Vercel CLI

```bash
cd demo
npm install
vercel
```

Follow the prompts:
- Link to existing project? `No`
- What's your project's name? `credlens-demo`
- In which directory is your code located? `./`
- Want to modify these settings? `No`

---

## Local Development

```bash
cd demo
npm install
npm run dev
```

Opens at `http://127.0.0.1:5174`.

### Demo Login Accounts

| Role | Email | Password | Landing Page |
|---|---|---|---|
| **Lender / Bank / NBFC** | `lender@credlens.in` | `lender123` | `/lender` |
| **MSME Borrower** | `msme@credlens.in` | `msme123` | `/msme` |
| **Government / Ecosystem** | `govt@credlens.in` | `govt123` | `/government` |
| **Platform Admin** | `admin@credlens.in` | `admin123` | `/admin` |

*Tip: You can click the 1-click login buttons on the login screen, or switch roles at any time using the pills in the header or `⌘K`.*
