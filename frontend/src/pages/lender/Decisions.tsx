import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gavel } from 'lucide-react'
import { api_list_decisions, api_list_msmes, type Decision, type MSMEListItem } from '../../api/client'
import { Badge, Card, EmptyState, ErrorState, Spinner } from '../../components/UI'
import { formatDate, formatINR, gradeColor, outcomeColor } from '../../utils/format'

export default function Decisions() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [msmes, setMsmes] = useState<MSMEListItem[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([api_list_decisions({ outcome: filter || undefined }), api_list_msmes({ limit: 200 })])
      .then(([d, m]) => {
        setDecisions(d)
        setMsmes(m)
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const msmeName = (id: number) => msmes.find((m) => m.id === id)?.legal_name || `MSME #${id}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Decision Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">All decisions issued on the platform.</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="select w-auto"
          aria-label="Filter by outcome"
        >
          <option value="">All outcomes</option>
          <option value="APPROVE">Approved</option>
          <option value="REVIEW">Review</option>
          <option value="REJECT">Rejected</option>
        </select>
      </div>

      {error != null && <ErrorState error={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : decisions.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gavel}
            title="No decisions found"
            message={filter ? `No ${filter.toLowerCase()} decisions match this filter.` : 'Decisions appear here once assessments run.'}
          />
        </Card>
      ) : (
        <Card flush title={`${decisions.length} decisions`} subtitle={filter ? `Filtered to ${filter}` : undefined}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>MSME</th>
                  <th>Outcome</th>
                  <th className="num">Score</th>
                  <th className="num">Limit</th>
                  <th>Rationale</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        to={`/lender/report/${d.msme_id}`}
                        className="font-medium text-primary transition-colors hover:text-primary-hover"
                      >
                        {msmeName(d.msme_id)}
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
                    <td>
                      <span className="block max-w-[320px] truncate text-muted-foreground" title={d.rationale}>
                        {d.rationale}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
