/**
 * Filters and Date Range Module
 *
 * Manages history log filters and date range selection:
 * - Filter chips for entry types (feed, susu, poti, temp, weight, speech)
 * - Click to toggle, long-press (600ms) to isolate single type
 * - Date range presets (6h, 12h, 24h, today, yesterday, week)
 * - Custom date/time range picker
 * - Persists filter state via state management
 * - Emits custom events to trigger entry list refresh
 *
 * @module components/filters
 */

import { state } from '../core/state.js';
import { parseDateTime, formatDateTimeForBackend } from '../utils/datetime.js';
import { showToast } from '../utils/toast.js';
import { modals } from './modals.js';

// ============================================================================
// Module Configuration
// ============================================================================

/**
 * Long-press duration in milliseconds to trigger filter isolation
 */
const LONG_PRESS_MS = 600;

/**
 * Valid filter types
 */
const FILTER_TYPES = ['feed', 'susu', 'poti', 'temp', 'weight', 'speech'];

// ============================================================================
// Filter Chip Management
// ============================================================================

/**
 * Initialize filter chips with click and long-press handlers
 * Click: Toggle filter on/off
 * Long-press (600ms): Isolate single filter (show only this type)
 */
function setupHistoryFilters() {
    const chips = document.querySelectorAll('.filter-chip[data-type]');

    console.log(`🔍 Found ${chips.length} filter chips with data-type attribute`);

    chips.forEach(chip => {
        let pressTimer = null;
        let longPressTriggered = false;

        const startPress = () => {
            longPressTriggered = false;
            pressTimer = setTimeout(() => {
                longPressTriggered = true;
                console.log(`👆 Long press on filter: ${chip.dataset.type}`);
                isolateFilter(chip.dataset.type);
            }, LONG_PRESS_MS);
        };

        const clearPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        // Click handler: Toggle filter
        chip.addEventListener('click', () => {
            if (longPressTriggered) return;
            console.log(`🖱️ Click on filter: ${chip.dataset.type}`);
            toggleTypeFilter(chip);
        });

        // Touch/Mouse press handlers for long-press
        chip.addEventListener('mousedown', startPress);
        chip.addEventListener('touchstart', startPress);
        chip.addEventListener('mouseup', clearPress);
        chip.addEventListener('mouseleave', clearPress);
        chip.addEventListener('touchend', clearPress);
        chip.addEventListener('touchcancel', clearPress);
    });

    // Sync chip UI with state on initialization
    syncChipsWithState();
}

/**
 * Toggle a filter type on/off
 * @param {HTMLElement|string} chipOrType - Chip element or type string
 */
function toggleTypeFilter(chipOrType) {
    const type = typeof chipOrType === 'string'
        ? chipOrType
        : chipOrType.dataset.type;

    if (!type || !FILTER_TYPES.includes(type)) {
        console.warn(`Invalid filter type: ${type}`);
        return;
    }

    const currentFilters = state.getState('filters.types');

    if (currentFilters.has(type)) {
        // Keep at least one filter active to avoid empty state confusion
        if (currentFilters.size === 1) {
            showToast('At least one type must stay selected', 'error');
            return;
        }
        currentFilters.delete(type);
    } else {
        currentFilters.add(type);
    }

    // Update state
    state.setState({
        filters: {
            types: currentFilters
        }
    });

    // Persist to localStorage
    state.persist(['filters.types']);

    // Sync UI
    syncChipsWithState();

    // Emit event to refresh entry list
    emitFilterChange();
}

/**
 * Isolate a single filter type (show only this type)
 * @param {string} type - Filter type to isolate
 */
function isolateFilter(type) {
    if (!type || !FILTER_TYPES.includes(type)) {
        console.warn(`Invalid filter type: ${type}`);
        return;
    }

    // Clear all filters and add only this type
    const newFilters = new Set([type]);

    state.setState({
        filters: {
            types: newFilters
        }
    });

    // Persist to localStorage
    state.persist(['filters.types']);

    // Sync UI
    syncChipsWithState();

    // Emit event to refresh entry list
    emitFilterChange();
}

/**
 * Sync filter chip UI with state
 */
function syncChipsWithState() {
    const currentFilters = state.getState('filters.types');
    const chips = document.querySelectorAll('.filter-chip[data-type]');

    chips.forEach(chip => {
        const type = chip.dataset.type;
        const isActive = currentFilters.has(type);
        chip.classList.toggle('active', isActive);
    });
}

// ============================================================================
// Date Range Management
// ============================================================================

/**
 * Initialize history date range (default to 'today')
 */
async function setupHistoryRange() {
    // Initialize with Today preset
    await applyPreset('today');
}

/**
 * Switch between range picker tabs (presets vs. custom)
 * @param {string} tab - 'presets' or 'custom'
 */
function switchRangeTab(tab) {
    const presetsBtn = document.getElementById('range-tab-presets');
    const customBtn = document.getElementById('range-tab-custom');
    const presetsView = document.getElementById('range-view-presets');
    const customView = document.getElementById('range-view-custom');

    if (!presetsBtn || !customBtn || !presetsView || !customView) return;

    if (tab === 'presets') {
        presetsBtn.classList.add('bg-white', 'shadow-sm', 'text-sky-600');
        customBtn.classList.remove('bg-white', 'shadow-sm', 'text-sky-600');
        presetsView.classList.remove('hidden');
        customView.classList.add('hidden');
    } else {
        customBtn.classList.add('bg-white', 'shadow-sm', 'text-sky-600');
        presetsBtn.classList.remove('bg-white', 'shadow-sm', 'text-sky-600');
        customView.classList.remove('hidden');
        presetsView.classList.add('hidden');

        // Initialize custom inputs with current range if not set
        initializeCustomInputs();
    }
}

/**
 * Initialize custom date/time inputs with current range
 */
function initializeCustomInputs() {
    const customStartDate = document.getElementById('custom-start-date');
    const customStartTime = document.getElementById('custom-start-time');
    const customEndDate = document.getElementById('custom-end-date');
    const customEndTime = document.getElementById('custom-end-time');

    if (!customStartDate || customStartDate.value) return;

    const dateRange = state.getState('filters.dateRange');
    const start = dateRange.start || new Date();
    const end = dateRange.end || new Date();

    const pad = n => String(n).padStart(2, '0');

    customStartDate.value = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    customStartTime.value = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    customEndDate.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    customEndTime.value = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

/**
 * Set custom end time to current time
 */
function setCustomEndTimeNow() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');

    const customEndDate = document.getElementById('custom-end-date');
    const customEndTime = document.getElementById('custom-end-time');

    if (customEndDate) {
        customEndDate.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
    if (customEndTime) {
        customEndTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
}

/**
 * Apply custom date/time range
 */
async function applyCustomRange() {
    const sDate = document.getElementById('custom-start-date')?.value;
    const sTime = document.getElementById('custom-start-time')?.value;
    const eDate = document.getElementById('custom-end-date')?.value;
    const eTime = document.getElementById('custom-end-time')?.value;

    if (!sDate || !sTime || !eDate || !eTime) {
        showToast('Please fill all date and time fields', 'error');
        return;
    }

    const start = parseDateTime(sDate, sTime);
    const end = parseDateTime(eDate, eTime, true);

    if (!start || !end) {
        showToast('Invalid date or time format', 'error');
        return;
    }

    if (end < start) {
        showToast('End time cannot be before start time', 'error');
        return;
    }

    // Update state
    state.setState({
        filters: {
            dateRange: { start, end },
            activePreset: null
        }
    });

    // Update UI summary
    updateRangeSummary('Custom Range');

    // Emit event to refresh entry list
    emitFilterChange();

    // Close modal
    modals.close('range');
}

/**
 * Apply a date range preset
 * @param {string} preset - Preset key: '6h', '12h', '24h', 'today', 'yesterday', 'week'
 */
async function applyPreset(preset) {
    console.log(`📅 Applying preset: ${preset}`);
    const end = new Date();
    let start = new Date();
    let label = '';

    switch (preset) {
        case '6h':
            start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
            label = 'Last 6 Hours';
            break;
        case '12h':
            start = new Date(end.getTime() - 12 * 60 * 60 * 1000);
            label = 'Last 12 Hours';
            break;
        case '24h':
            start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
            label = 'Last 24 Hours';
            break;
        case 'today':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            label = 'Today';
            break;
        case 'yesterday':
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            label = 'Yesterday';
            break;
        case 'week':
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            label = 'This Week';
            break;
        default:
            console.warn(`Unknown preset: ${preset}`);
            return;
    }

    // Update state
    state.setState({
        filters: {
            dateRange: { start, end },
            activePreset: preset
        }
    });

    // Persist to localStorage
    state.persist(['filters']);

    // Update UI summary
    updateRangeSummary(label, preset);

    // Emit event to refresh entry list
    emitFilterChange();
}

/**
 * Apply preset and close modal
 * @param {string} preset - Preset key
 */
async function selectPresetAndClose(preset) {
    await applyPreset(preset);
    modals.close('range');
}

/**
 * Update range summary UI chip
 * @param {string} label - Display label
 * @param {string|null} activePreset - Active preset key (null for custom)
 */
function updateRangeSummary(label, activePreset = null) {
    const customBtn = document.getElementById('custom-range-btn');
    const customLabel = document.getElementById('custom-range-label');

    // Deactivate all preset chips (exclude custom btn and type filter chips)
    // Only target buttons without data-type attribute (time range filters only)
    const presetChips = document.querySelectorAll('.filter-scroll-container button:not(#custom-range-btn):not([data-type])');
    presetChips.forEach(chip => chip.classList.remove('active'));

    if (activePreset) {
        // Preset Mode: Find matches by onclick text or textContent
        const activeChip = Array.from(presetChips).find(c =>
            c.getAttribute('onclick')?.includes(`'${activePreset}'`)
        );
        if (activeChip) activeChip.classList.add('active');

        // Reset Custom Button to default state
        if (customBtn) customBtn.classList.remove('active');
        if (customLabel) customLabel.textContent = 'Range';
    } else {
        // Custom Mode
        if (customBtn) customBtn.classList.add('active');

        // Format compact label: "Oct 12 - Oct 14"
        const dateRange = state.getState('filters.dateRange');
        if (dateRange.start && dateRange.end) {
            const formatDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const dateText = `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;

            if (customLabel) customLabel.textContent = dateText;
        }
    }
}

// ============================================================================
// Event Emission
// ============================================================================

/**
 * Emit custom event when filters change
 * Other modules can listen for this event to refresh entry lists
 */
function emitFilterChange() {
    const filtersState = {
        types: state.getState('filters.types'),
        dateRange: state.getState('filters.dateRange')
    };

    console.log('🔔 Emitting filters:changed event', filtersState);

    const event = new CustomEvent('filters:changed', {
        detail: filtersState
    });
    window.dispatchEvent(event);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Filters and date range management API
 */
export const filters = {
    /**
     * Initialize filter chips and date range
     */
    init: async function() {
        setupHistoryFilters();
        await setupHistoryRange();
    },

    /**
     * Toggle a filter type on/off
     * @param {string} type - Filter type
     */
    toggle: toggleTypeFilter,

    /**
     * Isolate a single filter type
     * @param {string} type - Filter type to isolate
     */
    isolate: isolateFilter,

    /**
     * Apply a date range preset
     * @param {string} preset - Preset key ('6h', '12h', '24h', 'today', 'yesterday', 'week')
     */
    applyPreset: applyPreset,

    /**
     * Apply preset and close modal
     * @param {string} preset - Preset key
     */
    selectPresetAndClose: selectPresetAndClose,

    /**
     * Apply custom date/time range
     */
    applyCustomRange: applyCustomRange,

    /**
     * Set custom end time to now
     */
    setCustomEndTimeNow: setCustomEndTimeNow,

    /**
     * Switch range picker tab
     * @param {string} tab - 'presets' or 'custom'
     */
    switchRangeTab: switchRangeTab,

    /**
     * Update range summary UI
     * @param {string} label - Display label
     * @param {string|null} activePreset - Active preset key
     */
    updateSummary: updateRangeSummary,

    /**
     * Sync filter chips with current state
     */
    syncChips: syncChipsWithState
};

// Export for window.filters access (for onclick handlers in HTML)
if (typeof window !== 'undefined') {
    window.filters = filters;
}

export default filters;
