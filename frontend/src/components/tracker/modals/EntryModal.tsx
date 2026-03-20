import { Modal } from '../../shared/Modal'
import { Button } from '../../shared/Button'
import type { ReactNode, FormEvent } from 'react'

interface EntryModalProps {
  open: boolean
  onClose: () => void
  title: string
  onSubmit: (e: FormEvent) => void
  children: ReactNode
  submitting?: boolean
}

export function EntryModal({ open, onClose, title, onSubmit, children, submitting }: EntryModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(e)
        }}
        className="space-y-4"
      >
        {children}

        {/* Timestamp field */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
            Date & Time
          </label>
          <input
            type="datetime-local"
            name="timestamp"
            defaultValue={new Date().toISOString().slice(0, 16)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface resize-none"
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Entry'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
