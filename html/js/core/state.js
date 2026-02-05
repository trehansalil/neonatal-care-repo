/**
 * Reactive State Management
 * Simple observer pattern for app state
 */

class AppState {
  constructor() {
    this.state = {
      // Data
      entries: [],
      speechEntries: [],

      // Pagination
      pagination: {
        currentPage: 1,
        totalPages: 0,
        total: 0,
        hasMore: true
      },

      // Filters
      filters: {
        dateRange: { start: null, end: null },
        types: new Set(['feed', 'susu', 'poti', 'temp', 'weight']),
        activePreset: 'today'
      },

      // UI State
      ui: {
        loading: false,
        activeModal: null,
        activeTab: 'log', // 'log' or 'trends'
        view: 'log', // 'log' or 'trends'
        editingEntry: null
      },

      // Trend State
      trend: {
        metric: 'weight-avg',
        range: 'week',
        compareMetric: null,
        cumulative: false
      },

      // Speech State
      speech: {
        status: 'idle', // 'idle' | 'recording' | 'paused' | 'stopped'
        draft: null,
        pendingTranscriptions: new Set()
      },

      // Timer State
      timer: {
        lastDiaperChange: null,
        timeSince: null
      }
    };

    this.listeners = new Set();
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Called with (newState, oldState, updates)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current state or specific path
   * @param {string} [path] - Dot notation path (e.g., 'filters.types')
   */
  getState(path) {
    if (!path) return this.state;

    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  /**
   * Update state and notify listeners
   * @param {Object} updates - Partial state updates (supports nested objects)
   */
  setState(updates) {
    const oldState = structuredClone(this.state);

    // Deep merge updates
    this.state = this._deepMerge(this.state, updates);

    // Notify all listeners
    this.listeners.forEach(callback => {
      try {
        callback(this.state, oldState, updates);
      } catch (err) {
        console.error('State listener error:', err);
      }
    });
  }

  /**
   * Reset state to initial values
   */
  reset() {
    this.setState({
      entries: [],
      pagination: { currentPage: 1, totalPages: 0, hasMore: true },
      ui: { loading: false, activeModal: null }
    });
  }

  /**
   * Deep merge two objects
   */
  _deepMerge(target, source) {
    const output = { ...target };

    for (const key in source) {
      if (source[key] instanceof Set) {
        output[key] = new Set(source[key]);
      } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this._deepMerge(target[key] || {}, source[key]);
      } else {
        output[key] = source[key];
      }
    }

    return output;
  }

  /**
   * Save specific state keys to localStorage
   */
  persist(keys = ['filters', 'trend', 'ui.view']) {
    keys.forEach(key => {
      const value = this.getState(key);
      if (value !== undefined) {
        // Convert Set to Array for JSON serialization
        const serializable = value instanceof Set ? Array.from(value) : value;
        localStorage.setItem(`state:${key}`, JSON.stringify(serializable));
      }
    });
  }

  /**
   * Restore state from localStorage
   */
  restore(keys = ['filters', 'trend', 'ui.view']) {
    keys.forEach(key => {
      const stored = localStorage.getItem(`state:${key}`);
      if (stored) {
        try {
          let value = JSON.parse(stored);
          // Restore Set from Array
          if (key.includes('types') && Array.isArray(value)) {
            value = new Set(value);
          }

          // Handle nested keys
          if (key.includes('.')) {
            const parts = key.split('.');
            const update = {};
            let current = update;
            parts.forEach((part, i) => {
              if (i === parts.length - 1) {
                current[part] = value;
              } else {
                current[part] = {};
                current = current[part];
              }
            });
            this.setState(update);
          } else {
            this.setState({ [key]: value });
          }
        } catch (err) {
          console.warn(`Failed to restore state for ${key}`, err);
        }
      }
    });
  }
}

// Singleton instance
export const state = new AppState();

// Export class for testing
export { AppState };
