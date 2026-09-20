import { useEffect, useRef, useState } from 'react'
import { api_audit_log } from '../../api/client'
import { Card, EmptyState, Spinner, Badge } from '../../components/UI'
import { useReveal } from '../../hooks/useReveal'

export default function AuditLog() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)
  useEffect(() => {
    api_audit_log().then(setRows).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div ref={containerRef} className="space-y-space-lg">
      <div data-reveal>
        <h1 className="text-headline-lg text-primary font-bold tracking-tight">Audit Log</h1>
        <p className="text-body-md text-on-surface-variant mt-1">All platform events for monitoring and compliance.</p>
      </div>

      {rows.length === 0 ? <EmptyState title="No audit events yet" /> : (
        <div data-reveal>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="text-left text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="py-2 font-medium">When</th>
                    <th className="py-2 font-medium">Action</th>
                    <th className="py-2 font-medium">Actor</th>
                    <th className="py-2 font-medium">MSME</th>
                    <th className="py-2 font-medium">Endpoint</th>
                    <th className="py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b border-outline-variant/40 last:border-0 align-top">
                      <td className="py-2 text-on-surface-variant whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="py-2"><Badge className="chip bg-surface-container text-on-surface">{a.action}</Badge></td>
                      <td className="py-2 text-on-surface">{a.actor_user_id ?? '-'}</td>
                      <td className="py-2 text-on-surface">{a.msme_id ?? '-'}</td>
                      <td className="py-2 font-mono text-mono-caption text-on-surface-variant">{a.endpoint ?? '-'}</td>
                      <td className="py-2 text-mono-caption text-on-surface-variant max-w-md truncate" title={JSON.stringify(a.details)}>
                        {JSON.stringify(a.details)}
                      </td>
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
