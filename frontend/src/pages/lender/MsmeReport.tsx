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
    <div ref={containerRef} className="space-y-space-lg">
      <div data-reveal className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-body-sm text-on-surface-variant hover:text-primary transition-colors">&larr; Back</button>
          <h1 className="text-headline-lg text-primary font-bold tracking-tight mt-1">{msme.legal_name}</h1>
          <div className="text-body-sm text-on-surface-variant">
            {msme.sector} - {msme.city}, {msme.state} - GSTIN {msme.gstin || '-'}
          </div>
        </div>
        <button onClick={run} disabled={running} className="btn-primary px-5 py-2.5">
          {running ? 'Running assessment...' : score ? 'Re-run Assessment' : 'Run Assessment'}
        </button>
      </div>

      {error && <div className="text-body-sm text-error bg-error-container/30 px-3 py-2 rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 reveal-stagger">
        <div data-reveal>
          <Card title="Credit score" subtitle={score ? `Model ${score.model_version}` : 'No score yet'}>
            <ScoreGauge score={score?.credit_score} grade={score?.risk_grade} />
            {score && (
              <div className="mt-4 space-y-1 text-body-sm">
                <div className="flex justify-between"><span className="text-on-surface-variant">PD (12m default)</span><span className="font-medium text-on-surface">{(score.pd_default_12m * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">ML raw score</span><span className="font-medium text-on-surface">{breakdown.ml_score}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Rule penalty</span><span className="font-medium text-error">-{breakdown.rules_penalty}</span></div>
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
                  <div className="text-mono-caption text-on-surface-variant">Recommended limit</div>
                  <div className="text-data-metric text-on-surface font-bold">{formatINR(decision.recommended_limit_inr)}</div>
                </div>
                <p className="text-body-sm text-on-surface">{decision.rationale}</p>
                <div>
                  <div className="text-mono-caption uppercase text-on-surface-variant mb-1">Reason codes</div>
                  <div className="flex flex-wrap gap-1">
                    {decision.reason_codes.map((r) => (
                      <span key={r} className="text-mono-caption bg-surface-container text-on-surface px-2 py-0.5 rounded font-mono">{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : <div className="text-body-sm text-on-surface-variant">Run an assessment to see the decision.</div>}
          </Card>
        </div>

        <div data-reveal>
          <Card title="Red flags" subtitle={`${score?.red_flags.length || 0} flagged`}>
            {score?.red_flags.length ? (
              <ul className="space-y-2">
                {score.red_flags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-body-sm text-secondary-container">
                    <span className="mt-0.5 material-symbols-outlined text-[16px]">warning</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-body-sm text-on-surface-variant">No red flags raised.</div>}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 reveal-stagger">
        <div data-reveal><Stat label="Avg monthly revenue" value={formatINR(fin.avg_monthly_revenue_inr)} icon="currency_rupee" /></div>
        <div data-reveal><Stat label="Revenue trend" value={formatPct(fin.revenue_trend_pct)} hint="Last 6 months" icon="trending_up" /></div>
        <div data-reveal><Stat label="GST compliance" value={formatPct((fin.gst_compliance_ratio || 0) * 100, 0)} hint={`${fin.gst_filings_done || 0}/${fin.gst_filings_expected || 0} filings`} icon="verified" /></div>
        <div data-reveal><Stat label="Vintage" value={`${formatNumber(fin.vintage_years, 1)} years`} icon="schedule" /></div>
        <div data-reveal><Stat label="Bank balance" value={formatINR(fin.avg_bank_balance_inr)} icon="account_balance" /></div>
        <div data-reveal><Stat label="Bounced cheques (12m)" value={String(fin.bounced_cheques_12m ?? 0)} icon="error" /></div>
        <div data-reveal><Stat label="Existing debt" value={formatINR(fin.existing_loan_obligations_inr)} icon="payments" /></div>
        <div data-reveal><Stat label="Customer concentration" value={formatPct((fin.top_customer_concentration_pct || 0) * 100, 0)} icon="pie_chart" /></div>
      </div>

      {decision && (
        <div data-reveal>
          <Card title="Feedback Loop" subtitle="Record the actual outcome to improve the model">
            {feedbackSent ? (
              <div className="text-body-sm text-tertiary-container bg-tertiary-container/20 px-3 py-2 rounded-lg">Recorded: {feedbackSent}. Thank you.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => submitFeedback('PAID_ON_TIME')} className="btn-feedback-approved">Paid on time</button>
                <button onClick={() => submitFeedback('DELAYED')} className="btn-feedback-review">Delayed</button>
                <button onClick={() => submitFeedback('PARTIAL_DEFAULT')} className="btn-feedback-review">Partial default</button>
                <button onClick={() => submitFeedback('NPA')} className="btn-feedback-rejected">NPA</button>
              </div>
            )}
          </Card>
        </div>
      )}

      <div data-reveal className="text-body-sm text-on-surface-variant">
        <Link to="/lender/search" className="text-primary hover:text-primary font-medium">Search another MSME</Link>
      </div>
    </div>
  )
}
