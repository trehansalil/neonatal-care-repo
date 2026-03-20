import { useState, useCallback } from 'react'
import { api, type Stats } from '../api/client'

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async (date?: string) => {
    setLoading(true)
    try {
      const params = date ? `?date=${date}` : ''
      const data = await api.get<Stats>(`/stats${params}`)
      setStats(data)
      return data
    } finally {
      setLoading(false)
    }
  }, [])

  return { stats, loading, fetchStats }
}
