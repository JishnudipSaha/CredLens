import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api_list_msmes, api_run_assessment, type MSMEListItem } from '../../api/client'
import { Card, Spinner } from '../../components/UI'
import { gradeColor, outcomeColor, formatINR, scoreColor } from '../../utils/format'
import { useReveal } from '../../hooks/useReveal'

export default function MsmeSearch() {
  const [q, setQ] = useState('')
  const [sector, setSector] = useState('')
  const [state, setState] = useState('')
  const [rows, setRows] = useState<MSMEListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)

  const load = () => {
    setLoading(true)
    api_list_msmes({ q: q || undefined, sector: sector || undefined, state: state || undefined, limit: 200 })
      .then(setRows).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const run = async (id: number) => {
    setRunning(id); setError(null)
    try {
      await api_run_assessment(id)
      navigate(`/lender/report/${id}`)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Assessment failed')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div ref={containerRef} className="space-y-space-lg">
      <div data-reveal>
        <h1 className="text-headline-lg text-primary font-bold tracking-tight">MSME Search</h1>
        <p className="text-body-md text-on-surface-variant mt-1">Find an MSME, then run a fresh credit assessment.</p>
      </div>

      <div data-reveal>
        <Card>
          <div className="flex flex-wrap gap-3">
            <input
              type="text" placeholder="Search by name, city, sector..."
              value={q} onChange={(e) => setQ(e.target.value)}
              className="flex-1 min-w-64 glass-input"
            />
            <select value={sector} onChange={(e) => setSector(e.target.value)}
              className="px-3 py-2 rounded-lg glass-input">
              <option value="">All sectors</option>
              {['manufacturing', 'retail', 'services', 'it', 'other'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={state} onChange={(e) => setState(e.target.value)}
              className="px-3 py-2 rounded-lg glass-input">
              <option value="">All states</option>
              {['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Delhi', 'Telangana', 'Uttar Pradesh', 'West Bengal'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <button onClick={load} className="btn-primary px-4 py-2">Search</button>
          </div>
        </Card>
      </div>

      {error && <div className="text-body-sm text-error bg-error-container/30 px-3 py-2 rounded-lg">{error}</div>}

      {loading ? <Spinner /> : (
        <div data-reveal>
          <Card title={`${rows.length} MSMEs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead className="text-left text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="py-2 font-medium">Company</th>
                    <th className="py-2 font-medium">Sector</th>
                    <th className="py-2 font-medium">State</th>
                    <th className="py-2 font-medium">Annual turnover</th>
                    <th className="py-2 font-medium">Latest score</th>
                    <th className="py-2 font-medium">Latest decision</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-low transition">
                      <td className="py-3">
                        <Link to={`/lender/report/${m.id}`} className="text-primary hover:text-primary font-medium">{m.legal_name}</Link>
                        <div className="text-mono-caption text-on-surface-variant">{m.city}</div>
                      </td>
                      <td className="py-3 capitalize text-on-surface">{m.sector}</td>
                      <td className="py-3 text-on-surface">{m.state}</td>
                      <td className="py-3 text-on-surface">{formatINR(m.annual_turnover_inr)}</td>
                      <td className="py-3">
                        {m.latest_score != null ? (
                          <span className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${scoreColor(m.latest_score)}`}>{m.latest_score}</span>
                            <span className={`chip ${gradeColor(m.latest_grade)}`}>{m.latest_grade}</span>
                          </span>
                        ) : <span className="text-on-surface-variant">-</span>}
                      </td>
                      <td className="py-3">{m.latest_decision ? <span className={`chip ${outcomeColor(m.latest_decision)}`}>{m.latest_decision}</span> : <span className="text-on-surface-variant">-</span>}</td>
                      <td className="py-3 text-right space-x-2">
                        <Link to={`/lender/report/${m.id}`} className="text-primary hover:text-primary text-body-sm font-medium">View</Link>
                        <button
                          onClick={() => run(m.id)} disabled={running === m.id}
                          className="text-body-sm font-medium text-white btn-primary px-3 py-1"
                        >
                          {running === m.id ? 'Running...' : 'Run Assessment'}
                        </button>
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
