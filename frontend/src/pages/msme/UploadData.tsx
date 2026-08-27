import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context'
import { api_list_msmes, api } from '../../api/client'
import { Card, Spinner } from '../../components/UI'
import { useReveal } from '../../hooks/useReveal'

export default function UploadData() {
  const { user } = useAuth()
  const [msmeId, setMsmeId] = useState<number | null>(user?.msme_id || null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  useEffect(() => {
    if (msmeId) return
    api_list_msmes({ limit: 1 }).then((rows) => { if (rows[0]) setMsmeId(rows[0].id) })
  }, [msmeId])

  const send = async (path: string, payload: object) => {
    if (!msmeId) return
    setLoading(true); setMsg(null)
    try {
      const r = await api.post(`/ingest${path}/${msmeId}`, payload)
      setMsg({ kind: 'ok', text: `Accepted ${r.data.accepted_records}, rejected ${r.data.rejected_records}.` })
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.detail || 'Upload failed' })
    } finally { setLoading(false) }
  }

  const sendSampleFinancial = () => send('/financial', {
    bank_statements: [
      { month: '2025-04', closing_balance: 480000, bounced_cheques: 0 },
      { month: '2025-05', closing_balance: 510000, bounced_cheques: 0 },
      { month: '2025-06', closing_balance: 530000, bounced_cheques: 0 },
    ],
    gst_returns: [
      { period: '2025-04', taxable_value: 1100000, tax_paid: 198000 },
      { period: '2025-05', taxable_value: 1150000, tax_paid: 207000 },
      { period: '2025-06', taxable_value: 1200000, tax_paid: 216000 },
    ],
  })

  const sendSampleAlternative = () => send('/alternative', {
    utility_payments: [
      { month: '2025-04', on_time: true }, { month: '2025-05', on_time: true },
      { month: '2025-06', on_time: true }, { month: '2025-07', on_time: true },
    ],
    telecom_data: { score: 0.78 },
    digital_footprint: { score: 0.72 },
  })

  return (
    <div ref={containerRef} className="space-y-5">
      <div data-reveal>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Upload Data</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Push sample records to see how ingestion cleans, validates, and updates your financials.</p>
      </div>

      {msg && (
        <div data-reveal className={`text-sm px-3 py-2 rounded-lg ${msg.kind === 'ok' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
          {msg.text}
        </div>
      )}

      {loading && <Spinner />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 reveal-stagger">
        <div data-reveal>
          <Card title="Financial data" subtitle="Bank statements, GST returns, ITR, balance sheet">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Sample: 3 months of healthy bank balance and GST filings.</p>
            <button onClick={sendSampleFinancial} disabled={!msmeId || loading} className="btn-primary px-4 py-2 disabled:opacity-50">
              Send sample financial payload
            </button>
          </Card>
        </div>
        <div data-reveal>
          <Card title="Alternative data" subtitle="Utility payments, telecom, digital footprint">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Sample: all utility bills on time, healthy telecom & digital scores.</p>
            <button onClick={sendSampleAlternative} disabled={!msmeId || loading} className="btn-primary px-4 py-2 disabled:opacity-50">
              Send sample alternative payload
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
