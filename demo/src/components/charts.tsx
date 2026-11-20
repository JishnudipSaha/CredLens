import { useMemo, type ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { useTheme } from '../theme'
import { cn } from '../utils/cn'

export interface ChartColors {
  grid: string
  axis: string
  text: string
  primary: string
  palette: string[]
  grade: Record<string, string>
  outcome: Record<string, string>
}

function hsl(v: string): string {
  return `hsl(${v.trim()})`
}

/**
 * Reads the CSS-variable chart palette from :root/.dark so every chart
 * automatically matches the active theme.
 */
export function useChartColors(): ChartColors {
  const { theme } = useTheme()
  return useMemo(() => {
    const s = getComputedStyle(document.documentElement)
    const v = (name: string) => s.getPropertyValue(name)
    return {
      grid: hsl(v('--border')),
      axis: hsl(v('--subtle-foreground')),
      text: hsl(v('--muted-foreground')),
      primary: hsl(v('--primary')),
      palette: ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6', '--chart-7', '--chart-8'].map(
        (n) => hsl(v(n)),
      ),
      grade: {
        A: hsl(v('--grade-a')),
        B: hsl(v('--grade-b')),
        C: hsl(v('--grade-c')),
        D: hsl(v('--grade-d')),
        E: hsl(v('--grade-e')),
        F: hsl(v('--grade-f')),
      },
      outcome: {
        APPROVE: hsl(v('--success')),
        REVIEW: hsl(v('--warning')),
        REJECT: hsl(v('--danger')),
        PAID_ON_TIME: hsl(v('--success')),
        DELAYED: hsl(v('--warning')),
        PARTIAL_DEFAULT: hsl(v('--grade-d')),
        NPA: hsl(v('--danger')),
      },
    }
  }, [theme])
}

/** Standard X/Y axis styling — pass into <XAxis {...axisProps(c)} /> */
export function axisProps(c: ChartColors) {
  return {
    tick: { fill: c.axis, fontSize: 11 },
    axisLine: { stroke: c.grid },
    tickLine: false as const,
  }
}

/* --------------------------------------------------------------- ChartCard */

export function ChartCard({
  title,
  subtitle,
  action,
  height = 260,
  children,
  className = '',
  empty = false,
  emptyMessage = 'No data to display yet.',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  height?: number
  children: ReactNode
  className?: string
  empty?: boolean
  emptyMessage?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card shadow-xs', className)}>
      {(title || action || subtitle) && (
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold leading-tight text-foreground">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="px-4 py-4">
        {empty ? (
          <div className="grid place-items-center text-sm text-subtle-foreground" style={{ height }}>
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ ChartTooltip */

interface TooltipEntry {
  name?: string
  value?: number | string
  color?: string
  fill?: string
}

export function ChartTooltip({
  active,
  payload,
  label,
  format = (v: unknown) => String(v),
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: unknown
  format?: (v: unknown) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      {label != null && label !== '' && (
        <div className="mb-1 text-xs font-medium text-foreground">{String(label)}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: p.color || p.fill || 'currentColor' }}
            aria-hidden
          />
          {p.name && <span>{p.name}:</span>}
          <span className="font-medium tabular-nums text-foreground">{format(p.value)}</span>
        </div>
      ))}
    </div>
  )
}
