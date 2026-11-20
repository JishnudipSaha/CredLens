import seedMsmesRaw from './seed_msmes.json'
import type {
  CreditPillars,
  CreditReport,
  Decision,
  ModelMonitorStats,
  MSMEFinancialsData,
  MSMEListItem,
  PortfolioInsights,
  ScoreRun,
  TokenResponse,
  UserRole,
} from '../api/client'

// ---------- LocalStorage Keys ----------
const LS_INIT = 'credlens_demo_initialized_v2'
const LS_MSMES = 'credlens_demo_msmes_v2'
const LS_REPORTS = 'credlens_demo_reports_v2'
const LS_DECISIONS = 'credlens_demo_decisions_v2'
const LS_AUDIT = 'credlens_demo_audit_v2'
const LS_FEEDBACK = 'credlens_demo_feedback_v2'
const LS_TOKEN = 'credlens_token'
const LS_USER = 'credlens_demo_user'

// ---------- Demo Users ----------
export const DEMO_USERS: Record<string, { role: UserRole; name: string; org: string; pass: string; msmeId?: number }> = {
  'lender@credlens.in': { role: 'LENDER', name: 'Lender Demo', org: 'Demo Bank Ltd', pass: 'lender123' },
  'msme@credlens.in': { role: 'MSME', name: 'Acme Enterprises Owner', org: 'Acme Enterprises', pass: 'msme123', msmeId: 1 },
  'govt@credlens.in': { role: 'GOVERNMENT', name: 'Government Analyst', org: 'Ministry of MSME', pass: 'govt123' },
  'admin@credlens.in': { role: 'ADMIN', name: 'Platform Admin', org: 'CredLens Platform', pass: 'admin123' },
}

export interface StoredMSME {
  id: number
  legal_name: string
  trade_name?: string
  gstin: string
  pan: string
  udyam_number: string
  sector: string
  sub_sector: string
  state: string
  city: string
  incorporation_date: string
  employee_count: number
  annual_turnover_inr: number
  financials: MSMEFinancialsData
  raw_financial?: any
  raw_business?: any
  raw_alternative?: any
  raw_government?: any
  latest_score?: number | null
  latest_grade?: string | null
  latest_decision?: string | null
}

export interface StoredAuditRow {
  id: number
  created_at: string
  action: string
  actor_user_id?: number | null
  msme_id?: number | null
  endpoint?: string | null
  status_code?: number | null
  latency_ms?: number | null
  details?: any
}

// ---------- Engine Calculation Helpers ----------

export function gradeFromScore(score: number): string {
  if (score >= 800) return 'A'
  if (score >= 740) return 'B'
  if (score >= 680) return 'C'
  if (score >= 620) return 'D'
  if (score >= 560) return 'E'
  return 'F'
}

export function computePillars(fin: MSMEFinancialsData): CreditPillars {
  const dscr = fin.dscr ?? 1.5
  const ebitda = fin.ebitda_margin_pct ?? 10.0
  const debtRev = (fin.existing_loan_obligations_inr || 0) / Math.max(fin.avg_monthly_revenue_inr * 12, 1)
  const currRatio = fin.current_ratio ?? 1.33

  // 1. Financial Strength
  let finScore = 100
  if (dscr < 1.0) finScore -= 35
  else if (dscr < 1.25) finScore -= 15
  if (ebitda < 0) finScore -= 30
  else if (ebitda < 8) finScore -= 12
  if (debtRev > 0.4) finScore -= 20
  else if (debtRev > 0.25) finScore -= 10
  if (currRatio < 1.0) finScore -= 15
  const financial_strength = Math.max(15, Math.min(100, Math.round(finScore)))

  // 2. Banking Quality
  let bankScore = 100
  const bounced = fin.bounced_cheques_12m || 0
  bankScore -= bounced * 20
  const liquidityRatio = (fin.avg_bank_balance_inr || 0) / Math.max(fin.avg_monthly_revenue_inr * 12, 1)
  if (liquidityRatio < 0.05) bankScore -= 25
  const cashRatio = fin.cash_withdrawal_ratio ?? 0.05
  if (cashRatio > 0.20) bankScore -= 20
  const banking_quality = Math.max(15, Math.min(100, Math.round(bankScore)))

  // 3. Tax & Statutory Compliance
  const gstRatio = fin.gst_compliance_ratio ?? 1.0
  let taxScore = gstRatio * 100
  const varPct = Math.abs(fin.gst_vs_bank_turnover_variance_pct ?? 0)
  if (varPct > 25.0) taxScore -= 20
  else if (varPct > 15.0) taxScore -= 10
  const tax_compliance = Math.max(15, Math.min(100, Math.round(taxScore)))

  // 4. Bureau & Tradeline Record
  const cmr = fin.cibil_cmr_rank ?? 3
  const dpd = fin.max_dpd_12m ?? 0
  const cmrMap: Record<number, number> = { 1: 98, 2: 92, 3: 85, 4: 78, 5: 68, 6: 58, 7: 48, 8: 38, 9: 25, 10: 15 }
  let bureauScore = cmrMap[cmr] || 70
  if (dpd >= 60) bureauScore -= 30
  else if (dpd >= 30) bureauScore -= 15
  const bureau_record = Math.max(15, Math.min(100, Math.round(bureauScore)))

  // 5. Business Stability & Vintage
  let stabScore = 100
  const vintage = fin.vintage_years ?? 3.0
  if (vintage < 1) stabScore -= 25
  else if (vintage < 3) stabScore -= 10
  const topCust = fin.top_customer_concentration_pct ?? 0.3
  if (topCust > 0.65) stabScore -= 25
  else if (topCust > 0.45) stabScore -= 10
  const business_stability = Math.max(15, Math.min(100, Math.round(stabScore)))

  return {
    financial_strength,
    banking_quality,
    tax_compliance,
    bureau_record,
    business_stability,
  }
}

export function calculateNayakMPBF(avg_monthly_rev: number, grade: string) {
  const annual_turnover = Math.max(0, avg_monthly_rev * 12)
  const working_capital_requirement = Math.round(annual_turnover * 0.25)
  const promoter_margin = Math.round(annual_turnover * 0.05)
  const mpbf = Math.round(annual_turnover * 0.20)

  const gradeFactors: Record<string, number> = {
    A: 1.00,
    B: 0.85,
    C: 0.65,
    D: 0.40,
    E: 0.20,
    F: 0.00,
  }
  const factor = gradeFactors[grade] ?? 0
  const sanctioned_limit = Math.round(mpbf * factor)

  return {
    annual_turnover_inr: annual_turnover,
    working_capital_requirement_inr: working_capital_requirement,
    promoter_margin_inr: promoter_margin,
    mpbf_inr: mpbf,
    grade_multiplier: factor,
    sanctioned_limit_inr: sanctioned_limit,
  }
}

export function generateSanctionCovenants(outcome: string, grade: string): string[] {
  if (outcome === 'REJECT') return []
  const covenants = [
    'CP-1 (Primary Security): First exclusive charge by way of hypothecation on all current assets, stock-in-trade, and book debts of the MSME.',
    'CP-2 (Statutory Charge Creation): Creation and formal registration of charge on Ministry of Corporate Affairs portal (Form CHG-1) within 30 days of first drawdown.',
    'CP-3 (Promoter Guarantee): Unconditional, irrevocable, and continuous personal guarantee of all executive promoter directors.',
    'CP-4 (Cash Flow Routing): Minimum 75% of total business collection inflows to be strictly routed through the operative current account maintained with the lender.',
    'CP-5 (Statutory Covenants): Timely submission of quarterly stock and aged debtor statements certified by statutory auditors within 21 days from quarter end.',
  ]
  if (grade === 'C' || grade === 'D') {
    covenants.push('CP-6 (Enhanced Monitoring): Monthly submission of GST-3B challans and collateral coverage test maintenance of minimum 1.25x.')
  }
  return covenants
}

export function evaluateAssessment(msme: StoredMSME): { score: ScoreRun; decision: Decision } {
  const fin = msme.financials
  const red_flags: string[] = []
  let rulePenalty = 0

  if ((fin.gst_compliance_ratio ?? 1) < 0.6) {
    rulePenalty += 35
    red_flags.push('GST compliance below 60%')
  } else if ((fin.gst_compliance_ratio ?? 1) < 0.8) {
    rulePenalty += 15
    red_flags.push('Inconsistent GST filings')
  }

  const bounced = fin.bounced_cheques_12m || 0
  if (bounced >= 3) {
    rulePenalty += 30
    red_flags.push(`High bounced cheques: ${bounced} in last 12 months`)
  } else if (bounced >= 1) {
    rulePenalty += 10
  }

  const revTrend = fin.revenue_trend_pct ?? 0
  if (revTrend < -20) {
    rulePenalty += 20
    red_flags.push(`Revenue declined ${Math.abs(revTrend).toFixed(0)}% over period`)
  }

  const conc = fin.top_customer_concentration_pct ?? 0
  if (conc > 0.7) {
    rulePenalty += 15
    red_flags.push(`Customer concentration risk: ${(conc * 100).toFixed(0)}% from top customer`)
  }

  const debtRatio = (fin.existing_loan_obligations_inr || 0) / Math.max(fin.avg_monthly_revenue_inr * 12, 1)
  if (debtRatio > 0.5) {
    rulePenalty += 20
    red_flags.push('Debt exceeds 50% of annual revenue')
  }

  const liqRatio = (fin.avg_bank_balance_inr || 0) / Math.max(fin.avg_monthly_revenue_inr * 12, 1)
  if (liqRatio < 0.05) {
    rulePenalty += 15
    red_flags.push('Low liquidity: bank balance <5% of annual revenue')
  }

  const dscr = fin.dscr ?? 1.5
  if ((fin.existing_loan_obligations_inr || 0) > 0) {
    if (dscr < 1.0) {
      rulePenalty += 20
      red_flags.push(`DSCR critical: ${dscr.toFixed(2)}x (operating cash insufficient to service debt)`)
    } else if (dscr < 1.25) {
      rulePenalty += 8
      red_flags.push(`DSCR weak: ${dscr.toFixed(2)}x below banking benchmark 1.25x`)
    }
  }

  const cmr = fin.cibil_cmr_rank ?? 3
  if (cmr >= 8) {
    rulePenalty += 20
    red_flags.push(`CIBIL CMR Rank ${cmr}: Elevated commercial bureau risk`)
  } else if (cmr >= 6) {
    rulePenalty += 8
    red_flags.push(`CIBIL CMR Rank ${cmr}: Moderate bureau delinquency risk`)
  }

  const varPct = fin.gst_vs_bank_turnover_variance_pct ?? 0
  if (Math.abs(varPct) > 25.0) {
    rulePenalty += 12
    red_flags.push(`Turnover reconciliation mismatch: GST vs Bank variance is ${varPct.toFixed(1)}%`)
  }

  // Base ML score simulation
  const mlBase = 840 + Math.min(60, (fin.avg_monthly_revenue_inr / 100000) * 2) - ((cmr - 1) * 15)
  const finalScore = Math.max(300, Math.min(900, Math.round(mlBase - rulePenalty)))
  const grade = gradeFromScore(finalScore)
  const pd = Math.max(0.01, Math.min(0.99, Number(((900 - finalScore) / 600).toFixed(4))))

  const pillars = computePillars(fin)
  const mpbf = calculateNayakMPBF(fin.avg_monthly_revenue_inr, grade)

  // Policy Evaluation
  const hardReject = (fin.gst_compliance_ratio ?? 1) < 0.5 || bounced > 5 || (dscr < 0.8 && (fin.existing_loan_obligations_inr || 0) > 0)
  const violations: string[] = []
  const reasonCodes: string[] = []

  if (hardReject) {
    if ((fin.gst_compliance_ratio ?? 1) < 0.5) violations.push('HARD_REJECT_GST_BELOW_50')
    if (bounced > 5) violations.push('HARD_REJECT_BOUNCED_OVER_5')
    if (dscr < 0.8) violations.push('HARD_REJECT_DSCR_CRITICAL')
  } else {
    if (finalScore >= 700) reasonCodes.push('MIN_SCORE_OK')
    else violations.push('BELOW_MIN_SCORE_THRESHOLD')

    if ((fin.gst_compliance_ratio ?? 1) >= 0.8) reasonCodes.push('GST_COMPLIANCE_OK')
    else violations.push('GST_COMPLIANCE_BELOW_POLICY')

    if (bounced <= 2) reasonCodes.push('BOUNCED_CHEQUES_OK')
    else violations.push('BOUNCED_CHEQUES_OVER_POLICY')

    if (dscr >= 1.25) reasonCodes.push('DSCR_BENCHMARK_OK')
    else violations.push('DSCR_BELOW_BENCHMARK')

    if (cmr <= 5) reasonCodes.push('CIBIL_CMR_OK')
    else violations.push('CIBIL_CMR_ELEVATED')
  }

  let outcome: 'APPROVE' | 'REVIEW' | 'REJECT'
  let rationale = ''

  if (hardReject) {
    outcome = 'REJECT'
    rationale = `Hard reject triggered: ${violations.join(', ')}`
  } else if (violations.length === 0 && finalScore >= 700 && mpbf.sanctioned_limit_inr > 0) {
    outcome = 'APPROVE'
    rationale = `Auto-approved. Grade ${grade}, score ${finalScore}, Nayak MPBF limit INR ${mpbf.sanctioned_limit_inr.toLocaleString('en-IN')}.`
  } else if (violations.length <= 1 && finalScore >= 600) {
    outcome = 'REVIEW'
    rationale = `Sent for manual credit review. Grade ${grade}, score ${finalScore}. ${violations.join('; ') || 'borderline metrics'}.`
  } else {
    outcome = 'REJECT'
    rationale = `Rejected. Grade ${grade}, score ${finalScore}. ${violations.join('; ') || 'score below institutional threshold'}.`
  }

  const covenants = generateSanctionCovenants(outcome, grade)

  const scoreRunId = Date.now() + msme.id
  const decisionId = scoreRunId + 1

  const score: ScoreRun = {
    id: scoreRunId,
    msme_id: msme.id,
    model_version: 'v1.2-institutional-demo',
    credit_score: finalScore,
    risk_grade: grade,
    pd_default_12m: pd,
    red_flags,
    score_breakdown: {
      model_version: 'v1.2-institutional-demo',
      ml_score: Math.round(mlBase),
      rules_penalty: rulePenalty,
      final_score: finalScore,
      grade,
      pillars,
      data_trust_score: fin.data_trust_score ?? 85,
      verification_badges: fin.verification_badges ?? ['AA_VERIFIED', 'GSTN_VERIFIED', 'MCA_VERIFIED', 'BUREAU_VERIFIED'],
    },
    created_at: new Date().toISOString(),
  }

  const decision: Decision = {
    id: decisionId,
    msme_id: msme.id,
    score_run_id: scoreRunId,
    outcome,
    recommended_limit_inr: mpbf.sanctioned_limit_inr,
    working_capital_mpbf_inr: mpbf.mpbf_inr,
    underwriting_summary: mpbf,
    covenants,
    reason_codes: [...reasonCodes, ...violations],
    rationale,
    credit_score: finalScore,
    risk_grade: grade,
    created_at: new Date().toISOString(),
  }

  return { score, decision }
}

// ---------- Store Initialization ----------

export function initDemoStore() {
  if (typeof window === 'undefined') return
  const isInit = localStorage.getItem(LS_INIT)
  if (isInit) return

  const msmesList: StoredMSME[] = JSON.parse(JSON.stringify(seedMsmesRaw))
  const reportsMap: Record<number, CreditReport> = {}
  const decisionsList: Decision[] = []
  const auditLogs: StoredAuditRow[] = []

  // Pre-assess first 20 MSMEs
  for (let i = 0; i < msmesList.length; i++) {
    const m = msmesList[i]
    if (i < 20) {
      const { score, decision } = evaluateAssessment(m)
      m.latest_score = score.credit_score
      m.latest_grade = score.risk_grade
      m.latest_decision = decision.outcome

      reportsMap[m.id] = {
        msme: m,
        financials: m.financials,
        score,
        decision,
        policy_used: { name: 'Default Bank Policy', auto_approve_score: 700, review_min_score: 600 },
      }
      decisionsList.push(decision)

      auditLogs.push({
        id: i + 1,
        created_at: new Date(Date.now() - (20 - i) * 3600000).toISOString(),
        action: 'ASSESSMENT_RUN',
        actor_user_id: 1,
        msme_id: m.id,
        endpoint: '/api/v1/score/run',
        status_code: 200,
        latency_ms: 124,
      })
    } else {
      m.latest_score = null
      m.latest_grade = null
      m.latest_decision = null
    }
  }

  localStorage.setItem(LS_MSMES, JSON.stringify(msmesList))
  localStorage.setItem(LS_REPORTS, JSON.stringify(reportsMap))
  localStorage.setItem(LS_DECISIONS, JSON.stringify(decisionsList))
  localStorage.setItem(LS_AUDIT, JSON.stringify(auditLogs))
  localStorage.setItem(LS_FEEDBACK, JSON.stringify([]))
  localStorage.setItem(LS_INIT, 'true')
}

// Ensure store is ready
initDemoStore()

// ---------- Helper Getters / Setters ----------

function getMsmes(): StoredMSME[] {
  try {
    const raw = localStorage.getItem(LS_MSMES)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveMsmes(list: StoredMSME[]) {
  localStorage.setItem(LS_MSMES, JSON.stringify(list))
}

function getReports(): Record<number, CreditReport> {
  try {
    const raw = localStorage.getItem(LS_REPORTS)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveReports(map: Record<number, CreditReport>) {
  localStorage.setItem(LS_REPORTS, JSON.stringify(map))
}

function getDecisions(): Decision[] {
  try {
    const raw = localStorage.getItem(LS_DECISIONS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveDecisions(list: Decision[]) {
  localStorage.setItem(LS_DECISIONS, JSON.stringify(list))
}

function getAudit(): StoredAuditRow[] {
  try {
    const raw = localStorage.getItem(LS_AUDIT)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function logAudit(action: string, msme_id?: number, details?: any) {
  const list = getAudit()
  const newRow: StoredAuditRow = {
    id: list.length + 1,
    created_at: new Date().toISOString(),
    action,
    actor_user_id: 1,
    msme_id,
    endpoint: `/api/v1/${action.toLowerCase()}`,
    status_code: 200,
    latency_ms: Math.floor(Math.random() * 80) + 40,
    details,
  }
  list.unshift(newRow)
  localStorage.setItem(LS_AUDIT, JSON.stringify(list.slice(0, 100)))
}

// ---------- Exported Mock API Functions ----------

export async function mockLogin(email: string, pass: string): Promise<TokenResponse> {
  const user = DEMO_USERS[email]
  if (!user || user.pass !== pass) {
    throw new Error('Invalid email or password.')
  }
  const token = `demo-token-${user.role.toLowerCase()}-${Date.now()}`
  const userObj = {
    access_token: token,
    token_type: 'bearer',
    role: user.role,
    user_id: user.role === 'LENDER' ? 1 : user.role === 'MSME' ? 2 : user.role === 'GOVERNMENT' ? 3 : 4,
    name: user.name,
    email,
    msme_id: user.msmeId || (user.role === 'MSME' ? 1 : null),
  }
  localStorage.setItem(LS_TOKEN, token)
  localStorage.setItem(LS_USER, JSON.stringify(userObj))
  logAudit('USER_LOGIN')
  return userObj
}

export async function mockMe(): Promise<any> {
  const raw = localStorage.getItem(LS_USER)
  if (raw) return JSON.parse(raw)
  return mockLogin('lender@credlens.in', 'lender123')
}

export async function mockListMsmes(params?: { q?: string; sector?: string; state?: string; limit?: number }): Promise<MSMEListItem[]> {
  const list = getMsmes()
  let filtered = [...list]
  if (params?.q) {
    const q = params.q.toLowerCase()
    filtered = filtered.filter((m) => m.legal_name.toLowerCase().includes(q) || m.gstin.toLowerCase().includes(q) || m.city.toLowerCase().includes(q))
  }
  if (params?.sector) {
    filtered = filtered.filter((m) => m.sector.toLowerCase() === params.sector!.toLowerCase())
  }
  if (params?.state) {
    filtered = filtered.filter((m) => m.state.toLowerCase() === params.state!.toLowerCase())
  }
  if (params?.limit) {
    filtered = filtered.slice(0, params.limit)
  }
  return filtered.map((m) => ({
    id: m.id,
    legal_name: m.legal_name,
    sector: m.sector,
    state: m.state,
    city: m.city,
    annual_turnover_inr: m.annual_turnover_inr,
    latest_score: m.latest_score ?? null,
    latest_grade: m.latest_grade ?? null,
    latest_decision: m.latest_decision ?? null,
  }))
}

export async function mockGetMsme(id: number): Promise<StoredMSME> {
  const list = getMsmes()
  const m = list.find((item) => item.id === id)
  if (!m) throw new Error(`MSME #${id} not found`)
  return m
}

export async function mockGetCreditReport(id: number): Promise<CreditReport> {
  const reports = getReports()
  if (reports[id]) return reports[id]
  const m = await mockGetMsme(id)
  return {
    msme: m,
    financials: m.financials,
    score: null,
    decision: null,
    policy_used: null,
  }
}

export async function mockRunAssessment(msmeId: number): Promise<CreditReport> {
  const list = getMsmes()
  const idx = list.findIndex((m) => m.id === msmeId)
  if (idx === -1) throw new Error(`MSME #${msmeId} not found`)

  const m = list[idx]
  const { score, decision } = evaluateAssessment(m)

  m.latest_score = score.credit_score
  m.latest_grade = score.risk_grade
  m.latest_decision = decision.outcome
  list[idx] = m
  saveMsmes(list)

  const reports = getReports()
  const report: CreditReport = {
    msme: m,
    financials: m.financials,
    score,
    decision,
    policy_used: { name: 'Default Bank Policy', auto_approve_score: 700, review_min_score: 600 },
  }
  reports[msmeId] = report
  saveReports(reports)

  const decisions = getDecisions()
  decisions.unshift(decision)
  saveDecisions(decisions)

  logAudit('ASSESSMENT_RUN', msmeId, { score: score.credit_score, outcome: decision.outcome })

  return report
}

export async function mockListDecisions(params?: { outcome?: string; msme_id?: number }): Promise<Decision[]> {
  let list = getDecisions()
  if (params?.outcome) {
    list = list.filter((d) => d.outcome === params.outcome)
  }
  if (params?.msme_id) {
    list = list.filter((d) => d.msme_id === params.msme_id)
  }
  return list
}

export async function mockSubmitFeedback(payload: {
  decision_id: number
  outcome: 'PAID_ON_TIME' | 'DELAYED' | 'PARTIAL_DEFAULT' | 'NPA'
  days_past_due?: number
  notes?: string
}) {
  const feedbacks = JSON.parse(localStorage.getItem(LS_FEEDBACK) || '[]')
  feedbacks.push({ ...payload, created_at: new Date().toISOString() })
  localStorage.setItem(LS_FEEDBACK, JSON.stringify(feedbacks))
  logAudit('FEEDBACK_SUBMITTED', undefined, payload)
  return { status: 'recorded', decision_id: payload.decision_id }
}

export async function mockModelMonitor(): Promise<ModelMonitorStats> {
  const msmes = getMsmes()
  const decisions = getDecisions()
  const feedbacks = JSON.parse(localStorage.getItem(LS_FEEDBACK) || '[]')

  const scored = msmes.filter((m) => m.latest_score != null)
  const avgScore = scored.length ? scored.reduce((acc, m) => acc + (m.latest_score || 0), 0) / scored.length : 715

  const gradeDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
  scored.forEach((m) => {
    if (m.latest_grade) gradeDist[m.latest_grade] = (gradeDist[m.latest_grade] || 0) + 1
  })

  const decDist: Record<string, number> = { APPROVE: 0, REVIEW: 0, REJECT: 0 }
  decisions.forEach((d) => {
    decDist[d.outcome] = (decDist[d.outcome] || 0) + 1
  })

  const feedDist: Record<string, number> = {
    PAID_ON_TIME: 14,
    DELAYED: 4,
    PARTIAL_DEFAULT: 2,
    NPA: 1,
  }
  feedbacks.forEach((f: any) => {
    if (f.outcome) feedDist[f.outcome] = (feedDist[f.outcome] || 0) + 1
  })

  return {
    model_version: 'v1.2-institutional-demo',
    total_score_runs: decisions.length,
    total_decisions: decisions.length,
    total_feedback: Object.values(feedDist).reduce((a, b) => a + b, 0),
    avg_credit_score: Math.round(avgScore),
    grade_distribution: gradeDist,
    decision_distribution: decDist,
    feedback_distribution: feedDist,
  }
}

export async function mockPortfolioInsights(): Promise<PortfolioInsights> {
  const msmes = getMsmes()
  const decisions = getDecisions()
  const scored = msmes.filter((m) => m.latest_score != null)
  const avgScore = scored.length ? scored.reduce((acc, m) => acc + (m.latest_score || 0), 0) / scored.length : 720
  const totalExposure = decisions.reduce((acc, d) => acc + (d.recommended_limit_inr || 0), 0)

  const gradeDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }
  scored.forEach((m) => {
    if (m.latest_grade) gradeDist[m.latest_grade] = (gradeDist[m.latest_grade] || 0) + 1
  })

  const decDist: Record<string, number> = { APPROVE: 0, REVIEW: 0, REJECT: 0 }
  decisions.forEach((d) => {
    decDist[d.outcome] = (decDist[d.outcome] || 0) + 1
  })

  const secDist: Record<string, number> = {}
  const stateDist: Record<string, number> = {}
  msmes.forEach((m) => {
    secDist[m.sector] = (secDist[m.sector] || 0) + 1
    stateDist[m.state] = (stateDist[m.state] || 0) + 1
  })

  return {
    total_msmes: msmes.length,
    scored_msmes: scored.length,
    avg_credit_score: Math.round(avgScore),
    total_recommended_exposure_inr: totalExposure,
    grade_distribution: gradeDist,
    decision_distribution: decDist,
    sector_distribution: secDist,
    state_distribution: stateDist,
  }
}

export async function mockRetrain(): Promise<any> {
  logAudit('MODEL_RETRAINED', undefined, { model_version: 'v1.3-feedback-trained' })
  return {
    status: 'retrained',
    model_version: 'v1.3-feedback-trained',
    samples_used: 48,
    accuracy: 0.94,
    data: {
      metrics: {
        test_auc: 0.942,
      },
    },
  }
}

export async function mockAuditLog(): Promise<StoredAuditRow[]> {
  return getAudit()
}

export async function mockGetScoreRuns(msmeId: number): Promise<ScoreRun[]> {
  const reports = getReports()
  const r = reports[msmeId]
  if (r && r.score) return [r.score]
  return []
}
