import { useState, useEffect, useCallback } from 'react'
import { api, type DiaperStatus } from '../api/client'

export function useDiaperAlert(pollIntervalMs = 60000) {
  const [status, setStatus] = useState<DiaperStatus | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<DiaperStatus>('/notifications/diaper-status')
      setStatus(data)
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, pollIntervalMs)
    return () => clearInterval(id)
  }, [fetchStatus, pollIntervalMs])

  return {
    status: status?.status ?? 'no_data',
    hoursSinceLastChange: status?.hours_since_last_change ?? 0,
    isOverdue: status?.status === 'overdue',
    lastChangeDescription: status?.last_change_description ?? null,
    lastChangeFormatted: status?.last_change_formatted ?? null,
    thresholdHours: status?.threshold_hours ?? 4,
    refresh: fetchStatus,
  }
}
