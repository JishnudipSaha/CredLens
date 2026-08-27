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
    <div ref={containerRef} className="space-y-5">
      <div data-reveal>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">All platform events for monitoring and compliance.</p>
      </div>

      {rows.length === 0 ? <EmptyState title="No audit events yet" /> : (
        <div data-reveal>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60">
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
                    <tr key={a.id} className="border-b border-slate-200/40 dark:border-slate-700/40 last:border-0 align-top">
                      <td className="py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="py-2"><Badge className="bg-slate-100 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-500/40">{a.action}</Badge></td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{a.actor_user_id ?? '-'}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{a.msme_id ?? '-'}</td>
                      <td className="py-2 font-mono text-xs text-slate-600 dark:text-slate-400">{a.endpoint ?? '-'}</td>
                      <td className="py-2 text-xs text-slate-500 dark:text-slate-400 max-w-md truncate" title={JSON.stringify(a.details)}>
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
