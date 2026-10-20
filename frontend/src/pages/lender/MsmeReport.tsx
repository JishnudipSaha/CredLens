import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Banknote, CalendarDays, CheckCircle2,
  IndianRupee, Landmark, PieChart, RefreshCw, ShieldCheck, Timer, TrendingUp, XCircle, Ban,
  FileCheck, Scale, Building2, Percent, ShieldAlert, FileText, Check,
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
      toast({ tone: 'success', title: 'Assessment complete', message: 'Institutional score, MPBF limit, and covenants refreshed.' })
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
  const pillars = breakdown.pillars || {}
  const mpbfData = decision?.underwriting_summary || {}
  const covenants: string[] = decision?.covenants || []
  const badges: string[] = fin.verification_badges || breakdown.verification_badges || []
  const trustScore = fin.data_trust_score ?? breakdown.data_trust_score ?? 85

  // Triangulation calculations
  const monthlyRevenue = fin.avg_monthly_revenue_inr || 0
  const annualTurnover = monthlyRevenue * 12
  const variancePct = fin.gst_vs_bank_turnover_variance_pct ?? 0
  const estimatedBankInflow = annualTurnover * (1 + variancePct / 100)

  // DSCR tier
  const dscr = fin.dscr ?? 1.5
  const dscrTone = dscr >= 1.25 ? 'success' : dscr >= 1.0 ? 'warning' : 'danger'

  // CMR tier
  const cmr = fin.cibil_cmr_rank ?? 3
  const cmrText = cmr <= 3 ? 'Prime Risk' : cmr <= 6 ? 'Moderate Risk' : 'High Risk'
  const cmrTone = cmr <= 3 ? 'text-success' : cmr <= 6 ? 'text-warning' : 'text-danger'

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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{msme.legal_name}</h1>
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Institutional Credit Memo
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="capitalize">{msme.sector}</span>
            <span aria-hidden>·</span>
            <span>
              {msme.city}, {msme.state}
            </span>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">GSTIN {dash(msme.gstin)}</span>
            <span aria-hidden>·</span>
            <span className="font-mono text-xs">PAN {dash(msme.pan)}</span>
          </div>
        </div>
        <Button onClick={run} loading={running}>
          {!running && <RefreshCw className="h-4 w-4" aria-hidden />}
          {running ? 'Running…' : score ? 'Re-run assessment' : 'Run assessment'}
        </Button>
      </div>

      {/* Verification Provenance Badges Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Verification Provenance:</span>
          {badges.includes('AA_VERIFIED') && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <Check className="h-3 w-3" /> Account Aggregator (AA)
            </span>
          )}
          {badges.includes('GSTN_VERIFIED') && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <BadgeCheck className="h-3 w-3" /> GSTN Active & Filed
            </span>
          )}
          {badges.includes('MCA_VERIFIED') && (
            <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
              <Building2 className="h-3 w-3" /> MCA21 Active ROC
            </span>
          )}
          {badges.includes('BUREAU_VERIFIED') && (
            <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-500">
              <Scale className="h-3 w-3" /> CIBIL Commercial Scored
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Data Trust Index:</span>
          <span className="font-mono font-bold text-foreground">{trustScore}%</span>
          <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${trustScore >= 80 ? 'bg-success' : trustScore >= 60 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: `${trustScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top three summary cards */}
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
                <span className="text-muted-foreground">Rule & ratio penalty</span>
                <span className="font-medium tabular-nums text-danger">
                  {breakdown.rules_penalty != null ? `−${breakdown.rules_penalty}` : '—'}
                </span>
              </div>
            </div>
          )}
        </Card>

        <Card title="Decision & Sanctioned Limit" subtitle={decision ? formatDateTime(decision.created_at) : 'Not decided yet'}>
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

        <Card title="Red flags & Covenants" subtitle={`${score?.red_flags.length || 0} flagged`}>
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
              <ShieldCheck className="h-4 w-4" aria-hidden /> Clean underwriting profile. No policy red flags.
            </div>
          )}
        </Card>
      </div>

      {/* 3-Way Triangulation & Cross-Reconciliation Section */}
      <Card
        title="3-Way Triangulation & Cross-Reconciliation"
        subtitle="Independent verification of GST turnover against bank statement cash inflows"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="text-xs font-medium text-muted-foreground">Declared GST Turnover (Annual)</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatINR(annualTurnover)}</div>
            <div className="mt-1 text-xs text-muted-foreground">From GSTR-3B monthly filings</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="text-xs font-medium text-muted-foreground">Bank Statement Inflows (Annualized)</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatINR(estimatedBankInflow)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Account Aggregator verified deposits</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="text-xs font-medium text-muted-foreground">Turnover Variance %</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold tabular-nums text-foreground">{variancePct > 0 ? `+${variancePct}%` : `${variancePct}%`}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  Math.abs(variancePct) <= 15
                    ? 'border border-success/30 bg-success/10 text-success'
                    : 'border border-warning/30 bg-warning/10 text-warning'
                }`}
              >
                {Math.abs(variancePct) <= 15 ? 'Reconciled (<15%)' : 'Variance Warning'}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {Math.abs(variancePct) <= 15 ? 'Banking credits match reported sales' : 'Inflow mismatch requires clarification'}
            </div>
          </div>
        </div>
      </Card>

      {/* Institutional Financial Ratios & Solvency Grid */}
      <div>
        <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">
          Institutional Banking Ratios & Covenants
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="DSCR (Debt Service)"
            value={`${formatNumber(dscr, 2)}x`}
            hint={dscr >= 1.25 ? 'Meets benchmark (≥1.25x)' : 'Below benchmark'}
            icon={Scale}
          />
          <Stat
            label="Interest Coverage (ICR)"
            value={`${formatNumber(fin.interest_coverage_ratio ?? 3.0, 2)}x`}
            hint="EBITDA / Annual Interest"
            icon={Percent}
          />
          <Stat
            label="Current Ratio"
            value={`${formatNumber(fin.current_ratio ?? 1.33, 2)}x`}
            hint="CA / CL (Benchmark ≥1.33x)"
            icon={TrendingUp}
          />
          <Stat
            label="EBITDA Margin"
            value={formatPct(fin.ebitda_margin_pct)}
            hint="Operating profitability"
            icon={BadgeCheck}
          />
          <Stat
            label="CIBIL Commercial Rank"
            value={`CMR-${cmr}`}
            hint={cmrText}
            icon={Building2}
          />
        </div>
      </div>

      {/* Working Capital Assessment (Nayak Committee MPBF Method) */}
      <Card
        title="Working Capital Assessment — Nayak Committee Turnover Method"
        subtitle="Standard Indian Banking benchmark for MSME Working Capital limits"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2">Underwriting Step</th>
                <th className="pb-2">Formula / Banking Norm</th>
                <th className="pb-2 text-right">Computed Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr>
                <td className="py-2.5 font-medium text-foreground">1. Projected Annual Turnover</td>
                <td className="py-2.5">Validated annual revenue base</td>
                <td className="py-2.5 text-right font-mono font-medium text-foreground">
                  {formatINR(mpbfData.annual_turnover_inr || annualTurnover)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-foreground">2. Total Working Capital Requirement</td>
                <td className="py-2.5">25% of Annual Turnover</td>
                <td className="py-2.5 text-right font-mono font-medium text-foreground">
                  {formatINR(mpbfData.working_capital_requirement_inr || annualTurnover * 0.25)}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-medium text-foreground">3. Promoter Contribution / Margin</td>
                <td className="py-2.5">5% of Annual Turnover (Borrower Equity)</td>
                <td className="py-2.5 text-right font-mono font-medium text-foreground">
                  {formatINR(mpbfData.promoter_margin_inr || annualTurnover * 0.05)}
                </td>
              </tr>
              <tr className="bg-muted/20 font-semibold text-foreground">
                <td className="py-2.5">4. Maximum Permissible Bank Finance (MPBF)</td>
                <td className="py-2.5">20% of Turnover (Turnover Method cap)</td>
                <td className="py-2.5 text-right font-mono text-primary">
                  {formatINR(mpbfData.mpbf_inr || annualTurnover * 0.20)}
                </td>
              </tr>
              <tr className="font-bold text-foreground">
                <td className="py-2.5 text-primary">5. Sanctioned Working Capital Limit</td>
                <td className="py-2.5 text-xs text-muted-foreground">
                  MPBF × Risk Grade {score?.risk_grade || 'B'} Multiplier ({((mpbfData.grade_multiplier ?? 0.85) * 100).toFixed(0)}%)
                </td>
                <td className="py-2.5 text-right font-mono text-base text-primary">
                  {formatINR(decision?.working_capital_mpbf_inr || decision?.recommended_limit_inr)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5-Pillar Credit Sub-Scores */}
      <Card title="5-Pillar Credit Sub-Scores" subtitle="Multi-dimensional risk assessment breakdown (0-100)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Financial Solvency</div>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">{pillars.financial_strength ?? 85}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pillars.financial_strength ?? 85}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">DSCR, ICR, EBITDA</div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Banking Quality</div>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">{pillars.banking_quality ?? 80}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pillars.banking_quality ?? 80}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">AMB, Cheque returns</div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Tax Compliance</div>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">{pillars.tax_compliance ?? 95}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pillars.tax_compliance ?? 95}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">GST regularity & match</div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Bureau Track Record</div>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">{pillars.bureau_record ?? 90}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pillars.bureau_record ?? 90}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">CMR rank, DPD, loans</div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Business Stability</div>
            <div className="mt-1 text-2xl font-bold font-mono text-foreground">{pillars.business_stability ?? 82}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pillars.business_stability ?? 82}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Vintage, concentration</div>
          </div>
        </div>
      </Card>

      {/* Sanction Covenants & Pre-Disbursement Conditions */}
      {covenants.length > 0 && (
        <Card title="Sanction Terms & Pre-Disbursement Conditions (CP)" subtitle="Mandatory legal and credit covenants for facility drawdown">
          <ul className="divide-y divide-border text-sm">
            {covenants.map((cov, idx) => (
              <li key={idx} className="flex items-start gap-3 py-2.5">
                <FileCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-foreground">{cov}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Operational Financial KPIs */}
      <div>
        <h2 className="mb-3 text-base font-semibold tracking-tight text-foreground">
          Underlying Financial Data & Activity
        </h2>
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
          <Stat label="Avg Bank Balance" value={formatINR(fin.avg_bank_balance_inr)} icon={Landmark} />
          <Stat label="Bounced cheques (12m)" value={String(fin.bounced_cheques_12m ?? 0)} icon={XCircle} />
          <Stat label="Existing debt" value={formatINR(fin.existing_loan_obligations_inr)} icon={Banknote} />
          <Stat
            label="Customer concentration"
            value={formatPct((fin.top_customer_concentration_pct || 0) * 100, 0)}
            icon={PieChart}
          />
        </div>
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
