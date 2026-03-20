const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `Upload failed: ${res.status}`)
    }
    return res.json()
  },
}

// Types
export interface Entry {
  id: number
  temperature: number | null
  feed_amount: number | null
  feed_type: string | null
  susu_count: number
  poti_count: number
  poti_color: string | null
  weight: number | null
  notes: string | null
  timestamp: string
  created_at: string
}

export interface SpeechEntry {
  id: number
  object_key: string
  audio_url: string | null
  transcription: string | null
  category: string | null
  mode: string | null
  duration_ms: number | null
  notes: string | null
  timestamp: string
  created_at: string
  type: 'speech'
}

export interface Stats {
  feed_count: number
  total_feed_volume: number
  avg_feed_amount: number
  total_susu: number
  total_poti: number
  avg_temperature: number
  max_temperature: number
  min_temperature: number
  latest_weight: number
}

export interface DiaperStatus {
  status: 'overdue' | 'ok' | 'no_data'
  hours_since_last_change: number
  last_change_timestamp: string | null
  last_change_formatted: string | null
  last_change_description: string | null
  entry_id: number | null
  susu_count: number
  poti_count: number
  threshold_hours: number
  webhook_configured: boolean
}

export interface UploadResult {
  object_key: string
  url: string
  content_type: string
  size_bytes: number
  duration_ms: number
}
