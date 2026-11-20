import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Building2, LayoutDashboard, Gavel, Gauge, Upload, History,
  BarChart3, Cpu, ScrollText, Sun, Moon, Landmark, Store, X, ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { api_list_msmes, api_login, auth, type MSMEListItem, type UserRole } from '../api/client'
import { useAuth } from '../context'
import { useTheme } from '../theme'
import { formatINR, gradeColor } from '../utils/format'
import { cn } from '../utils/cn'

interface CommandItem {
  id: string
  category: 'MSMEs' | 'Navigation' | 'Actions'
  title: string
  subtitle?: string
  icon: typeof Search
  badge?: string
  badgeClass?: string
  onSelect: () => void
}

const DEMO_USERS: Record<UserRole, { email: string; pass: string; path: string; label: string }> = {
  LENDER: { email: 'lender@credlens.in', pass: 'lender123', path: '/lender', label: 'Lender' },
  MSME: { email: 'msme@credlens.in', pass: 'msme123', path: '/msme', label: 'MSME Borrower' },
  GOVERNMENT: { email: 'govt@credlens.in', pass: 'govt123', path: '/government', label: 'Government' },
  ADMIN: { email: 'admin@credlens.in', pass: 'admin123', path: '/admin', label: 'Platform Admin' },
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { refresh, user } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [msmes, setMsmes] = useState<MSMEListItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Fetch MSMEs once when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      api_list_msmes({ limit: 50 }).then(setMsmes).catch(() => {})
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const switchRole = async (targetRole: UserRole) => {
    onClose()
    const target = DEMO_USERS[targetRole]
    try {
      const res = await api_login(target.email, target.pass)
      auth.setToken(res.access_token)
      await refresh()
      navigate(target.path)
    } catch (e) {
      console.error(e)
    }
  }

  // Build items based on query
  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = []
    const q = query.toLowerCase().trim()

    // 1. Navigation items
    const navItems = [
      { title: 'Lender Portfolio Dashboard', path: '/lender', icon: LayoutDashboard, role: 'LENDER' },
      { title: 'MSME Search & Underwriting', path: '/lender/search', icon: Search, role: 'LENDER' },
      { title: 'Decision Queue', path: '/lender/decisions', icon: Gavel, role: 'LENDER' },
      { title: 'Borrower Credit Health', path: '/msme', icon: Gauge, role: 'MSME' },
      { title: 'Document & Data Ingestion', path: '/msme/upload', icon: Upload, role: 'MSME' },
      { title: 'Score Trend History', path: '/msme/history', icon: History, role: 'MSME' },
      { title: 'Government Portfolio Insights', path: '/government', icon: BarChart3, role: 'GOVERNMENT' },
      { title: 'AI Risk Model Monitor', path: '/admin', icon: Cpu, role: 'ADMIN' },
      { title: 'System Audit Trail & Logs', path: '/admin/audit', icon: ScrollText, role: 'ADMIN' },
    ]

    for (const n of navItems) {
      if (!q || n.title.toLowerCase().includes(q)) {
        list.push({
          id: `nav-${n.path}`,
          category: 'Navigation',
          title: n.title,
          subtitle: `Go to ${n.path}`,
          icon: n.icon,
          onSelect: () => {
            onClose()
            navigate(n.path)
          },
        })
      }
    }

    // 2. Actions
    const actionItems: CommandItem[] = [
      {
        id: 'action-theme',
        category: 'Actions',
        title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`,
        subtitle: `Currently in ${theme} mode`,
        icon: theme === 'dark' ? Sun : Moon,
        onSelect: () => {
          toggleTheme()
          onClose()
        },
      },
      ...((['LENDER', 'MSME', 'GOVERNMENT', 'ADMIN'] as UserRole[])
        .filter((r) => r !== user?.role)
        .map((r) => ({
          id: `role-${r}`,
          category: 'Actions' as const,
          title: `Switch Account to ${DEMO_USERS[r].label}`,
          subtitle: `Login as ${DEMO_USERS[r].email}`,
          icon: r === 'LENDER' ? Landmark : r === 'MSME' ? Store : r === 'GOVERNMENT' ? BarChart3 : Cpu,
          onSelect: () => switchRole(r),
        }))),
    ]

    for (const a of actionItems) {
      if (!q || a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q)) {
        list.push(a)
      }
    }

    // 3. MSMEs
    const matchedMsmes = msmes.filter((m) => {
      if (!q) return true
      return (
        m.legal_name.toLowerCase().includes(q) ||
        m.sector.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q) ||
        m.state.toLowerCase().includes(q)
      )
    })

    for (const m of matchedMsmes.slice(0, 15)) {
      list.push({
        id: `msme-${m.id}`,
        category: 'MSMEs',
        title: m.legal_name,
        subtitle: `${m.sector.toUpperCase()} · ${m.city}, ${m.state} · ${formatINR(m.annual_turnover_inr)}`,
        icon: Building2,
        badge: m.latest_grade ? `Grade ${m.latest_grade}` : undefined,
        badgeClass: m.latest_grade ? gradeColor(m.latest_grade) : undefined,
        onSelect: () => {
          onClose()
          navigate(`/lender/report/${m.id}`)
        },
      })
    }

    return list
  }, [query, msmes, theme, user?.role])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % (items.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + items.length) % (items.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (items[selectedIndex]) {
          items[selectedIndex].onSelect()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, items, selectedIndex, onClose])

  // Auto-scroll highlighted item into view
  useEffect(() => {
    const el = document.getElementById(`cmd-item-${selectedIndex}`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl animate-fade-in">
        {/* Search header */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Type a command, search MSMEs, or jump to page..."
            className="w-full bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground outline-hidden focus:ring-0"
          />
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-2 divide-y divide-border/40">
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No matching commands or MSMEs found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => {
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={item.id}
                    id={`cmd-item-${idx}`}
                    onClick={item.onSelect}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'flex items-center justify-between rounded-xl px-3 py-2.5 text-sm cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                          isSelected
                            ? 'border-primary/40 bg-primary/20 text-primary'
                            : 'border-border bg-muted/60 text-muted-foreground',
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        <span className={item.badgeClass}>{item.badge}</span>
                      )}
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 px-1.5 py-0.5 rounded border border-border/60">
                        {item.category}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Hotkey Footer */}
        <div className="flex flex-wrap items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>{' '}
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">↵</kbd> to select
            </span>
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">esc</kbd> to close
            </span>
          </div>
          <span className="hidden sm:inline font-mono text-[10px] text-primary">CredLens Engine v1.2</span>
        </div>
      </div>
    </div>
  )
}
