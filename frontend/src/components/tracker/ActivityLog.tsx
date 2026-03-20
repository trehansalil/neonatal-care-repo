import { useEffect, useMemo } from 'react'
import { FileText } from 'lucide-react'
import { useEntries } from '../../hooks/useEntries'
import { useSpeechEntries } from '../../hooks/useSpeechEntries'
import { useAppStore } from '../../store/appStore'
import { EntryCard } from './EntryCard'
import { FilterBar } from './FilterBar'
import { EmptyState } from '../shared/EmptyState'
import type { Entry, SpeechEntry } from '../../api/client'

function getTimeRange(range: string): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString()
  let start: Date

  switch (range) {
    case '6h':
      start = new Date(now.getTime() - 6 * 3600000)
      break
    case '12h':
      start = new Date(now.getTime() - 12 * 3600000)
      break
    case '24h':
      start = new Date(now.getTime() - 24 * 3600000)
      break
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      y.setHours(0, 0, 0, 0)
      start = y
      break
    }
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 3600000)
      break
    default: // 'today'
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
  }

  return { start: start.toISOString(), end }
}

function getEntryType(entry: Entry | SpeechEntry): string {
  if ('type' in entry && entry.type === 'speech') return 'speech'
  const e = entry as Entry
  if (e.feed_amount) return 'feed'
  if (e.susu_count > 0) return 'susu'
  if (e.poti_count > 0) return 'poti'
  if (e.temperature) return 'temperature'
  if (e.weight) return 'weight'
  return 'general'
}

function groupByDate(items: (Entry | SpeechEntry)[]): Map<string, (Entry | SpeechEntry)[]> {
  const groups = new Map<string, (Entry | SpeechEntry)[]>()
  for (const item of items) {
    const date = new Date(item.timestamp).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    const list = groups.get(date) ?? []
    list.push(item)
    groups.set(date, list)
  }
  return groups
}

export function ActivityLog() {
  const { entries, speechEntries, activeFilters, timeRange } = useAppStore()
  const { fetchEntries, deleteEntry } = useEntries()
  const { fetchSpeechEntries, deleteSpeechEntry } = useSpeechEntries()

  useEffect(() => {
    const { start, end } = getTimeRange(timeRange)
    fetchEntries(start, end)
    fetchSpeechEntries(start, end)
  }, [timeRange, fetchEntries, fetchSpeechEntries])

  const allItems = useMemo(() => {
    const combined: (Entry | SpeechEntry)[] = [
      ...entries,
      ...speechEntries,
    ]
    // Sort by timestamp desc
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply type filters
    if (activeFilters.length > 0) {
      return combined.filter((item) => activeFilters.includes(getEntryType(item) as never))
    }
    return combined
  }, [entries, speechEntries, activeFilters])

  const grouped = useMemo(() => groupByDate(allItems), [allItems])

  const handleDelete = async (id: number) => {
    const isSpeech = speechEntries.some((s) => s.id === id)
    if (isSpeech) {
      await deleteSpeechEntry(id)
      const { start, end } = getTimeRange(timeRange)
      fetchSpeechEntries(start, end)
    } else {
      await deleteEntry(id)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-widest text-dark mb-4">Activity Log</h2>

      <FilterBar />

      <div className="mt-4">
        {allItems.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            title="No entries yet"
            description="Record a voice entry or add one manually to get started"
          />
        ) : (
          Array.from(grouped.entries()).map(([date, items]) => (
            <div key={date} className="mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">{date}</h3>
              <div className="border-l-2 border-primary-100 ml-4 pl-4">
                {items.map((item) => (
                  <EntryCard key={`${item.id}-${'type' in item ? 'speech' : 'entry'}`} entry={item} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
