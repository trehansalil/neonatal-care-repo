import { Mic, Square, Loader2 } from 'lucide-react'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useSpeechEntries } from '../../hooks/useSpeechEntries'
import { useSSE } from '../../hooks/useSSE'
import { WaveformVisualizer } from './WaveformVisualizer'
import { Badge } from '../shared/Badge'
import { useCallback, useState } from 'react'

export function SpeechHero() {
  const { state, duration, waveformData, startRecording, stopRecording, reset, audioBlob } =
    useAudioRecorder()
  const { uploadAudio, createSpeechEntry } = useSpeechEntries()
  const [transcription, setTranscription] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')

  const handleStop = useCallback(async () => {
    stopRecording()
  }, [stopRecording])

  // Process audio after blob is ready
  const processAudio = useCallback(async () => {
    if (!audioBlob) return
    try {
      setStatus('Uploading...')
      const uploadResult = await uploadAudio(audioBlob, duration * 1000)
      setStatus('Transcribing...')
      await createSpeechEntry({
        object_key: uploadResult.object_key,
        audio_url: uploadResult.url,
        duration_ms: uploadResult.duration_ms,
      })
      setStatus('Processing...')
    } catch {
      setStatus('Error uploading')
    }
  }, [audioBlob, duration, uploadAudio, createSpeechEntry])

  // Auto-process when audioBlob becomes available
  if (audioBlob && state === 'uploading') {
    processAudio()
  }

  useSSE({
    onTranscriptionComplete: (data) => {
      if (data.success) {
        setStatus('Categorizing...')
        setTranscription(data.success ? 'Transcription complete' : 'Transcription failed')
      }
    },
    onMappingComplete: (data) => {
      if (data.success) {
        setCategory(data.category)
        setStatus('')
        setTimeout(() => {
          reset()
          setTranscription(null)
          setCategory(null)
        }, 3000)
      }
    },
  })

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const isIdle = state === 'idle' || state === 'done'
  const isRecording = state === 'recording'
  const isProcessing = state === 'uploading' || state === 'transcribing'

  return (
    <div
      className={`rounded-xl p-6 transition-all ${
        isRecording
          ? 'bg-primary-500'
          : 'bg-primary-500'
      }`}
    >
      {/* Title */}
      <div className="text-center mb-4">
        <h2 className="text-white text-sm font-bold uppercase tracking-widest mb-1">
          Voice Entry
        </h2>
        {isRecording && (
          <p className="text-white/70 text-sm">{formatDuration(duration)}</p>
        )}
      </div>

      {/* Waveform */}
      {isRecording && (
        <div className="mb-4">
          <WaveformVisualizer data={waveformData} active />
        </div>
      )}

      {/* Record / Stop button */}
      <div className="flex justify-center mb-4">
        {isIdle && (
          <button
            onClick={startRecording}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          >
            <Mic size={28} className="text-primary-500" />
          </button>
        )}
        {isRecording && (
          <button
            onClick={handleStop}
            className="w-16 h-16 rounded-full bg-white/20 border-2 border-white flex items-center justify-center animate-pulse-record cursor-pointer"
          >
            <Square size={24} className="text-white" fill="white" />
          </button>
        )}
        {isProcessing && (
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <Loader2 size={28} className="text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Status text */}
      <div className="text-center">
        {isIdle && !category && (
          <p className="text-white/70 text-sm">Tap to record a voice entry</p>
        )}
        {status && <p className="text-white/80 text-sm">{status}</p>}
        {transcription && (
          <p className="text-white text-sm mt-1">"{transcription}"</p>
        )}
        {category && (
          <div className="mt-2">
            <Badge variant="accent">{category}</Badge>
          </div>
        )}
      </div>
    </div>
  )
}
