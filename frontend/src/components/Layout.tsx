import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
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

const navByRole: Record<UserRole, { to: string; label: string; icon: string }[]> = {
  LENDER: [
    { to: '/lender', label: 'Portfolio', icon: 'dashboard' },
    { to: '/lender/search', label: 'MSME Search', icon: 'search' },
    { to: '/lender/decisions', label: 'Decision Queue', icon: 'gavel' },
  ],
  MSME: [
    { to: '/msme', label: 'Credit Health', icon: 'speed' },
    { to: '/msme/upload', label: 'Data Upload', icon: 'upload_file' },
    { to: '/msme/history', label: 'Score History', icon: 'history' },
  ],
  GOVERNMENT: [
    { to: '/government', label: 'Portfolio Insights', icon: 'analytics' },
  ],
  ADMIN: [
    { to: '/admin', label: 'Model Monitor', icon: 'monitoring' },
    { to: '/admin/audit', label: 'Audit Log', icon: 'receipt_long' },
  ],
}

const roleIcons: Record<UserRole, string> = {
  LENDER: 'account_balance',
  MSME: 'business',
  GOVERNMENT: 'domain',
  ADMIN: 'admin_panel_settings',
}

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const parts = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = []

  if (parts[0] === 'lender') {
    crumbs.push({ label: 'Lender Portfolio', path: '/lender' })
    if (parts[1] === 'search') crumbs.push({ label: 'MSME Search', path: '/lender/search' })
    if (parts[1] === 'decisions') crumbs.push({ label: 'Decision Queue', path: '/lender/decisions' })
    if (parts[1] === 'report') crumbs.push({ label: 'Credit Report', path: pathname })
  } else if (parts[0] === 'msme') {
    crumbs.push({ label: 'MSME Portal', path: '/msme' })
    if (parts[1] === 'upload') crumbs.push({ label: 'Data Upload', path: '/msme/upload' })
    if (parts[1] === 'history') crumbs.push({ label: 'Score History', path: '/msme/history' })
  } else if (parts[0] === 'government') {
    crumbs.push({ label: 'Government', path: '/government' })
    crumbs.push({ label: 'Portfolio Insights', path: '/government' })
  } else if (parts[0] === 'admin') {
    crumbs.push({ label: 'Platform Admin', path: '/admin' })
    if (parts[1] === 'audit') crumbs.push({ label: 'Audit Log', path: '/admin/audit' })
    else crumbs.push({ label: 'Model Monitor', path: '/admin' })
  }

  return crumbs
}

export default function Layout({ role, userName, children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const links = navByRole[role]
  const breadcrumbs = getBreadcrumbs(location.pathname)

  return (
    <>
      <div className="app-bg" aria-hidden />
      <div className="flex min-h-screen">
        {/* Sidebar Navigation */}
        <aside className="hidden xl:flex w-[260px] flex-col bg-white border-r border-outline-variant fixed top-0 left-0 h-screen z-40">
          {/* Logo */}
          <div className="px-4 py-4 border-b border-outline-variant">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-container flex items-center justify-center">
                <svg viewBox="0 0 28 28" className="w-5 h-5" fill="none">
                  <circle cx="14" cy="14" r="7" stroke="#60A5FA" strokeWidth="2.5" strokeDasharray="32 10" />
                  <circle cx="14" cy="14" r="3" fill="#93C5FD" />
                  <path d="M19 19L24 24" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-headline-sm text-primary font-bold tracking-tight">CredLens</span>
                <span className="text-mono-caption text-on-surface-variant uppercase tracking-wider">{roleLabel[role]}</span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-md transition-all ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="px-3 py-3 border-t border-outline-variant">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px] text-on-primary-container">
                  {roleIcons[role]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-body-sm text-on-surface font-medium truncate">{userName}</div>
                <div className="text-mono-caption text-on-surface-variant">{roleLabel[role]}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 xl:ml-[260px] flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="sticky top-0 z-30 bg-white border-b border-outline-variant">
            <div className="px-margin py-space-sm flex items-center justify-between gap-space-md">
              {/* Mobile Logo + Hamburger */}
              <div className="xl:hidden flex items-center gap-3">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                    <svg viewBox="0 0 28 28" className="w-4 h-4" fill="none">
                      <circle cx="14" cy="14" r="7" stroke="#60A5FA" strokeWidth="2.5" strokeDasharray="32 10" />
                      <circle cx="14" cy="14" r="3" fill="#93C5FD" />
                    </svg>
                  </div>
                  <span className="text-headline-sm text-primary font-bold">CredLens</span>
                </Link>
              </div>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 font-mono-caption text-mono-caption text-on-surface-variant">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.path} className="flex items-center gap-2">
                    {i > 0 && <span className="material-symbols-outlined text-[14px]">chevron_right</span>}
                    <Link
                      to={crumb.path}
                      className={`hover:text-primary transition-colors ${
                        i === breadcrumbs.length - 1 ? 'text-primary font-medium' : ''
                      }`}
                    >
                      {crumb.label}
                    </Link>
                  </span>
                ))}
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-space-md">
                <ThemeToggle />
                <div className="hidden sm:block text-right">
                  <div className="text-body-sm text-on-surface font-medium">{userName}</div>
                  <div className="text-mono-caption text-on-surface-variant">{roleLabel[role]}</div>
                </div>
                <button
                  onClick={() => { auth.clear(); navigate('/login') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors text-body-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 px-margin py-space-lg max-w-[1640px] w-full mx-auto">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-outline-variant bg-surface-container-low py-space-md">
            <div className="px-margin flex flex-col md:flex-row items-center justify-between gap-space-sm text-on-surface-variant">
              <div className="flex items-center gap-space-sm">
                <span className="text-headline-sm text-primary">CredLens</span>
                <span className="text-body-sm">© 2025 CredLens Enterprise Financial Technologies. All rights reserved.</span>
              </div>
              <div className="flex items-center gap-space-lg font-mono-label text-mono-label">
                <span>SOC-2 Type II Certified</span>
                <span>RBI Master Direction Compliant</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
