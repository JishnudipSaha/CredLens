import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api_list_decisions, api_list_msmes, type Decision, type MSMEListItem } from '../../api/client'
import { Card, EmptyState, Spinner, Badge } from '../../components/UI'
import { formatINR, outcomeColor } from '../../utils/format'
import { useReveal } from '../../hooks/useReveal'

export default function Decisions() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [msmes, setMsmes] = useState<MSMEListItem[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  const load = () => {
    setLoading(true)
    Promise.all([api_list_decisions({ outcome: filter || undefined }), api_list_msmes({ limit: 200 })])
      .then(([d, m]) => { setDecisions(d); setMsmes(m) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [filter])

  const msmeName = (id: number) => msmes.find((m) => m.id === id)?.legal_name || `MSME #${id}`

  return (
    <div ref={containerRef} className="space-y-5">
      <div data-reveal className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Decision Queue</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">All decisions issued on the platform.</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-lg glass-input">
          <option value="">All outcomes</option>
          <option value="APPROVE">Approved</option>
          <option value="REVIEW">Review</option>
          <option value="REJECT">Rejected</option>
        </select>
      </div>

      {loading ? <Spinner /> : decisions.length === 0 ? <EmptyState title="No decisions found" /> : (
        <div data-reveal>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60">
                  <tr>
                    <th className="py-2 font-medium">MSME</th>
                    <th className="py-2 font-medium">Outcome</th>
                    <th className="py-2 font-medium">Limit</th>
                    <th className="py-2 font-medium">Rationale</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.id} className="border-b border-slate-200/40 dark:border-slate-700/40 last:border-0 hover:bg-slate-900/5 dark:hover:bg-white/5 transition">
                      <td className="py-3">
                        <Link to={`/lender/report/${d.msme_id}`} className="text-brand-700 dark:text-brand-300 hover:text-brand-900 dark:hover:text-brand-100 font-medium">{msmeName(d.msme_id)}</Link>
                      </td>
                      <td className="py-3"><Badge className={outcomeColor(d.outcome)}>{d.outcome}</Badge></td>
                      <td className="py-3 text-slate-700 dark:text-slate-300">{formatINR(d.recommended_limit_inr)}</td>
                      <td className="py-3 max-w-md text-slate-600 dark:text-slate-300 truncate" title={d.rationale}>{d.rationale}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400">{new Date(d.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
