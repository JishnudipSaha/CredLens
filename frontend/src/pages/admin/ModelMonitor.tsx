import { useEffect, useRef, useState } from 'react'
import { api_audit_log, api_model_monitor, api_retrain, type ModelMonitorStats } from '../../api/client'
import { Card, EmptyState, Spinner, Stat, Badge } from '../../components/UI'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { useReveal } from '../../hooks/useReveal'

const GRADE_COLORS: Record<string, string> = { A: '#10b981', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#e11d48' }
const OUTCOME_COLORS: Record<string, string> = { APPROVE: '#10b981', REVIEW: '#eab308', REJECT: '#e11d48', PAID_ON_TIME: '#10b981', DELAYED: '#f59e0b', PARTIAL_DEFAULT: '#f97316', NPA: '#e11d48' }

export default function ModelMonitor() {
  const [stats, setStats] = useState<ModelMonitorStats | null>(null)
  const [audit, setAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [retraining, setRetraining] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  const load = () => {
    setLoading(true)
    Promise.all([api_model_monitor(), api_audit_log()])
      .then(([s, a]) => { setStats(s); setAudit(a) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const retrain = async () => {
    setRetraining(true); setMsg(null)
    try {
      const r = await api_retrain()
      setMsg(`Retrained. AUC = ${(r.data.metrics.test_auc * 100).toFixed(2)}%`)
      load()
    } catch (e: any) { setMsg(e?.response?.data?.detail || 'Retrain failed') }
    finally { setRetraining(false) }
  }

  if (loading) return <Spinner />
  if (!stats) return null

  const gradeData = Object.entries(stats.grade_distribution).map(([g, c]) => ({ grade: g, count: c }))
  const decisionData = Object.entries(stats.decision_distribution).map(([k, v]) => ({ name: k, value: v }))
  const feedbackData = Object.entries(stats.feedback_distribution).map(([k, v]) => ({ name: k, value: v }))

  return (
    <div ref={containerRef} className="space-y-5">
      <div data-reveal className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Model Monitor</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Active model: <span className="font-mono">{stats.model_version}</span></p>
        </div>
        <button onClick={retrain} disabled={retraining} className="btn-primary px-4 py-2 disabled:opacity-50">
          {retraining ? 'Retraining...' : 'Retrain model'}
        </button>
      </div>

      {msg && <div data-reveal className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-3 py-2 rounded-lg">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 reveal-stagger">
        <div data-reveal><Stat label="Score runs" value={stats.total_score_runs} /></div>
        <div data-reveal><Stat label="Decisions" value={stats.total_decisions} /></div>
        <div data-reveal><Stat label="Feedback records" value={stats.total_feedback} /></div>
        <div data-reveal><Stat label="Avg score" value={stats.avg_credit_score} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 reveal-stagger">
        <div data-reveal>
          <Card title="Grade distribution">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={gradeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.25)" />
                  <XAxis dataKey="grade" stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis allowDecimals={false} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {gradeData.map((d) => <Cell key={d.grade} fill={GRADE_COLORS[d.grade] || '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div data-reveal>
          <Card title="Decision distribution">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                    {decisionData.map((d) => <Cell key={d.name} fill={OUTCOME_COLORS[d.name] || '#94a3b8'} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div data-reveal>
          <Card title="Feedback outcomes">
            {feedbackData.length === 0 ? <EmptyState title="No feedback yet" message="Lenders will report outcomes after decisions are issued." /> : (
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={feedbackData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80}>
                      {feedbackData.map((d) => <Cell key={d.name} fill={OUTCOME_COLORS[d.name] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div data-reveal>
        <Card title="Recent audit log" subtitle={`Last ${audit.length} events`}>
          {audit.length === 0 ? <EmptyState title="No audit events" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60">
                  <tr>
                    <th className="py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Action</th>
                    <th className="py-2 font-medium">Endpoint</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.slice(0, 25).map((a) => (
                    <tr key={a.id} className="border-b border-slate-200/40 dark:border-slate-700/40 last:border-0">
                      <td className="py-2 text-slate-500 dark:text-slate-400">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="py-2"><Badge className="bg-slate-100 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-500/40">{a.action}</Badge></td>
                      <td className="py-2 font-mono text-xs text-slate-600 dark:text-slate-400">{a.endpoint || '-'}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{a.status_code || '-'}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{a.latency_ms != null ? `${a.latency_ms} ms` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
