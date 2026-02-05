import { API_ENDPOINTS, PAGINATION } from '../config.js';

/**
 * API Client for Baby Tracker
 * Handles all HTTP requests with pagination support
 */

class APIClient {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Fetch entries with pagination (NEW: supports new backend API)
   */
  async fetchEntries({ page = 1, limit = PAGINATION.defaultPageSize, start, end, types } = {}) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    // Only add date params if they are valid
    const startDate = this._formatDate(start);
    if (startDate) params.set('start', startDate);

    const endDate = this._formatDate(end);
    if (endDate) params.set('end', endDate);

    if (types?.length) params.set('types', Array.isArray(types) ? types.join(',') : Array.from(types).join(','));

    const url = `${API_ENDPOINTS.entries}?${params}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();

      // Return both entries and pagination metadata
      return {
        entries: data.entries || [],
        pagination: data.pagination || {
          page: 1,
          limit: 20,
          total: data.entries?.length || 0,
          total_pages: 1,
          has_next: false,
          has_prev: false
        }
      };
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      throw error;
    }
  }

  /**
   * Fetch speech entries
   */
  async fetchSpeechEntries({ start, end } = {}) {
    const params = new URLSearchParams();

    // Only add date params if they are valid
    const startDate = this._formatDate(start);
    if (startDate) params.set('start', startDate);

    const endDate = this._formatDate(end);
    if (endDate) params.set('end', endDate);

    const url = `${API_ENDPOINTS.speechEntries}${params.toString() ? '?' + params : ''}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch speech entries:', error);
      throw error;
    }
  }

  /**
   * Create new entry
   */
  async createEntry(data) {
    const response = await fetch(API_ENDPOINTS.entries, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create entry: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update entry
   */
  async updateEntry(id, data) {
    const response = await fetch(`${API_ENDPOINTS.entries}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to update entry: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete entry
   */
  async deleteEntry(id) {
    const response = await fetch(`${API_ENDPOINTS.entries}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete entry: ${response.statusText}`);
    }

    return true;
  }

  /**
   * Upload speech audio
   */
  async uploadSpeechAudio(audioBlob, durationMs) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.webm');
    if (durationMs) formData.append('duration_ms', durationMs);

    const response = await fetch(API_ENDPOINTS.speechUpload, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create speech entry
   */
  async createSpeechEntry(data) {
    const response = await fetch(API_ENDPOINTS.speechEntries, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create speech entry: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update speech entry
   */
  async updateSpeechEntry(id, data) {
    const response = await fetch(`${API_ENDPOINTS.speechEntries}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to update speech entry: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete speech entry
   */
  async deleteSpeechEntry(id) {
    const response = await fetch(`${API_ENDPOINTS.speechEntries}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Failed to delete speech entry: ${response.statusText}`);
    }

    return true;
  }

  /**
   * Retranscribe a speech entry
   */
  async retranscribeSpeech(id) {
    const response = await fetch(API_ENDPOINTS.speechRetranscribe(id), {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to retranscribe: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get diaper status
   */
  async getDiaperStatus() {
    const response = await fetch(API_ENDPOINTS.diaperStatus);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  /**
   * Send notification
   */
  async sendNotification(message, metadata = {}) {
    const response = await fetch(API_ENDPOINTS.notifications, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, metadata })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  /**
   * Fetch webhook configuration
   */
  async fetchWebhookConfig() {
    const response = await fetch(API_ENDPOINTS.webhookConfig);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  /**
   * Subscribe to SSE for real-time updates
   */
  subscribeToTranscriptions(onUpdate) {
    const eventSource = new EventSource(API_ENDPOINTS.sseEvents);

    eventSource.addEventListener('transcription_complete', (event) => {
      const data = JSON.parse(event.data);
      onUpdate('transcription', data);
    });

    eventSource.addEventListener('mapping_complete', (event) => {
      const data = JSON.parse(event.data);
      onUpdate('mapping', data);
    });

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return eventSource; // Return for manual close
  }

  /**
   * Format date for API (ISO format)
   */
  _formatDate(date) {
    if (!date) return null;
    if (typeof date === 'string') return date;
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return null; // Validate date is valid
    return dateObj.toISOString();
  }
}

// Singleton instance
export const api = new APIClient();
