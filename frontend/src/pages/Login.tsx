import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { api_login, auth, UserRole } from '../api/client'
import { useAuth } from '../context'
import { ThemeToggle } from '../components/ThemeToggle'

const homeFor: Record<UserRole, string> = {
  LENDER: '/lender',
  MSME: '/msme',
  GOVERNMENT: '/government',
  ADMIN: '/admin',
}

const demoCreds: { label: string; email: string; password: string; role: UserRole }[] = [
  { label: 'Lender / Bank', email: 'lender@credlens.in', password: 'lender123', role: 'LENDER' },
  { label: 'MSME Owner', email: 'msme@credlens.in', password: 'msme123', role: 'MSME' },
  { label: 'Government', email: 'govt@credlens.in', password: 'govt123', role: 'GOVERNMENT' },
  { label: 'Platform Admin', email: 'admin@credlens.in', password: 'admin123', role: 'ADMIN' },
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
      <div className="absolute top-4 right-4 z-30"><ThemeToggle /></div>
      <div className="min-h-screen grid place-items-center px-4">
        <div className="w-full max-w-md glass-strong rounded-3xl p-8 animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center font-bold text-lg shadow-glass">
              CL
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">CredLens</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">AI Powered MSME Credit Intelligence</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="glass-input" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="glass-input" required
              />
            </div>
            {error && <div className="text-sm text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3 py-2 rounded-lg">{error}</div>}
            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200/40 dark:border-slate-700/40 pt-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Demo accounts (click to fill):</div>
            <div className="grid grid-cols-2 gap-2">
              {demoCreds.map((c) => (
                <button
                  key={c.email} type="button" onClick={() => useDemo(c)}
                  className="text-xs text-left px-3 py-2 rounded-lg glass hover:bg-brand-500/10 dark:hover:bg-brand-500/20 transition"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{c.label}</div>
                  <div className="text-slate-500 dark:text-slate-400">{c.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
