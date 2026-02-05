import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { PAGINATION } from '../config.js';
import { getCurrentDateTime, combineDateTime, formatDateTimeForBackend, parseDateTime } from '../utils/datetime.js';
import { parseSusuNotes, parsePotiNotes, buildNotes } from '../utils/note-parser.js';
import { showToast } from '../utils/toast.js';
import { modals } from './modals.js';

/**
 * Entry List Component with Infinite Scroll
 * Renders entries and loads more as user scrolls
 * Includes form submission, swipe gestures, context menu, and entry operations
 */

export class EntryList {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.error('Entry list container not found:', containerSelector);
      return;
    }

    // Find scroll container - use closest overflow-y-auto or window
    const scrollParent = this.container.closest('.overflow-y-auto');
    this.scrollContainer = scrollParent;
    this.useWindowScroll = !scrollParent; // Use window scroll if no specific container found

    this.loading = false;
    this.hasMore = true;

    // Touch/swipe state
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isSwiping = false;

    this._bindEvents();
    this._subscribeToState();
    this.setupFormHandlers();
    this._setupEventListeners();
  }

  /**
   * Render entries list
   */
  render() {
    const { entries } = state.getState();

    if (!entries || entries.length === 0) {
      this.container.innerHTML = `
        <div class="text-center py-8">
          <p class="text-slate-500 text-lg">No entries yet</p>
          <p class="text-slate-400 text-sm mt-2">Start logging above!</p>
        </div>
      `;
      return;
    }

    // Group entries by date
    const grouped = this._groupByDate(entries);

    let html = '';
    for (const [date, dateEntries] of Object.entries(grouped)) {
      html += this._renderDateGroup(date, dateEntries);
    }

    this.container.innerHTML = html;

    // Check if we need to load more
    this._checkLoadMore();
  }

  /**
   * Render a date group
   */
  _renderDateGroup(date, entries) {
    const groupId = `group-${date.replace(/\s+/g, '-')}`;

    let html = `
      <div class="date-group mb-6">
        <button
          onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('span:last-child').style.transform = this.nextElementSibling.classList.contains('hidden') ? 'rotate(-90deg)' : 'rotate(0deg)';"
          class="w-full text-left sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md py-3 px-3 mb-3 border-b border-slate-200/50 font-semibold text-slate-500 text-xs uppercase tracking-widest flex justify-between items-center cursor-pointer select-none hover:bg-slate-100/50 transition-colors rounded-xl">
          <span>${date}</span>
          <span style="transition: transform 0.2s; font-size: 10px; opacity: 0.5;">▼</span>
        </button>
        <div id="${groupId}" class="space-y-3 timeline-container">
    `;

    for (const entry of entries) {
      html += this._renderEntry(entry);
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * Render single entry
   */
  _renderEntry(entry) {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const { icon, title, details, iconBg } = this._getEntryDisplayData(entry);

    return `
      <div class="timeline-item mb-4" data-id="${entry.id}">
        <div class="timeline-card-content bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
             data-entry-id="${entry.id}"
             ontouchstart="window.entryList.handleTouchStart(event, this)"
             ontouchmove="window.entryList.handleTouchMove(event, this)"
             ontouchend="window.entryList.handleTouchEnd(event, this)"
             oncontextmenu="window.entryList.handleContextMenu(event, ${entry.id})">
          <div class="flex items-start gap-5">
            <div class="w-12 h-12 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0 text-xl shadow-inner-sm">
              ${icon}
            </div>
            <div class="flex-1 min-w-0 pt-0.5">
              <div class="flex items-start justify-between gap-3 mb-1">
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-slate-900 text-base mb-1">${title}</div>
                  <div class="text-slate-500 text-sm font-medium leading-relaxed">${details}</div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <div class="text-xs font-bold text-slate-400 tracking-wide">${timeStr}</div>
                  <button onclick="window.entryList.showContextMenu(event, ${entry.id})" class="p-2 text-slate-300 hover:text-slate-500 rounded-full transition-colors">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 16a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2zm0-6a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2zm0-6a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get display data for entry (icon, title, details, color)
   */
  _getEntryDisplayData(entry) {
    let icon, title, details, iconBg;

    if (entry.audio_url || entry.transcription !== undefined) {
      // Speech entry
      icon = '🎤';
      title = 'Speech Note';
      const parts = [];
      if (entry.transcription) {
        parts.push(entry.transcription.substring(0, 50) + (entry.transcription.length > 50 ? '...' : ''));
      } else {
        parts.push('Transcribing...');
      }
      if (entry.duration_ms) {
        const seconds = Math.floor(entry.duration_ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const duration = minutes > 0 ? `${minutes}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
        parts.push(`<b>${duration}</b>`);
      }
      if (entry.category && entry.category !== 'general') {
        parts.push(entry.category);
      }
      details = parts.join(' • ');
      iconBg = 'bg-indigo-100 text-indigo-600';
    } else if (entry.feed_amount || entry.feed_type) {
      icon = '🍼';
      title = 'Feed';
      const parts = [];
      if (entry.feed_amount) parts.push(`<b>${entry.feed_amount}ml</b>`);
      if (entry.feed_type) parts.push(entry.feed_type);
      details = parts.join(' • ');
      iconBg = 'bg-orange-100 text-orange-500';
    } else if (entry.susu_count > 0) {
      icon = '💧';
      title = 'Diaper Wet';
      details = entry.notes || 'One wet diaper';
      iconBg = 'bg-blue-100 text-blue-500';
    } else if (entry.poti_count > 0) {
      icon = '💩';
      title = 'Diaper Soiled';
      const color = entry.poti_color ? ` (${entry.poti_color})` : '';
      details = (entry.notes || 'One soiled diaper') + color;
      iconBg = 'bg-amber-100 text-amber-600';
    } else if (entry.temperature) {
      icon = '🌡️';
      title = 'Temperature';
      details = `<b>${entry.temperature}°C</b>`;
      iconBg = entry.temperature > 38 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600';
    } else if (entry.weight) {
      icon = '⚖️';
      title = 'Weight';
      details = `<b>${entry.weight}g</b>`;
      iconBg = 'bg-emerald-100 text-emerald-600';
    } else {
      icon = '📝';
      title = 'Note';
      details = entry.notes || 'No details';
      iconBg = 'bg-slate-100 text-slate-600';
    }

    return { icon, title, details, iconBg };
  }

  /**
   * Group entries by date
   */
  _groupByDate(entries) {
    const grouped = {};

    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });

      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });

    return grouped;
  }

  /**
   * Load next page (infinite scroll)
   */
  async loadNextPage() {
    if (this.loading || !this.hasMore) return;

    this.loading = true;
    state.setState({ ui: { loading: true } });

    try {
      const { pagination, filters } = state.getState();
      const nextPage = pagination.currentPage + 1;

      console.log(`📄 Loading page ${nextPage}...`);

      const response = await api.fetchEntries({
        page: nextPage,
        limit: PAGINATION.defaultPageSize,
        start: filters.dateRange.start,
        end: filters.dateRange.end,
        types: filters.types
      });

      // If no entries returned, we've reached the end of filtered data
      if (response.entries.length === 0) {
        console.log('📭 No more entries within filter range');
        this.hasMore = false;
        state.setState({
          pagination: {
            ...pagination,
            hasMore: false
          },
          ui: { loading: false }
        });
        this.loading = false;
        return;
      }

      // Append new entries to existing ones
      const currentEntries = state.getState('entries');
      const allEntries = [...currentEntries, ...response.entries];

      state.setState({
        entries: allEntries,
        pagination: {
          currentPage: response.pagination.page,
          totalPages: response.pagination.total_pages,
          total: response.pagination.total,
          hasMore: response.pagination.has_next && response.entries.length > 0
        }
      });

      this.hasMore = response.pagination.has_next && response.entries.length > 0;

      console.log(`✅ Loaded page ${nextPage}: ${response.entries.length} entries`);

    } catch (error) {
      console.error('Failed to load next page:', error);
    } finally {
      this.loading = false;
      state.setState({ ui: { loading: false } });
    }
  }

  /**
   * Check if we need to load more entries
   */
  _checkLoadMore() {
    if (this.useWindowScroll) {
      // Using window scroll
      const rect = this.container.getBoundingClientRect();
      const containerBottom = rect.bottom;
      const windowHeight = window.innerHeight;

      // Load more if container bottom is near viewport bottom
      const distanceFromBottom = containerBottom - windowHeight;

      if (distanceFromBottom < PAGINATION.infiniteScrollThreshold) {
        this.loadNextPage();
      }
    } else if (this.scrollContainer) {
      // Using container scroll
      const scrollHeight = this.scrollContainer.scrollHeight;
      const scrollTop = this.scrollContainer.scrollTop;
      const clientHeight = this.scrollContainer.clientHeight;

      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

      if (distanceFromBottom < PAGINATION.infiniteScrollThreshold) {
        this.loadNextPage();
      }
    }
  }

  /**
   * Bind scroll events
   */
  _bindEvents() {
    // Throttled scroll handler
    let scrollTimeout;

    const handleScroll = () => {
      if (scrollTimeout) return;

      scrollTimeout = setTimeout(() => {
        this._checkLoadMore();
        scrollTimeout = null;
      }, 100);
    };

    if (this.useWindowScroll) {
      // Listen to window scroll
      window.addEventListener('scroll', handleScroll);
    } else if (this.scrollContainer) {
      // Listen to container scroll
      this.scrollContainer.addEventListener('scroll', handleScroll);
    }
  }

  /**
   * Subscribe to state changes
   */
  _subscribeToState() {
    state.subscribe((newState, oldState) => {
      // Re-render if entries changed
      if (newState.entries !== oldState.entries) {
        this.render();
      }
    });
  }

  // ============================================================================
  // Event Listeners Setup
  // ============================================================================

  /**
   * Setup global event listeners
   */
  _setupEventListeners() {
    // Listen for filter changes
    window.addEventListener('filters:changed', () => {
      this.refreshEntries();
    });

    // Listen for speech entry creation
    window.addEventListener('speech:saved', () => {
      this.refreshEntries();
    });
  }

  // ============================================================================
  // Form Submission Handlers
  // ============================================================================

  /**
   * Setup form submit handlers for all entry types
   */
  setupFormHandlers() {
    // Feed form
    const feedForm = document.getElementById('feed-form');
    if (feedForm) {
      feedForm.addEventListener('submit', (e) => this.handleFeedSubmit(e));
    }

    // Susu form
    const susuForm = document.getElementById('susu-form');
    if (susuForm) {
      susuForm.addEventListener('submit', (e) => this.handleSusuSubmit(e));
    }

    // Poti form
    const potiForm = document.getElementById('poti-form');
    if (potiForm) {
      potiForm.addEventListener('submit', (e) => this.handlePotiSubmit(e));
    }

    // Temperature form
    const tempForm = document.getElementById('temp-form');
    if (tempForm) {
      tempForm.addEventListener('submit', (e) => this.handleTempSubmit(e));
    }

    // Weight form
    const weightForm = document.getElementById('weight-form');
    if (weightForm) {
      weightForm.addEventListener('submit', (e) => this.handleWeightSubmit(e));
    }
  }

  /**
   * Handle feed form submission
   */
  async handleFeedSubmit(e) {
    e.preventDefault();

    const data = {
      feed_type: document.getElementById('feed-type').value,
      feed_amount: parseInt(document.getElementById('feed-amount').value) || null,
      notes: document.getElementById('feed-notes').value || null,
      timestamp: this._getTimestampFromInputs('feed')
    };

    await this._saveEntry(data, 'feed');
  }

  /**
   * Handle susu form submission
   */
  async handleSusuSubmit(e) {
    e.preventDefault();

    const data = {
      susu_count: parseInt(document.getElementById('susu-count').value),
      notes: buildNotes([
        { label: 'Item', value: document.getElementById('susu-item-type').value },
        { label: 'Urine color', value: document.getElementById('susu-color').value }
      ], document.getElementById('susu-notes').value),
      timestamp: this._getTimestampFromInputs('susu')
    };

    await this._saveEntry(data, 'susu');
  }

  /**
   * Handle poti form submission
   */
  async handlePotiSubmit(e) {
    e.preventDefault();

    const data = {
      poti_count: parseInt(document.getElementById('poti-count').value),
      poti_color: document.getElementById('poti-color').value,
      notes: buildNotes([
        { label: 'Item', value: document.getElementById('poti-item-type').value },
        { label: 'Consistency', value: document.getElementById('poti-consistency').value }
      ], document.getElementById('poti-notes').value),
      timestamp: this._getTimestampFromInputs('poti')
    };

    await this._saveEntry(data, 'poti');
  }

  /**
   * Handle temperature form submission
   */
  async handleTempSubmit(e) {
    e.preventDefault();

    const data = {
      temperature: parseFloat(document.getElementById('temp-value').value),
      notes: document.getElementById('temp-notes').value || null,
      timestamp: this._getTimestampFromInputs('temp')
    };

    await this._saveEntry(data, 'temp');
  }

  /**
   * Handle weight form submission
   */
  async handleWeightSubmit(e) {
    e.preventDefault();

    const data = {
      weight: parseInt(document.getElementById('weight-value').value),
      notes: document.getElementById('weight-notes').value || null,
      timestamp: this._getTimestampFromInputs('weight')
    };

    await this._saveEntry(data, 'weight');
  }

  /**
   * Get timestamp from date/time inputs
   */
  _getTimestampFromInputs(type) {
    const date = document.getElementById(`${type}-date`).value;
    const time = document.getElementById(`${type}-time`).value;
    return combineDateTime(date, time);
  }

  /**
   * Save entry (create or update)
   */
  async _saveEntry(data, type) {
    try {
      const { editingEntry } = state.getState('ui');

      let response;
      if (editingEntry) {
        // Update existing entry
        response = await api.updateEntry(editingEntry.id, data);
        showToast('Entry updated successfully!', 'success');
      } else {
        // Create new entry
        response = await api.createEntry(data);
        showToast('Entry saved successfully!', 'success');
      }

      // Close modal and refresh
      modals.close(type);
      await this.refreshEntries();

    } catch (error) {
      console.error('Error saving entry:', error);
      showToast('Error saving entry. Please try again.', 'error');
    }
  }

  /**
   * Refresh entries from server (includes speech entries)
   */
  async refreshEntries() {
    console.log('🔄 Refreshing entries with current filters...');
    try {
      const { filters } = state.getState();

      console.log('📊 Current filter state:', {
        types: Array.from(filters.types),
        dateRange: filters.dateRange
      });

      // Load both regular entries and speech entries in parallel
      const [response, speechEntries] = await Promise.all([
        api.fetchEntries({
          page: 1,
          limit: PAGINATION.defaultPageSize,
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
        }
      });

      this.hasMore = hasMore;

      console.log(`✅ Refreshed: ${response.entries.length} regular + ${speechEntries.length} speech entries`);
    } catch (error) {
      console.error('Failed to refresh entries:', error);
      showToast('Failed to load entries', 'error');
    }
  }

  // ============================================================================
  // Entry Operations (Edit, Delete, Duplicate)
  // ============================================================================

  /**
   * Edit an entry
   */
  editEntry(id) {
    const { entries } = state.getState();
    const entry = entries.find(e => e.id === id);

    if (!entry) {
      console.warn('Entry not found:', id);
      return;
    }

    // Determine which modal to open based on entry type
    if (entry.feed_amount || entry.feed_type) {
      modals.open('feed', entry);
    } else if (entry.susu_count > 0) {
      modals.open('susu', entry);
    } else if (entry.poti_count > 0) {
      modals.open('poti', entry);
    } else if (entry.temperature) {
      modals.open('temp', entry);
    } else if (entry.weight) {
      modals.open('weight', entry);
    }
  }

  /**
   * Delete an entry with confirmation
   */
  async confirmDelete(id) {
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    await this.deleteEntry(id);
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id) {
    try {
      await api.deleteEntry(id);
      showToast('Entry deleted', 'success');
      await this.refreshEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      showToast('Error deleting entry', 'error');
    }
  }

  /**
   * Duplicate an entry
   */
  async duplicateEntry(id) {
    const { entries } = state.getState();
    const entry = entries.find(e => e.id === id);

    if (!entry) {
      console.warn('Entry not found:', id);
      return;
    }

    // Create a copy without ID and with current timestamp
    const newEntry = { ...entry };
    delete newEntry.id;
    newEntry.timestamp = new Date().toISOString();

    // Determine type based on fields present
    let type = 'feed';
    if (newEntry.susu_count !== undefined) type = 'susu';
    else if (newEntry.poti_count !== undefined) type = 'poti';
    else if (newEntry.temperature !== undefined) type = 'temp';
    else if (newEntry.weight !== undefined) type = 'weight';

    try {
      await api.createEntry(newEntry);
      showToast('Entry duplicated', 'success');
      await this.refreshEntries();
    } catch (error) {
      console.error('Error duplicating entry:', error);
      showToast('Error duplicating entry', 'error');
    }
  }

  // ============================================================================
  // Touch/Swipe Handlers
  // ============================================================================

  /**
   * Handle touch start for swipe gesture
   */
  handleTouchStart(e, element) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isSwiping = false;

    // Close other open swipes
    document.querySelectorAll('.timeline-card-content').forEach(el => {
      if (el !== element) {
        this._resetSwipe(el);
      }
    });
  }

  /**
   * Handle touch move for swipe gesture
   */
  handleTouchMove(e, element) {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const diffX = touchX - this.touchStartX;
    const diffY = touchY - this.touchStartY;

    // Determine if scrolling or swiping
    if (!this.isSwiping) {
      // More horizontal than vertical movement
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
        this.isSwiping = true;
      } else {
        return; // Vertical scroll, let browser handle it
      }
    }

    if (this.isSwiping) {
      if (e.cancelable) e.preventDefault(); // Prevent scroll

      // Only allow swiping left (negative diffX)
      // Limit swipe to -160px (width of 2 buttons)
      const newX = Math.min(0, Math.max(-160, diffX));
      element.style.transform = `translateX(${newX}px)`;
    }
  }

  /**
   * Handle touch end for swipe gesture
   */
  handleTouchEnd(e, element) {
    if (!this.isSwiping) return;

    const touchX = e.changedTouches[0].clientX;
    const diffX = touchX - this.touchStartX;

    // Snap to open or closed
    if (diffX < -60) { // Swiped enough to open
      element.style.transform = 'translateX(-160px)';
    } else {
      this._resetSwipe(element);
    }

    // Reset flag after a short delay to prevent click trigger
    setTimeout(() => { this.isSwiping = false; }, 100);
  }

  /**
   * Reset swipe position
   */
  _resetSwipe(element) {
    element.style.transform = 'translateX(0px)';
  }

  // ============================================================================
  // Context Menu
  // ============================================================================

  /**
   * Show context menu for entry
   */
  showContextMenu(e, entryId) {
    e.preventDefault();
    e.stopPropagation();

    // Remove existing menus
    this._closeContextMenu();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'context-menu-overlay';
    overlay.onclick = () => this._closeContextMenu();
    document.body.appendChild(overlay);

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
      <button class="context-menu-item" data-action="edit" data-id="${entryId}">
        <span>✏️</span> Edit
      </button>
      <button class="context-menu-item" data-action="duplicate" data-id="${entryId}">
        <span>📋</span> Duplicate
      </button>
      <div class="h-px bg-slate-100 my-1"></div>
      <button class="context-menu-item destructive" data-action="delete" data-id="${entryId}">
        <span>🗑️</span> Delete
      </button>
    `;

    // Add click handlers
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        const id = parseInt(item.dataset.id);

        this._closeContextMenu();

        if (action === 'edit') {
          this.editEntry(id);
        } else if (action === 'duplicate') {
          this.duplicateEntry(id);
        } else if (action === 'delete') {
          this.confirmDelete(id);
        }
      });
    });

    document.body.appendChild(menu);

    // Position menu
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (!clientX && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    // Adjust if close to edge
    const menuRect = menu.getBoundingClientRect();
    let left = clientX;
    let top = clientY;

    if (left + menuRect.width > window.innerWidth) {
      left = window.innerWidth - menuRect.width - 10;
    }
    if (top + menuRect.height > window.innerHeight) {
      top = clientY - menuRect.height;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  /**
   * Close context menu
   */
  _closeContextMenu() {
    const overlay = document.querySelector('.context-menu-overlay');
    const menu = document.querySelector('.context-menu');
    if (overlay) overlay.remove();
    if (menu) menu.remove();
  }

  /**
   * Handle context menu event
   */
  handleContextMenu(e, entryId) {
    this.showContextMenu(e, entryId);
  }
}
