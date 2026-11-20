import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, Landmark, ShieldCheck, Store } from 'lucide-react'
import { api_login, auth, UserRole } from '../api/client'
import { useAuth } from '../context'
import { Alert, Button, errorMessage } from '../components/UI'
import { cn } from '../utils/cn'

const homeFor: Record<UserRole, string> = {
  LENDER: '/lender',
  MSME: '/msme',
  GOVERNMENT: '/government',
  ADMIN: '/admin',
}

const demoCreds: { label: string; email: string; password: string; role: UserRole; icon: LucideIcon }[] = [
  { label: 'Lender / Bank', email: 'lender@credlens.in', password: 'lender123', role: 'LENDER', icon: Landmark },
  { label: 'MSME Owner', email: 'msme@credlens.in', password: 'msme123', role: 'MSME', icon: Store },
  { label: 'Government', email: 'govt@credlens.in', password: 'govt123', role: 'GOVERNMENT', icon: Building2 },
  { label: 'Platform Admin', email: 'admin@credlens.in', password: 'admin123', role: 'ADMIN', icon: ShieldCheck },
]

function LensLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" strokeDasharray="28 12" />
      <circle cx="11" cy="11" r="2.5" fill="currentColor" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function Login() {
  const { user, setUser, refresh } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('lender@credlens.in')
  const [password, setPassword] = useState('lender123')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user && !submitting) {
    return <Navigate to={homeFor[user.role]} replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const token = await api_login(email, password)
      auth.setToken(token.access_token)
      setUser({ id: token.user_id, email: token.email, name: token.name, role: token.role, org_name: null, msme_id: null })
      await refresh()
      navigate(homeFor[token.role])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const useDemo = (c: (typeof demoCreds)[0]) => {
    setEmail(c.email)
    setPassword(c.password)
    setError(null)
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#101828] px-10 py-8 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-chart-4/20 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white">
            <LensLogo className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-bold text-white">CredLens</div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/50">Credit Intelligence</div>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
            Institutional-grade MSME credit decisions, in real time.
          </h1>
          <ul className="mt-7 space-y-3.5 text-sm text-white/70">
            {[
              '300–900 credit score with explainable reason codes',
              'RBI-aligned policy engine with automated decision bands',
              'Feedback loop that retrains on actual repayment outcomes',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex gap-5 font-mono text-[11px] uppercase tracking-wider text-white/40">
          <span>SOC-2 Type II</span>
          <span>RBI Master Direction</span>
        </div>
      </div>

      {/* Sign-in form */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <LensLogo className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold text-foreground">CredLens</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-subtle-foreground">
                Credit Intelligence
              </div>
            </div>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-foreground">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">AI-powered MSME credit intelligence platform.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
              />
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            <Button type="submit" className="w-full" loading={submitting}>
              {!submitting && (
                <>
                  Sign in <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
              {submitting && 'Signing in…'}
            </Button>
          </form>

          <div className="mt-7 border-t border-border pt-5">
            <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
              Demo accounts — click to fill
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {demoCreds.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => useDemo(c)}
                  className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <c.icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-foreground">{c.label}</span>
                    <span className="block truncate font-mono text-[10px] text-subtle-foreground">{c.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className={cn('mt-6 text-center text-[11px] text-subtle-foreground')}>
            Protected by enterprise-grade encryption · © 2026 CredLens
          </p>
        </div>
      </div>
    </div>
  )
}
