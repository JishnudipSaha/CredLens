import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, Gavel, Gauge, MessageSquare, RefreshCw } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import { api_audit_log, api_model_monitor, api_retrain, type ModelMonitorStats } from '../../api/client'
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Spinner, Stat, buttonClasses, errorMessage } from '../../components/UI'
import { ChartCard, ChartTooltip, axisProps, useChartColors } from '../../components/charts'
import { useToast } from '../../components/Toast'
import { formatDateTime } from '../../utils/format'

interface AuditRow {
  id: number
  created_at: string
  action: string
  endpoint?: string | null
  status_code?: number | null
  latency_ms?: number | null
}

export default function ModelMonitor() {
  const [stats, setStats] = useState<ModelMonitorStats | null>(null)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [retraining, setRetraining] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const colors = useChartColors()
  const { toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([api_model_monitor(), api_audit_log()])
      .then(([s, a]) => {
        setStats(s)
        setAudit(a)
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const retrain = async () => {
    setRetraining(true)
    setResult(null)
    try {
      const r = await api_retrain()
      const auc = r.data?.metrics?.test_auc
      const text =
        typeof auc === 'number'
          ? `Model retrained — test AUC ${(auc * 100).toFixed(2)}%.`
          : 'Model retrained successfully.'
      setResult({ ok: true, text })
      toast({ tone: 'success', title: 'Retrain complete', message: text })
      load()
    } catch (e) {
      const text = errorMessage(e)
      setResult({ ok: false, text })
      toast({ tone: 'error', title: 'Retrain failed', message: text })
    } finally {
      setRetraining(false)
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!stats) return <ErrorState error="No model statistics available." onRetry={load} />

  const gradeData = Object.entries(stats.grade_distribution).map(([grade, count]) => ({ grade, count }))
  const decisionData = Object.entries(stats.decision_distribution).map(([name, value]) => ({ name, value }))
  const feedbackData = Object.entries(stats.feedback_distribution).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Model Monitor</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            Active model:
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {stats.model_version}
            </span>
          </p>
        </div>
        <Button onClick={retrain} loading={retraining}>
          {!retraining && <RefreshCw className="h-4 w-4" aria-hidden />}
          {retraining ? 'Retraining…' : 'Retrain model'}
        </Button>
      </div>

      {result && (
        <Alert tone={result.ok ? 'success' : 'error'} title={result.ok ? 'Retrain complete' : 'Retrain failed'}>
          {result.text}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Score runs" value={stats.total_score_runs} icon={Gauge} />
        <Stat label="Decisions" value={stats.total_decisions} icon={Gavel} />
        <Stat label="Feedback records" value={stats.total_feedback} icon={MessageSquare} />
        <Stat label="Avg score" value={Math.round(stats.avg_credit_score)} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard title="Grade distribution" height={240} empty={gradeData.length === 0}>
          <BarChart data={gradeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="grade" {...axisProps(colors)} />
            <YAxis allowDecimals={false} {...axisProps(colors)} width={44} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
            <Bar dataKey="count" name="Runs" radius={[6, 6, 0, 0]}>
              {gradeData.map((d) => (
                <Cell key={d.grade} fill={colors.grade[d.grade] || colors.palette[0]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Decision distribution" height={240} empty={decisionData.length === 0}>
          <PieChart>
            <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
              {decisionData.map((d) => (
                <Cell key={d.name} fill={colors.outcome[d.name] || colors.palette[0]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard
          title="Feedback outcomes"
          height={240}
          empty={feedbackData.length === 0}
          emptyMessage="No feedback yet — lenders report outcomes after decisions."
        >
          <PieChart>
            <Pie data={feedbackData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
              {feedbackData.map((d) => (
                <Cell key={d.name} fill={colors.outcome[d.name] || colors.palette[0]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>
      </div>

      <Card
        flush
        title="Recent audit log"
        subtitle={`Last ${Math.min(audit.length, 25)} events`}
        action={
          <Link to="/admin/audit" className={buttonClasses('ghost', 'sm')}>
            View full log <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        {audit.length === 0 ? (
          <EmptyState title="No audit events" />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Endpoint</th>
                  <th className="num">Status</th>
                  <th className="num">Latency</th>
                </tr>
              </thead>
              <tbody>
                {audit.slice(0, 25).map((a) => {
                  const ok = a.status_code == null || (a.status_code >= 200 && a.status_code < 400)
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.created_at)}</td>
                      <td>
                        <Badge>{a.action}</Badge>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">{a.endpoint || '—'}</td>
                      <td className={`num ${ok ? 'text-success' : 'text-danger'}`}>{a.status_code ?? '—'}</td>
                      <td className="num">{a.latency_ms != null ? `${a.latency_ms} ms` : '—'}</td>
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
