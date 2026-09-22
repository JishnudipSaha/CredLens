import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, AlertTriangle, CheckCircle2, Inbox, Info, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '../utils/cn'
import { BADGE_BASE } from '../utils/format'

/* ------------------------------------------------------------------ Card */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
  flush = false,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  flush?: boolean
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
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </div>
  )
}

/* ---------------------------------------------------------------- Button */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
export type ButtonSize = 'sm' | 'md'

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  const v: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs',
    secondary: 'border border-border bg-card text-foreground hover:bg-muted shadow-xs',
    ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted',
    danger: 'border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20',
    success: 'border border-success/30 bg-success/10 text-success hover:bg-success/20',
    warning: 'border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20',
  }
  const s = size === 'sm' ? 'h-8 px-3 text-[13px] gap-1.5' : 'h-10 px-4 text-sm gap-2'
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    v[variant],
    s,
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({ variant, size, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- Badge */

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={cn(BADGE_BASE, !className && 'border-border bg-muted text-muted-foreground', className)}>{children}</span>
}

/* ----------------------------------------------------------------- Alert */

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

const ALERT_STYLE: Record<AlertTone, { wrap: string; icon: LucideIcon; iconCls: string }> = {
  error: { wrap: 'border-danger/30 bg-danger/10', icon: AlertCircle, iconCls: 'text-danger' },
  success: { wrap: 'border-success/30 bg-success/10', icon: CheckCircle2, iconCls: 'text-success' },
  warning: { wrap: 'border-warning/30 bg-warning/10', icon: AlertTriangle, iconCls: 'text-warning' },
  info: { wrap: 'border-primary/30 bg-primary/10', icon: Info, iconCls: 'text-primary' },
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const s = ALERT_STYLE[tone]
  const Icon = s.icon
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', s.wrap, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <div className="font-medium text-foreground">{title}</div>}
        {children != null && <div className={cn(title ? 'mt-0.5 text-muted-foreground' : 'text-muted-foreground')}>{children}</div>}
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: {
  icon?: LucideIcon
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-muted text-subtle-foreground">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {message && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------- Spinner / Skeleton */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16', className)} role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden />
}

/* ------------------------------------------------------------------ Stat */

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-mono-label uppercase tracking-wider text-subtle-foreground">{label}</span>
        {Icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ ErrorState */

export function errorMessage(err: unknown): string {
  const e = err as { response?: { data?: { detail?: unknown } }; message?: string }
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join('; ')
  }
  return e?.message || 'Something went wrong'
}

export function ErrorState({
  error,
  onRetry,
  title = 'Could not load data',
  className = '',
}: {
  error?: unknown
  onRetry?: () => void
  title?: string
  className?: string
}) {
  return (
    <Alert
      tone="error"
      title={title}
      className={className}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        ) : undefined
      }
    >
      {typeof error === 'string' && error ? error : errorMessage(error)}
    </Alert>
  )
}

/* ----------------------------------------------------------- TableWrap */

export function TableWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border bg-card shadow-xs', className)}>
      <table className="tbl">{children}</table>
    </div>
  )
}
