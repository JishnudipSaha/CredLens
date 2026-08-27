import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { auth, UserRole } from '../api/client'
import { ThemeToggle } from './ThemeToggle'

interface LayoutProps {
  role: UserRole
  userName: string
  children: ReactNode
}

const roleLabel: Record<UserRole, string> = {
  LENDER: 'Lender / Bank / NBFC',
  MSME: 'MSME Owner',
  GOVERNMENT: 'Government / Ecosystem',
  ADMIN: 'Platform Admin',
}

const navByRole: Record<UserRole, { to: string; label: string }[]> = {
  LENDER: [
    { to: '/lender', label: 'Portfolio' },
    { to: '/lender/search', label: 'MSME Search' },
    { to: '/lender/decisions', label: 'Decision Queue' },
  ],
  MSME: [
    { to: '/msme', label: 'My Credit Health' },
    { to: '/msme/upload', label: 'Upload Data' },
    { to: '/msme/history', label: 'Score History' },
  ],
  GOVERNMENT: [
    { to: '/government', label: 'Portfolio Insights' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Model Monitor' },
    { to: '/admin/audit', label: 'Audit Log' },
  ],
}

export default function Layout({ role, userName, children }: LayoutProps) {
  const navigate = useNavigate()
  const links = navByRole[role]

  return (
    <>
      <div className="app-bg" aria-hidden />
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 glass">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center font-bold shadow-glass group-hover:scale-105 transition-transform">
                CL
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">CredLens</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-none">MSME Credit Intelligence</div>
              </div>
            </Link>
            <nav className="flex items-center gap-1 ml-4">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-900/5 dark:hover:bg-white/5'
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden sm:block text-right px-2">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{userName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{roleLabel[role]}</div>
              </div>
              <button
                onClick={() => { auth.clear(); navigate('/login') }}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-md btn-ghost"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">{children}</main>
        <footer className="border-t border-slate-200/40 dark:border-slate-700/40 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
          CredLens prototype - AI Powered MSME Credit Intelligence Platform
        </footer>
      </div>
    </>
  )
}
