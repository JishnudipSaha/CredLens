import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, api_me, type UserRole } from './api/client'

export interface CurrentUser {
  id: number
  email: string
  name: string
  role: UserRole
  org_name: string | null
  msme_id: number | null
}

interface AuthCtx {
  user: CurrentUser | null
  loading: boolean
  setUser: (u: CurrentUser | null) => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!auth.getToken()) { setUser(null); setLoading(false); return }
    try {
      const me = await api_me()
      setUser(me)
    } catch {
      setUser(null)
      auth.clear()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return <Ctx.Provider value={{ user, loading, setUser, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used within AuthProvider')
  return v
}
