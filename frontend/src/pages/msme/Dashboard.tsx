import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarDays, IndianRupee, Lightbulb, TrendingUp, Upload } from 'lucide-react'
import { useAuth } from '../../context'
import { api_get_credit_report, type CreditReport } from '../../api/client'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Spinner, Stat } from '../../components/UI'
import { ScoreGauge } from '../../components/ScoreGauge'
import { formatDate, formatINR, formatNumber, formatPct, outcomeColor } from '../../utils/format'

export default function MsmeDashboard() {
  const { user } = useAuth()
  const [report, setReport] = useState<CreditReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(() => {
    if (!user) return
    if (!user.msme_id) {
      setError('No MSME profile is linked to your account. Please contact support.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    api_get_credit_report(user.msme_id)
      .then(setReport)
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!report) return <EmptyState title="No MSME found" message="Your account has no linked business profile." />

  const fin: Record<string, any> = report.financials || {}
  const score = report.score
  const decision = report.decision

  const tips: string[] = []
  if ((fin.gst_compliance_ratio ?? 1) < 0.9) tips.push('File all pending GST returns to lift your compliance score.')
  if ((fin.bounced_cheques_12m ?? 0) > 0) tips.push('Work with your bank to prevent cheque bounces — they weigh heavily.')
  if ((fin.utility_payment_consistency ?? 1) < 0.9) tips.push('Pay electricity and water bills on time to improve alt-data signals.')
  if ((fin.top_customer_concentration_pct ?? 0) > 0.5) tips.push('Diversify your customer base to reduce concentration risk.')
  if (tips.length === 0) tips.push('You look healthy. Keep your books clean and re-run after material changes.')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Credit Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome, {user?.name}. Here's how lenders see your business.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card
          title="Your credit score"
          subtitle={score ? `Last run: ${formatDate(score.created_at)}` : 'No score yet'}
        >
          <ScoreGauge score={score?.credit_score} grade={score?.risk_grade} />
        </Card>

        <Card title="Latest decision">
          {decision ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Badge className={outcomeColor(decision.outcome)}>{decision.outcome}</Badge>
                <span className="text-xs text-subtle-foreground">{formatDate(decision.created_at)}</span>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-subtle-foreground">
                  Recommended exposure
                </div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                  {formatINR(decision.recommended_limit_inr)}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{decision.rationale}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload data and a lender will assess you.</p>
              <Link to="/msme/upload">
                <Button variant="secondary" size="sm">
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Upload data
                </Button>
              </Link>
            </div>
          )}
        </Card>

        <Card title="Improvement tips" subtitle="What would move your score next time">
          <ul className="space-y-3 text-sm text-foreground">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monthly revenue" value={formatINR(fin.avg_monthly_revenue_inr)} icon={IndianRupee} />
        <Stat label="Revenue trend" value={formatPct(fin.revenue_trend_pct)} icon={TrendingUp} />
        <Stat
          label="GST compliance"
          value={formatPct((fin.gst_compliance_ratio || 0) * 100, 0)}
          icon={BadgeCheck}
        />
        <Stat
          label="Vintage"
          value={fin.vintage_years != null ? `${formatNumber(fin.vintage_years, 1)} yrs` : '—'}
          icon={CalendarDays}
        />
      </div>

      {!score && (
        <Alert tone="info" title="No score yet">
          Run an assessment from a lender, or upload fresh data to get scored.
        </Alert>
      )}
    </div>
  )
}
