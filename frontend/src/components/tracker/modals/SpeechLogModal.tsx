import { Modal } from '../../shared/Modal'
import { useSpeechEntries } from '../../../hooks/useSpeechEntries'
import { useAppStore } from '../../../store/appStore'
import { Badge } from '../../shared/Badge'
import { RefreshCw, Trash2 } from 'lucide-react'

interface SpeechLogModalProps {
  open: boolean
  onClose: () => void
}

export function SpeechLogModal({ open, onClose }: SpeechLogModalProps) {
  const { speechEntries } = useAppStore()
  const { deleteSpeechEntry, retranscribe } = useSpeechEntries()

  const handleDelete = async (id: number) => {
    await deleteSpeechEntry(id)
  }

  const handleRetranscribe = async (id: number) => {
    await retranscribe(id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Speech Log">
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {speechEntries.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No speech entries yet</p>
        ) : (
          speechEntries.map((entry) => (
            <div
              key={entry.id}
              className="border border-border rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark">
                    {entry.transcription || 'Pending transcription...'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {entry.category && (
                      <Badge variant="accent">{entry.category}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleRetranscribe(entry.id)}
                    className="p-1.5 rounded hover:bg-bg transition-colors cursor-pointer"
                    title="Retranscribe"
                  >
                    <RefreshCw size={14} className="text-muted" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-1.5 rounded hover:bg-primary-50 transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-primary-500" />
                  </button>
                </div>
              </div>
              {entry.audio_url && (
                <audio
                  src={entry.audio_url}
                  controls
                  className="mt-2 w-full h-8"
                  preload="none"
                />
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
