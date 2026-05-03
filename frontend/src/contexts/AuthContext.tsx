import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '../api'
import type { User } from '../api/types'

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const r = await authApi.me()
      setUser(r.data)
    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('nc_token')
    if (token) refreshUser().finally(() => setLoading(false))
    else setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const r = await authApi.login(email, password)
    localStorage.setItem('nc_token', r.data.access_token)
    await refreshUser()
  }

  const register = async (email: string, password: string, name: string) => {
    const r = await authApi.register(email, password, name)
    localStorage.setItem('nc_token', r.data.access_token)
    await refreshUser()
  }

  const logout = () => {
    localStorage.removeItem('nc_token')
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
