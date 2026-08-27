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
    <div className={`glass-card animate-fade-up ${className}`}>
      {(title || action) && (
        <div className="px-5 py-3 border-b border-slate-200/60 dark:border-slate-700/60 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`chip ${className}`}>{children}</span>
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="glass-card p-4 hover:scale-[1.015] transition-transform duration-300">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</div>}
    </div>
  )
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-slate-400 dark:text-slate-500 text-sm font-medium">{title}</div>
      {message && <div className="text-slate-500 dark:text-slate-400 text-sm mt-1">{message}</div>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
