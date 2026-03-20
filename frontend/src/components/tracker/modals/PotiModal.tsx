import { useState } from 'react'
import { EntryModal } from './EntryModal'
import { useEntries } from '../../../hooks/useEntries'

const potiColors = [
  { value: 'mustard', label: 'Mustard (Normal)' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'brown', label: 'Brown' },
  { value: 'black', label: 'Black (Meconium)' },
  { value: 'red', label: 'Red (Alert)' },
  { value: 'white', label: 'White/Clay (Alert)' },
]

interface PotiModalProps {
  open: boolean
  onClose: () => void
}

export function PotiModal({ open, onClose }: PotiModalProps) {
  const { createEntry } = useEntries()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    setSubmitting(true)
    try {
      await createEntry({
        poti_count: Number(data.get('poti_count')) || 1,
        poti_color: data.get('poti_color') as string,
        notes: (data.get('notes') as string) || null,
        timestamp: (data.get('timestamp') as string) || undefined,
      } as never)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EntryModal open={open} onClose={onClose} title="Log Stool" onSubmit={handleSubmit} submitting={submitting}>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
          Count
        </label>
        <input
          type="number"
          name="poti_count"
          min={1}
          max={10}
          defaultValue={1}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
          Color
        </label>
        <select
          name="poti_color"
          defaultValue="mustard"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          {potiColors.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </EntryModal>
  )
}
