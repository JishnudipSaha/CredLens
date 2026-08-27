import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import { Card, EmptyState, Spinner } from '../../components/UI'
import { ScoreGauge } from '../../components/ScoreGauge'
import { useAuth } from '../../context'
import { api_list_msmes } from '../../api/client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useReveal } from '../../hooks/useReveal'

export default function ScoreHistory() {
  const { user } = useAuth()
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  useEffect(() => {
    api_list_msmes({ limit: 200 })
      .then((rows) => {
        const myMsme = rows.find((m) => m.id === user?.msme_id) || rows[0]
        if (!myMsme) return []
        return api.get(`/score/runs/${myMsme.id}`).then((r) => r.data)
      })
      .then(setRuns)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <Spinner />

  const chartData = [...runs].reverse().map((r) => ({ date: new Date(r.created_at).toLocaleDateString(), score: r.credit_score }))

  return (
    <div ref={containerRef} className="space-y-5">
      <div data-reveal>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Score History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track how your credit score has changed over time.</p>
      </div>

      {runs.length === 0 ? <EmptyState title="No score runs yet" /> : (
        <>
          <div data-reveal>
            <Card title="Trend" subtitle={`Last ${runs.length} runs`}>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.25)" />
                    <XAxis dataKey="date" stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                    <YAxis domain={[300, 900]} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#3563ff" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div data-reveal>
            <Card title="All runs">
              <div className="space-y-3">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-700/40 last:border-0 py-3">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{new Date(r.created_at).toLocaleString()}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Model {r.model_version}</div>
                    </div>
                    <ScoreGauge score={r.credit_score} grade={r.risk_grade} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
