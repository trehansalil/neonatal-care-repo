import { Trash2, Edit3 } from 'lucide-react'
import type { Entry, SpeechEntry } from '../../api/client'
import { Badge } from '../shared/Badge'
import { useState, useRef } from 'react'

interface EntryCardProps {
  entry: Entry | SpeechEntry
  onDelete?: (id: number) => void
  onEdit?: (id: number) => void
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

function getEntryIcon(type: string): string {
  const icons: Record<string, string> = {
    feed: '🍼',
    susu: '💧',
    poti: '💩',
    temperature: '🌡️',
    weight: '⚖️',
    speech: '🎙️',
    general: '📋',
  }
  return icons[type] || '📋'
}

function getEntryDescription(entry: Entry | SpeechEntry): string {
  if ('type' in entry && entry.type === 'speech') {
    return (entry as SpeechEntry).transcription || 'Voice entry'
  }
  const e = entry as Entry
  const parts: string[] = []
  if (e.feed_amount) parts.push(`${e.feed_amount}ml ${e.feed_type || ''}`.trim())
  if (e.susu_count > 0) parts.push(`${e.susu_count} wet diaper${e.susu_count > 1 ? 's' : ''}`)
  if (e.poti_count > 0) parts.push(`${e.poti_count} ${e.poti_color || ''} stool`.trim())
  if (e.temperature) parts.push(`${e.temperature}°C`)
  if (e.weight) parts.push(`${(e.weight / 1000).toFixed(2)}kg`)
  if (e.notes && parts.length === 0) parts.push(e.notes)
  return parts.join(' · ') || 'Entry'
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function EntryCard({ entry, onDelete, onEdit }: EntryCardProps) {
  const type = getEntryType(entry)
  const [swipeX, setSwipeX] = useState(0)
  const startXRef = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = startXRef.current - e.touches[0].clientX
    if (dx > 0) setSwipeX(Math.min(dx, 120))
  }

  const handleTouchEnd = () => {
    if (swipeX > 80) {
      setSwipeX(120)
    } else {
      setSwipeX(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg mb-2">
      {/* Swipe actions */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button
          onClick={() => onEdit?.(entry.id)}
          className="w-15 flex items-center justify-center bg-accent-300 text-dark cursor-pointer"
        >
          <Edit3 size={18} />
        </button>
        <button
          onClick={() => onDelete?.(entry.id)}
          className="w-15 flex items-center justify-center bg-primary-500 text-white cursor-pointer"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Card content */}
      <div
        className="relative bg-surface border border-border p-3 flex items-center gap-3 transition-transform"
        style={{ transform: `translateX(-${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Timeline dot */}
        <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-lg flex-shrink-0">
          {getEntryIcon(type)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-muted">{formatTime(entry.timestamp)}</span>
            <Badge variant={type === 'speech' ? 'accent' : 'primary'}>
              {type}
            </Badge>
          </div>
          <p className="text-sm text-dark truncate">{getEntryDescription(entry)}</p>
        </div>
      </div>
    </div>
  )
}
