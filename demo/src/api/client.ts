import {
  mockLogin,
  mockMe,
  mockListMsmes,
  mockGetMsme,
  mockGetCreditReport,
  mockRunAssessment,
  mockListDecisions,
  mockSubmitFeedback,
  mockModelMonitor,
  mockPortfolioInsights,
  mockRetrain,
  mockAuditLog,
  mockGetScoreRuns,
} from '../mock/engine'

const TOKEN_KEY = 'credlens_token'

export const auth = {
  setToken(t: string) { localStorage.setItem(TOKEN_KEY, t) },
  getToken(): string | null { return localStorage.getItem(TOKEN_KEY) },
  clear() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('credlens_demo_user')
  },
}

// Simulated axios client for any direct api.get/api.post calls
export const api = {
  get: async <T = any>(url: string, _config?: any): Promise<{ data: T }> => {
    // Artificial small delay for realistic UI skeleton shimmer
    await new Promise((r) => setTimeout(r, 80))

    if (url.startsWith('/score/runs/')) {
      const parts = url.split('/')
      const msmeId = Number(parts[parts.length - 1])
      const data = await mockGetScoreRuns(msmeId)
      return { data: data as unknown as T }
    }
    if (url === '/admin/audit-log') {
      const data = await mockAuditLog()
      return { data: data as unknown as T }
    }
    if (url === '/admin/model-monitor') {
      const data = await mockModelMonitor()
      return { data: data as unknown as T }
    }
    if (url === '/government/portfolio-insights') {
      const data = await mockPortfolioInsights()
      return { data: data as unknown as T }
    }
    if (url.startsWith('/score/report/')) {
      const parts = url.split('/')
      const id = Number(parts[parts.length - 1])
      const data = await mockGetCreditReport(id)
      return { data: data as unknown as T }
    }
    if (url.startsWith('/msmes/')) {
      const parts = url.split('/')
      const id = Number(parts[parts.length - 1])
      const data = await mockGetMsme(id)
      return { data: data as unknown as T }
    }
    if (url === '/msmes') {
      const data = await mockListMsmes()
      return { data: data as unknown as T }
    }
    if (url === '/decisions') {
      const data = await mockListDecisions()
      return { data: data as unknown as T }
    }
    if (url === '/auth/me') {
      const data = await mockMe()
      return { data: data as unknown as T }
    }
    return { data: {} as T }
  },

  post: async <T = any>(url: string, body?: any): Promise<{ data: T }> => {
    await new Promise((r) => setTimeout(r, 120))

    if (url === '/auth/login') {
      const data = await mockLogin(body?.email, body?.password)
      return { data: data as unknown as T }
    }
    if (url === '/score/run') {
      const data = await mockRunAssessment(body?.msme_id)
      return { data: data as unknown as T }
    }
    if (url === '/feedback') {
      const data = await mockSubmitFeedback(body)
      return { data: data as unknown as T }
    }
    if (url === '/admin/model/retrain') {
      const data = await mockRetrain()
      return { data: data as unknown as T }
    }
    if (url.startsWith('/ingest/')) {
      return { data: { status: 'ingested', message: 'Payload received and verified' } as unknown as T }
    }
    return { data: {} as T }
  },
}

// ---------- Types ----------

export type UserRole = 'LENDER' | 'MSME' | 'GOVERNMENT' | 'ADMIN'

export interface TokenResponse {
  access_token: string
  token_type: string
  role: UserRole
  user_id: number
  name: string
  email: string
  msme_id?: number | null
}

export interface MSMEListItem {
  id: number
  legal_name: string
  sector: string
  state: string
  city: string
  annual_turnover_inr: number
  latest_score: number | null
  latest_grade: string | null
  latest_decision: string | null
}

export interface CreditPillars {
  financial_strength: number
  banking_quality: number
  tax_compliance: number
  bureau_record: number
  business_stability: number
}

export interface ScoreRun {
  id: number
  msme_id: number
  model_version: string
  credit_score: number
  risk_grade: string
  pd_default_12m: number
  red_flags: string[]
  score_breakdown: Record<string, any>
  created_at: string
}

export interface Decision {
  id: number
  msme_id: number
  score_run_id: number
  outcome: 'APPROVE' | 'REVIEW' | 'REJECT'
  recommended_limit_inr: number
  reason_codes: string[]
  rationale: string
  covenants?: string[]
  working_capital_mpbf_inr?: number
  term_loan_limit_inr?: number
  underwriting_summary?: Record<string, any>
  credit_score?: number | null
  risk_grade?: string | null
  created_at: string
}

export interface MSMEFinancialsData {
  avg_monthly_revenue_inr: number
  revenue_trend_pct: number
  ebitda_margin_pct: number
  gst_filings_expected: number
  gst_filings_done: number
  gst_compliance_ratio: number
  avg_bank_balance_inr: number
  bounced_cheques_12m: number
  existing_loan_obligations_inr: number
  utility_payment_consistency: number
  telecom_footprint_score: number
  digital_footprint_score: number
  top_customer_concentration_pct: number
  vintage_years: number
  dscr?: number
  interest_coverage_ratio?: number
  current_ratio?: number
  gst_vs_bank_turnover_variance_pct?: number
  cibil_cmr_rank?: number
  max_dpd_12m?: number
  active_credit_facilities?: number
  cash_withdrawal_ratio?: number
  data_trust_score?: number
  verification_badges?: string[]
}

export interface CreditReport {
  msme: Record<string, any>
  financials: MSMEFinancialsData | null
  score: ScoreRun | null
  decision: Decision | null
  policy_used: Record<string, any> | null
}

export interface ModelMonitorStats {
  model_version: string
  total_score_runs: number
  total_decisions: number
  total_feedback: number
  avg_credit_score: number
  grade_distribution: Record<string, number>
  decision_distribution: Record<string, number>
  feedback_distribution: Record<string, number>
}

export interface PortfolioInsights {
  total_msmes: number
  scored_msmes: number
  avg_credit_score: number
  total_recommended_exposure_inr: number
  grade_distribution: Record<string, number>
  decision_distribution: Record<string, number>
  sector_distribution: Record<string, number>
  state_distribution: Record<string, number>
}

// ---------- Typed API Functions ----------

export const api_login = (email: string, pass: string) => mockLogin(email, pass)
export const api_register = async (payload: any) => mockLogin(payload.email, payload.password)
export const api_me = () => mockMe()
export const api_list_msmes = (params?: { q?: string; sector?: string; state?: string; limit?: number }) =>
  mockListMsmes(params)
export const api_get_msme = (id: number) => mockGetMsme(id)
export const api_get_credit_report = (id: number) => mockGetCreditReport(id)
export const api_run_assessment = (msme_id: number) => mockRunAssessment(msme_id)
export const api_list_decisions = (params?: { outcome?: string; msme_id?: number }) => mockListDecisions(params)
export const api_submit_feedback = (payload: {
  decision_id: number
  outcome: 'PAID_ON_TIME' | 'DELAYED' | 'PARTIAL_DEFAULT' | 'NPA'
  days_past_due?: number
  notes?: string
}) => mockSubmitFeedback(payload)
export const api_model_monitor = () => mockModelMonitor()
export const api_portfolio_insights = () => mockPortfolioInsights()
export const api_retrain = () => mockRetrain()
export const api_audit_log = () => mockAuditLog()
