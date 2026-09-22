import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, Gavel, Wallet } from 'lucide-react'
import { BarChart, Bar, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import {
  api_list_decisions,
  api_list_msmes,
  api_model_monitor,
  type Decision,
  type MSMEListItem,
  type ModelMonitorStats,
} from '../../api/client'
import { Badge, Card, EmptyState, ErrorState, Spinner, Stat, buttonClasses } from '../../components/UI'
import { ChartCard, ChartTooltip, axisProps, useChartColors } from '../../components/charts'
import { formatDate, formatINR, gradeColor, outcomeColor } from '../../utils/format'

export default function LenderDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [msmes, setMsmes] = useState<MSMEListItem[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [stats, setStats] = useState<ModelMonitorStats | null>(null)
  const colors = useChartColors()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([api_list_msmes({ limit: 100 }), api_list_decisions({}), api_model_monitor()])
      .then(([m, d, s]) => {
        setMsmes(m)
        setDecisions(d)
        setStats(s)
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />

  const recent = decisions.slice(0, 8)
  const totalExposure = decisions.reduce((acc, d) => acc + (d.recommended_limit_inr || 0), 0)
  const approveCount = decisions.filter((d) => d.outcome === 'APPROVE').length
  const gradeData = Object.entries(stats?.grade_distribution || {}).map(([grade, count]) => ({ grade, count }))
  const decisionData = Object.entries(stats?.decision_distribution || {}).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Lender Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Portfolio overview, recent decisions, and model health.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="MSMEs in platform" value={msmes.length} icon={Building2} />
        <Stat label="Decisions on file" value={decisions.length} icon={Gavel} />
        <Stat
          label="Approved"
          value={approveCount}
          hint={`${((approveCount / Math.max(decisions.length, 1)) * 100).toFixed(0)}% approval rate`}
          icon={CheckCircle2}
        />
        <Stat label="Total recommended exposure" value={formatINR(totalExposure)} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Risk grade distribution" subtitle="Latest score per MSME" empty={gradeData.length === 0}>
          <BarChart data={gradeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="grade" {...axisProps(colors)} />
            <YAxis allowDecimals={false} {...axisProps(colors)} width={44} />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: colors.grid, fillOpacity: 0.4 }}
            />
            <Bar dataKey="count" name="MSMEs" radius={[6, 6, 0, 0]}>
              {gradeData.map((entry) => (
                <Cell key={entry.grade} fill={colors.grade[entry.grade] || colors.palette[0]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Decision distribution" empty={decisionData.length === 0}>
          <PieChart>
            <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
              {decisionData.map((entry) => (
                <Cell key={entry.name} fill={colors.outcome[entry.name] || colors.palette[0]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>
      </div>

      <Card
        flush
        title="Recent decisions"
        subtitle="Last 8 assessments"
        action={
          <Link to="/lender/decisions" className={buttonClasses('ghost', 'sm')}>
            View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        {recent.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No decisions yet"
            message="Run an assessment from MSME Search to get started."
            action={
              <Link to="/lender/search" className={buttonClasses('primary', 'sm')}>
                Go to MSME Search
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>MSME</th>
                  <th>Outcome</th>
                  <th className="num">Score</th>
                  <th className="num">Recommended limit</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => {
                  const m = msmes.find((x) => x.id === d.msme_id)
                  return (
                    <tr key={d.id}>
                      <td>
                        <Link
                          to={`/lender/report/${d.msme_id}`}
                          className="font-medium text-primary transition-colors hover:text-primary-hover"
                        >
                          {m?.legal_name || `MSME #${d.msme_id}`}
                        </Link>
                      </td>
                      <td>
                        <Badge className={outcomeColor(d.outcome)}>{d.outcome}</Badge>
                      </td>
                      <td className="num">
                        {d.credit_score != null ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-semibold">{d.credit_score}</span>
                            {d.risk_grade && <span className={gradeColor(d.risk_grade)}>{d.risk_grade}</span>}
                          </span>
                        ) : (
                          <span className="text-subtle-foreground">—</span>
                        )}
                      </td>
                      <td className="num">{formatINR(d.recommended_limit_inr)}</td>
                      <td className="text-muted-foreground">{formatDate(d.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
