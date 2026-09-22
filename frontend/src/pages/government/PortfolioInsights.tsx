import { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Building2, Gauge, Wallet } from 'lucide-react'
import { api_portfolio_insights, type PortfolioInsights } from '../../api/client'
import { Card, ErrorState, Spinner, Stat } from '../../components/UI'
import { ChartCard, ChartTooltip, axisProps, useChartColors } from '../../components/charts'
import { formatINR } from '../../utils/format'

export default function PortfolioInsightsPage() {
  const [data, setData] = useState<PortfolioInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const colors = useChartColors()

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api_portfolio_insights()
      .then(setData)
      .catch((e) => setError(e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={load} />
  if (!data) return <ErrorState error="No portfolio data available." onRetry={load} />

  const sectorData = Object.entries(data.sector_distribution).map(([sector, count]) => ({ sector, count }))
  const stateData = Object.entries(data.state_distribution).map(([state, count]) => ({ state, count }))
  const gradeData = Object.entries(data.grade_distribution).map(([grade, count]) => ({ grade, count }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Ecosystem Portfolio Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aggregate credit health of MSMEs on the platform.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total MSMEs" value={data.total_msmes} icon={Building2} />
        <Stat label="Scored MSMEs" value={data.scored_msmes} icon={Gauge} />
        <Stat label="Average credit score" value={Math.round(data.avg_credit_score)} icon={Activity} />
        <Stat label="Total recommended exposure" value={formatINR(data.total_recommended_exposure_inr)} icon={Wallet} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="MSMEs by sector" empty={sectorData.length === 0}>
          <PieChart>
            <Pie data={sectorData} dataKey="count" nameKey="sector" innerRadius={55} outerRadius={95} paddingAngle={2}>
              {sectorData.map((entry, i) => (
                <Cell key={entry.sector} fill={colors.palette[i % colors.palette.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Risk grade distribution" empty={gradeData.length === 0}>
          <BarChart data={gradeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="grade" {...axisProps(colors)} />
            <YAxis allowDecimals={false} {...axisProps(colors)} width={44} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
            <Bar dataKey="count" name="MSMEs" radius={[6, 6, 0, 0]}>
              {gradeData.map((entry) => (
                <Cell key={entry.grade} fill={colors.grade[entry.grade] || colors.palette[0]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard
        title="MSMEs by state"
        subtitle="Top states by count"
        height={Math.max(220, Math.min(480, stateData.length * 36))}
        empty={stateData.length === 0}
      >
        <BarChart data={stateData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...axisProps(colors)} />
          <YAxis dataKey="state" type="category" width={110} {...axisProps(colors)} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.grid, fillOpacity: 0.4 }} />
          <Bar dataKey="count" name="MSMEs" fill={colors.palette[0]} radius={[0, 6, 6, 0]} barSize={16} />
        </BarChart>
      </ChartCard>
    </div>
  )
}
