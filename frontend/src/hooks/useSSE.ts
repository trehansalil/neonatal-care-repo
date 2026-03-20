import { useEffect, useRef, useCallback } from 'react'

interface SSECallbacks {
  onTranscriptionComplete?: (data: { speech_entry_id: number; success: boolean; error?: string }) => void
  onCategorizationUpdate?: (data: { speech_entry_id: number; category: string }) => void
  onMappingComplete?: (data: {
    speech_entry_id: number
    entry_id: number
    category: string
    success: boolean
    error?: string
  }) => void
}

export function useSSE(callbacks: SSECallbacks) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource('/api/events/transcription')
    eventSourceRef.current = es

    es.onopen = () => {
      retryCountRef.current = 0
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'connected') return

        if (data.type === 'transcription_complete') {
          callbacksRef.current.onTranscriptionComplete?.(data)
        } else if (data.type === 'categorization_update') {
          callbacksRef.current.onCategorizationUpdate?.(data)
        } else if (data.type === 'mapping_complete') {
          callbacksRef.current.onMappingComplete?.(data)
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
      retryCountRef.current++
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
      setTimeout(connect, delay)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])
}
