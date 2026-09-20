import type { ReactNode } from 'react'

export function Card({
  title, subtitle, action, children, className = '',
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`bg-surface-container-lowest rounded-xl shadow-sm animate-fade-up ${className}`} style={{ border: '1px solid #e2e8f0' }}>
      {(title || action) && (
        <div className="px-space-lg py-space-md border-b border-outline-variant flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-headline-sm text-on-surface font-semibold">{title}</h2>}
            {subtitle && <p className="text-body-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-space-lg">{children}</div>
    </div>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`chip ${className}`}>{children}</span>
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: string }) {
  return (
    <div className="metric-card hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-mono-label text-on-surface-variant uppercase tracking-wider">{label}</span>
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px] text-primary">{icon}</span>
          </div>
        )}
      </div>
      <div className="my-space-xs">
        <div className="text-data-metric text-primary font-bold tracking-tight">{value}</div>
      </div>
      {hint && <div className="text-body-sm text-on-surface-variant">{hint}</div>}
    </div>
  )
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-on-surface-variant text-body-md font-medium">{title}</div>
      {message && <div className="text-on-surface-variant text-body-sm mt-1">{message}</div>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
