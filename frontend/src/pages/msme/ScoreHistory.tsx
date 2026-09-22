import { useCallback, useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { History } from 'lucide-react'
import { api, api_list_msmes, type ScoreRun } from '../../api/client'
import { Card, EmptyState, ErrorState, Spinner } from '../../components/UI'
import { ChartCard, ChartTooltip, axisProps, useChartColors } from '../../components/charts'
import { useAuth } from '../../context'
import { formatDateTime, formatPct, gradeColor, scoreColor } from '../../utils/format'

export default function ScoreHistory() {
  const { user } = useAuth()
  const [runs, setRuns] = useState<ScoreRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const colors = useChartColors()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api_list_msmes({ limit: 200 })
      .then((rows) => {
        const myMsme = rows.find((m) => m.id === user?.msme_id) || rows[0]
        if (!myMsme) return [] as ScoreRun[]
        return api.get<ScoreRun[]>(`/score/runs/${myMsme.id}`).then((r) => r.data)
      })
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />

  if (runs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Score History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track how your credit score has changed over time.</p>
        </div>
        <Card>
          <EmptyState
            icon={History}
            title="No score runs yet"
            message="Scores appear here after a lender runs an assessment on your profile."
          />
        </Card>
      </div>
    )
  }

  const chartData = [...runs].reverse().map((r) => ({
    date: new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: r.credit_score,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Score History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track how your credit score has changed over time.</p>
      </div>

      <ChartCard title="Score trend" subtitle={`Last ${runs.length} runs · range 300–900`} height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" {...axisProps(colors)} />
          <YAxis domain={[300, 900]} {...axisProps(colors)} width={44} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="score"
            name="Score"
            stroke={colors.primary}
            strokeWidth={2}
            dot={{ r: 3, fill: colors.primary, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartCard>

      <Card flush title="All runs" subtitle={`${runs.length} assessments`}>
        <div>
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{formatDateTime(r.created_at)}</div>
                <div className="mt-0.5 font-mono text-[11px] text-subtle-foreground">Model {r.model_version}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  PD {formatPct(r.pd_default_12m * 100)}
                </span>
                <span className={`text-lg font-bold tabular-nums ${scoreColor(r.credit_score)}`}>
                  {r.credit_score}
                </span>
                <span className={gradeColor(r.risk_grade)}>{r.risk_grade}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
