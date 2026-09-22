import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { api_audit_log } from '../../api/client'
import { Badge, Card, EmptyState, ErrorState, Spinner } from '../../components/UI'
import { formatDateTime } from '../../utils/format'

interface AuditRow {
  id: number
  created_at: string
  action: string
  actor_user_id?: number | null
  msme_id?: number | null
  endpoint?: string | null
  details?: unknown
}

export default function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api_audit_log()
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action).filter(Boolean))).sort(),
    [rows],
  )
  const filtered = action ? rows.filter((r) => r.action === action) : rows

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">All platform events for monitoring and compliance.</p>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="select w-auto"
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {error != null && <ErrorState error={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="No audit events found"
            message={action ? `No events match action “${action}”.` : 'Events appear as the platform is used.'}
          />
        </Card>
      ) : (
        <Card
          flush
          title={`${filtered.length} events`}
          subtitle={action ? `Filtered to ${action}` : 'Most recent first'}
        >
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th className="num">Actor</th>
                  <th className="num">MSME</th>
                  <th>Endpoint</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.created_at)}</td>
                    <td>
                      <Badge>{a.action}</Badge>
                    </td>
                    <td className="num">{a.actor_user_id ?? '—'}</td>
                    <td className="num">{a.msme_id ?? '—'}</td>
                    <td className="font-mono text-xs text-muted-foreground">{a.endpoint ?? '—'}</td>
                    <td className="align-top">
                      <details>
                        <summary className="cursor-pointer select-none text-xs font-medium text-primary transition-colors hover:text-primary-hover">
                          View JSON
                        </summary>
                        <pre className="mt-1.5 max-w-md overflow-auto rounded-lg border border-border bg-muted p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                          {JSON.stringify(a.details ?? {}, null, 2)}
                        </pre>
                      </details>
                    </td>
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
