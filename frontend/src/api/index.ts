import api from './client'
import type { Baby, LogEntry, GrowthRecord, DayStats, RoutineResponse } from './types'

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string, full_name: string) =>
    api.post<{ access_token: string }>('/auth/register', { email, password, full_name }),
  login: (email: string, password: string) =>
    api.post<{ access_token: string }>('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  updateMe: (data: Record<string, unknown>) => api.patch('/auth/me', data),
}

// ── Babies ────────────────────────────────────────────────────────────────────

export const babiesApi = {
  list: () => api.get<Baby[]>('/babies/'),
  create: (data: Partial<Baby>) => api.post<Baby>('/babies/', data),
  update: (id: number, data: Partial<Baby>) => api.patch<Baby>(`/babies/${id}`, data),
  delete: (id: number) => api.delete(`/babies/${id}`),
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export const logsApi = {
  list: (babyId: number, limit = 50) =>
    api.get<LogEntry[]>(`/babies/${babyId}/logs/`, { params: { limit } }),
  create: (babyId: number, data: Partial<LogEntry>) =>
    api.post<LogEntry>(`/babies/${babyId}/logs/`, data),
  delete: (babyId: number, logId: number) =>
    api.delete(`/babies/${babyId}/logs/${logId}`),
  todayStats: (babyId: number) =>
    api.get<DayStats>(`/babies/${babyId}/logs/stats/today`),
  weekStats: (babyId: number) =>
    api.get<DayStats[]>(`/babies/${babyId}/logs/stats/week`),
}

// ── Growth ────────────────────────────────────────────────────────────────────

export const growthApi = {
  list: (babyId: number) => api.get<GrowthRecord[]>(`/babies/${babyId}/growth/`),
  create: (babyId: number, data: Partial<GrowthRecord>) =>
    api.post<GrowthRecord>(`/babies/${babyId}/growth/`, data),
  delete: (babyId: number, recordId: number) =>
    api.delete(`/babies/${babyId}/growth/${recordId}`),
}

// ── Routine ───────────────────────────────────────────────────────────────────

export const routineApi = {
  calculate: (weight_kg: number, care_plan: string, feeding_method: string) =>
    api.post<RoutineResponse>('/routine/calculate', { weight_kg, care_plan, feeding_method }),
}

// ── Telegram ──────────────────────────────────────────────────────────────────

export const telegramApi = {
  setup: (chat_id: string) => api.post('/telegram/setup', { chat_id }),
  test: () => api.post('/telegram/test', {}),
}
