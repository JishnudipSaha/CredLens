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
    <div ref={containerRef} className="space-y-space-lg">
      <div data-reveal className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg text-primary font-bold tracking-tight">Decision Queue</h1>
          <p className="text-body-md text-on-surface-variant mt-1">All decisions issued on the platform.</p>
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
              <table className="w-full text-body-sm">
                <thead className="text-left text-on-surface-variant border-b border-outline-variant">
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
                    <tr key={d.id} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-low transition">
                      <td className="py-3">
                        <Link to={`/lender/report/${d.msme_id}`} className="text-primary hover:text-primary font-medium">{msmeName(d.msme_id)}</Link>
                      </td>
                      <td className="py-3"><Badge className={outcomeColor(d.outcome)}>{d.outcome}</Badge></td>
                      <td className="py-3 text-on-surface">{formatINR(d.recommended_limit_inr)}</td>
                      <td className="py-3 max-w-md text-on-surface truncate" title={d.rationale}>{d.rationale}</td>
                      <td className="py-3 text-on-surface-variant">{new Date(d.created_at).toLocaleString()}</td>
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
