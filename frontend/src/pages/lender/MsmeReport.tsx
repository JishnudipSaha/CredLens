import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api_get_credit_report, api_run_assessment, api_submit_feedback, type CreditReport } from '../../api/client'
import { Card, EmptyState, Spinner, Stat, Badge } from '../../components/UI'
import { ScoreGauge } from '../../components/ScoreGauge'
import { formatINR, formatNumber, formatPct, outcomeColor } from '../../utils/format'
import { useReveal } from '../../hooks/useReveal'

export default function MsmeReport() {
  const { id } = useParams<{ id: string }>()
  const msmeId = Number(id)
  const navigate = useNavigate()
  const [report, setReport] = useState<CreditReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  const load = () => {
    setLoading(true)
    api_get_credit_report(msmeId).then(setReport).finally(() => setLoading(false))
  }
  useEffect(load, [msmeId])

  const run = async () => {
    setRunning(true); setError(null)
    try { await api_run_assessment(msmeId); load() }
    catch (e: any) { setError(e?.response?.data?.detail || 'Assessment failed') }
    finally { setRunning(false) }
  }

  const submitFeedback = async (outcome: 'PAID_ON_TIME' | 'DELAYED' | 'PARTIAL_DEFAULT' | 'NPA') => {
    if (!report?.decision) return
    try {
      await api_submit_feedback({ decision_id: report.decision.id, outcome })
      setFeedbackSent(outcome)
    } catch (e: any) { setError(e?.response?.data?.detail || 'Feedback failed') }
  }

  if (loading) return <Spinner />
  if (!report) return <EmptyState title="MSME not found" />

  const msme: any = report.msme
  const fin: any = report.financials || {}
  const score = report.score
  const decision = report.decision
  const breakdown: any = score?.score_breakdown || {}

  return (
    <div ref={containerRef} className="space-y-5">
      <div data-reveal className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">&larr; Back</button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{msme.legal_name}</h1>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {msme.sector} - {msme.city}, {msme.state} - GSTIN {msme.gstin || '-'}
          </div>
        </div>
        <button onClick={run} disabled={running} className="btn-primary px-5 py-2.5">
          {running ? 'Running assessment...' : score ? 'Re-run Assessment' : 'Run Assessment'}
        </button>
      </div>

      {error && <div className="text-sm text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 reveal-stagger">
        <div data-reveal>
          <Card title="Credit score" subtitle={score ? `Model ${score.model_version}` : 'No score yet'}>
            <ScoreGauge score={score?.credit_score} grade={score?.risk_grade} />
            {score && (
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">PD (12m default)</span><span className="font-medium text-slate-800 dark:text-slate-200">{(score.pd_default_12m * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">ML raw score</span><span className="font-medium text-slate-800 dark:text-slate-200">{breakdown.ml_score}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Rule penalty</span><span className="font-medium text-rose-600 dark:text-rose-400">-{breakdown.rules_penalty}</span></div>
              </div>
            )}
          </Card>
        </div>

        <div data-reveal>
          <Card title="Decision" subtitle={decision ? new Date(decision.created_at).toLocaleString() : '-'}>
            {decision ? (
              <div className="space-y-3">
                <Badge className={`${outcomeColor(decision.outcome)} text-base px-3 py-1`}>{decision.outcome}</Badge>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Recommended limit</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatINR(decision.recommended_limit_inr)}</div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{decision.rationale}</p>
                <div>
                  <div className="text-xs uppercase text-slate-500 dark:text-slate-400 mb-1">Reason codes</div>
                  <div className="flex flex-wrap gap-1">
                    {decision.reason_codes.map((r) => (
                      <span key={r} className="text-xs bg-slate-900/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-mono">{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : <div className="text-sm text-slate-500 dark:text-slate-400">Run an assessment to see the decision.</div>}
          </Card>
        </div>

        <div data-reveal>
          <Card title="Red flags" subtitle={`${score?.red_flags.length || 0} flagged`}>
            {score?.red_flags.length ? (
              <ul className="space-y-2">
                {score.red_flags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <span className="mt-0.5 text-amber-500">!</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-sm text-slate-500 dark:text-slate-400">No red flags raised.</div>}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 reveal-stagger">
        <div data-reveal><Stat label="Avg monthly revenue" value={formatINR(fin.avg_monthly_revenue_inr)} /></div>
        <div data-reveal><Stat label="Revenue trend" value={formatPct(fin.revenue_trend_pct)} hint="Last 6 months" /></div>
        <div data-reveal><Stat label="GST compliance" value={formatPct((fin.gst_compliance_ratio || 0) * 100, 0)} hint={`${fin.gst_filings_done || 0}/${fin.gst_filings_expected || 0} filings`} /></div>
        <div data-reveal><Stat label="Vintage" value={`${formatNumber(fin.vintage_years, 1)} years`} /></div>
        <div data-reveal><Stat label="Bank balance" value={formatINR(fin.avg_bank_balance_inr)} /></div>
        <div data-reveal><Stat label="Bounced cheques (12m)" value={String(fin.bounced_cheques_12m ?? 0)} /></div>
        <div data-reveal><Stat label="Existing debt" value={formatINR(fin.existing_loan_obligations_inr)} /></div>
        <div data-reveal><Stat label="Customer concentration" value={formatPct((fin.top_customer_concentration_pct || 0) * 100, 0)} /></div>
      </div>

      {decision && (
        <div data-reveal>
          <Card title="Feedback Loop" subtitle="Record the actual outcome to improve the model">
            {feedbackSent ? (
              <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-3 py-2 rounded-lg">Recorded: {feedbackSent}. Thank you.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => submitFeedback('PAID_ON_TIME')} className="px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 rounded-lg text-sm font-medium transition">Paid on time</button>
                <button onClick={() => submitFeedback('DELAYED')} className="px-3 py-2 bg-yellow-100 dark:bg-yellow-500/20 hover:bg-yellow-200 dark:hover:bg-yellow-500/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm font-medium transition">Delayed</button>
                <button onClick={() => submitFeedback('PARTIAL_DEFAULT')} className="px-3 py-2 bg-orange-100 dark:bg-orange-500/20 hover:bg-orange-200 dark:hover:bg-orange-500/30 text-orange-800 dark:text-orange-200 rounded-lg text-sm font-medium transition">Partial default</button>
                <button onClick={() => submitFeedback('NPA')} className="px-3 py-2 bg-rose-100 dark:bg-rose-500/20 hover:bg-rose-200 dark:hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 rounded-lg text-sm font-medium transition">NPA</button>
              </div>
            )}
          </Card>
        </div>
      )}

      <div data-reveal className="text-xs text-slate-500 dark:text-slate-400">
        <Link to="/lender/search" className="text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-200">Search another MSME</Link>
      </div>
    </div>
  )
}
