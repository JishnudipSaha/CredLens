import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FileText, Send, Wifi } from 'lucide-react'
import { useAuth } from '../../context'
import { api_list_msmes, api } from '../../api/client'
import { Alert, Button, Card, errorMessage } from '../../components/UI'
import { useToast } from '../../components/Toast'

const FINANCIAL_PAYLOAD = {
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
}

const ALTERNATIVE_PAYLOAD = {
  utility_payments: [
    { month: '2025-04', on_time: true },
    { month: '2025-05', on_time: true },
    { month: '2025-06', on_time: true },
    { month: '2025-07', on_time: true },
  ],
  telecom_data: { score: 0.78 },
  digital_footprint: { score: 0.72 },
}

function PayloadPreview({ payload }: { payload: object }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer select-none text-xs font-medium text-primary transition-colors hover:text-primary-hover">
        View sample payload
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </details>
  )
}

export default function UploadData() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [msmeId, setMsmeId] = useState<number | null>(user?.msme_id || null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (msmeId) return
    api_list_msmes({ limit: 1 }).then((rows) => {
      if (rows[0]) setMsmeId(rows[0].id)
    })
  }, [msmeId])

  const send = useCallback(
    async (path: string, payload: object) => {
      if (!msmeId) return
      setLoading(true)
      setMsg(null)
      try {
        const r = await api.post(`/ingest${path}/${msmeId}`, payload)
        const text = `Accepted ${r.data.accepted_records}, rejected ${r.data.rejected_records}.`
        setMsg({ kind: 'ok', text })
        toast({ tone: 'success', title: 'Payload accepted', message: text })
      } catch (e) {
        const text = errorMessage(e)
        setMsg({ kind: 'err', text })
        toast({ tone: 'error', title: 'Upload failed', message: text })
      } finally {
        setLoading(false)
      }
    },
    [msmeId, toast],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Upload Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Push sample records to see how ingestion cleans, validates, and updates your financials.
        </p>
      </div>

      {!msmeId && (
        <Alert tone="warning" title="No MSME linked">
          Your account has no linked MSME profile, so uploads are disabled.
        </Alert>
      )}

      {msg && (
        <Alert tone={msg.kind === 'ok' ? 'success' : 'error'} title={msg.kind === 'ok' ? 'Ingestion result' : 'Upload failed'}>
          {msg.text}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card title="Financial data" subtitle="Bank statements, GST returns, ITR, balance sheet">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4.5 w-4.5" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              Sample: 3 months of healthy bank balance and GST filings — exercises validation, cleaning, and
              financial feature refresh.
            </p>
          </div>
          <PayloadPreview payload={FINANCIAL_PAYLOAD} />
          <Button
            className="mt-4"
            variant="secondary"
            loading={loading}
            disabled={!msmeId}
            onClick={() => send('/financial', FINANCIAL_PAYLOAD)}
          >
            {!loading && <Send className="h-4 w-4" aria-hidden />}
            Send sample financial payload
          </Button>
        </Card>

        <Card title="Alternative data" subtitle="Utility payments, telecom, digital footprint">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wifi className="h-4.5 w-4.5" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              Sample: all utility bills on time with healthy telecom &amp; digital scores — feeds the alt-data
              component of the score.
            </p>
          </div>
          <PayloadPreview payload={ALTERNATIVE_PAYLOAD} />
          <Button
            className="mt-4"
            variant="secondary"
            loading={loading}
            disabled={!msmeId}
            onClick={() => send('/alternative', ALTERNATIVE_PAYLOAD)}
          >
            {!loading && <Send className="h-4 w-4" aria-hidden />}
            Send sample alternative payload
          </Button>
        </Card>
      </div>

      <Alert tone="info" title="What happens next">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Ingested records update your financial profile immediately — re-run an assessment (or wait for a lender)
          to see the score move.
        </span>
      </Alert>
    </div>
  )
}
