import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  BarChart3, ChevronRight, Cpu, Gavel, Gauge, History, Landmark, LayoutDashboard,
  LogOut, Menu, ScrollText, Search, Store, Upload, X, type LucideIcon,
} from 'lucide-react'
import { auth, UserRole } from '../api/client'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '../utils/cn'

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

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const navByRole: Record<UserRole, NavItem[]> = {
  LENDER: [
    { to: '/lender', label: 'Portfolio', icon: LayoutDashboard },
    { to: '/lender/search', label: 'MSME Search', icon: Search },
    { to: '/lender/decisions', label: 'Decision Queue', icon: Gavel },
  ],
  MSME: [
    { to: '/msme', label: 'Credit Health', icon: Gauge },
    { to: '/msme/upload', label: 'Data Upload', icon: Upload },
    { to: '/msme/history', label: 'Score History', icon: History },
  ],
  GOVERNMENT: [{ to: '/government', label: 'Portfolio Insights', icon: BarChart3 }],
  ADMIN: [
    { to: '/admin', label: 'Model Monitor', icon: Cpu },
    { to: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  ],
}

const roleIcons: Record<UserRole, LucideIcon> = {
  LENDER: Landmark,
  MSME: Store,
  GOVERNMENT: BarChart3,
  ADMIN: Cpu,
}

function getBreadcrumbs(pathname: string): { label: string; path: string }[] {
  const parts = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = []

  if (parts[0] === 'lender') {
    crumbs.push({ label: 'Lender', path: '/lender' })
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

function LensLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" strokeDasharray="28 12" />
      <circle cx="11" cy="11" r="2.5" fill="currentColor" />
      <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function Layout({ role, userName, children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const links = navByRole[role]
  const breadcrumbs = getBreadcrumbs(location.pathname)
  const RoleIcon = roleIcons[role]

  // Close the drawer on navigation
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // Lock scroll + ESC while drawer is open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const signOut = () => {
    auth.clear()
    navigate('/login')
  }

  const sidebarContent = (onNavigate?: () => void) => (
    <>
      <div className="border-b border-border px-4 py-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <LensLogo className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-bold leading-tight tracking-tight text-foreground">CredLens</span>
            <span className="truncate text-[10px] font-medium uppercase tracking-widest text-subtle-foreground">
              {roleLabel[role]}
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <l.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <RoleIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-foreground">{userName}</div>
            <div className="truncate text-[11px] text-subtle-foreground">{roleLabel[role]}</div>
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-1.5 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border bg-card lg:flex">
        {sidebarContent()}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 left-0 flex w-[272px] flex-col border-r border-border bg-card animate-slide-in"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3.5 z-10 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent(() => setOpen(false))}
          </div>
        </div>
      )}

      {/* Content column */}
      <div className="flex min-h-screen flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.path} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-subtle-foreground" aria-hidden />}
                    <Link
                      to={crumb.path}
                      className={cn(
                        'transition-colors hover:text-foreground',
                        i === breadcrumbs.length - 1 && 'font-medium text-foreground',
                      )}
                    >
                      {crumb.label}
                    </Link>
                  </span>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden text-right md:block">
                <div className="text-xs font-medium leading-tight text-foreground">{userName}</div>
                <div className="text-[11px] leading-tight text-subtle-foreground">{roleLabel[role]}</div>
              </div>
              <button
                onClick={signOut}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="animate-fade-up">{children}</div>
        </main>

        <footer className="border-t border-border bg-card">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">CredLens</span>
              <span>© 2026 CredLens Enterprise Financial Technologies. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-subtle-foreground">
              <span>SOC-2 Type II</span>
              <span>RBI Compliant</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
