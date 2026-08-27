import axios, { AxiosInstance } from 'axios'

const TOKEN_KEY = 'credlens_token'

// In production, set VITE_API_BASE to the backend URL, e.g.
// VITE_API_BASE=https://credlens-backend.onrender.com/api/v1
// In dev, leave it empty so the Vite proxy on /api -> :8000 handles routing.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api/v1'

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

export const auth = {
  setToken(t: string) { localStorage.setItem(TOKEN_KEY, t) },
  getToken(): string | null { return localStorage.getItem(TOKEN_KEY) },
  clear() { localStorage.removeItem(TOKEN_KEY) },
}

// ---------- typed endpoints ----------

export type UserRole = 'LENDER' | 'MSME' | 'GOVERNMENT' | 'ADMIN'

export interface TokenResponse {
  access_token: string
  token_type: string
  role: UserRole
  user_id: number
  name: string
  email: string
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

export interface ScoreRun {
  id: number
  msme_id: number
  model_version: string
  credit_score: number
  risk_grade: string
  pd_default_12m: number
  red_flags: string[]
  score_breakdown: Record<string, unknown>
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
  created_at: string
}

export interface CreditReport {
  msme: Record<string, unknown>
  financials: Record<string, unknown> | null
  score: ScoreRun | null
  decision: Decision | null
  policy_used: Record<string, unknown> | null
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

// ---- API methods ----

export const api_login = (email: string, password: string) =>
  api.post<TokenResponse>('/auth/login', { email, password }).then((r) => r.data)

export const api_register = (payload: {
  email: string
  name: string
  password: string
  role: UserRole
  org_name?: string
}) => api.post<TokenResponse>('/auth/register', payload).then((r) => r.data)

export const api_me = () => api.get('/auth/me').then((r) => r.data)

export const api_list_msmes = (params?: { q?: string; sector?: string; state?: string; limit?: number }) =>
  api.get<MSMEListItem[]>('/msmes', { params }).then((r) => r.data)

export const api_get_msme = (id: number) => api.get(`/msmes/${id}`).then((r) => r.data)
export const api_get_credit_report = (id: number) => api.get<CreditReport>(`/score/report/${id}`).then((r) => r.data)
export const api_run_assessment = (msme_id: number) =>
  api.post<CreditReport>('/score/run', { msme_id }).then((r) => r.data)
export const api_list_decisions = (params?: { outcome?: string; msme_id?: number }) =>
  api.get<Decision[]>('/decisions', { params }).then((r) => r.data)
export const api_submit_feedback = (payload: {
  decision_id: number
  outcome: 'PAID_ON_TIME' | 'DELAYED' | 'PARTIAL_DEFAULT' | 'NPA'
  days_past_due?: number
  notes?: string
}) => api.post('/feedback', payload).then((r) => r.data)
export const api_model_monitor = () => api.get<ModelMonitorStats>('/admin/model-monitor').then((r) => r.data)
export const api_portfolio_insights = () => api.get<PortfolioInsights>('/government/portfolio-insights').then((r) => r.data)
export const api_retrain = () => api.post('/admin/model/retrain').then((r) => r.data)
export const api_audit_log = () => api.get('/admin/audit-log').then((r) => r.data)
