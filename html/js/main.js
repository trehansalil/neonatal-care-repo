/**
 * Baby Tracker - Main Entry Point
 * Initializes the application and sets up modular architecture
 */

import { api } from './core/api.js';
import { state } from './core/state.js';
import { EntryList } from './components/entry-list.js';
import { speech } from './components/speech.js';
import { diaperTimer } from './components/diaper-timer.js';
import { modals } from './components/modals.js';
import { filters } from './components/filters.js';
import { dashboard } from './components/dashboard.js';
import { STORAGE_KEYS } from './config.js';

console.log('🚀 Baby Tracker initializing (modular version)...');

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  try {
    console.log('📦 Restoring saved state...');
    // Restore saved state from localStorage
    restoreState();

    console.log('🎨 Initializing modals...');
    // Initialize modal management
    // Modals are automatically initialized on import

    console.log('🔽 Initializing filters...');
    // Initialize filters and date range
    filters.init();

    console.log('📋 Initializing entry list...');
    // Initialize entry list with infinite scrolling
    const entryList = new EntryList('#entries-container');
    window.entryList = entryList; // Expose for onclick handlers

    console.log('🎤 Initializing speech recording...');
    // Initialize speech module (SSE connection, UI setup)
    speech.initSSE();

    console.log('⏱️ Initializing diaper timer...');
    // Initialize diaper timer
    diaperTimer.init({
      card: 'diaper-timer-card',
      display: 'diaper-timer-display',
      subtitle: 'diaper-timer-subtitle',
      icon: 'diaper-timer-icon'
    });
    await diaperTimer.fetchConfig();

    console.log('📊 Initializing dashboard...');
    // Initialize dashboard and charts
    dashboard.init();

    console.log('📥 Loading initial data...');
    // Load initial entries
    await loadEntries();

    // Update diaper timer with loaded entries
    diaperTimer.update();

    console.log('🎛️ Setting up event listeners...');
    // Set up global event listeners
    setupEventListeners();

    // Setup mobile tabs
    setupMobileTabs();

    console.log('✅ Baby Tracker ready!');

  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    // Show user-friendly error message
    const container = document.querySelector('#entries-container');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-red-500 font-bold text-lg">Failed to load tracker</p>
          <p class="text-slate-500 text-sm mt-2">${error.message}</p>
          <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Reload Page
          </button>
        </div>
      `;
    }
  }
}

/**
 * Load entries from API (both regular entries and speech entries)
 */
export async function loadEntries() {
  const { filters } = state.getState();

  state.setState({ ui: { loading: true } });

  try {
    // Load both regular entries and speech entries in parallel
    const [response, speechEntries] = await Promise.all([
      api.fetchEntries({
        page: 1,
        limit: 20,
        start: filters.dateRange.start,
        end: filters.dateRange.end,
        types: filters.types
      }),
      api.fetchSpeechEntries({
        start: filters.dateRange.start,
        end: filters.dateRange.end
      })
    ]);

    // Merge and sort entries by timestamp (newest first)
    const allEntries = [...response.entries, ...speechEntries].sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Calculate hasMore based on whether we got entries and backend says there's more
    const hasMore = response.pagination.has_next && response.entries.length > 0;

    state.setState({
      entries: allEntries,
      speechEntries: speechEntries,
      pagination: {
        currentPage: response.pagination.page,
        totalPages: response.pagination.total_pages,
        total: response.pagination.total + speechEntries.length,
        hasMore: hasMore
      },
      ui: { loading: false }
    });

    console.log(`📥 Loaded ${response.entries.length} regular + ${speechEntries.length} speech entries`);
    if (response.entries.length === 0 && speechEntries.length === 0) {
      console.log('📭 No entries found within filter range');
    }

  } catch (error) {
    console.error('Failed to load entries:', error);
    state.setState({ ui: { loading: false } });
    alert('Failed to load entries. Please check your connection and try again.');
  }
}

/**
 * Restore state from localStorage
 */
function restoreState() {
  const savedFilters = localStorage.getItem(STORAGE_KEYS.filters);
  if (savedFilters) {
    try {
      const filters = JSON.parse(savedFilters);
      if (filters.types && Array.isArray(filters.types)) {
        filters.types = new Set(filters.types);
      }
      state.setState({ filters });
      console.log('✅ Restored filters from localStorage');
    } catch (err) {
      console.warn('Failed to restore filters:', err);
    }
  }

  const savedView = localStorage.getItem(STORAGE_KEYS.view);
  if (savedView) {
    state.setState({ ui: { view: savedView } });
    console.log('✅ Restored view from localStorage:', savedView);
  }
}

/**
 * Setup mobile tab switching (Log/Trends)
 */
function setupMobileTabs() {
  const tabLog = document.getElementById('tab-log');
  const tabTrends = document.getElementById('tab-trends');

  if (!tabLog || !tabTrends) {
    console.warn('Mobile tab buttons not found');
    return;
  }

  const root = document.body;

  const setView = (view) => {
    tabLog.classList.toggle('active', view === 'log');
    tabTrends.classList.toggle('active', view === 'trends');
    root.classList.toggle('mobile-view-trends', view === 'trends');
    localStorage.setItem(STORAGE_KEYS.view, view);
    state.setState({ ui: { view } });
  };

  tabLog.addEventListener('click', () => setView('log'));
  tabTrends.addEventListener('click', () => setView('trends'));

  const storedView = localStorage.getItem(STORAGE_KEYS.view);
  if (storedView === 'trends') {
    setView('trends');
  } else {
    setView('log');
  }
}

/**
 * Set up global event listeners
 */
function setupEventListeners() {
  // Save state on page unload
  window.addEventListener('beforeunload', () => {
    const { filters: filterState, trend } = state.getState();
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify({
      ...filterState,
      types: Array.from(filterState.types)
    }));
    localStorage.setItem(STORAGE_KEYS.metric, trend.metric);
    localStorage.setItem(STORAGE_KEYS.range, trend.range);
    localStorage.setItem(STORAGE_KEYS.cumulative, trend.cumulative);
  });

  // Handle visibility change (reload on tab focus)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('👀 Tab focused, checking for updates...');
      loadEntries();
    }
  });

  // Listen for entries changes to update dashboard and timer
  state.subscribe((newState, oldState) => {
    if (newState.entries !== oldState.entries) {
      // Update dashboard stats
      dashboard.updateStats();

      // Update diaper timer
      diaperTimer.update();
    }
  });

  // Listen for filter changes to update dashboard
  window.addEventListener('filters:changed', () => {
    console.log('🔄 Filters changed, updating dashboard...');
    dashboard.updateStats();
    dashboard.updateChart();
  });

  // Log state changes for debugging (localhost only)
  if (window.location.hostname === 'localhost') {
    state.subscribe((newState) => {
      console.log('📊 State updated:', {
        entriesCount: newState.entries.length,
        page: newState.pagination.currentPage,
        total: newState.pagination.total,
        loading: newState.ui.loading
      });
    });
  }
}

// Export globals for backward compatibility and onclick handlers
window.appAPI = api;
window.appState = state;
window.appLoadEntries = loadEntries;
window.speech = speech;
window.modals = modals;
window.filters = filters;
window.dashboard = dashboard;
window.diaperTimer = diaperTimer;

// Export specific functions for onclick handlers
window.applyPreset = filters.applyPreset;
window.openModal = modals.open;
window.closeModal = modals.close;

console.log('📦 Main module loaded');
