import { useCallback } from 'react'
import { api, type SpeechEntry, type UploadResult } from '../api/client'
import { useAppStore } from '../store/appStore'

export function useSpeechEntries() {
  const { setSpeechEntries } = useAppStore()

  const fetchSpeechEntries = useCallback(
    async (start?: string, end?: string) => {
      const params = new URLSearchParams()
      if (start) params.set('start', start)
      if (end) params.set('end', end)
      const query = params.toString() ? `?${params}` : ''
      const data = await api.get<SpeechEntry[]>(`/speech_entries${query}`)
      setSpeechEntries(data)
      return data
    },
    [setSpeechEntries]
  )

  const uploadAudio = useCallback(async (blob: Blob, durationMs?: number) => {
    const formData = new FormData()
    formData.append('file', blob, `recording_${Date.now()}.webm`)
    if (durationMs) formData.append('duration_ms', String(durationMs))
    return api.upload<UploadResult>('/speech/upload', formData)
  }, [])

  const createSpeechEntry = useCallback(
    async (data: {
      object_key: string
      audio_url: string
      duration_ms?: number
      transcription?: string
      category?: string
    }) => {
      const result = await api.post<SpeechEntry>('/speech_entries', data)
      return result
    },
    []
  )

  const deleteSpeechEntry = useCallback(async (id: number) => {
    await api.del(`/speech_entries/${id}`)
  }, [])

  const retranscribe = useCallback(async (id: number) => {
    return api.post<{ id: number; transcription: string; status: string }>(
      `/speech_entries/${id}/retranscribe`
    )
  }, [])

  return { fetchSpeechEntries, uploadAudio, createSpeechEntry, deleteSpeechEntry, retranscribe }
}
