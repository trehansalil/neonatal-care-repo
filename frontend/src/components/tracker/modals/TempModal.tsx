import { useState } from 'react'
import { EntryModal } from './EntryModal'
import { useEntries } from '../../../hooks/useEntries'

interface TempModalProps {
  open: boolean
  onClose: () => void
}

export function TempModal({ open, onClose }: TempModalProps) {
  const { createEntry } = useEntries()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    const form = e.target as HTMLFormElement
    const data = new FormData(form)
    setSubmitting(true)
    try {
      await createEntry({
        temperature: Number(data.get('temperature')) || 37.0,
        notes: (data.get('notes') as string) || null,
        timestamp: (data.get('timestamp') as string) || undefined,
      } as never)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EntryModal open={open} onClose={onClose} title="Log Temperature" onSubmit={handleSubmit} submitting={submitting}>
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
          Temperature (°C)
        </label>
        <input
          type="number"
          name="temperature"
          min={35}
          max={42}
          step={0.1}
          defaultValue={37.0}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        />
      </div>
    </EntryModal>
  )
}
