import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api_list_decisions, api_list_msmes, api_model_monitor, type Decision, type MSMEListItem, type ModelMonitorStats,
} from '../../api/client'
import { Badge, Card, Spinner, Stat } from '../../components/UI'
import { outcomeColor, formatINR } from '../../utils/format'
import { useReveal } from '../../hooks/useReveal'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const GRADE_COLOR: Record<string, string> = { A: '#10b981', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#e11d48' }
const OUTCOME_COLOR: Record<string, string> = { APPROVE: '#10b981', REVIEW: '#eab308', REJECT: '#e11d48' }

export default function LenderDashboard() {
  const [loading, setLoading] = useState(true)
  const [msmes, setMsmes] = useState<MSMEListItem[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [stats, setStats] = useState<ModelMonitorStats | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  useEffect(() => {
    Promise.all([api_list_msmes({ limit: 100 }), api_list_decisions({}), api_model_monitor()])
      .then(([m, d, s]) => { setMsmes(m); setDecisions(d); setStats(s) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const recent = decisions.slice(0, 8)
  const totalExposure = decisions.reduce((acc, d) => acc + (d.recommended_limit_inr || 0), 0)
  const approveCount = decisions.filter((d) => d.outcome === 'APPROVE').length
  const gradeData = Object.entries(stats?.grade_distribution || {}).map(([g, c]) => ({ grade: g, count: c }))
  const decisionData = Object.entries(stats?.decision_distribution || {}).map(([k, v]) => ({ name: k, value: v }))

  return (
    <div ref={containerRef} className="space-y-6">
      <div data-reveal>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lender Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Portfolio overview, recent decisions, and model health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 reveal-stagger">
        <div data-reveal><Stat label="MSMEs in platform" value={msmes.length} /></div>
        <div data-reveal><Stat label="Decisions on file" value={decisions.length} /></div>
        <div data-reveal><Stat label="Approved" value={approveCount} hint={`${((approveCount / Math.max(decisions.length, 1)) * 100).toFixed(0)}% approval rate`} /></div>
        <div data-reveal><Stat label="Total recommended exposure" value={formatINR(totalExposure)} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 reveal-stagger">
        <div data-reveal>
          <Card title="Risk grade distribution" subtitle="Latest score per MSME">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={gradeData}>
                  <XAxis dataKey="grade" stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis allowDecimals={false} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {gradeData.map((entry) => (
                      <Cell key={entry.grade} fill={GRADE_COLOR[entry.grade] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div data-reveal>
          <Card title="Decision distribution">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={decisionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {decisionData.map((entry) => (
                      <Cell key={entry.name} fill={OUTCOME_COLOR[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <div data-reveal>
        <Card title="Recent decisions" subtitle="Last 8 assessments"
          action={<Link to="/lender/decisions" className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-200 font-medium">View all</Link>}>
          {recent.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No decisions yet. Run an assessment from MSME Search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60">
                  <tr>
                    <th className="py-2 font-medium">MSME</th>
                    <th className="py-2 font-medium">Outcome</th>
                    <th className="py-2 font-medium">Score</th>
                    <th className="py-2 font-medium">Recommended limit</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((d) => {
                    const m = msmes.find((x) => x.id === d.msme_id)
                    return (
                      <tr key={d.id} className="border-b border-slate-200/40 dark:border-slate-700/40 last:border-0 hover:bg-slate-900/5 dark:hover:bg-white/5 transition">
                        <td className="py-2.5">
                          <Link to={`/lender/report/${d.msme_id}`} className="text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 font-medium">
                            {m?.legal_name || `MSME #${d.msme_id}`}
                          </Link>
                        </td>
                        <td className="py-2.5"><Badge className={outcomeColor(d.outcome)}>{d.outcome}</Badge></td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-400">-</td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">{formatINR(d.recommended_limit_inr)}</td>
                        <td className="py-2.5 text-slate-500 dark:text-slate-400">{new Date(d.created_at).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
