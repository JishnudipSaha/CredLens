# CredLens — Future Updates Roadmap

> Living document. Items are grouped by theme and roughly ordered by priority within each theme.
> Status legend: `Planned` · `In Progress` · `Shipped`

---

## 1. Regional In-App Language Service

**Status:** Planned

### Why

CredLens serves lenders, MSMEs, and government stakeholders across India. Many MSME owners and field officers interact more comfortably in regional languages. An in-app language layer makes the platform accessible without relying on browser-level translation.

### Scope

| Phase | Deliverables |
|-------|-------------|
| **Phase 1 — Framework** | i18n infrastructure (`react-i18next` or similar), locale detection, language switcher in user profile |
| **Phase 2 — Hindi + English** | Full Hindi translation of all UI strings, labels, error messages, credit report narratives |
| **Phase 3 — 8 Regional Languages** | Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, Odia |
| **Phase 4 — Dynamic Content** | Credit report summaries, reason codes, improvement tips, and red flag descriptions rendered in the user's preferred language |

### Key Decisions

- **String management:** External JSON/YAML files per locale; CI validates completeness before merge.
- **ML model output:** Reason codes remain English identifiers internally; human-readable translations are applied at the presentation layer only.
- **RTL support:** Not required for Indian languages but the architecture should not preclude it.
- **Fallback:** English is always the fallback. Missing strings log a warning in dev mode.

### Technical Notes

- Add a `locale` field to the `User` model and expose it via the auth profile endpoint.
- Backend PDF/CSV exports should accept a `lang` query parameter to render section headers and narratives in the chosen language.
- Seed a `locales/` directory at the project root: `locales/en.json`, `locales/hi.json`, etc.

---

## 2. RAG-Based System for Usability & Easy Data Access

**Status:** Planned

### Why

CredLens ingests financial statements, GST returns, invoices, government filings, and alternative data. Currently, users must navigate structured views and manual filters to find what they need. A Retrieval-Augmented Generation (RAG) layer lets users ask natural-language questions and receive grounded answers drawn directly from the MSME's ingested documents.

### Architecture

```
User Query (natural language)
        |
        v
+-------------------+       +---------------------+
|  Query Router     | ----> |  Embedding Service   |
|  (intent detect)  |       |  (text-embedding-3)  |
+-------------------+       +----------+----------+
                                           |
                                           v
                                +---------------------+
                                |  Vector Store       |
                                |  (Qdrant / pgvec)   |
                                |  per-MSME collections|
                                +----------+----------+
                                           |
                                           v
                                +---------------------+
                                |  LLM (GPT-4 /       |
                                |  Claude / Gemini)    |
                                +----------+----------+
                                           |
                                           v
                                Grounded Answer + Source Citations
```

### Scope

| Phase | Deliverables |
|-------|-------------|
| **Phase 1 — Ingestion Pipeline** | Chunk ingested documents (bank statements, GST returns, invoices, filings) into ~512-token segments; embed and upsert into a vector store partitioned by `msme_id` |
| **Phase 2 — Query Engine** | FastAPI `/api/v1/chat` endpoint; retrieve top-k chunks, inject into LLM prompt, return answer with source references (`msme_id`, document type, record index) |
| **Phase 3 — Frontend Chat** | Conversational sidebar panel on MSME Report and Lender Dashboard; streaming responses; clickable source citations |
| **Phase 4 — Advanced Queries** | Multi-hop questions ("compare Q1 vs Q2 GST compliance"), document summarization, anomaly highlighting |

### Data Flow

1. **On ingestion** (Layer 1): after `ingestion_service` persists raw data, a new `rag_indexer` service chunks the records, calls the embedding model, and upserts vectors into the store.
2. **On query**: the chat endpoint retrieves relevant chunks, constructs a prompt with system instructions ("You are a credit analyst assistant..."), calls the LLM, and streams the response back.
3. **On feedback**: user ratings on answer quality feed back into retrieval tuning (re-ranking weights, chunk-size experiments).

### Key Decisions

- **Vector store:** Start with Qdrant (self-hosted, lightweight) or pgvector if sticking with PostgreSQL for prod. SQLite is not suitable.
- **Embedding model:** `text-embedding-3-small` (OpenAI) or `bge-small-en` (open-source fallback).
- **Chunking strategy:** 512 tokens with 50-token overlap. Documents with tabular data (bank statements, GST returns) are chunked per-row with metadata (`month`, `period`, `field_name`).
- **Access control:** Queries are scoped to the user's role. An MSME can only query their own data. A lender queries MSMEs they have assessment access to.
- **Cost control:** Cache frequent queries; cap context window at 4K tokens per query; expose a "usage" counter in the admin dashboard.

### Technical Notes

- Add `app/services/rag_service.py` and `app/api/chat.py`.
- Store chunk metadata in a `rag_chunks` table: `id`, `msme_id`, `doc_type`, `record_index`, `text`, `embedding`, `created_at`.
- The vector store is external (Docker service or managed). The backend connects via env var `VECTOR_STORE_URL`.
- Frontend adds a `ChatPanel.tsx` component with markdown rendering and citation links.

---

## 3. Real-World Data Integrations

**Status:** Planned

| Integration | API | What it replaces |
|-------------|-----|-----------------|
| GSTN (GST Network) | GSTN API v2 | Synthetic GST returns |
| MCA (Ministry of Corporate Affairs) | MCA21 API | Synthetic director/filing data |
| CIBIL / Experian | Bureau pull API | Synthetic credit history |
| Udyam Registration | Udyam API | Synthetic MSME registration |
| Bank Account Aggregator (AA) | Sahamati AA framework | Synthetic bank statements |
| DigiLocker | DigiLocker API | Document verification |

### Implementation Notes

- Each integration lives in `app/integrations/` as a module with a standard interface: `fetch(msme_id) -> RawData`.
- The ingestion service calls integrations in sequence, merges results, and deduplicates.
- API keys and credentials stored in environment variables, never in code.
- A "data source health" dashboard for admins shows integration status, last sync time, and error rates.

---

## 4. Enhanced ML & Analytics

### 4a. Real Data Model Retraining

- Move from synthetic-only training to a hybrid approach: synthetic data for cold-start, real feedback data for ongoing retraining.
- Implement automated weekly retraining pipeline with A/B testing (shadow deployment of new model version).
- Add SHAP-based feature importance explanations to every credit report.

### 4b. Sector-Specific Models

- Train separate models for Manufacturing, Retail, Services, IT, and Agriculture sectors.
- Sector models capture domain-specific risk signals (e.g., inventory turnover matters more in retail).

### 4c. Time-Series Forecasting

- Revenue trajectory forecasting using Prophet or similar.
- Predict future GST compliance based on historical filing patterns.
- Cash flow runway estimation.

### 4d. Anomaly Detection

- Auto-flag unusual patterns: sudden revenue spikes, irregular GST filings, unusual bounced cheque clusters.
- Present anomalies as a dedicated "Anomalies" tab in the credit report.

---

## 5. Platform & Infrastructure

### 5a. Multi-Tenancy

- Support multiple lending organizations (banks, NBFCs) with isolated data and policies.
- Tenant-scoped JWT claims; row-level security in the database.
- Per-tenant branding (logo, color scheme) on reports and exports.

### 5b. Production Database

- Migrate from SQLite to PostgreSQL for concurrent access, transactions, and pgvector.
- Database migration tooling (Alembic).
- Connection pooling (PgBouncer or built-in SQLAlchemy pool).

### 5c. Authentication Hardening

- OAuth2 / OIDC integration (Google Workspace, Microsoft Entra ID for enterprise lenders).
- Multi-factor authentication (TOTP / SMS).
- Session management with device tracking and forced logout.

### 5d. API Rate Limiting & Quotas

- Per-user and per-tenant rate limits.
- Usage dashboards for API consumers.
- Webhook support for event-driven integrations (e.g., notify lender when assessment completes).

### 5e. PDF & Excel Report Export

- One-click download of credit reports as branded PDF.
- Excel export for portfolio-level data and MSME search results.
- Server-side generation using WeasyPrint or ReportLab.

---

## 6. Frontend Enhancements

### 6a. Real-Time Notifications

- WebSocket-based alerts: new assessment ready, feedback recorded, model retrained.
- In-app notification center with read/unread state.
- Email digest option for daily/weekly summary.

### 6b. Advanced Search & Filters

- Full-text search across MSME names, GSTINs, sectors, and states.
- Saved search presets ("My high-risk portfolio", "Manufacturing in Tamil Nadu").
- Column sorting, pagination, and export from any list view.

### 6c. Dashboard Customization

- Drag-and-drop widget layout for lender and admin dashboards.
- Custom KPI cards (e.g., "Average score this quarter", "Total approved limit").
- Dark mode refinements and high-contrast accessibility mode.

### 6d. Mobile Responsive (PWA)

- Progressive Web App for MSME data upload on phones.
- Responsive sidebar collapses to bottom nav on small screens.
- Offline-capable data entry with sync on reconnect.

---

## 7. Compliance & Governance

| Item | Description |
|------|-------------|
| **Audit Trail Enhancements** | Immutable audit log with cryptographic hashing (tamper-evident). Exportable for regulatory review. |
| **Data Retention Policies** | Configurable retention periods per data type. Automated purge jobs. |
| **Consent Management** | MSMEs explicitly consent to data sharing with specific lenders. Consent audit trail. |
| **RBAC Granularity** | Fine-grained permissions beyond 4 roles (e.g., "junior analyst can view but not approve"). |
| **PDPA / Data Localization** | Ensure all data stays within Indian borders. Data residency tags on storage. |

---

## 8. Ecosystem & Partnerships

- **Tally / Zoho integration:** Pull accounting data directly from popular MSME software.
- **India Stack integration:** Leverage ONDC, Account Aggregator, and DigiLocker for real-time data.
- **Credit guarantee schemes:** Auto-apply for CGTMSE / PMEGP based on assessment results.
- **Lender marketplace:** anonymized risk-profile matching between MSMEs and lenders willing to serve their segment.

---

## Contributing

If you'd like to pick up any item from this roadmap, open an issue to discuss the approach before starting implementation. Reference the item number (e.g., "RAG Phase 1") in the issue title.

---

*Last updated: 2026-09-20*
