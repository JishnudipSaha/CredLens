import { useEffect, useRef, useState } from 'react'
import { api_portfolio_insights, type PortfolioInsights } from '../../api/client'
import { Card, Spinner, Stat } from '../../components/UI'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { formatINR } from '../../utils/format'
import { useReveal } from '../../hooks/useReveal'

const COLORS = ['#3563ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899']

export default function PortfolioInsightsPage() {
  const [data, setData] = useState<PortfolioInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  useReveal(containerRef)
  useEffect(() => {
    api_portfolio_insights().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data) return null

  const sectorData = Object.entries(data.sector_distribution).map(([s, c]) => ({ sector: s, count: c }))
  const stateData = Object.entries(data.state_distribution).map(([s, c]) => ({ state: s, count: c }))
  const gradeData = Object.entries(data.grade_distribution).map(([g, c]) => ({ grade: g, count: c }))

  return (
    <div ref={containerRef} className="space-y-5">
      <div data-reveal>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ecosystem Portfolio Insights</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Aggregate credit health of MSMEs in the platform.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 reveal-stagger">
        <div data-reveal><Stat label="Total MSMEs" value={data.total_msmes} /></div>
        <div data-reveal><Stat label="Scored MSMEs" value={data.scored_msmes} /></div>
        <div data-reveal><Stat label="Average credit score" value={data.avg_credit_score} /></div>
        <div data-reveal><Stat label="Total recommended exposure" value={formatINR(data.total_recommended_exposure_inr)} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 reveal-stagger">
        <div data-reveal>
          <Card title="MSMEs by sector">
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sectorData} dataKey="count" nameKey="sector" innerRadius={50} outerRadius={90}>
                    {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div data-reveal>
          <Card title="Risk grade distribution">
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={gradeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.25)" />
                  <XAxis dataKey="grade" stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <YAxis allowDecimals={false} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3563ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      <div data-reveal>
        <Card title="MSMEs by state">
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={stateData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.25)" />
                <XAxis type="number" allowDecimals={false} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <YAxis dataKey="state" type="category" width={120} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
