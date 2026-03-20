import { useState } from 'react'
import { EntryModal } from './EntryModal'
import { useEntries } from '../../../hooks/useEntries'

interface SusuModalProps {
  open: boolean
  onClose: () => void
}

export function SusuModal({ open, onClose }: SusuModalProps) {
  const { createEntry } = useEntries()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    setSubmitting(true)
    try {
      await createEntry({
        susu_count: Number(data.get('susu_count')) || 1,
        notes: (data.get('notes') as string) || null,
        timestamp: (data.get('timestamp') as string) || undefined,
      } as never)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EntryModal open={open} onClose={onClose} title="Log Wet Diaper" onSubmit={handleSubmit} submitting={submitting}>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
          Count
        </label>
        <input
          type="number"
          name="susu_count"
          min={1}
          max={10}
          defaultValue={1}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        />
      </div>
    </EntryModal>
  )
}
