# External Data Sources

**Where to obtain the authoritative data that CredLens evaluation and calculations depend on.**

## Overview

Today, every input to the CredLens scoring pipeline arrives as **self-uploaded JSON** (`POST /api/v1/ingest/*`) or is **Faker-fabricated** by `backend/app/seed.py`. That is fine for a demo, but not for real underwriting: an MSME will never upload evidence of its *missed* GST filings, its bounces at *other* banks, or loans it chose to omit.

This document maps **each evaluated feature → the external source that can authoritatively supply it → where to get that source (official route + practical vendor route) → what access/consent is required**. It is the "where to obtain" companion to the roadmap in [`FUTURE_UPDATES.md`](../FUTURE_UPDATES.md) (Section 3, *Real-World Data Integrations*) and to Layer 1 of [`architecture.md`](architecture.md).

**How to read it:**
- **Feeds** = the exact feature names in `feature_engine.py:14-35` (`FEATURE_NAMES`), plus the red flags / policy checks / limit formula that consume them.
- **Status** = whether the backend consumes it today (`scored`), accepts but ignores it (`ingested, unused`), or has no field at all (`absent`).

---

## 1. Coverage matrix

All 20 ML features and where their inputs must come from:

| # | Feature (FEATURE_NAMES) | External source required | Why an upload can't be trusted | Status |
|---|---|---|---|---|
| 0 | `avg_monthly_revenue_inr` | **GSTN** (GSTR-1 taxable value), optionally IRP e-invoice / GSTR-2A | Today = mean of self-supplied `taxable_value` (`ingestion_service.py:317-326`); trivially fabricable | scored (synthetic) |
| 1 | `revenue_trend_pct` | **GSTN** (period-wise returns) | Same as above; trend needs filing calendar only GSTN holds | scored (synthetic) |
| 2 | `ebitda_margin_pct` | **Audited financials** / **MCA21 AOC-4** | EBITDA from unaudited self-supplied `balance_sheet` (`ingestion_service.py:345-349`) | scored (synthetic) |
| 3 | `gst_compliance_ratio` | **GSTN** (GSTR-1/3B filing history) | The signal *is* filing gaps (`ingestion_service.py:281-295`) — the borrower never reports gaps | scored (synthetic) |
| 4 | `avg_bank_balance_inr` | **Account Aggregator** (bank FIP) or bank-hosted statement | Self-typed `closing_balance` has no provenance; AA gives consented, signed ledger data | scored (synthetic) |
| 5 | `bounced_cheques_12m` | **Drawee-bank CTS/return records** + **credit bureau** dishonoured-cheque segment | Recorded by the *other* bank across all the borrower's accounts; policy hard-rejects on `>5` | scored (synthetic) |
| 6 | `existing_loan_obligations_inr` | **Credit bureau tradelines** (CIBIL/Experian/Equifax/CRIF) + AA | Loans are reported *by lenders* to bureaus — including facilities the borrower omits; currently a self-declared balance-sheet field | scored (synthetic) |
| 7 | `utility_payment_consistency` | **Utility provider records** (discom/telecom billing) | Self-reported `on_time` booleans (`ingestion_service.py:206-211`) prove nothing | scored (synthetic) |
| 8 | `telecom_footprint_score` | **Telco/data vendor API** | 0-1 third-party construct; no borrower upload can generate it authentically | scored (synthetic) |
| 9 | `digital_footprint_score` | **Digital-footprint vendor API** | Same — external telemetry by definition | scored (synthetic) |
| 10 | `top_customer_concentration_pct` | **GSTN GSTR-2A/2B**, IRP e-invoices, or accounting-software (Tally/Zoho) cross-match | Derived only from self-supplied invoices (`ingestion_service.py:377-393`) | scored (synthetic) |
| 11 | `vintage_years` | **MCA/ROC** + **Udyam registry** | Self-declared `incorporation_date` drives a scored feature *and* a policy covenant | scored (synthetic) |
| 12 | `log_revenue` | (derived from #0) | — | derived |
| 13 | `debt_to_revenue_ratio` | Bureau + AA (for #6) / GSTN (for #0) | — | derived |
| 14 | `liquidity_ratio` | AA (for #4) / GSTN (for #0) | — | derived |
| 15 | `sector_manufacturing` | Profile / **Udyam NIC classification** (optional verification) | Low-risk self-declaration | scored (self-declared) |
| 16 | `sector_retail` | Profile / **Udyam NIC classification** (optional verification) | Low-risk self-declaration | scored (self-declared) |
| 17 | `sector_services` | Profile / **Udyam NIC classification** (optional verification) | Low-risk self-declaration | scored (self-declared) |
| 18 | `sector_it` | Profile / **Udyam NIC classification** (optional verification) | Low-risk self-declaration | scored (self-declared) |
| 19 | `sector_other` | Profile / **Udyam NIC classification** (optional verification) | Low-risk self-declaration | scored (self-declared) |

**Beyond the ML vector**, these also feed rules/policy but need the same external sources:

| Input | Used by | External source |
|---|---|---|
| `gstin` registration status | (stored, not scored) | GSTN public search |
| `mca_data` (CIN, status, directors) | (ingested, **unused**) | MCA21 / API Setu |
| `udyam_data` | (ingested, **unused**) | Udyam registry |
| `cibil_score` / `cibil_accounts` | (ingested, **deliberately unused** — `ingestion_service.py:367-375`) | Credit bureau |
| `itr_filings` | (ingested, **unused**) | Income-tax CPC / DigiLocker |
| Litigation / wilful default / director disqualification | (**absent from backend**; design mockups only) | Court records / MCA / bureau |
| DSCR, debt-equity covenants | (**absent from backend**) | AA cash flow + bureau liabilities |

---

## 2. Source directory

### 2.1 Tax & compliance — GSTN

**Feeds:** `gst_compliance_ratio`, `avg_monthly_revenue_inr`, `revenue_trend_pct`, `top_customer_concentration_pct` (buyer-side); hard reject `HARD_REJECT_GST_BELOW_50`, policy `min_gst_compliance`.

| Route | Where | Access requirements |
|---|---|---|
| **Manual portal** | [gst.gov.in](https://www.gst.gov.in) → Returns Dashboard → GSTR-2A/2B (JSON/Excel download) | Taxpayer's own credentials + OTP; no lender bulk-pull |
| **GSP API (recommended)** | GSTN-authorised GST Suvidha Providers — **Sandbox** (`developer.sandbox.co.in`), **WhiteBooks** (`whitebooks.in/apis/gst`), **PeriOne** (`perione.in`) | Sandbox keys immediate; production = KYC + signed agreement (~5 business days). OTP-based taxpayer session per pull |
| **Via Account Aggregator** | GSTN is an RBI-notified **FIP** — reachable through any licensed AA | Borrower consent + OTP (same rails as bank data) |

Key endpoints via GSP: `GET /gstr2a/b2b`, `GET /gstr2b/all`, GSTIN search (`/public/search`), filing-status track (`/gstr/rettrack`).

> GSTR-2A is dynamic (updates as suppliers file); re-fetch after the 11th of each month for full coverage. Only with explicit borrower consent — NBFCs cannot pull GSTR data without it.

### 2.2 Banking & cash flow — Account Aggregator

**Feeds:** `avg_bank_balance_inr`, `liquidity_ratio`, bounced-cheque *returns* visible in statements, future DSCR/cash-flow metrics.

| Route | Where | Access requirements |
|---|---|---|
| **AA network (the real path)** | **Sahamati** — register as **FIU**: [developer.sahamati.org.in](https://developer.sahamati.org.in) → Central Registry onboarding → ReBIT FIU API specs (`api.rebit.org.in/schema`) | Only RBI/SEBI/IRDAI/PFRDA-regulated entities may be FIUs (or their authorized tech partner); consent artefact required per fetch |
| **Via a licensed AA** | Partner with an AA (Setu, Finvu, CAMS Finvu, NADL) — they handle FIP connectivity | Commercial agreement + FIU compliance |
| **Manual fallback** | Borrower-uploaded PDF statements + parsers — **Precisa**, **Docstruct** (450+ banks, 1000+ formats) | Borrower upload; tamper-detection needed |

Core ReBIT flow: `POST /Consent` → borrower approves on AA app → `POST /FI/request` → `POST /FI/fetch` (signed FI JSON: profile, summary, transactions).

### 2.3 Credit & liabilities — Bureau

**Feeds:** `bounced_cheques_12m` (dishonoured-cheque segment), `existing_loan_obligations_inr`, `debt_to_revenue_ratio`; the ingested-but-unused `cibil_score`/`cibil_accounts`; future DPD / wilful-default / suit-filed checks.

| Route | Where | Access requirements |
|---|---|---|
| **Direct membership** | The 4 RBI-licensed CICs: **TransUnion CIBIL**, **Experian India** (`experiansolutions.in` — bureau membership form), **Equifax**, **CRIF High Mark** (strong MSME/rural coverage) | Bureau membership + borrower consent (CICRA/RBI guidelines); web-pull or batch APIs |
| **API hubs** | Experian API Hub (`experian.com/business-information/api-hub`), CIBIL/CRIF lender portals | Same as above; per-bureau schemas differ |
| **Aggregators (one integration)** | **FinBox**, **Precisa**, **LendSystem**, **Sandbox KYB** — multi-bureau pull, normalized JSON | Vendor contract; still needs borrower consent |

### 2.4 Registration & filings — MCA21, Udyam, GSTN registry, DigiLocker

**Feeds:** `vintage_years` (verified incorporation date → policy `min_vintage_years`); the ingested `mca_data`/`udyam_data`/`gstin_data`; document authenticity for ITR/audited accounts.

| Data | Where | Access requirements |
|---|---|---|
| **MCA (CIN, status, directors, charges)** | MCA21 portal (`mca.gov.in`) manually; **API Setu** (`apisetu.gov.in`); **Sandbox MCA API** (`POST /kyc/mca/company/master-data`, `GET` search) | API keys; partner onboarding |
| **Udyam / MSME registry** | `udyamregistration.gov.in` (public search); Udyam API = *Planned* in FUTURE_UPDATES | Public / API key |
| **GSTIN status** | GSTN public search via GSP (`/public/search`) | GSP key |
| **Verified documents** (incorporation cert, ITR, GST cert, AOC-4) | **DigiLocker / EntityLocker** — onboarding at [apisetu.gov.in/digilocker](https://apisetu.gov.in/digilocker) | Registered partner org + DSC + signed TOS; EntityLocker is consent-based (business rep authorizes) |

### 2.5 Alternative data

**Utility payment history** — *hardest; no national API:*

| Route | Where | Feeds |
|---|---|---|
| Discom/electricity portals | State discom consumer portals (e.g. Tata Power-DDL) expose history only to the **account holder** | `utility_payment_consistency` |
| AA utility FIPs | Some FIPs now include utility/bill accounts under AA consent | same |
| Interim pragmatic path | Borrower-consented bill/SMS upload + parsing | same |

**Telco & digital-footprint scores** (vendor-constructed 0-1 scores — exactly the shape your ingestion expects at `telecom_data.score` / `digital_footprint.score`):

| Vendor | What it returns | Feeds |
|---|---|---|
| **Sign3** (`sign3.ai`) | Phone/email → 100+ platform presence, identity/affluence scores, raw signals | `digital_footprint_score` |
| **Decentro** (User Profile API) | Digital footprint, social/behavior risk profile | `digital_footprint_score` |
| **RiskSeal**, **TrustDecision** | Digital-credit scores, behavioral intelligence | `digital_footprint_score`, `telecom_footprint_score` |
| **Telcosignal / Outris Traceflow** | SIM tenure, circle, network telemetry, trust score | `telecom_footprint_score` |

### 2.6 Legal — litigation / wilful default

**Feeds:** nothing yet (absent from backend; appears only in `designs/` mockups).

| Route | Where |
|---|---|
| Official (free, manual) | eCourts / NJDG (`ecourts.nic.in`) |
| API | **eCourtsIndia API** (`ecourtsindia.com/api` — REST + MCP, party/litigant search incl. NCLT/DRT/tribunals), **SignalX Litigation Checks API**, **Attestr** |
| Registry lists | RBI wilful-defaulter list, IBBI (IBC), SEBI debarment — via the aggregators above |

### 2.7 Accounting books

**Feeds:** `top_customer_concentration_pct`, `purchase_orders`/`bills` (ingested, unused), EBITDA cross-checks.

| Software | Where |
|---|---|
| **Tally** | TallyPrime ODBC/HTTP + TDL connectors; GSP bridges (e.g. Perimattic Tally↔GSTR connectors) |
| **Zoho Books/Invoice** | Public REST API (`zohoapis.in`) with OAuth org token |

---

## 3. Fastest integration assembly

One vendor per layer covers **every scored feature** except utility and footprint:

| Need | Shortest path | Replaces (seeded today) |
|---|---|---|
| GST: revenue, compliance, concentration | **1 GSP** — Sandbox or WhiteBooks (sandbox free, prod ~5 days KYC) | `gst_returns[]` |
| Bank: balances, bounces, loans | **Sahamati FIU + 1 AA** (Setu/Finvu) | `bank_statements[]` |
| Bureau: score, tradelines, cheques, wilful | **1 bureau aggregator** — FinBox/Precisa (or direct CRIF/Experian membership) | `cibil_*` |
| MCA / Udyam / GSTIN verify | **API Setu** + Sandbox KYB batch endpoints | `mca_data`, `udyam_data`, `gstin_data` |
| Documents: ITR, incorporation cert | **DigiLocker/EntityLocker** partner portal | `itr_filings`, `raw_manual.documents` |
| Digital/telco footprint | **Sign3** or **Decentro** (drop-in REST, matches 0-1 fields) | `telecom_data`, `digital_footprint` |
| Litigation | **eCourtsIndia API** or **SignalX** | *(no field yet)* |
| Utility | Slowest — borrower-consented uploads/SMS parsing first, AA utility FIPs later | `utility_payments[]` |

**Regulatory gates to expect:**
- Bureau pulls → borrower consent under CICRA
- AA → regulated-FIU status (or a partner FIU)
- GSP production keys → KYC + signed agreement
- DigiLocker → DSC + signed TOS
- GSTR/AA data → explicit per-fetch borrower consent (OTP)

Cross-reference: this covers all six rows in `FUTURE_UPDATES.md` §3 (GSTN, MCA, CIBIL/Experian, Udyam, Bank AA, DigiLocker), plus the Tally/Zoho item from §8.

---

## 4. Current-state appendix

**Ingested but with zero effect on score/decision** (accepted by `ingestion_service.py`, never read by scoring):

- `raw_government.cibil_score`, `cibil_accounts` — deliberately excluded (`ingestion_service.py:367-375`; comment reserves a future path)
- `raw_government.mca_data`, `gstin_data`, `udyam_data`
- `raw_financial.itr_filings` (validated for `assessment_year` only)
- `raw_business.purchase_orders`, `bills`
- `raw_manual.notes`, `documents[]`
- `annual_turnover_inr`, `employee_count`, GST `tax_paid`

**Absent from backend entirely** (design mockups only, `designs/*/code.html`):

- Litigation / court records, wilful default, director disqualification
- DSCR, debt-equity covenants, credit-card utilisation, registration-status checks
- AUA/KUA (not mentioned anywhere in the repo)

**Currently fabricated by** `backend/app/seed.py` — GST filing gaps (L127-155), bounces (L131/L171), utility on-time rates (L132), concentration (L173-193), bureau scores 520-820 (L227-231), MCA CIN/GSTIN/Udyam (L224-226), incorporation dates (L121).

---

*Related:* [`architecture.md`](architecture.md) (Layer 1 ingestion) · [`sample_credit_report.md`](sample_credit_report.md) (what the evaluation outputs) · [`../FUTURE_UPDATES.md`](../FUTURE_UPDATES.md) (integration roadmap)
