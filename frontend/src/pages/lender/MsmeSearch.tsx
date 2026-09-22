import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Play, Search } from 'lucide-react'
import { api_list_msmes, api_run_assessment, type MSMEListItem } from '../../api/client'
import { Badge, Button, Card, EmptyState, ErrorState, Spinner, buttonClasses, errorMessage } from '../../components/UI'
import { useToast } from '../../components/Toast'
import { formatINR, gradeColor, outcomeColor, scoreColor } from '../../utils/format'

const SECTORS = ['manufacturing', 'retail', 'services', 'it', 'other']
const STATES = [
  'Maharashtra',
  'Karnataka',
  'Tamil Nadu',
  'Gujarat',
  'Delhi',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
]

const PAGE_SIZE = 15

export default function MsmeSearch() {
  const [q, setQ] = useState('')
  const [sector, setSector] = useState('')
  const [state, setState] = useState('')
  const [rows, setRows] = useState<MSMEListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [running, setRunning] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const { toast } = useToast()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    setPage(1)
    api_list_msmes({ q: q || undefined, sector: sector || undefined, state: state || undefined, limit: 200 })
      .then(setRows)
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [q, sector, state])

  useEffect(() => {
    load()
    // initial fetch only — subsequent loads happen on submit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async (id: number) => {
    setRunning(id)
    try {
      await api_run_assessment(id)
      toast({ tone: 'success', title: 'Assessment complete', message: 'Opening the credit report…' })
      navigate(`/lender/report/${id}`)
    } catch (e) {
      toast({ tone: 'error', title: 'Assessment failed', message: errorMessage(e) })
    } finally {
      setRunning(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = rows.slice(start, start + PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">MSME Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find an MSME, then run a fresh credit assessment.</p>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
          className="flex flex-wrap items-center gap-2.5"
        >
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
            <input
              type="text"
              placeholder="Search by name, city, sector…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="input pl-9"
              aria-label="Search MSMEs"
            />
          </div>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="select w-auto min-w-[150px]"
            aria-label="Filter by sector"
          >
            <option value="">All sectors</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="select w-auto min-w-[150px]"
            aria-label="Filter by state"
          >
            <option value="">All states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden /> Search
          </Button>
        </form>
      </Card>

      {error != null && <ErrorState error={error} onRetry={load} />}

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="No MSMEs found"
            message="Try a different search term or clear the filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQ('')
                  setSector('')
                  setState('')
                  load()
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <Card flush title={`${rows.length} MSMEs`} subtitle={`Page ${safePage} of ${totalPages}`}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Sector</th>
                  <th>State</th>
                  <th className="num">Annual turnover</th>
                  <th>Latest score</th>
                  <th>Latest decision</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link
                        to={`/lender/report/${m.id}`}
                        className="font-medium text-primary transition-colors hover:text-primary-hover"
                      >
                        {m.legal_name}
                      </Link>
                      <div className="text-xs text-subtle-foreground">{m.city}</div>
                    </td>
                    <td className="capitalize">{m.sector}</td>
                    <td>{m.state}</td>
                    <td className="num">{formatINR(m.annual_turnover_inr)}</td>
                    <td>
                      {m.latest_score != null ? (
                        <span className="flex items-center gap-2">
                          <span className={`text-base font-bold ${scoreColor(m.latest_score)}`}>{m.latest_score}</span>
                          <span className={gradeColor(m.latest_grade)}>{m.latest_grade}</span>
                        </span>
                      ) : (
                        <span className="text-subtle-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {m.latest_decision ? (
                        <Badge className={outcomeColor(m.latest_decision)}>{m.latest_decision}</Badge>
                      ) : (
                        <span className="text-subtle-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/lender/report/${m.id}`} className={buttonClasses('ghost', 'sm')}>
                          View
                        </Link>
                        <Button size="sm" onClick={() => run(m.id)} loading={running === m.id}>
                          {running !== m.id && <Play className="h-3.5 w-3.5" aria-hidden />}
                          {running === m.id ? 'Running…' : 'Run assessment'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
