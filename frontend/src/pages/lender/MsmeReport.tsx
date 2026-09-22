import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Banknote, CalendarDays, CheckCircle2,
  IndianRupee, Landmark, PieChart, RefreshCw, ShieldCheck, Timer, TrendingUp, XCircle, Ban,
} from 'lucide-react'
import { api_get_credit_report, api_run_assessment, api_submit_feedback, type CreditReport } from '../../api/client'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Spinner, Stat, errorMessage } from '../../components/UI'
import { ScoreGauge } from '../../components/ScoreGauge'
import { useToast } from '../../components/Toast'
import { dash, formatDate, formatDateTime, formatINR, formatNumber, formatPct, outcomeColor } from '../../utils/format'

export default function MsmeReport() {
  const { id } = useParams<{ id: string }>()
  const msmeId = Number(id)
  const navigate = useNavigate()
  const { toast } = useToast()
  const [report, setReport] = useState<CreditReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    api_get_credit_report(msmeId)
      .then(setReport)
      .catch((e) => setLoadError(e))
      .finally(() => setLoading(false))
  }, [msmeId])

  useEffect(() => {
    load()
  }, [load])

  const run = async () => {
    setRunning(true)
    try {
      await api_run_assessment(msmeId)
      toast({ tone: 'success', title: 'Assessment complete', message: 'Scores and decision refreshed.' })
      load()
    } catch (e) {
      toast({ tone: 'error', title: 'Assessment failed', message: errorMessage(e) })
    } finally {
      setRunning(false)
    }
  }

  const submitFeedback = async (outcome: 'PAID_ON_TIME' | 'DELAYED' | 'PARTIAL_DEFAULT' | 'NPA') => {
    if (!report?.decision) return
    try {
      await api_submit_feedback({ decision_id: report.decision.id, outcome })
      setFeedbackSent(outcome)
      toast({ tone: 'success', title: 'Feedback recorded', message: 'Thanks — this improves the model.' })
    } catch (e) {
      toast({ tone: 'error', title: 'Feedback failed', message: errorMessage(e) })
    }
  }

  if (loading) return <Spinner />
  if (loadError) return <ErrorState error={loadError} onRetry={load} />
  if (!report) {
    return (
      <EmptyState
        title="MSME not found"
        message="This profile may have been removed."
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/lender/search')}>
            Back to search
          </Button>
        }
      />
    )
  }

  const msme: Record<string, any> = report.msme
  const fin: Record<string, any> = report.financials || {}
  const score = report.score
  const decision = report.decision
  const breakdown: Record<string, any> = score?.score_breakdown || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{msme.legal_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="capitalize">{msme.sector}</span>
            <span aria-hidden>·</span>
            <span>
              {msme.city}, {msme.state}
            </span>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">GSTIN {dash(msme.gstin)}</span>
          </div>
        </div>
        <Button onClick={run} loading={running}>
          {!running && <RefreshCw className="h-4 w-4" aria-hidden />}
          {running ? 'Running…' : score ? 'Re-run assessment' : 'Run assessment'}
        </Button>
      </div>

      {/* Top three cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Credit score" subtitle={score ? `Model ${score.model_version} · ${formatDate(score.created_at)}` : 'No score yet'}>
          <ScoreGauge score={score?.credit_score} grade={score?.risk_grade} />
          {score && (
            <div className="mt-5 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">PD (12m default)</span>
                <span className="font-medium tabular-nums text-foreground">{formatPct(score.pd_default_12m * 100)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ML raw score</span>
                <span className="font-medium tabular-nums text-foreground">{dash(breakdown.ml_score)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rule penalty</span>
                <span className="font-medium tabular-nums text-danger">
                  {breakdown.rules_penalty != null ? `−${breakdown.rules_penalty}` : '—'}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Decision" subtitle={decision ? formatDateTime(decision.created_at) : 'Not decided yet'}>
          {decision ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Recommended limit
                </span>
                <Badge className={outcomeColor(decision.outcome)}>{decision.outcome}</Badge>
              </div>
              <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {formatINR(decision.recommended_limit_inr)}
              </div>
              <p className="border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
                {decision.rationale}
              </p>
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
                  Reason codes
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {decision.reason_codes.map((r) => (
                    <span
                      key={r}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Run an assessment to see the decision.</div>
          )}
        </Card>

        <Card title="Red flags" subtitle={`${score?.red_flags.length || 0} flagged`}>
          {score?.red_flags.length ? (
            <ul className="space-y-3">
              {score.red_flags.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-success">
              <ShieldCheck className="h-4 w-4" aria-hidden /> No red flags raised.
            </div>
          )}
        </Card>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Avg monthly revenue" value={formatINR(fin.avg_monthly_revenue_inr)} icon={IndianRupee} />
        <Stat label="Revenue trend" value={formatPct(fin.revenue_trend_pct)} hint="Last 6 months" icon={TrendingUp} />
        <Stat
          label="GST compliance"
          value={formatPct((fin.gst_compliance_ratio || 0) * 100, 0)}
          hint={`${fin.gst_filings_done ?? 0}/${fin.gst_filings_expected ?? 0} filings`}
          icon={BadgeCheck}
        />
        <Stat
          label="Vintage"
          value={fin.vintage_years != null ? `${formatNumber(fin.vintage_years, 1)} yrs` : '—'}
          icon={CalendarDays}
        />
        <Stat label="Bank balance" value={formatINR(fin.avg_bank_balance_inr)} icon={Landmark} />
        <Stat label="Bounced cheques (12m)" value={String(fin.bounced_cheques_12m ?? 0)} icon={XCircle} />
        <Stat label="Existing debt" value={formatINR(fin.existing_loan_obligations_inr)} icon={Banknote} />
        <Stat
          label="Customer concentration"
          value={formatPct((fin.top_customer_concentration_pct || 0) * 100, 0)}
          icon={PieChart}
        />
      </div>

      {/* Feedback loop */}
      {decision && (
        <Card title="Feedback loop" subtitle="Record the actual outcome to improve the model">
          {feedbackSent ? (
            <Alert tone="success" title="Feedback recorded">
              Outcome: {feedbackSent}. This will be used when the model next retrains.
            </Alert>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="success" onClick={() => submitFeedback('PAID_ON_TIME')}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Paid on time
              </Button>
              <Button variant="warning" onClick={() => submitFeedback('DELAYED')}>
                <Timer className="h-4 w-4" aria-hidden /> Delayed
              </Button>
              <Button variant="warning" onClick={() => submitFeedback('PARTIAL_DEFAULT')}>
                <AlertTriangle className="h-4 w-4" aria-hidden /> Partial default
              </Button>
              <Button variant="danger" onClick={() => submitFeedback('NPA')}>
                <Ban className="h-4 w-4" aria-hidden /> NPA
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="text-sm">
        <Link to="/lender/search" className="font-medium text-primary transition-colors hover:text-primary-hover">
          Search another MSME →
        </Link>
      </div>
    </div>
  )
}
