import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { babiesApi } from '../api'
import type { Baby } from '../api/types'
import { useAuth } from './AuthContext'

interface BabyCtx {
  babies: Baby[]
  activeBaby: Baby | null
  setActiveBabyId: (id: number) => void
  reload: () => Promise<void>
}

const Ctx = createContext<BabyCtx | null>(null)

export function BabyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [babies, setBabies] = useState<Baby[]>([])
  const [activeBabyId, setActiveBabyId] = useState<number | null>(null)

  const reload = async () => {
    if (!user) return
    try {
      const r = await babiesApi.list()
      setBabies(r.data)
      if (r.data.length > 0 && !activeBabyId) {
        setActiveBabyId(r.data[0].id)
      }
    } catch {
      setBabies([])
    }
  }

  useEffect(() => { if (user) reload() }, [user])

  const activeBaby = babies.find((b) => b.id === activeBabyId) ?? babies[0] ?? null

  return (
    <Ctx.Provider value={{ babies, activeBaby, setActiveBabyId, reload }}>
      {children}
    </Ctx.Provider>
  )
}

export const useBaby = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBaby must be inside BabyProvider')
  return ctx
}
