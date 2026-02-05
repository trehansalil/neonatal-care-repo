/**
 * Diaper Timer Component
 * Tracks time since last diaper change and sends notifications
 */

import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { formatTimeSince } from '../utils/datetime.js';
import { UI, API_ENDPOINTS } from '../config.js';

/**
 * Diaper Timer Manager
 * Handles timer display, notifications, and state management
 */
class DiaperTimer {
  constructor() {
    // DOM element references
    this.elements = {
      card: null,
      display: null,
      subtitle: null,
      icon: null
    };

    // Timer state
    this.timerInterval = null;
    this.lastDiaperChangeTime = null;

    // Constants
    this.DIAPER_ALERT_HOURS = UI.diaperAlertHours || 4;

    // Webhook configuration
    this.webhookConfig = {
      configured: false,
      webhook_url: null,
      diaper_alert_hours: this.DIAPER_ALERT_HOURS
    };

    // LocalStorage key for notification state
    this.STORAGE_KEY = 'diaperNotificationState';
  }

  /**
   * Initialize the diaper timer
   * @param {Object} elementIds - Object with DOM element IDs
   */
  init(elementIds = {}) {
    this.elements = {
      card: document.getElementById(elementIds.card || 'diaper-timer-card'),
      display: document.getElementById(elementIds.display || 'diaper-timer-display'),
      subtitle: document.getElementById(elementIds.subtitle || 'diaper-timer-subtitle'),
      icon: document.getElementById(elementIds.icon || 'diaper-timer-icon')
    };

    // Verify elements exist
    const missingElements = Object.entries(this.elements)
      .filter(([key, el]) => !el)
      .map(([key]) => key);

    if (missingElements.length > 0) {
      console.warn(`Diaper timer missing elements: ${missingElements.join(', ')}`);
    }

    // Load webhook configuration
    this.fetchWebhookConfig();

    // Subscribe to state changes
    this._subscribeToState();

    return this;
  }

  /**
   * Fetch webhook configuration from backend
   */
  async fetchWebhookConfig() {
    try {
      this.webhookConfig = await api.fetchWebhookConfig();
      console.log('Webhook config loaded:', this.webhookConfig);
    } catch (error) {
      console.error('Error fetching webhook config:', error);
    }
  }

  /**
   * Get notification state from localStorage
   * @returns {Object} Notification state
   */
  getNotificationState() {
    try {
      const state = localStorage.getItem(this.STORAGE_KEY);
      return state ? JSON.parse(state) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save notification state to localStorage
   * @param {Object} state - State to save
   */
  saveNotificationState(state) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving notification state:', error);
    }
  }

  /**
   * Send diaper notification via webhook
   * @param {number} hours - Hours since last change
   * @param {string} lastChangeTime - Timestamp of last change
   * @param {boolean} isNewEntry - Whether this is triggered by a new entry
   * @returns {Promise<boolean>} Success status
   */
  async sendNotification(hours, lastChangeTime, isNewEntry = false) {
    if (!this.webhookConfig.configured) {
      console.log('Webhook not configured, skipping notification');
      return false;
    }

    const lastChangeDate = new Date(lastChangeTime);
    const timeStr = lastChangeDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const dateStr = lastChangeDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric'
    });

    const thresholdHours = this.webhookConfig.diaper_alert_hours || this.DIAPER_ALERT_HOURS;
    const thresholdSeconds = thresholdHours * 3600;

    // Calculate time since the entry's timestamp (whether backdated or current)
    let timeSinceSeconds;
    let actualHours;
    let message;

    if (isNewEntry) {
      // For a new entry, calculate time from the entry's timestamp to NOW
      // This respects backdating - if entry is backdated to 7 PM and it's now 9 PM,
      // then 2 hours have already passed
      const now = new Date();
      const then = new Date(lastChangeTime);
      const diffMs = now - then;
      timeSinceSeconds = Math.floor(diffMs / 1000); // Convert ms directly to seconds
      actualHours = timeSinceSeconds / 3600; // Convert to hours for display

      message = `⚠️ Diaper Alert: It's been ${thresholdHours} hours since the last diaper change. Last change was at ${timeStr} on ${dateStr}.`;
    } else {
      // For status updates, use provided hours parameter
      actualHours = hours;
      timeSinceSeconds = Math.floor(hours * 3600);

      const isOverdue = hours >= thresholdHours;
      if (isOverdue) {
        message = `⚠️ Diaper Alert: It's been ${hours.toFixed(1)} hours since the last diaper change. Last change was at ${timeStr} on ${dateStr}.`;
      } else {
        message = `🔔 Diaper status update: Last change was ${hours.toFixed(1)} hours ago at ${timeStr} on ${dateStr}.`;
      }
    }

    // Calculate time left until threshold (based on entry's timestamp)
    const timeLeftSeconds = Math.max(0, thresholdSeconds - timeSinceSeconds);

    const metadata = {
      alert_type: isNewEntry ? 'diaper_entry_created' : (actualHours >= thresholdHours ? 'diaper_overdue' : 'diaper_status'),
      is_new_entry: isNewEntry,
      is_overdue: actualHours >= thresholdHours,
      hours_since_last_change: Math.round(actualHours * 100) / 100,
      last_change_timestamp: lastChangeTime,
      threshold_hours: thresholdHours,
      time_left: timeLeftSeconds,  // For n8n scheduling
      source: 'frontend'
    };

    try {
      const response = await fetch(API_ENDPOINTS.notifications, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, metadata })
      });

      if (response.ok) {
        console.log('Notification sent successfully:', message);
        return true;
      } else {
        console.error('Failed to send notification:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Update timer display with color coding
   * Green: Normal (< 75% threshold)
   * Amber: Warning (>= 75% threshold)
   * Red: Overdue (>= threshold)
   */
  updateDisplay() {
    if (!this.elements.display) return;

    if (!this.lastDiaperChangeTime) {
      this._renderEmptyState();
      return;
    }

    const { hours, minutes, display } = formatTimeSince(this.lastDiaperChangeTime);
    this.elements.display.textContent = display;

    const lastChangeDate = new Date(this.lastDiaperChangeTime);
    const timeStr = lastChangeDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const alertThreshold = this.webhookConfig.diaper_alert_hours || this.DIAPER_ALERT_HOURS;

    // Smart status coloring based on threshold
    if (hours >= alertThreshold) {
      this._renderOverdueState(timeStr, hours);
    } else if (hours >= alertThreshold * 0.75) {
      this._renderWarningState(timeStr);
    } else {
      this._renderNormalState(timeStr);
    }
  }

  /**
   * Render empty state (no diaper changes yet)
   * @private
   */
  _renderEmptyState() {
    this.elements.display.textContent = '--:--';
    this.elements.subtitle.textContent = 'No changes yet';

    // Reset to neutral state
    this.elements.card.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all duration-300';
    this.elements.icon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center transition-colors duration-300';
    this.elements.icon.innerHTML = `
      <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `;
    this.elements.display.className = 'text-2xl font-semibold text-slate-900';
    this.elements.subtitle.className = 'text-[10px] text-slate-400 mt-0.5';

    // Clear notification state
    const state = this.getNotificationState();
    if (state.lastNotifiedTimestamp) {
      this.saveNotificationState({});
    }
  }

  /**
   * Render overdue state (red alert)
   * @param {string} timeStr - Formatted time string
   * @param {number} hours - Hours since last change
   * @private
   */
  _renderOverdueState(timeStr, hours) {
    this.elements.card.className = 'bg-white p-4 rounded-xl shadow-sm border-2 border-red-200 transition-all duration-300';
    this.elements.icon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center transition-colors duration-300';
    this.elements.icon.innerHTML = `
      <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `;
    this.elements.display.className = 'text-2xl font-semibold text-red-600';
    this.elements.subtitle.textContent = `⚠️ Last: ${timeStr}`;
    this.elements.subtitle.className = 'text-[10px] text-red-500 mt-0.5 font-medium';

    // Send notification if not already sent for this timestamp
    const state = this.getNotificationState();
    if (state.lastNotifiedTimestamp !== this.lastDiaperChangeTime) {
      console.log('Diaper/Nappy overdue detected - sending notification');
      this.sendNotification(hours, this.lastDiaperChangeTime).then(success => {
        if (success) {
          this.saveNotificationState({ lastNotifiedTimestamp: this.lastDiaperChangeTime });
        }
      });
    }
  }

  /**
   * Render warning state (amber)
   * @param {string} timeStr - Formatted time string
   * @private
   */
  _renderWarningState(timeStr) {
    this.elements.card.className = 'bg-white p-4 rounded-xl shadow-sm border border-amber-200 transition-all duration-300';
    this.elements.icon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center transition-colors duration-300';
    this.elements.icon.innerHTML = `
      <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `;
    this.elements.display.className = 'text-2xl font-semibold text-amber-600';
    this.elements.subtitle.textContent = `Last: ${timeStr}`;
    this.elements.subtitle.className = 'text-[10px] text-amber-500 mt-0.5';

    // Clear notification state (not overdue anymore)
    const state = this.getNotificationState();
    if (state.lastNotifiedTimestamp) {
      this.saveNotificationState({});
    }
  }

  /**
   * Render normal state (green check)
   * @param {string} timeStr - Formatted time string
   * @private
   */
  _renderNormalState(timeStr) {
    this.elements.card.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all duration-300';
    this.elements.icon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center transition-colors duration-300';
    this.elements.icon.innerHTML = `
      <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    `;
    this.elements.display.className = 'text-2xl font-semibold text-emerald-600';
    this.elements.subtitle.textContent = `Last: ${timeStr}`;
    this.elements.subtitle.className = 'text-[10px] text-slate-400 mt-0.5';

    // Clear notification state
    const state = this.getNotificationState();
    if (state.lastNotifiedTimestamp) {
      this.saveNotificationState({});
    }
  }

  /**
   * Start the timer (updates every 30 seconds)
   */
  start() {
    // Clear existing timer if any
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Update immediately
    this.updateDisplay();

    // Update every 30 seconds
    this.timerInterval = setInterval(() => {
      this.updateDisplay();
    }, UI.timerUpdateInterval || 30000);
  }

  /**
   * Stop the timer
   */
  stop() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Find the last diaper change from entries
   * @param {Array} entries - Array of entry objects
   * @returns {string|null} Timestamp of last diaper change
   */
  findLastDiaperChange(entries) {
    if (!entries || !Array.isArray(entries)) {
      console.warn('Invalid entries provided to findLastDiaperChange');
      return null;
    }

    // Find most recent entry with susu_count OR poti_count > 0
    const diaperEntries = entries
      .filter(e => (e.susu_count && e.susu_count > 0) || (e.poti_count && e.poti_count > 0))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (diaperEntries.length > 0) {
      return diaperEntries[0].timestamp;
    }

    return null;
  }

  /**
   * Update timer with current entries from state
   */
  update() {
    const entries = state.getState('entries');
    const lastChangeTime = this.findLastDiaperChange(entries);

    if (lastChangeTime !== this.lastDiaperChangeTime) {
      this.lastDiaperChangeTime = lastChangeTime;

      // Update state
      state.setState({
        timer: {
          lastDiaperChange: lastChangeTime,
          timeSince: lastChangeTime ? formatTimeSince(lastChangeTime) : null
        }
      });
    }

    this.start();
  }

  /**
   * Subscribe to state changes
   * @private
   */
  _subscribeToState() {
    state.subscribe((newState, oldState) => {
      // Update timer when entries change
      if (newState.entries !== oldState.entries) {
        this.update();
      }
    });
  }

  /**
   * Cleanup on destruction
   */
  destroy() {
    this.stop();
  }
}

// Create singleton instance
const diaperTimerInstance = new DiaperTimer();

/**
 * Public API
 */
export const diaperTimer = {
  /**
   * Initialize the diaper timer
   * @param {Object} elementIds - DOM element IDs
   */
  init: (elementIds) => diaperTimerInstance.init(elementIds),

  /**
   * Start the timer
   */
  start: () => diaperTimerInstance.start(),

  /**
   * Stop the timer
   */
  stop: () => diaperTimerInstance.stop(),

  /**
   * Update timer with current entries
   */
  update: () => diaperTimerInstance.update(),

  /**
   * Find last diaper change from entries
   * @param {Array} entries - Entry array
   * @returns {string|null} Timestamp
   */
  findLast: (entries) => diaperTimerInstance.findLastDiaperChange(entries),

  /**
   * Send notification
   * @param {number} hours - Hours since last change
   * @param {string} timestamp - Last change timestamp
   * @param {boolean} isNewEntry - Is this a new entry
   * @returns {Promise<boolean>}
   */
  sendNotification: (hours, timestamp, isNewEntry) =>
    diaperTimerInstance.sendNotification(hours, timestamp, isNewEntry),

  /**
   * Fetch webhook configuration
   * @returns {Promise<void>}
   */
  fetchConfig: () => diaperTimerInstance.fetchWebhookConfig(),

  /**
   * Get current last diaper change time
   * @returns {string|null}
   */
  getLastChangeTime: () => diaperTimerInstance.lastDiaperChangeTime,

  /**
   * Manually set last diaper change time
   * @param {string} timestamp - Timestamp
   */
  setLastChangeTime: (timestamp) => {
    diaperTimerInstance.lastDiaperChangeTime = timestamp;
    diaperTimerInstance.start();
  }
};

// Export the class for testing
export { DiaperTimer };
