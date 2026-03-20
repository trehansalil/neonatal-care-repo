import { useCallback } from 'react'
import { api, type Entry } from '../api/client'
import { useAppStore } from '../store/appStore'

export function useEntries() {
  const { setEntries, addEntry, removeEntry, updateEntry: updateInStore } = useAppStore()

  const fetchEntries = useCallback(
    async (start?: string, end?: string) => {
      const params = new URLSearchParams()
      if (start) params.set('start', start)
      if (end) params.set('end', end)
      const query = params.toString() ? `?${params}` : ''
      const data = await api.get<Entry[]>(`/entries${query}`)
      setEntries(data)
      return data
    },
    [setEntries]
  )

  const createEntry = useCallback(
    async (entry: Partial<Entry>) => {
      const result = await api.post<{ id: number; message: string }>('/entries', entry)
      const newEntry = { ...entry, id: result.id } as Entry
      addEntry(newEntry)
      return result
    },
    [addEntry]
  )

  const deleteEntry = useCallback(
    async (id: number) => {
      await api.del(`/entries/${id}`)
      removeEntry(id)
    },
    [removeEntry]
  )

  const editEntry = useCallback(
    async (id: number, updates: Partial<Entry>) => {
      await api.put(`/entries/${id}`, updates)
      updateInStore(id, updates)
    },
    [updateInStore]
  )

  return { fetchEntries, createEntry, deleteEntry, editEntry }
}
