import { create } from 'zustand'
import type { Entry, SpeechEntry } from '../api/client'

export type EntryType = 'feed' | 'susu' | 'poti' | 'temperature' | 'weight' | 'speech'
export type TimeRange = '6h' | '12h' | 'today' | 'yesterday' | '24h' | 'week'
export type Aggregation = 'hour' | 'day' | 'week' | 'month'

interface AppState {
  // Entries
  entries: Entry[]
  speechEntries: SpeechEntry[]
  setEntries: (entries: Entry[]) => void
  setSpeechEntries: (entries: SpeechEntry[]) => void
  addEntry: (entry: Entry) => void
  removeEntry: (id: number) => void
  updateEntry: (id: number, entry: Partial<Entry>) => void

  // Filters
  activeFilters: EntryType[]
  toggleFilter: (type: EntryType) => void
  setFilters: (filters: EntryType[]) => void
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void

  // Trends
  trendMetric: string
  compareMetric: string | null
  aggregation: Aggregation
  setTrendMetric: (metric: string) => void
  setCompareMetric: (metric: string | null) => void
  setAggregation: (agg: Aggregation) => void

  // UI
  activeModal: string | null
  openModal: (modal: string) => void
  closeModal: () => void
  mobileTab: 'log' | 'dashboard' | 'trends' | 'guide'
  setMobileTab: (tab: 'log' | 'dashboard' | 'trends' | 'guide') => void
}

export const useAppStore = create<AppState>((set) => ({
  entries: [],
  speechEntries: [],
  setEntries: (entries) => set({ entries }),
  setSpeechEntries: (entries) => set({ speechEntries: entries }),
  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
  removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
  updateEntry: (id, updates) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  activeFilters: [],
  toggleFilter: (type) =>
    set((s) => ({
      activeFilters: s.activeFilters.includes(type)
        ? s.activeFilters.filter((f) => f !== type)
        : [...s.activeFilters, type],
    })),
  setFilters: (filters) => set({ activeFilters: filters }),
  timeRange: 'today',
  setTimeRange: (range) => set({ timeRange: range }),

  trendMetric: 'feed_amount',
  compareMetric: null,
  aggregation: 'hour',
  setTrendMetric: (metric) => set({ trendMetric: metric }),
  setCompareMetric: (metric) => set({ compareMetric: metric }),
  setAggregation: (agg) => set({ aggregation: agg }),

  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  mobileTab: 'log',
  setMobileTab: (tab) => set({ mobileTab: tab }),
}))
