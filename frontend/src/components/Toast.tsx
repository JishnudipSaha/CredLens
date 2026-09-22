import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../utils/cn'

type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  message?: string
}

interface ToastCtx {
  toast: (t: Omit<ToastItem, 'id'>) => void
}

const Ctx = createContext<ToastCtx | null>(null)

const TONE_STYLE: Record<ToastTone, { icon: typeof AlertCircle; iconCls: string; border: string }> = {
  success: { icon: CheckCircle2, iconCls: 'text-success', border: 'border-success/30' },
  error: { icon: AlertCircle, iconCls: 'text-danger', border: 'border-danger/30' },
  warning: { icon: AlertTriangle, iconCls: 'text-warning', border: 'border-warning/30' },
  info: { icon: Info, iconCls: 'text-primary', border: 'border-primary/30' },
}

function ToastCard({ tone, title, message, onClose }: ToastItem & { onClose: () => void }) {
  const s = TONE_STYLE[tone]
  const Icon = s.icon
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-lg animate-fade-up',
        s.border,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {message && <div className="mt-0.5 text-xs text-muted-foreground">{message}</div>}
      </div>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        className="rounded p-0.5 text-subtle-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = ++idRef.current
      setItems((xs) => [...xs.slice(-3), { ...t, id }])
      window.setTimeout(() => remove(id), 4500)
    },
    [remove],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      >
        {items.map((t) => (
          <ToastCard key={t.id} {...t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}
