import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { api_login, auth, UserRole } from '../api/client'
import { useAuth } from '../context'

const homeFor: Record<UserRole, string> = {
  LENDER: '/lender',
  MSME: '/msme',
  GOVERNMENT: '/government',
  ADMIN: '/admin',
}

const demoCreds: { label: string; email: string; password: string; role: UserRole; icon: string }[] = [
  { label: 'Lender / Bank', email: 'lender@credlens.in', password: 'lender123', role: 'LENDER', icon: 'account_balance' },
  { label: 'MSME Owner', email: 'msme@credlens.in', password: 'msme123', role: 'MSME', icon: 'business' },
  { label: 'Government', email: 'govt@credlens.in', password: 'govt123', role: 'GOVERNMENT', icon: 'domain' },
  { label: 'Platform Admin', email: 'admin@credlens.in', password: 'admin123', role: 'ADMIN', icon: 'admin_panel_settings' },
]

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
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  const useDemo = (c: typeof demoCreds[0]) => { setEmail(c.email); setPassword(c.password) }

  return (
    <>
      <div className="app-bg" aria-hidden />
      <div className="min-h-screen grid place-items-center px-4">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-lg p-8 animate-fade-up" style={{ border: '1px solid #e2e8f0' }}>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-primary-container flex items-center justify-center">
              <svg viewBox="0 0 28 28" className="w-6 h-6" fill="none">
                <circle cx="14" cy="14" r="7" stroke="#60A5FA" strokeWidth="2.5" strokeDasharray="32 10" />
                <circle cx="14" cy="14" r="3" fill="#93C5FD" />
                <path d="M19 19L24 24" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold text-primary tracking-tight">CredLens</div>
              <div className="text-mono-caption text-on-surface-variant">AI Powered MSME Credit Intelligence</div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="glass-input" required
              />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="glass-input" required
              />
            </div>
            {error && (
              <div className="text-body-sm text-error bg-error-container/30 px-3 py-2 rounded-lg">{error}</div>
            )}
            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-6 border-t border-outline-variant pt-4">
            <div className="text-mono-caption text-on-surface-variant mb-2 uppercase font-semibold">Demo accounts (click to fill):</div>
            <div className="grid grid-cols-2 gap-2">
              {demoCreds.map((c) => (
                <button
                  key={c.email} type="button" onClick={() => useDemo(c)}
                  className="text-left px-3 py-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">{c.icon}</span>
                    <div className="font-medium text-body-sm text-on-surface">{c.label}</div>
                  </div>
                  <div className="text-mono-caption text-on-surface-variant mt-1 ml-6">{c.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
