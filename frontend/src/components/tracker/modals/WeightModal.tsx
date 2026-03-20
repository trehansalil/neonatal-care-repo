import { useState } from 'react'
import { EntryModal } from './EntryModal'
import { useEntries } from '../../../hooks/useEntries'

interface WeightModalProps {
  open: boolean
  onClose: () => void
}

export function WeightModal({ open, onClose }: WeightModalProps) {
  const { createEntry } = useEntries()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    setSubmitting(true)
    try {
      await createEntry({
        weight: Math.round(Number(data.get('weight')) * 1000) || 3000,
        notes: (data.get('notes') as string) || null,
        timestamp: (data.get('timestamp') as string) || undefined,
      } as never)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EntryModal open={open} onClose={onClose} title="Log Weight" onSubmit={handleSubmit} submitting={submitting}>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
          Weight (kg)
        </label>
        <input
          type="number"
          name="weight"
          min={1}
          max={15}
          step={0.01}
          defaultValue={3.5}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        />
      </div>
    </EntryModal>
  )
}
