import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context'
import { api_get_credit_report, api_list_msmes, type CreditReport, type MSMEListItem } from '../../api/client'
import { Card, EmptyState, Spinner, Stat } from '../../components/UI'
import { ScoreGauge } from '../../components/ScoreGauge'
import { formatINR, formatPct } from '../../utils/format'
import { useReveal } from '../../hooks/useReveal'

export default function MsmeDashboard() {
  const { user } = useAuth()
  const [report, setReport] = useState<CreditReport | null>(null)
  const [msme, setMsme] = useState<MSMEListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  useEffect(() => {
    if (!user) return
    api_list_msmes({ limit: 200 })
      .then((rows) => {
        const myMsme = rows.find((m) => m.id === user.msme_id) || rows[0]
        if (!myMsme) throw new Error('No MSME available')
        setMsme(myMsme)
        return api_get_credit_report(myMsme.id)
      })
      .then(setReport)
      .catch((e) => setError(e?.message || 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <Spinner />
  if (error) return <EmptyState title="Could not load your credit report" message={error} />
  if (!msme || !report) return <EmptyState title="No MSME found" />

  const fin: any = report.financials || {}
  const score = report.score
  const decision = report.decision

  const tips: string[] = []
  if ((fin.gst_compliance_ratio ?? 1) < 0.9) tips.push('File all pending GST returns to lift your compliance score.')
  if ((fin.bounced_cheques_12m ?? 0) > 0) tips.push('Work with your bank to prevent cheque bounces - they weigh heavily.')
  if ((fin.utility_payment_consistency ?? 1) < 0.9) tips.push('Pay electricity and water bills on time to improve alt-data signals.')
  if ((fin.top_customer_concentration_pct ?? 0) > 0.5) tips.push('Diversify your customer base to reduce concentration risk.')
  if (tips.length === 0) tips.push('You look great. Keep your books clean and re-run this report after material changes.')

  return (
    <div ref={containerRef} className="space-y-5">
      <div data-reveal>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Credit Health</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Welcome, {user?.name}. Here's how lenders see your business.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 reveal-stagger">
        <div data-reveal>
          <Card title="Your credit score" subtitle={score ? `Last run: ${new Date(score.created_at).toLocaleDateString()}` : 'No score yet'}>
            <ScoreGauge score={score?.credit_score} grade={score?.risk_grade} />
          </Card>
        </div>
        <div data-reveal>
          <Card title="Latest decision">
            {decision ? (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{decision.outcome}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Recommended exposure: {formatINR(decision.recommended_limit_inr)}</div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{decision.rationale}</p>
              </div>
            ) : <div className="text-sm text-slate-500 dark:text-slate-400">Upload data and a lender will assess you.</div>}
          </Card>
        </div>
        <div data-reveal>
          <Card title="Improvement tips" subtitle="What would move your score next time">
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {tips.map((t, i) => <li key={i} className="flex gap-2"><span className="text-brand-500 dark:text-brand-400">-</span><span>{t}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 reveal-stagger">
        <div data-reveal><Stat label="Monthly revenue" value={formatINR(fin.avg_monthly_revenue_inr)} /></div>
        <div data-reveal><Stat label="Revenue trend" value={formatPct(fin.revenue_trend_pct)} /></div>
        <div data-reveal><Stat label="GST compliance" value={formatPct((fin.gst_compliance_ratio || 0) * 100, 0)} /></div>
        <div data-reveal><Stat label="Vintage" value={`${(fin.vintage_years || 0).toFixed(1)} years`} /></div>
      </div>
    </div>
  )
}
