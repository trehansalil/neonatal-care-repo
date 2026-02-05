/**
 * Application Configuration
 * Single source of truth for all constants
 */

export const API_BASE_URL = '/api';

export const API_ENDPOINTS = {
  entries: `${API_BASE_URL}/entries`,
  speechEntries: `${API_BASE_URL}/speech_entries`,
  speechUpload: `${API_BASE_URL}/speech/upload`,
  speechTranscribe: `${API_BASE_URL}/speech/transcribe`,
  speechRetranscribe: (id) => `${API_BASE_URL}/speech_entries/${id}/retranscribe`,
  sseEvents: `${API_BASE_URL}/events/transcription`,
  stats: `${API_BASE_URL}/stats`,
  notifications: `${API_BASE_URL}/notifications/send`,
  diaperStatus: `${API_BASE_URL}/notifications/diaper-status`,
  webhookConfig: `${API_BASE_URL}/notifications/webhook-config`,
};

export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 50,
  infiniteScrollThreshold: 200 // px from bottom
};

export const STORAGE_KEYS = {
  metric: 'tracker.metric',
  range: 'tracker.range',
  view: 'tracker.view',
  cumulative: 'tracker.cumulative',
  filters: 'tracker.filters',
  lastNotifiedTimestamp: 'tracker.lastNotifiedTimestamp'
};

export const UI = {
  diaperAlertHours: 4,
  timerUpdateInterval: 30000, // 30 seconds
  longPressDuration: 800, // ms
  toastDuration: 2000, // ms
};

export const METRICS = {
  'weight-avg': {
    title: 'Weight Trend',
    unit: 'g',
    color: { border: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.14)' }
  },
  'temp-avg': {
    title: 'Temperature Trend',
    unit: '°C',
    color: { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.12)' }
  },
  'feed-total': {
    title: 'Total Feed Volume',
    unit: 'ml',
    color: { border: 'rgb(245, 158, 11)', bg: 'rgba(245, 158, 11, 0.12)' }
  },
  'susu-count': {
    title: 'Wet Diapers',
    unit: '',
    color: { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.12)' }
  },
  'poti-count': {
    title: 'Soiled Diapers',
    unit: '',
    color: { border: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.12)' }
  },
  'diaper-count': {
    title: 'Diapers',
    unit: '',
    color: { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.14)' }
  }
};
