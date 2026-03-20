import { useState } from 'react'
import { EntryModal } from './EntryModal'
import { useEntries } from '../../../hooks/useEntries'

const feedTypes = [
  { value: 'bottle_expressed', label: 'Bottle (Expressed)' },
  { value: 'bottle_formula', label: 'Bottle (Formula)' },
  { value: 'direct_breastfeed', label: 'Direct Breastfeed' },
]

interface FeedModalProps {
  open: boolean
  onClose: () => void
}

export function FeedModal({ open, onClose }: FeedModalProps) {
  const { createEntry } = useEntries()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    setSubmitting(true)
    try {
      await createEntry({
        feed_amount: Number(data.get('feed_amount')) || 0,
        feed_type: data.get('feed_type') as string,
        notes: (data.get('notes') as string) || null,
        timestamp: (data.get('timestamp') as string) || undefined,
      } as never)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EntryModal open={open} onClose={onClose} title="Log Feed" onSubmit={handleSubmit} submitting={submitting}>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
          Amount (ml)
        </label>
        <input
          type="number"
          name="feed_amount"
          min={0}
          max={500}
          step={5}
          defaultValue={60}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
          Feed Type
        </label>
        <select
          name="feed_type"
          defaultValue="bottle_expressed"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          {feedTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </EntryModal>
  )
}
