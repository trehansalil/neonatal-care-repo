/**
 * File: tracker.js
 * Purpose: Client-side logic for neonatal care tracking interface
 * Dependencies: 
 *   - Chart.js (CDN) - for trend visualization
 *   - Tailwind CSS (CDN) - for utility classes
 * Last Modified: 2026-02-02
 * 
 * This file contains all JavaScript functionality for the baby tracker application.
 * It handles speech recording, entry management, statistics, charts, and UI interactions.
 */

// ==========================================
// SECTION: API Configuration
// ==========================================

// API Configuration
const API_BASE_URL = '/api';
const SPEECH_UPLOAD_URL = `${API_BASE_URL}/speech/upload`;
const SPEECH_TRANSCRIBE_URL = `${API_BASE_URL}/speech/transcribe`;
const SPEECH_ENTRIES_URL = `${API_BASE_URL}/speech_entries`;

// ==========================================
// SECTION: State Management
// ==========================================
let entries = [];
let speechEntries = [];
let trendChart = null;
let currentEditingEntry = null;
let currentMetric = 'weight-avg';
let currentTimeRange = 'week';
let compareMetric = null;
let isCumulative = false;
const typeFilters = new Set(['feed', 'susu', 'poti', 'temp', 'weight']);
let historyRange = { start: null, end: null };
let trendRange = { start: null, end: null };
const STORAGE_KEYS = {
    metric: 'tracker.metric',
    range: 'tracker.range',
    view: 'tracker.view',
    cumulative: 'tracker.cumulative'
};

// ==========================================
// SECTION: Speech Recording State
// ==========================================
let speechRecorder = null;
let speechStream = null;
let speechChunks = [];
let speechTimerInterval = null;
let speechStartTime = null;
let speechDraft = null;
let speechStatus = 'idle';
let selectedMimeType = 'audio/webm';

// Rotating placeholder prompts
const placeholderPrompts = [
    'Say: "50ml formula milk at 2pm"...',
    'Say: "Stool was soft and yellow"...',
    'Say: "Baby had susu just now"...',
    'Say: "Fed 60ml at lunch time"...',
    'Say: "Urine diaper at 3:30pm"...',
    'Say: "Temperature log of 98.6°F"...',
    'Say: "Weight entry of 4.312 Kg"...'
];
let currentPlaceholderIndex = 0;
let placeholderRotationInterval = null;

// Transcription polling state - using SSE for push notifications
let sseConnection = null;
let pendingSpeechEntries = new Set(); // Track entries waiting for transcription

// Diaper timer state
let diaperTimerInterval = null;
let lastDiaperChangeTime = null;
const DIAPER_ALERT_HOURS = 3; // Alert threshold in hours
let webhookConfig = { configured: false, webhook_url: null, diaper_alert_hours: 3 };
// Note: n8n handles recurring reminders every 15 minutes via backend polling

// Long-press / jiggle state (must be at top level so inline handlers can use them)
let longPressTimer = null;
const LONG_PRESS_DURATION_MS = 800;

// ==========================================
// SECTION: DOM Element References
// ==========================================
const entriesContainer = document.getElementById('entries-container');
const speechTimerEl = document.getElementById('speech-timer');
const speechStatusEl = document.getElementById('speech-status');
const speechBars = document.querySelectorAll('.speech-bar');
const speechStatusEls = document.querySelectorAll('[data-speech-status]');
const speechTimerEls = document.querySelectorAll('[data-speech-timer]');
const speechHeroRecordBtn = document.querySelector('[data-speech-record]');
const speechHeroStopBtn = document.querySelector('[data-speech-stop]');
const speechHeroCTA = document.querySelector('[data-speech-cta]');
const speechAudioEl = document.getElementById('speech-audio');
const speechTranscriptionEl = document.getElementById('speech-transcription');
const speechNotesEl = document.getElementById('speech-notes');
const speechCategoryEl = document.getElementById('speech-category');
const speechModeEl = document.getElementById('speech-mode');
const speechDurationEl = document.getElementById('speech-duration');
const speechDateEl = document.getElementById('speech-date');
const speechTimeEl = document.getElementById('speech-time');
const speechRecentEl = document.getElementById('speech-recent');

// Stats Elements
const todayFeedsEl = document.getElementById('today-feeds');
const totalFeedMlEl = document.getElementById('total-feed-ml');
const totalDiapersEl = document.getElementById('total-diapers');
const diaperTimerCard = document.getElementById('diaper-timer-card');
const diaperTimerDisplay = document.getElementById('diaper-timer-display');
const diaperTimerSubtitle = document.getElementById('diaper-timer-subtitle');
const diaperTimerIcon = document.getElementById('diaper-timer-icon');
const todaySusuEl = document.getElementById('today-susu');
const todayPotiEl = document.getElementById('today-poti');
const avgTempEl = document.getElementById('avg-temp');
const currentWeightEl = document.getElementById('current-weight');

// Mobile Stats Elements
const todayFeedsMobileEl = document.getElementById('today-feeds-mobile');
const totalDiapersMobileEl = document.getElementById('total-diapers-mobile');
const todaySusuMobileEl = document.getElementById('today-susu-mobile');
const todayPotiMobileEl = document.getElementById('today-poti-mobile');
const avgTempMobileEl = document.getElementById('avg-temp-mobile');
const currentWeightMobileEl = document.getElementById('current-weight-mobile');

// Helper function to get current datetime in local timezone
/**
 * Get the current date and time formatted for datetime-local inputs
 * @returns {Object} Object containing date (YYYY-MM-DD) and time (HH:mm)
 */
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`
    };
}

// Helper function to set current date/time for a form
/**
 * Set current date and time values in form inputs
 * @param {string} type - The entry type (feed, susu, poti, temp, weight)
 */
function setCurrentDateTime(type) {
    const { date, time } = getCurrentDateTime();
    document.getElementById(`${type}-date`).value = date;
    document.getElementById(`${type}-time`).value = time;
}

// Diaper Timer Functions
/**
 * Fetch notification webhook configuration from the backend
 * @async
 */
async function fetchWebhookConfig() {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications/webhook-config`);
        if (response.ok) {
            webhookConfig = await response.json();
            console.log('Webhook config loaded:', webhookConfig);
        }
    } catch (error) {
        console.error('Error fetching webhook config:', error);
    }
}

/**
 * Retrieve notification state from localStorage
 * @returns {Object} Notification state object
 */
function getNotificationState() {
    try {
        const state = localStorage.getItem('diaperNotificationState');
        return state ? JSON.parse(state) : {};
    } catch {
        return {};
    }
}

/**
 * Save notification state to localStorage
 * @param {Object} state - Notification state to persist
 */
function saveNotificationState(state) {
    try {
        localStorage.setItem('diaperNotificationState', JSON.stringify(state));
    } catch (error) {
        console.error('Error saving notification state:', error);
    }
}

/**
 * Send diaper/nappy change notification via n8n webhook
 * @async
 * @param {number} hours - Hours since last diaper change
 * @param {Date} lastChangeTime - Timestamp of last diaper change
 * @param {boolean} isNewEntry - Whether this is triggered by a new entry
 * @returns {Promise<boolean>} Success status
 */
async function sendDiaperNappyNotification(hours, lastChangeTime, isNewEntry = false) {
    if (!webhookConfig.configured) {
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

    const thresholdHours = webhookConfig.diaper_alert_hours || DIAPER_ALERT_HOURS;
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

        message = `⚠️ Diaper Alert: It's been 4 hours since the last diaper change. Last change was at ${timeStr} on ${dateStr}.`;
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
        const response = await fetch(`${API_BASE_URL}/notifications/send`, {
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
 * Format elapsed time since a given timestamp
 * @param {Date} timestamp - Starting timestamp
 * @returns {string} Formatted time string (e.g., "2h 30m")
 */
function formatTimeSince(timestamp) {
    if (!timestamp) return { hours: 0, minutes: 0, display: '--:--' };
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;
    const display = `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return { hours, minutes, display };
}

/**
 * Update the diaper timer display with current elapsed time and visual state
 * Changes card colors based on elapsed time thresholds
 */
function updateDiaperNappyTimerDisplay() {
    if (!lastDiaperChangeTime) {
        diaperTimerDisplay.textContent = '--:--';
        diaperTimerSubtitle.textContent = 'No changes yet';
        // Reset to neutral state
        diaperTimerCard.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all duration-300';
        diaperTimerIcon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center transition-colors duration-300';
        diaperTimerIcon.innerHTML = `
<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
</svg>
`;
        diaperTimerDisplay.className = 'text-2xl font-semibold text-slate-900';
        diaperTimerSubtitle.className = 'text-[10px] text-slate-400 mt-0.5';

        const state = getNotificationState();
        if (state.lastNotifiedTimestamp) {
            saveNotificationState({});
        }
        return;
    }

    const { hours, display } = formatTimeSince(lastDiaperChangeTime);
    diaperTimerDisplay.textContent = display;

    const lastChangeDate = new Date(lastDiaperChangeTime);
    const timeStr = lastChangeDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const alertThreshold = webhookConfig.diaper_alert_hours || DIAPER_ALERT_HOURS;

    // Smart status coloring
    if (hours >= alertThreshold) {
        // Overdue - Red alert
        diaperTimerCard.className = 'bg-white p-4 rounded-xl shadow-sm border-2 border-red-200 transition-all duration-300';
        diaperTimerIcon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center transition-colors duration-300';
        diaperTimerIcon.innerHTML = `
<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
</svg>
`;
        diaperTimerDisplay.className = 'text-2xl font-semibold text-red-600';
        diaperTimerSubtitle.textContent = `⚠️ Last: ${timeStr}`;
        diaperTimerSubtitle.className = 'text-[10px] text-red-500 mt-0.5 font-medium';

        const state = getNotificationState();
        if (state.lastNotifiedTimestamp !== lastDiaperChangeTime) {
            console.log('Diaper/Nappy overdue detected - sending notification');
            sendDiaperNappyNotification(hours, lastDiaperChangeTime).then(success => {
                if (success) {
                    saveNotificationState({ lastNotifiedTimestamp: lastDiaperChangeTime });
                }
            });
        }
    } else if (hours >= alertThreshold * 0.75) {
        // Warning - Amber
        diaperTimerCard.className = 'bg-white p-4 rounded-xl shadow-sm border border-amber-200 transition-all duration-300';
        diaperTimerIcon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center transition-colors duration-300';
        diaperTimerIcon.innerHTML = `
<svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
</svg>
`;
        diaperTimerDisplay.className = 'text-2xl font-semibold text-amber-600';
        diaperTimerSubtitle.textContent = `Last: ${timeStr}`;
        diaperTimerSubtitle.className = 'text-[10px] text-amber-500 mt-0.5';

        const state = getNotificationState();
        if (state.lastNotifiedTimestamp) {
            saveNotificationState({});
        }
    } else {
        // Normal - Neutral
        diaperTimerCard.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all duration-300';
        diaperTimerIcon.className = 'flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center transition-colors duration-300';
        diaperTimerIcon.innerHTML = `
<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
</svg>
`;
        diaperTimerDisplay.className = 'text-2xl font-semibold text-emerald-600';
        diaperTimerSubtitle.textContent = `Last: ${timeStr}`;
        diaperTimerSubtitle.className = 'text-[10px] text-slate-400 mt-0.5';

        const state = getNotificationState();
        if (state.lastNotifiedTimestamp) {
            saveNotificationState({});
        }
    }
}

/**
 * Start the diaper timer interval to update the display every 30 seconds
 */
function startDiaperTimer() {
    // Clear existing timer if any
    if (diaperTimerInterval) {
        clearInterval(diaperTimerInterval);
    }

    // Update immediately
    updateDiaperNappyTimerDisplay();

    // Update every 30 seconds
    diaperTimerInterval = setInterval(updateDiaperNappyTimerDisplay, 30000);
}

/**
 * Find the most recent diaper change entry from entries array
 * @returns {Object|null} Most recent susu or poti entry, or null if none found
 */
function findLastDiaperChange() {
    // Find most recent entry with susu_count OR poti_count > 0
    const diaperEntries = entries
        .filter(e => (e.susu_count && e.susu_count > 0) || (e.poti_count && e.poti_count > 0))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (diaperEntries.length > 0) {
        lastDiaperChangeTime = diaperEntries[0].timestamp;
    } else {
        lastDiaperChangeTime = null;
    }

    startDiaperTimer();
}

// Generic note metadata parser for "Label: value" prefixes
/**
 * Parse a specific field from note text with optional validation
 * @param {string} noteText - Full note text to parse
 * @param {string} label - Field label to search for
 * @param {Array<string>} validValues - Optional array of valid values for validation
 * @returns {string|null} Parsed value or null if not found/invalid
 */
function parseNoteField(noteText, label, validValues = []) {
    if (!noteText) return { value: null, remaining: '', error: null };
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedLabel}:\\s*([^\\.\\n]+)\\.?\\s*(.*)`, 'i');
    const match = noteText.match(regex);
    if (!match) return { value: null, remaining: noteText.trim(), error: null };

    const value = match[1].trim().toLowerCase();
    const remaining = (match[2] || '').trim();

    if (validValues.length && !validValues.includes(value)) {
        const errorMessage = `Unexpected ${label.toLowerCase()} value: ${value}. Expected one of: ${validValues.join(', ')}`;
        console.warn(errorMessage);
        return { value: null, remaining: noteText.trim(), error: errorMessage };
    }

    return { value, remaining, error: null };
}

// Rebuild notes with structured metadata prefixes so we can parse later
/**
 * Build complete notes string from metadata parts and free text
 * @param {Array<string>} metadataParts - Array of metadata strings
 * @param {string} freeText - User-entered free text
 * @returns {string} Combined notes string
 */
function buildNotes(metadataParts, freeText) {
    const meta = metadataParts
        .filter(part => part.value)
        .map(part => `${part.label}: ${part.value}`)
        .join('. ');
    const text = freeText?.trim();
    return [meta, text].filter(Boolean).join('. ').trim();
}

// Parse susu notes to extract item type, urine color, and remaining text
/**
 * Parse susu (wet diaper) specific fields from notes
 * @param {string} noteText - Note text to parse
 * @returns {Object} Object containing color, susu_count
 */
function parseSusuNotes(noteText) {
    if (!noteText) return { itemType: null, color: null, text: '', errors: [] };

    const itemParsed = parseNoteField(noteText, 'Item', ['diaper', 'nappy']);
    const colorParsed = parseNoteField(itemParsed.remaining, 'Urine color', ['clear', 'pale_yellow', 'dark_yellow', 'orange', 'red']);

    return {
        itemType: itemParsed.value,
        color: colorParsed.value,
        text: colorParsed.remaining || itemParsed.remaining,
        errors: [itemParsed.error, colorParsed.error].filter(Boolean)
    };
}

// Parse poti notes to extract item type, consistency, and free-text notes
// Valid consistency values are: loose, soft, normal, hard, watery
/**
 * Parse poti (soiled diaper) specific fields from notes
 * @param {string} noteText - Note text to parse
 * @returns {Object} Object containing color, consistency, poti_count
 */
function parsePotiNotes(noteText) {
    if (!noteText) return { itemType: null, consistency: null, text: '', errors: [] };

    const itemParsed = parseNoteField(noteText, 'Item', ['diaper', 'nappy']);
    const consistencyParsed = parseNoteField(itemParsed.remaining, 'Consistency', ['loose', 'soft', 'normal', 'hard', 'watery']);

    return {
        itemType: itemParsed.value,
        consistency: consistencyParsed.value,
        text: consistencyParsed.remaining || itemParsed.remaining,
        errors: [itemParsed.error, consistencyParsed.error].filter(Boolean)
    };
}

function formatItemSubtitle(count, descriptor, itemType) {
    const base = itemType === 'nappy' ? 'nappy' : itemType === 'diaper' ? 'diaper' : 'item';
    const pluralBase = count === 1 ? base : `${base}s`;
    return `${count} ${descriptor} ${pluralBase}`;
}

// Helper function to combine date and time inputs
// Return a local-naive timestamp string so the backend treats it as local time
/**
 * Get timestamp from date/time form inputs
 * @param {string} type - Entry type (feed, susu, poti, etc.)
 * @returns {Date} Parsed date object
 */
function getTimestampFromInputs(type) {
    const date = document.getElementById(`${type}-date`).value;
    const time = document.getElementById(`${type}-time`).value;
    return `${date}T${time}`;
}

/**
 * Parse date and time strings into a Date object
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeStr - Time string (HH:mm)
 * @param {boolean} asRangeEnd - If true, set time to end of day
 * @returns {Date} Parsed date object
 */
function parseDateTime(dateStr, timeStr, asRangeEnd = false) {
    if (!dateStr || !timeStr) return null;
    const ts = new Date(`${dateStr}T${timeStr}`);
    if (isNaN(ts)) return null;
    if (asRangeEnd) ts.setSeconds(59, 999); // make end inclusive
    else ts.setSeconds(0, 0);
    return ts;
}

// Format a Date object as local datetime string (YYYY-MM-DDTHH:mm:ss) without timezone
// This ensures the backend interprets it as local time, not UTC
/**
 * Format a Date object for backend API (ISO 8601 format)
 * @param {Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
function formatDateTimeForBackend(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

// Format milliseconds into mm:ss
/**
 * Format milliseconds as minutes and seconds
 * @param {number} ms - Milliseconds to format
 * @returns {string} Formatted duration (e.g., "2:30")
 */
function formatDuration(ms = 0) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

// Determine entry type for filtering and UI labeling
function getEntryType(entry) {
    if (entry.type === 'speech' || entry.audioUrl || entry.mode === 'speech') return 'speech';
    if (entry.feed_amount || entry.feed_type) return 'feed';
    if (entry.susu_count > 0) return 'susu';
    if (entry.poti_count > 0) return 'poti';
    if (entry.temperature) return 'temp';
    if (entry.weight) return 'weight';
    return 'unknown';
}

function getEntryItemType(entry) {
    if (entry.susu_count > 0) {
        return parseSusuNotes(entry.notes).itemType;
    }
    if (entry.poti_count > 0) {
        return parsePotiNotes(entry.notes).itemType;
    }
    return null;
}

// --- Speech Recording Helpers ---
function startPlaceholderRotation() {
    if (placeholderRotationInterval) return; // Already running

    const placeholder = document.getElementById('speech-placeholder');
    if (!placeholder) return;

    // Set initial prompt
    placeholder.textContent = placeholderPrompts[currentPlaceholderIndex];

    placeholderRotationInterval = setInterval(() => {
        if (speechStatus !== 'idle') {
            stopPlaceholderRotation();
            return;
        }

        placeholder.classList.add('fade-out');

        setTimeout(() => {
            currentPlaceholderIndex = (currentPlaceholderIndex + 1) % placeholderPrompts.length;
            placeholder.textContent = placeholderPrompts[currentPlaceholderIndex];
            placeholder.classList.remove('fade-out');
        }, 300);
    }, 4000); // Rotate every 4 seconds
}

function stopPlaceholderRotation() {
    if (placeholderRotationInterval) {
        clearInterval(placeholderRotationInterval);
        placeholderRotationInterval = null;
    }
}

function resetSpeechBars(active = false) {
    speechBars.forEach(bar => {
        const height = active ? 30 + Math.random() * 50 : 8;
        bar.style.height = `${Math.round(height)}%`;
        bar.style.backgroundColor = active ? '#fb7185' : '#e2e8f0';
    });
}

function updateSpeechUI() {
    const duration = speechDraft?.duration_ms || (speechStartTime ? Date.now() - speechStartTime : 0);
    const durationText = formatDuration(duration);
    if (speechTimerEl) speechTimerEl.textContent = durationText;
    speechTimerEls.forEach(el => el.textContent = durationText);
    if (speechDurationEl) speechDurationEl.value = durationText;

    const statusCopy = {
        idle: 'Ready to record',
        recording: 'Recording...',
        paused: 'Paused',
        stopped: 'Stopped'
    };
    const statusText = statusCopy[speechStatus] || 'Ready to record';
    if (speechStatus !== 'idle' && speechStatusEl) {
        speechStatusEl.textContent = statusText;
    }
    speechStatusEls.forEach(el => {
        if (speechStatus !== 'idle') {
            el.textContent = statusText;
        }
        el.style.opacity = 1;
    });

    const recordBtn = document.getElementById('speech-record-btn');
    const pauseBtn = document.getElementById('speech-pause-btn');
    const resumeBtn = document.getElementById('speech-resume-btn');
    const stopBtn = document.getElementById('speech-stop-btn');

    const showRecord = speechStatus === 'idle' || speechStatus === 'stopped';
    const showStop = speechStatus === 'recording' || speechStatus === 'paused';
    const showCTA = speechStatus === 'stopped';

    if (recordBtn) {
        recordBtn.disabled = speechStatus === 'recording';
        recordBtn.classList.toggle('hidden', !showRecord);
    }
    if (pauseBtn) pauseBtn.disabled = speechStatus !== 'recording';
    if (resumeBtn) resumeBtn.disabled = speechStatus !== 'paused';
    if (stopBtn) {
        stopBtn.disabled = speechStatus === 'idle';
        stopBtn.classList.toggle('hidden', !showStop);
    }

    if (speechHeroRecordBtn) {
        speechHeroRecordBtn.disabled = speechStatus === 'recording';
        speechHeroRecordBtn.classList.toggle('hidden', !showRecord);
    }
    if (speechHeroStopBtn) {
        speechHeroStopBtn.disabled = speechStatus === 'idle';
        speechHeroStopBtn.classList.toggle('hidden', !showStop);
    }
    if (speechHeroCTA) {
        // Only show CTA when stopped (Save/Discard). Otherwise keep area empty to preserve rotating prompts.
        speechHeroCTA.className = 'flex items-center gap-2 flex-shrink-0';
        speechHeroCTA.classList.toggle('hidden', !showCTA);

        if (showCTA) {
            // Apple-style Save & Discard buttons
            speechHeroCTA.innerHTML = `
<button onclick="discardSpeech()" 
class="px-3 py-1.5 rounded-lg font-medium text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-all"
aria-label="Discard">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
</svg>
<span>Discard</span>
</button>
<button onclick="saveSpeechEntry()" 
class="px-3 py-1.5 rounded-lg font-medium text-sm text-white bg-blue-500 hover:bg-blue-600 flex items-center gap-1.5 transition-all"
aria-label="Save">
<span>Save</span>
</button>
`;
        } else {
            speechHeroCTA.innerHTML = '';
        }
    }

    if (speechAudioEl) {
        const url = speechDraft?.audioUrl || speechDraft?.audio_url;
        if (url) {
            speechAudioEl.src = url;
            speechAudioEl.classList.remove('hidden');
        } else {
            speechAudioEl.pause();
            speechAudioEl.removeAttribute('src');
            speechAudioEl.classList.add('hidden');
        }
    }

    // Show/hide retranscribe button in modal (if audio exists on server)
    const retranscribeBtn = document.getElementById('speech-retranscribe-modal-btn');
    if (retranscribeBtn) {
        if (speechDraft?.object_key || (speechDraft?.audio_url && !speechDraft?.audio_url.startsWith('blob:'))) {
            retranscribeBtn.classList.remove('hidden');
        } else {
            retranscribeBtn.classList.add('hidden');
        }
    }
}

function stopSpeechTimer() {
    if (speechTimerInterval) {
        clearInterval(speechTimerInterval);
        speechTimerInterval = null;
    }
}

/**
 * Handle stopping speech recording and initiate transcription
 * Uploads audio to backend and polls for transcription results
 */
function handleSpeechStop() {
    stopSpeechTimer();
    const duration = speechStartTime ? Date.now() - speechStartTime : 0;
    const blob = speechChunks.length ? new Blob(speechChunks, { type: selectedMimeType }) : null;
    const audioUrl = blob ? URL.createObjectURL(blob) : null;

    // Determine extension based on MIME type
    let ext = 'webm';
    if (selectedMimeType.includes('mp4') || selectedMimeType.includes('aac')) {
        ext = 'mp4';
    } else if (selectedMimeType.includes('ogg')) {
        ext = 'ogg';
    } else if (selectedMimeType.includes('wav')) {
        ext = 'wav';
    }

    const filename = `speech_${Date.now()}.${ext}`;

    speechDraft = {
        ...(speechDraft || {}),
        id: speechDraft?.id || `speech-${Date.now()}`,
        type: 'speech',
        duration_ms: duration,
        audioUrl,
        blob,
        filename
    };
    speechStatus = 'stopped';
    resetSpeechBars(false);
    updateSpeechUI();
    showToast('Recording stopped', 'info');
}

/**
 * Start speech recording via microphone
 * Initializes MediaRecorder and begins capturing audio
 * @async
 */
async function startSpeechRecording() {
    try {
        // Check for Secure Context first
        if (window.isSecureContext === false) {
            const msg = "Microphone requires HTTPS or localhost. If testing on mobile via IP, this will fail.";
            console.error(msg);
            alert(msg);
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast('Microphone API not supported in this browser.', 'error');
            return;
        }

        speechStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Detect supported MIME type
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/aac',
            'audio/ogg;codecs=opus',
            'audio/wav'
        ];

        selectedMimeType = 'audio/webm'; // fallback
        let options = {};

        for (const type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                selectedMimeType = type;
                options = { mimeType: type };
                break;
            }
        }

        console.log('Using MIME type:', selectedMimeType);

        try {
            speechRecorder = new MediaRecorder(speechStream, options);
        } catch (e) {
            // Fallback to default if options fail
            console.warn('MediaRecorder failed with options, trying default', e);
            speechRecorder = new MediaRecorder(speechStream);
            selectedMimeType = speechRecorder.mimeType || 'audio/webm';
        }

        speechChunks = [];

        speechRecorder.ondataavailable = (e) => {
            if (e.data?.size > 0) speechChunks.push(e.data);
        };
        speechRecorder.onstop = handleSpeechStop;

        speechRecorder.onerror = (e) => {
            console.error('Recorder error:', e);
            showToast('Recording error: ' + (e.error?.message || 'Unknown'), 'error');
        };

        speechRecorder.start();
        speechStartTime = Date.now();
        speechStatus = 'recording';
        resetSpeechBars(true);
        speechTimerInterval = setInterval(() => {
            resetSpeechBars(true);
            updateSpeechUI();
        }, 300);
        updateSpeechUI();
    } catch (err) {
        console.error('Mic error', err);
        const msg = err.name + ': ' + err.message;
        showToast('Mic Error: ' + msg, 'error');

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            alert('Microphone permission was denied. Please check your browser settings.');
        } else if (err.name === 'NotFoundError') {
            alert('No microphone found on this device.');
        }
    }
}

function pauseSpeechRecording() {
    if (speechRecorder && speechRecorder.state === 'recording') {
        speechRecorder.pause();
        speechStatus = 'paused';
        resetSpeechBars(false);
        updateSpeechUI();
    }
}

function resumeSpeechRecording() {
    if (speechRecorder && speechRecorder.state === 'paused') {
        speechRecorder.resume();
        speechStatus = 'recording';
        resetSpeechBars(true);
        updateSpeechUI();
    }
}

function stopSpeechRecording() {
    if (speechRecorder && speechRecorder.state !== 'inactive') {
        speechRecorder.stop();
        // handleSpeechStop will be called by the onstop event
    } else if (speechStatus === 'recording' || speechStatus === 'paused') {
        // If recorder is inactive but we're in recording/paused state, manually trigger stop
        handleSpeechStop();
    } else {
        // No recording to stop
        speechStatus = 'idle';
        updateSpeechUI();
    }
    if (speechStream) {
        speechStream.getTracks().forEach(track => track.stop());
        speechStream = null;
    }
}

async function hydrateSpeechTranscription(force = false) {
    // Transcription now happens automatically in the background after saving
    // This function is kept for backward compatibility but just shows a message
    showToast('Transcription will happen automatically after saving', 'info');
}

function clearSpeechDraft() {
    if (speechTranscriptionEl) speechTranscriptionEl.value = '';
    if (speechNotesEl) speechNotesEl.value = '';
}

function resetSpeechState() {
    stopSpeechTimer();
    if (speechRecorder && speechRecorder.state !== 'inactive') {
        try { speechRecorder.stop(); } catch (err) { console.warn(err); }
    }
    if (speechStream) {
        speechStream.getTracks().forEach(track => track.stop());
        speechStream = null;
    }
    speechRecorder = null;
    speechChunks = [];
    speechStartTime = null;
    speechDraft = null;
    speechStatus = 'idle';
    resetSpeechBars(false);
    updateSpeechUI();
    startPlaceholderRotation();
}

// Server-Sent Events (SSE) for real-time transcription updates
function initializeSSE() {
    console.log('🔌 Initializing SSE connection...');
    // Close existing connection if any
    if (sseConnection) {
        sseConnection.close();
    }

    const sseUrl = `${API_BASE_URL}/events/transcription`;
    console.log('📡 Connecting to SSE endpoint:', sseUrl);

    // Create new SSE connection
    sseConnection = new EventSource(sseUrl);


    sseConnection.onopen = () => {
        console.log(`[${new Date().toISOString()}] ✅ SSE connection established`);
    };

    // Log generic messages (e.g., initial connected payload)
    sseConnection.onmessage = (event) => {
        console.log(`[${new Date().toISOString()}] 📨 SSE message`, event.data);
    };

    // Listen for transcription complete events
    sseConnection.addEventListener('transcription_complete', async (event) => {
        try {
            console.log(`[${new Date().toISOString()}] 📨 transcription_complete raw`, event.data);
            const data = JSON.parse(event.data);
            console.log(`[${new Date().toISOString()}] 📨 transcription_complete`, data);

            const { speech_entry_id, success } = data;

            // Remove from pending set
            pendingSpeechEntries.delete(speech_entry_id);

            if (success) {
                // Refresh speech entries to show new transcription
                await refreshSpeechEntries();
                showToast('Transcription complete!', 'success');
            } else {
                showToast('Transcription failed', 'error');
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] ❌ transcription_complete handler error`, err, event.data);
        }
    });

    // Listen for auto-mapping complete events
    sseConnection.addEventListener('mapping_complete', async (event) => {
        try {
            console.log(`[${new Date().toISOString()}] 📨 mapping_complete raw`, event.data);
            const data = JSON.parse(event.data);
            console.log(`[${new Date().toISOString()}] 📨 mapping_complete`, data);

            const { entry_id, success } = data;

            if (success) {
                // Refresh both speech entries (for notes update) and regular entries (for new entry)
                await Promise.all([
                    refreshSpeechEntries(),
                    loadEntries()
                ]);
                showToast(`Auto-mapped to entry #${entry_id}!`, 'success');
            } else {
                // Still refresh to show updated notes
                await refreshSpeechEntries();
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] ❌ mapping_complete handler error`, err, event.data);
        }
    });

    sseConnection.onerror = (error) => {
        console.error(`[${new Date().toISOString()}] ❌ SSE connection error`, error);
        console.log('SSE readyState:', sseConnection?.readyState);
        // Start fallback polling if there are pending entries
        if (pendingSpeechEntries.size > 0) {
            console.log('⚠️ SSE failed, starting fallback polling');
            startFallbackPolling();
        }
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
            console.log('🔄 Reconnecting SSE...');
            stopFallbackPolling(); // Stop fallback when reconnecting
            initializeSSE();
        }, 5000);
    };
}

// Helper to refresh speech entries without full page reload
async function refreshSpeechEntries() {
    try {
        const response = await fetch(SPEECH_ENTRIES_URL);
        if (response.ok) {
            speechEntries = await response.json();
            renderSpeechRecent();
            console.log('🔄 Speech entries refreshed');
        }
    } catch (error) {
        console.error('Failed to refresh speech entries:', error);
    }
}

// Fallback polling for when SSE is not available or fails
let fallbackPollingInterval = null;

function startFallbackPolling() {
    if (pendingSpeechEntries.size === 0) return;

    // Stop any existing polling
    stopFallbackPolling();

    console.log('⏰ Starting fallback polling for:', Array.from(pendingSpeechEntries));

    fallbackPollingInterval = setInterval(async () => {
        if (pendingSpeechEntries.size === 0) {
            stopFallbackPolling();
            return;
        }

        console.log('🔍 Fallback polling... pending:', pendingSpeechEntries.size);
        await refreshSpeechEntries();
        await loadEntries();
    }, 5000); // Poll every 5 seconds as fallback
}

function stopFallbackPolling() {
    if (fallbackPollingInterval) {
        clearInterval(fallbackPollingInterval);
        fallbackPollingInterval = null;
        console.log('⏹️ Stopped fallback polling');
    }
}

function discardSpeech() {
    resetSpeechState();
    closeModal('speech');
}

async function saveSpeechEntry() {
    if (!speechDraft) {
        showToast('Record a clip before saving.', 'error');
        return;
    }

    const ts = parseDateTime(speechDateEl?.value, speechTimeEl?.value) || new Date();
    let uploadResult = null;
    let objectKey = speechDraft.object_key;
    let audioUrl = speechDraft.audioUrl || speechDraft.audio_url;

    if (speechDraft.blob && !speechDraft.object_key) {
        const formData = new FormData();
        formData.append('file', speechDraft.blob, speechDraft.filename || 'speech.webm');
        formData.append('duration_ms', speechDraft.duration_ms || 0);
        formData.append('timestamp', ts.toISOString());
        formData.append('category', speechCategoryEl?.value || 'general');
        formData.append('mode', speechModeEl?.value || 'auto');
        formData.append('notes', speechNotesEl?.value?.trim() || '');

        try {
            const uploadResp = await fetch(SPEECH_UPLOAD_URL, { method: 'POST', body: formData });
            if (!uploadResp.ok) {
                const errorPayload = await uploadResp.json().catch(() => ({}));
                throw new Error(errorPayload.error || 'Upload failed');
            }
            uploadResult = await uploadResp.json();
            objectKey = uploadResult.object_key;
            audioUrl = uploadResult.url;
        } catch (err) {
            console.error('Speech upload error', err);
            showToast('Upload failed. Please try again.', 'error');
            return;
        }
    }

    if (!objectKey) {
        showToast('Missing audio object. Please record again.', 'error');
        return;
    }

    // Get transcription from the input field if manually entered, otherwise leave empty
    // Backend will handle async transcription
    const transcription = speechTranscriptionEl?.value?.trim() || '';

    const payload = {
        object_key: objectKey,
        audio_url: audioUrl,
        transcription,
        category: speechCategoryEl?.value || 'general',
        mode: speechModeEl?.value || 'auto',
        duration_ms: speechDraft.duration_ms || 0,
        notes: speechNotesEl?.value?.trim() || '',
        timestamp: ts.toISOString()
    };

    try {
        const isEdit = Boolean(currentEditingEntry && currentEditingEntry.id);
        const resp = await fetch(isEdit ? `${SPEECH_ENTRIES_URL}/${currentEditingEntry.id}` : SPEECH_ENTRIES_URL, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error('save failed');
        const saved = await resp.json();
        speechEntries = [saved, ...speechEntries.filter(e => e.id !== saved.id)];
        renderSpeechRecent();
        renderEntries();

        // Show message about transcription status
        if (!transcription) {
            showToast('Speech saved. Waiting for transcription...', 'success');
            // Track this entry as pending
            pendingSpeechEntries.add(saved.id);
        } else {
            showToast('Speech saved.', 'success');
        }

        resetSpeechState();
        closeModal('speech');
    } catch (err) {
        console.error(err);
        showToast('Could not save speech entry', 'error');
    }
}

function renderSpeechRecent() {
    if (!speechRecentEl) return;
    if (!speechEntries.length) {
        speechRecentEl.innerHTML = '<p class="text-slate-500 text-sm">No speech clips yet.</p>';
        return;
    }

    const rows = speechEntries.slice(0, 3).map(entry => {
        const ts = new Date(entry.timestamp);
        const displayText = entry.transcription
            ? entry.transcription
            : '<span class="text-indigo-500 italic flex items-center gap-1"><svg class="animate-spin h-3 w-3 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Transcribing...</span>';
        return `
<div class="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
<div class="flex-1 min-w-0">
<p class="text-sm font-semibold text-slate-800 truncate">${displayText}</p>
<p class="text-xs text-slate-500">${formatDuration(entry.duration_ms)} · ${ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
</div>
${(entry.audioUrl || entry.audio_url) ? `<audio controls src="${entry.audioUrl || entry.audio_url}" class="ml-3 w-28"></audio>` : ''}
</div>
`;
    }).join('');

    speechRecentEl.innerHTML = rows;
}

// ==========================================
// SECTION: Modal Management
// ==========================================
function openModal(type, entry = null) {
    currentEditingEntry = entry;
    const modal = document.getElementById(`${type}-modal`);
    if (type === 'speech') {
        resetSpeechState();
        renderSpeechRecent();
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Update modal title
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
        const originalTitle = modalTitle.textContent.replace('Edit ', '');
        modalTitle.textContent = entry ? `Edit ${originalTitle}` : originalTitle;
    }

    if (entry) {
        // Pre-fill form with entry data
        const entryDate = new Date(entry.timestamp);
        // Use local date parts to avoid UTC shift when prefilling
        const year = entryDate.getFullYear();
        const month = String(entryDate.getMonth() + 1).padStart(2, '0');
        const day = String(entryDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const timeStr = entryDate.toTimeString().slice(0, 5);

        document.getElementById(`${type}-date`).value = dateStr;
        document.getElementById(`${type}-time`).value = timeStr;

        // Fill type-specific fields
        if (type === 'feed') {
            if (entry.feed_type) document.getElementById('feed-type').value = entry.feed_type;
            if (entry.feed_amount) document.getElementById('feed-amount').value = entry.feed_amount;
            if (entry.notes) document.getElementById('feed-notes').value = entry.notes;
        } else if (type === 'susu') {
            if (entry.susu_count) document.getElementById('susu-count').value = entry.susu_count;
            const { itemType, color, text } = parseSusuNotes(entry.notes);
            if (itemType) document.getElementById('susu-item-type').value = itemType;
            if (color) document.getElementById('susu-color').value = color;
            if (text) {
                document.getElementById('susu-notes').value = text;
            } else if (entry.notes && !color && !itemType) {
                document.getElementById('susu-notes').value = entry.notes;
            }
        } else if (type === 'poti') {
            if (entry.poti_count) document.getElementById('poti-count').value = entry.poti_count;
            if (entry.poti_color) document.getElementById('poti-color').value = entry.poti_color;
            const { itemType, consistency, text } = parsePotiNotes(entry.notes);
            if (itemType) document.getElementById('poti-item-type').value = itemType;
            if (consistency) {
                document.getElementById('poti-consistency').value = consistency;
            }
            if (text) {
                document.getElementById('poti-notes').value = text;
            } else if (entry.notes && !consistency && !itemType) {
                document.getElementById('poti-notes').value = entry.notes;
            }
        } else if (type === 'temp') {
            if (entry.temperature) document.getElementById('temp-value').value = entry.temperature;
            if (entry.notes) document.getElementById('temp-notes').value = entry.notes;
        } else if (type === 'weight') {
            if (entry.weight) document.getElementById('weight-value').value = entry.weight;
            if (entry.notes) document.getElementById('weight-notes').value = entry.notes;
        } else if (type === 'speech') {
            if (entry.transcription && speechTranscriptionEl) speechTranscriptionEl.value = entry.transcription;
            if (entry.notes && speechNotesEl) speechNotesEl.value = entry.notes;
            if (speechCategoryEl && entry.category) speechCategoryEl.value = entry.category;
            if (speechModeEl && entry.mode) speechModeEl.value = entry.mode;
            speechDraft = { ...entry };
            speechStatus = 'stopped';
            if (entry.audioUrl && speechAudioEl) {
                speechAudioEl.src = entry.audioUrl;
                speechAudioEl.classList.remove('hidden');
            }
            updateSpeechUI();
        }
    } else {
        // Set current date/time when creating new entry
        setCurrentDateTime(type);
    }
}

function closeModal(type) {
    const modal = document.getElementById(`${type}-modal`);
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    const form = document.getElementById(`${type}-form`);
    if (form) form.reset();
    currentEditingEntry = null;

    // Reset modal title
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
        modalTitle.textContent = modalTitle.textContent.replace('Edit ', '');
    }

    // Hide temp warning if visible
    if (type === 'temp') {
        document.getElementById('temp-warning').classList.add('hidden');
    }

    if (type === 'speech') {
        resetSpeechState();
        renderSpeechRecent();
    }
}

// Close modal on background click
window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        const modals = ['feed', 'susu', 'poti', 'temp', 'weight', 'speech'];
        modals.forEach(type => {
            if (event.target.id === `${type}-modal`) {
                closeModal(type);
            }
        });
    }
};

// Temperature warning
document.getElementById('temp-value').addEventListener('input', (e) => {
    const temp = parseFloat(e.target.value);
    const warning = document.getElementById('temp-warning');
    if (temp >= 38) {
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPlaceholderRotation();
    if (diaperTimerInterval) {
        clearInterval(diaperTimerInterval);
    }
    if (speechStream) {
        speechStream.getTracks().forEach(track => track.stop());
    }
    stopFallbackPolling();
    if (sseConnection) {
        sseConnection.close();
    }
});

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    // Start placeholder rotation
    startPlaceholderRotation();

    // Stop any stale polling from previous sessions
    stopFallbackPolling();
    // Initialize SSE connection for real-time transcription updates
    const sseSupported = typeof EventSource !== 'undefined';
    if (sseSupported) {
        initializeSSE();
    } else {
        console.warn('SSE not supported in this browser. Using fallback polling.');
        startFallbackPolling();
    }

    // Reconnect SSE when returning to the tab
    document.addEventListener('visibilitychange', () => {
        if (!sseSupported) return;
        if (document.visibilityState === 'visible') {
            const closed = !sseConnection || sseConnection.readyState === EventSource.CLOSED;
            if (closed) {
                initializeSSE();
            }
        }
    });

    fetchWebhookConfig(); // Load webhook configuration
    restoreViewPrefs();

    // Initialize chart BEFORE setupHistoryRange() since it calls loadEntries() which needs the chart
    initTrendChart();
    setupTrendControls();

    // Setup ranges and controls before the first fetch so both history and trend pull the right window
    await setupHistoryRange();
    setupHistoryFilters();
    // Sync filter chip UI with typeFilters Set
    document.querySelectorAll('.filter-chip[data-type]').forEach(chip => {
        const type = chip.dataset.type;
        if (typeFilters.has(type)) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
    // Now load entries with both history and trend ranges established
    await loadEntries();
    setupMobileTabs();
    resetSpeechBars(false);
    updateSpeechUI();
    renderSpeechRecent();
});

// Feed Form Submit
document.getElementById('feed-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        feed_type: document.getElementById('feed-type').value,
        feed_amount: parseInt(document.getElementById('feed-amount').value) || null,
        notes: document.getElementById('feed-notes').value || null,
        timestamp: getTimestampFromInputs('feed')
    };

    await saveEntry(data, 'feed');
});

// Susu Form Submit
document.getElementById('susu-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        susu_count: parseInt(document.getElementById('susu-count').value),
        notes: buildNotes([
            { label: 'Item', value: document.getElementById('susu-item-type').value },
            { label: 'Urine color', value: document.getElementById('susu-color').value }
        ], document.getElementById('susu-notes').value),
        timestamp: getTimestampFromInputs('susu')
    };

    await saveEntry(data, 'susu');
});

// Poti Form Submit
document.getElementById('poti-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        poti_count: parseInt(document.getElementById('poti-count').value),
        poti_color: document.getElementById('poti-color').value,
        notes: buildNotes([
            { label: 'Item', value: document.getElementById('poti-item-type').value },
            { label: 'Consistency', value: document.getElementById('poti-consistency').value }
        ], document.getElementById('poti-notes').value),
        timestamp: getTimestampFromInputs('poti')
    };

    await saveEntry(data, 'poti');
});

// Temperature Form Submit
document.getElementById('temp-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        temperature: parseFloat(document.getElementById('temp-value').value),
        notes: document.getElementById('temp-notes').value || null,
        timestamp: getTimestampFromInputs('temp')
    };

    await saveEntry(data, 'temp');
});

// Weight Form Submit
document.getElementById('weight-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        weight: parseInt(document.getElementById('weight-value').value),
        notes: document.getElementById('weight-notes').value || null,
        timestamp: getTimestampFromInputs('weight')
    };

    await saveEntry(data, 'weight');
});

// Save Entry
async function saveEntry(data, type) {
    try {
        let response;

        if (currentEditingEntry) {
            // Update existing entry
            response = await fetch(`${API_BASE_URL}/entries/${currentEditingEntry.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create new entry
            response = await fetch(`${API_BASE_URL}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        }

        if (response.ok) {
            await response.json();
            closeModal(type);
            await loadEntries();
            // Always update trend chart after any entry change
            updateTrendChart();

            // Trigger notification for new diaper/nappy entries (not for edits)
            console.log('saveEntry completed:', {
                type,
                currentEditingEntry,
                data,
                isSusuWithCount: type === 'susu' && data.susu_count > 0,
                isPotiWithCount: type === 'poti' && data.poti_count > 0
            });

            if (!currentEditingEntry && ((type === 'susu' && data.susu_count > 0) || (type === 'poti' && data.poti_count > 0))) {
                console.log('New diaper/nappy entry created - sending notification to n8n');
                // Use the timestamp from the entry that was just created
                const entryTimestamp = data.timestamp;

                // Send notification immediately with the new entry's timestamp
                setTimeout(() => {
                    console.log('Sending notification with entry timestamp:', entryTimestamp);
                    // Calculate time since the entry was created (should be near 0)
                    const now = new Date();
                    const then = new Date(entryTimestamp);
                    const diffMs = now - then;
                    const hours = diffMs / 3600000;

                    sendDiaperNappyNotification(hours, entryTimestamp, true);
                }, 500); // Small delay to ensure findLastDiaperChange has run
            }

            showToast(currentEditingEntry ? 'Entry updated successfully!' : 'Entry saved successfully!', 'success');
        } else {
            throw new Error('Failed to save entry');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error saving entry. Please try again.', 'error');
    }
}

// Load Entries
async function loadEntries() {
    try {
        const params = new URLSearchParams();
        const rangeStarts = [historyRange?.start, trendRange?.start].filter(Boolean);
        const rangeEnds = [historyRange?.end, trendRange?.end].filter(Boolean);
        const fetchStart = rangeStarts.length ? rangeStarts.reduce((earliest, current) => current < earliest ? current : earliest) : null;
        const fetchEnd = rangeEnds.length ? rangeEnds.reduce((latest, current) => current > latest ? current : latest) : null;

        if (fetchStart) params.set('start', formatDateTimeForBackend(fetchStart));
        if (fetchEnd) params.set('end', formatDateTimeForBackend(fetchEnd));

        const query = params.toString() ? `?${params.toString()}` : '';
        const [entriesResp, speechResp] = await Promise.all([
            fetch(`${API_BASE_URL}/entries${query}`),
            fetch(`${API_BASE_URL}/speech_entries${query}`)
        ]);

        if (!entriesResp.ok || !speechResp.ok) {
            throw new Error('Failed to load entries');
        }

        entries = await entriesResp.json();
        speechEntries = await speechResp.json();

        renderEntries();
        updateStats();
        findLastDiaperChange(); // Initialize/update diaper timer
        updateTrendChart();
    } catch (error) {
        console.error('Error loading entries:', error);
        entriesContainer.innerHTML = '<p class="text-center text-red-500 py-8">Error loading entries. Make sure the backend server is running.</p>';
    }
}

// History filters
function setupHistoryFilters() {
    const chips = document.querySelectorAll('.filter-chip[data-type]');
    const LONG_PRESS_MS = 600;

    chips.forEach(chip => {
        let pressTimer = null;
        let longPressTriggered = false;

        const startPress = () => {
            longPressTriggered = false;
            pressTimer = setTimeout(() => {
                longPressTriggered = true;
                isolateFilter(chip.dataset.type);
            }, LONG_PRESS_MS);
        };

        const clearPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        chip.addEventListener('click', () => {
            if (longPressTriggered) return;
            toggleTypeFilter(chip);
        });

        chip.addEventListener('mousedown', startPress);
        chip.addEventListener('touchstart', startPress);
        chip.addEventListener('mouseup', clearPress);
        chip.addEventListener('mouseleave', clearPress);
        chip.addEventListener('touchend', clearPress);
        chip.addEventListener('touchcancel', clearPress);
    });
}

// History date/time range
async function setupHistoryRange() {
    // Initialize with Today
    await applyPreset('today');
}

function setupTrendControls() {
    const metricButtons = document.querySelectorAll('#metric-segment button');
    const aggregationSelect = document.getElementById('aggregation-select');
    const compareSelect = document.getElementById('compare-select');
    const cumulativeBadge = document.getElementById('cumulative-badge');
    const rangeLabel = document.getElementById('range-label');
    const trendStartInput = document.getElementById('trend-start-date');
    const trendEndInput = document.getElementById('trend-end-date');
    const applyTrendRangeBtn = document.getElementById('trend-apply-range');
    const presetTodayBtn = document.getElementById('trend-preset-today');
    const preset7Btn = document.getElementById('trend-preset-7');
    const preset30Btn = document.getElementById('trend-preset-30');
    const toggleCustomDateBtn = document.getElementById('toggle-custom-date');
    const customDatePanel = document.getElementById('custom-date-panel');

    const longPressMs = 600;

    const updateMetricButtonContent = (btn, showIcon) => {
        const label = btn.dataset.label || btn.textContent.trim();
        const icon = btn.dataset.icon;
        if (showIcon && icon) {
            btn.innerHTML = `<span class="mr-1">${icon}</span><span>${label}</span>`;
        } else {
            btn.textContent = label;
        }
    };

    function setCumulativeUI() {
        if (cumulativeBadge) {
            cumulativeBadge.classList.toggle('hidden', !isCumulative);
        }
        const activeBtn = document.querySelector('#metric-segment .metric-tab.active');
        document.querySelectorAll('#metric-segment .metric-tab').forEach(b => {
            b.classList.remove('cumulative-active');
            updateMetricButtonContent(b, false);
        });
        if (isCumulative && activeBtn) {
            activeBtn.classList.add('cumulative-active');
            updateMetricButtonContent(activeBtn, true);
            activeBtn.title = 'Cumulative view (long-press to toggle)';
        } else if (activeBtn) {
            activeBtn.title = 'Long-press to toggle cumulative';
        }
    }

    // Metric Buttons
    metricButtons.forEach(btn => {
        let pressTimer = null;
        let longPressHandled = false;

        const clearPress = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        btn.addEventListener('pointerdown', () => {
            longPressHandled = false;
            clearPress();
            pressTimer = setTimeout(() => {
                longPressHandled = true;
                isCumulative = !isCumulative;
                localStorage.setItem(STORAGE_KEYS.cumulative, isCumulative ? '1' : '0');
                setCumulativeUI();
                updateTrendChart();
            }, longPressMs);
        });

        ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
            btn.addEventListener(evt, clearPress);
        });

        btn.addEventListener('click', () => {
            if (longPressHandled) {
                longPressHandled = false;
                return;
            }
            metricButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMetric = btn.dataset.metric;
            localStorage.setItem(STORAGE_KEYS.metric, currentMetric);
            setCumulativeUI();
            updateTrendChart();
        });
    });

    // Aggregation Select
    if (aggregationSelect) {
        aggregationSelect.addEventListener('change', (e) => {
            currentTimeRange = e.target.value;
            localStorage.setItem(STORAGE_KEYS.range, currentTimeRange);
            updateTrendChart();
        });
    }

    // Compare Select
    if (compareSelect) {
        compareSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            compareMetric = val === 'none' ? null : val;
            updateTrendChart();
        });
    }
    // Custom Date Toggle
    if (toggleCustomDateBtn && customDatePanel) {
        toggleCustomDateBtn.addEventListener('click', () => {
            customDatePanel.classList.toggle('hidden');
        });
    }

    const applyTrendRange = async () => {
        const parsed = parseTrendRangeFromInputs(trendStartInput, trendEndInput);
        if (!parsed) return;
        clearPresetStates();
        trendRange = parsed;
        await loadEntries();
    };

    if (applyTrendRangeBtn) {
        applyTrendRangeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            applyTrendRangeBtn.disabled = true;
            await applyTrendRange();
            applyTrendRangeBtn.disabled = false;
        });
    }

    const autoApply = () => {
        if (trendStartInput.value && trendEndInput.value) {
            applyTrendRange();
        }
    };

    if (trendStartInput) trendStartInput.addEventListener('change', autoApply);
    if (trendEndInput) trendEndInput.addEventListener('change', autoApply);

    const clearPresetStates = () => {
        const activeClasses = ['bg-white', 'shadow-sm', 'text-slate-800'];
        const inactiveClasses = ['text-slate-600', 'hover:bg-white', 'hover:shadow-sm'];

        [presetTodayBtn, preset7Btn, preset30Btn].forEach(btn => {
            if (!btn) return;
            btn.classList.remove(...activeClasses);
            btn.classList.add(...inactiveClasses);
        });
    };

    const setPreset = async (days, btn) => {
        clearPresetStates();
        if (btn) {
            const activeClasses = ['bg-white', 'shadow-sm', 'text-slate-800'];
            const inactiveClasses = ['text-slate-600', 'hover:bg-white', 'hover:shadow-sm'];
            btn.classList.remove(...inactiveClasses);
            btn.classList.add(...activeClasses);
        }

        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);

        trendRange = { start, end };
        setTrendRangeInputs(trendStartInput, trendEndInput, start, end);
        updateRangeLabel(rangeLabel, formatRangeLabel(start, end));
        await loadEntries();
    };

    if (presetTodayBtn) presetTodayBtn.addEventListener('click', async (e) => { e.preventDefault(); await setPreset(1, presetTodayBtn); });
    if (preset7Btn) preset7Btn.addEventListener('click', async (e) => { e.preventDefault(); await setPreset(7, preset7Btn); });
    if (preset30Btn) preset30Btn.addEventListener('click', async (e) => { e.preventDefault(); await setPreset(30, preset30Btn); });

    // Restore State
    const storedMetric = localStorage.getItem(STORAGE_KEYS.metric);
    const storedRange = localStorage.getItem(STORAGE_KEYS.range);
    const storedCumulative = localStorage.getItem(STORAGE_KEYS.cumulative);

    if (storedMetric) {
        currentMetric = storedMetric;
        metricButtons.forEach(b => b.classList.toggle('active', b.dataset.metric === currentMetric));
    }

    if (storedRange && aggregationSelect) {
        currentTimeRange = storedRange;
        aggregationSelect.value = currentTimeRange;
    }

    if (storedCumulative === '1') {
        isCumulative = true;
    }
    setCumulativeUI();

    // Default to 7 days
    setDefaultTrendRange(trendStartInput, trendEndInput, rangeLabel, preset7Btn);
}

function setupMobileTabs() {
    const tabLog = document.getElementById('tab-log');
    const tabTrends = document.getElementById('tab-trends');
    const root = document.body;

    const setView = (view) => {
        tabLog.classList.toggle('active', view === 'log');
        tabTrends.classList.toggle('active', view === 'trends');
        root.classList.toggle('mobile-view-trends', view === 'trends');
        localStorage.setItem(STORAGE_KEYS.view, view);
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

function restoreViewPrefs() {
    const view = localStorage.getItem(STORAGE_KEYS.view);
    if (view === 'trends') {
        document.body.classList.add('mobile-view-trends');
    }
}

// --- Range Picker Logic ---

function switchRangeTab(tab) {
    const presetsBtn = document.getElementById('range-tab-presets');
    const customBtn = document.getElementById('range-tab-custom');
    const presetsView = document.getElementById('range-view-presets');
    const customView = document.getElementById('range-view-custom');

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
        if (!document.getElementById('custom-start-date').value && historyRange.start) {
            const start = historyRange.start;
            const end = historyRange.end || new Date();

            const pad = n => String(n).padStart(2, '0');
            document.getElementById('custom-start-date').value = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
            document.getElementById('custom-start-time').value = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
            document.getElementById('custom-end-date').value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
            document.getElementById('custom-end-time').value = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
        }
    }
}

async function selectPresetAndClose(preset) {
    await applyPreset(preset);
    closeModal('range');
}

function setCustomEndTimeNow() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('custom-end-date').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    document.getElementById('custom-end-time').value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

async function applyCustomRange() {
    const sDate = document.getElementById('custom-start-date').value;
    const sTime = document.getElementById('custom-start-time').value;
    const eDate = document.getElementById('custom-end-date').value;
    const eTime = document.getElementById('custom-end-time').value;

    if (!sDate || !sTime || !eDate || !eTime) {
        showToast('Please fill all date and time fields', 'error');
        return;
    }

    const start = parseDateTime(sDate, sTime);
    const end = parseDateTime(eDate, eTime, true);

    if (end < start) {
        showToast('End time cannot be before start time', 'error');
        return;
    }

    historyRange = { start, end };
    updateRangeSummary('Custom Range');
    await loadEntries();
    closeModal('range');
}

async function applyPreset(preset) {
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
            const diff = start.getDate() - day + (day == 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            label = 'This Week';
            break;
    }

    historyRange = { start, end };
    updateRangeSummary(label, preset);
    await loadEntries();
}

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
        const formatDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const dateText = `${formatDate(historyRange.start)} - ${formatDate(historyRange.end)}`;

        if (customLabel) customLabel.textContent = dateText;
    }
}

function setDefaultTrendRange(startInput, endInput, rangeLabelEl, presetBtn = null) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    trendRange = { start, end };
    if (startInput && endInput) {
        setTrendRangeInputs(startInput, endInput, start, end);
    }
    if (rangeLabelEl) {
        updateRangeLabel(rangeLabelEl, formatRangeLabel(start, end));
    }
    if (presetBtn) {
        const activeClasses = ['bg-white', 'shadow-sm', 'text-slate-800'];
        const inactiveClasses = ['text-slate-600', 'hover:bg-white', 'hover:shadow-sm'];
        presetBtn.classList.remove(...inactiveClasses);
        presetBtn.classList.add(...activeClasses);
    }
}

function setTrendRangeInputs(startInput, endInput, start, end) {
    if (!startInput || !endInput) return;
    const pad = (n) => String(n).padStart(2, '0');
    startInput.value = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    endInput.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

function parseTrendRangeFromInputs(startInput, endInput) {
    const startVal = startInput?.value;
    const endVal = endInput?.value;
    if (!startVal || !endVal) {
        showToast('Please select both start and end dates', 'error');
        return null;
    }

    const start = new Date(`${startVal}T00:00:00`);
    const end = new Date(`${endVal}T23:59:59.999`);

    if (isNaN(start) || isNaN(end)) {
        showToast('Invalid dates selected', 'error');
        return null;
    }

    if (end < start) {
        showToast('End date must be after start date', 'error');
        return null;
    }

    return { start, end };
}

function isolateFilter(type) {
    if (!type) return;
    typeFilters.clear();
    typeFilters.add(type);

    // Only target type filter chips (those with data-type attribute)
    const chips = document.querySelectorAll('.filter-chip[data-type]');
    chips.forEach(chip => {
        const isActive = chip.dataset.type === type;
        chip.classList.toggle('active', isActive);
    });

    renderEntries();
}

function toggleTypeFilter(chip) {
    const type = chip.dataset.type;
    if (!type) return;

    if (typeFilters.has(type)) {
        // Keep at least one filter active to avoid empty state confusion
        if (typeFilters.size === 1) {
            showToast('At least one type must stay selected', 'error');
            return;
        }
        typeFilters.delete(type);
        chip.classList.remove('active');
    } else {
        typeFilters.add(type);
        chip.classList.add('active');
    }

    renderEntries();
}

// --- Interaction Logic for Swipe & Context Menu ---

let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;

function handleEntryClick(e, id) {
    // If we were swiping, don't trigger click
    if (isSwiping) return;

    // If clicking on menu button, don't trigger edit
    if (e.target.closest('.desktop-menu-btn')) return;

    // If swiped open, close it
    const content = e.currentTarget;
    if (content.style.transform && content.style.transform !== 'translateX(0px)') {
        resetSwipe(content);
        return;
    }

    editEntry(id);
}

function handleTouchStart(e) {
    const content = e.currentTarget;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;

    // Close other open swipes
    document.querySelectorAll('.swipe-content').forEach(el => {
        if (el !== content) resetSwipe(el);
    });
}

function handleTouchMove(e) {
    const content = e.currentTarget;
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const diffX = touchX - touchStartX;
    const diffY = touchY - touchStartY;

    // Determine if scrolling or swiping
    if (!isSwiping) {
        // More horizontal than vertical movement
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
            isSwiping = true;
        } else {
            return; // Vertical scroll, let browser handle it
        }
    }

    if (isSwiping) {
        if (e.cancelable) e.preventDefault(); // Prevent scroll
        // Only allow swiping left (negative diffX)
        // Limit swipe to -160px (width of 2 buttons)
        const newX = Math.min(0, Math.max(-160, diffX));
        content.style.transform = `translateX(${newX}px)`;
    }
}

function handleTouchEnd(e) {
    const content = e.currentTarget;
    if (!isSwiping) return;

    const touchX = e.changedTouches[0].clientX;
    const diffX = touchX - touchStartX;

    // Snap to open or closed
    if (diffX < -60) { // Swiped enough to open
        content.style.transform = 'translateX(-160px)';
    } else {
        resetSwipe(content);
    }

    // Reset flag after a short delay to prevent click trigger
    setTimeout(() => { isSwiping = false; }, 100);
}

function resetSwipe(element) {
    element.style.transform = 'translateX(0px)';
}

function confirmDeleteEntry(id) {
    // Use a custom modal or native confirm
    // For now, native confirm is safest and quickest
    if (confirm('Are you sure you want to delete this entry?')) {
        deleteEntry(id);
    }
}

function handleContextMenu(e, id) {
    e.preventDefault();
    showContextMenu(e, id);
}

function showContextMenu(e, id) {
    e.stopPropagation();

    // Remove existing menus
    closeContextMenu();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'context-menu-overlay';
    overlay.onclick = closeContextMenu;
    document.body.appendChild(overlay);

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
<button class="context-menu-item" onclick="editEntry(${id}); closeContextMenu()">
<span>✏️</span> Edit
</button>
<button class="context-menu-item" onclick="duplicateEntry(${id}); closeContextMenu()">
<span>📋</span> Duplicate
</button>
<div class="h-px bg-slate-100 my-1"></div>
<button class="context-menu-item destructive" onclick="confirmDeleteEntry(${id}); closeContextMenu()">
<span>🗑️</span> Delete
</button>
`;

    document.body.appendChild(menu);

    // Position menu
    // Use clientX/Y from event, handle both mouse and touch
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

function closeContextMenu() {
    const overlay = document.querySelector('.context-menu-overlay');
    const menu = document.querySelector('.context-menu');
    if (overlay) overlay.remove();
    if (menu) menu.remove();
}

async function duplicateEntry(id) {
    const entry = [...entries, ...speechEntries].find(e => e.id === id);
    if (!entry) return;

    // Create a copy without ID and with current time
    const newEntry = { ...entry };
    delete newEntry.id;
    newEntry.timestamp = new Date().toISOString();

    // Determine type based on fields present
    let type = 'feed';
    if (newEntry.susu_count !== undefined) type = 'susu';
    else if (newEntry.poti_count !== undefined) type = 'poti';
    else if (newEntry.temperature !== undefined) type = 'temp';
    else if (newEntry.weight !== undefined) type = 'weight';

    if (type === 'speech') {
        try {
            const payload = {
                object_key: newEntry.object_key,
                audio_url: newEntry.audioUrl || newEntry.audio_url,
                transcription: newEntry.transcription,
                category: newEntry.category,
                mode: newEntry.mode,
                duration_ms: newEntry.duration_ms,
                notes: newEntry.notes,
                timestamp: new Date().toISOString()
            };
            const resp = await fetch(SPEECH_ENTRIES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) throw new Error('dup failed');
            const saved = await resp.json();
            speechEntries = [saved, ...speechEntries];
            renderEntries();
            renderSpeechRecent();
            showToast('Speech entry duplicated', 'success');
        } catch (err) {
            console.error(err);
            showToast('Could not duplicate speech entry', 'error');
        }
    } else {
        await saveEntry(newEntry, type);
        showToast('Entry duplicated', 'success');
    }
}

function toggleSection(id) {
    const section = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);

    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        section.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(-90deg)';
    }
}

// Render Entries
/**
 * Render all entries to the timeline display
 * Applies current filters and date range
 */
function renderEntries() {
    const allEntries = [...entries, ...speechEntries];

    const filteredEntries = allEntries
        .filter(entry => {
            const ts = new Date(entry.timestamp);
            if (historyRange.start && ts < historyRange.start) return false;
            if (historyRange.end && ts > historyRange.end) return false;
            return true;
        })
        .filter(entry => typeFilters.has(getEntryType(entry)))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (filteredEntries.length === 0) {
        entriesContainer.innerHTML = '<p class="text-center text-slate-500 py-8">No entries yet. Start logging above!</p>';
        return;
    }

    let html = '';
    let lastDate = '';
    let groupCount = 0;

    filteredEntries.forEach(entry => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        if (dateStr !== lastDate) {
            if (lastDate !== '') {
                html += '</div>'; // Close previous group
            }

            const groupId = `group-${groupCount++}`;
            html += `
<div onclick="toggleSection('${groupId}')" class="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-md py-3 px-3 mb-3 border-b border-slate-200/50 font-semibold text-slate-500 text-xs uppercase tracking-widest flex justify-between items-center cursor-pointer select-none hover:bg-slate-100/50 transition-colors rounded-xl mt-4">
<span>${dateStr}</span>
<span id="icon-${groupId}" class="transform transition-transform duration-200 text-xs opacity-50">▼</span>
</div>
<div id="${groupId}" class="space-y-3 mb-6 timeline-container">
`;
            lastDate = dateStr;
        }
        html += createEntryItem(entry);
    });

    if (html.length > 0) {
        html += '</div>'; // Close last group
    }

    entriesContainer.innerHTML = html;
}

// Create Entry Item HTML
function createEntryItem(entry) {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    let icon = '';
    let title = '';
    let details = '';
    let iconBg = 'bg-slate-100 text-slate-500';

    // Generate simplified content based on type
    if (entry.feed_amount || entry.feed_type) {
        icon = '🍼';
        title = 'Feed';
        const parts = [];
        if (entry.feed_amount) parts.push(`<b>${entry.feed_amount}ml</b>`);
        if (entry.feed_type) parts.push(entry.feed_type);
        details = parts.join(' • '); // "120ml • Formula"
        iconBg = 'bg-orange-100 text-orange-500'; // Matches user image (orange/peach)
    } else if (entry.susu_count > 0) {
        icon = '💧';
        title = 'Diaper Wet';
        const { itemType } = parseSusuNotes(entry.notes);
        // Use parsed size-based summary when notes are absent, otherwise prefer raw notes
        const size = itemType === 'diaper' ? 'Medium' : 'Small';
        details = entry.notes || `${size} • Clear color` || 'One wet diaper';
        iconBg = 'bg-blue-100 text-blue-500';
    } else if (entry.poti_count > 0) {
        icon = '💩'; // Or wind icon if available
        title = 'Diaper Soiled';
        details = entry.notes || 'One soiled diaper';
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
        if (entry.notes) details += ` • ${entry.notes}`;
        iconBg = 'bg-emerald-100 text-emerald-600';
    } else if (getEntryType(entry) === 'speech') {
        icon = '🎙️'; // Or moon icon for sleep, speech icon for notes
        title = entry.category ? (entry.category.charAt(0).toUpperCase() + entry.category.slice(1)) : 'Voice Note';
        details = entry.transcription || entry.notes || 'No notes';
        iconBg = 'bg-indigo-100 text-indigo-500';
    }

    const isSpeech = getEntryType(entry) === 'speech';
    const hasAudio = isSpeech && (entry.audioUrl || entry.audio_url);

    return `
<div class="timeline-item mb-4 select-none" data-id="${entry.id}"
onmousedown="handleLongPressStart(event, ${entry.id})" 
ontouchstart="handleLongPressStart(event, ${entry.id})"
onmouseup="handleLongPressEnd()" 
ontouchend="handleLongPressEnd()"
ontouchcancel="handleLongPressEnd()">

<div class="timeline-card-content bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 relative z-10">

<!-- Pop-out Menu Overlay -->
<div class="pop-out-overlay" id="overlay-${entry.id}">
<button onclick="editEntry(${entry.id}); stopShake(${entry.id})" class="pop-btn text-blue-500 hover:scale-110">
<span class="text-xl">✏️</span>
</button>
<button onclick="duplicateEntry(${entry.id}); stopShake(${entry.id})" class="pop-btn text-emerald-500 hover:scale-110">
<span class="text-xl">📋</span>
</button>
<button onclick="confirmDeleteEntry(${entry.id}); stopShake(${entry.id})" class="pop-btn text-red-500 hover:scale-110">
<span class="text-xl">🗑️</span>
</button>
<!-- Close/Cancel Button -->
<button onclick="stopShake(${entry.id})" class="pop-btn text-slate-400 hover:scale-110 absolute -top-2 -right-2 w-8 h-8 text-base bg-slate-100">
<span>✕</span>
</button>
</div>

<div class="flex items-start gap-5">
<!-- Icon Circle -->
<div class="w-12 h-12 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0 text-xl shadow-inner-sm">
${icon}
</div>

<!-- Content -->
<div class="flex-1 min-w-0 pt-0.5">
<div class="flex items-start justify-between gap-3 mb-1">
<div class="flex-1 min-w-0">
<div class="font-bold text-slate-900 text-base mb-1">${title}</div>
<div class="text-slate-500 text-sm font-medium leading-relaxed truncate">${details}</div>
</div>
<div class="flex items-center gap-2 flex-shrink-0">
<!-- Time Top Right -->
<div class="text-xs font-bold text-slate-400 tracking-wide">${timeStr}</div>
<!-- Menu Button (Still keep 3 dots as alternative) -->
<button onclick="showContextMenu(event, ${entry.id})" class="p-2 -mr-2 -mt-2 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
<path d="M12 16a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2zm0-6a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2zm0-6a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2 2 2 0 012-2z"/>
</svg>
</button>
</div>
</div>

${(isSpeech && !hasAudio && !entry.transcription) ? `
<div class="text-xs text-indigo-500 mt-2 flex items-center gap-1.5 bg-indigo-50/50 p-2 rounded-lg w-fit">
<svg class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>
<span class="font-medium">Transcribing...</span>
</div>
` : ''}

${hasAudio ? `
<div class="flex items-center gap-2 mt-3">
<!-- Re-transcribe Button -->
<button onclick="reTranscribeEntry('${entry.id}')" class="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Re-transcribe">
<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
</svg>
</button>

<!-- Compact Pill Player -->
<div class="inline-flex items-center gap-3 bg-slate-50 rounded-full pl-2 pr-4 py-1.5 border border-slate-100">
<div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 text-[10px] cursor-pointer hover:bg-indigo-200 transition-colors" onclick="document.getElementById('audio-${entry.id}').play()">▶</div>
<audio id="audio-${entry.id}" src="${entry.audioUrl || entry.audio_url}" class="hidden"></audio>
<div class="h-1 w-20 bg-indigo-200 rounded-full overflow-hidden">
<div class="h-full bg-indigo-500 w-1/3 rounded-full"></div>
</div>
<span class="text-[10px] font-bold text-slate-400 tabular-nums">0:05</span>
</div>
</div>
` : ''}

</div>
</div>
</div>
</div>
`;
}

// Edit Entry
function editEntry(id) {
    const entry = [...entries, ...speechEntries].find(e => e.id === id);
    if (!entry) return;

    // Determine which modal to open based on entry type
    if (entry.feed_amount || entry.feed_type) {
        openModal('feed', entry);
    } else if (entry.susu_count > 0) {
        openModal('susu', entry);
    } else if (entry.poti_count > 0) {
        openModal('poti', entry);
    } else if (entry.temperature) {
        openModal('temp', entry);
    } else if (entry.weight) {
        openModal('weight', entry);
    } else if (getEntryType(entry) === 'speech') {
        openModal('speech', entry);
    }
}

// Delete Entry
/**
 * Delete an entry via backend API
 * @async
 * @param {number} id - Entry ID to delete
 */
async function deleteEntry(id) {
    // Handle local speech entries separately
    const speechMatch = speechEntries.find(e => e.id === id);
    if (speechMatch) {
        try {
            const resp = await fetch(`${SPEECH_ENTRIES_URL}/${id}`, { method: 'DELETE' });
            if (!resp.ok) throw new Error('Failed');
            speechEntries = speechEntries.filter(e => e.id !== id);
            renderEntries();
            renderSpeechRecent();
            showToast('Speech entry removed', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error deleting speech entry', 'error');
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadEntries();
            showToast('Entry deleted', 'success');
        } else {
            throw new Error('Failed to delete entry');
        }
    } catch (error) {
        console.error('Error:', error);
        showToast('Error deleting entry', 'error');
    }
}

// Update Stats
/**
 * Update dashboard statistics based on current entries
 * Calculates totals for feeds, diapers, temperature, weight
 */
function updateStats() {
    const rangeEntries = entries.filter(e => {
        const ts = new Date(e.timestamp);
        if (historyRange.start && ts < historyRange.start) return false;
        if (historyRange.end && ts > historyRange.end) return false;
        return true;
    });

    // Feeds count and average
    const feedEntries = rangeEntries.filter(e => e.feed_amount > 0 || e.feed_type);
    const feedsCount = feedEntries.length;
    const feedAmounts = feedEntries.filter(e => e.feed_amount > 0).map(e => e.feed_amount);
    const totalFeedMl = feedAmounts.reduce((sum, amt) => sum + amt, 0);
    const avgFeed = feedAmounts.length > 0
        ? Math.round(feedAmounts.reduce((sum, amt) => sum + amt, 0) / feedAmounts.length)
        : 0;

    if (todayFeedsEl) todayFeedsEl.textContent = `${feedsCount} | ${avgFeed}ml`;
    if (todayFeedsMobileEl) todayFeedsMobileEl.textContent = `${feedsCount} | ${avgFeed}ml`;
    if (totalFeedMlEl) totalFeedMlEl.textContent = `${Math.round(totalFeedMl)} ml`;

    // --- Feed Target Progress ---
    // Calculate goal based on the weight effective at the end of the selected range
    const applicableWeights = entries
        .filter(e => e.weight > 0 && e.timestamp)
        .filter(e => {
            if (historyRange.end) return new Date(e.timestamp) <= historyRange.end;
            return true;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const latestWeight = applicableWeights.length > 0 ? applicableWeights[0].weight : 0;

    const progressBar = document.getElementById('feed-progress-bar');
    const progressTextCompact = document.getElementById('feed-progress-text-compact');
    const basisText = document.getElementById('target-basis-text');

    if (latestWeight > 0) {
        const weightKg = (latestWeight / 1000).toFixed(2);
        const dailyTarget = Math.round((latestWeight / 1000) * 150);

        let days = 1;
        if (historyRange.start && historyRange.end) {
            const diffTime = Math.abs(historyRange.end - historyRange.start);
            days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
        }

        const dailyAvg = totalFeedMl / days;
        const percent = Math.min(100, Math.round((dailyAvg / dailyTarget) * 100));

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.className = 'h-full bg-blue-500 rounded-full transition-all duration-500';
        }

        if (progressTextCompact) progressTextCompact.textContent = `${percent}%`;
        if (basisText) basisText.textContent = `Goal: ${dailyTarget} ml (${weightKg}kg)`;
    } else {
        if (progressBar) progressBar.style.width = '0%';
        if (progressTextCompact) progressTextCompact.textContent = '0%';
        if (basisText) basisText.textContent = 'Goal: --';
    }

    // Susu total
    const susuTotal = rangeEntries.reduce((sum, e) => sum + (e.susu_count || 0), 0);
    if (todaySusuEl) todaySusuEl.textContent = susuTotal;
    if (todaySusuMobileEl) todaySusuMobileEl.textContent = susuTotal;

    // Poti total
    const potiTotal = rangeEntries.reduce((sum, e) => sum + (e.poti_count || 0), 0);
    if (todayPotiEl) todayPotiEl.textContent = potiTotal;
    if (todayPotiMobileEl) todayPotiMobileEl.textContent = potiTotal;

    // Combined diaper total
    const diaperTotal = rangeEntries.reduce((sum, e) => {
        const itemType = getEntryItemType(e);
        if (itemType === 'diaper') {
            return sum + (e.susu_count || 0) + (e.poti_count || 0);
        }
        return sum;
    }, 0);
    if (totalDiapersEl) totalDiapersEl.textContent = diaperTotal;
    if (totalDiapersMobileEl) totalDiapersMobileEl.textContent = diaperTotal;

    // Average temperature
    const temps = rangeEntries.filter(e => e.temperature).map(e => parseFloat(e.temperature));
    if (temps.length > 0) {
        const avgTemp = (temps.reduce((sum, t) => sum + t, 0) / temps.length).toFixed(1);
        if (avgTempEl) {
            avgTempEl.textContent = avgTemp;
            avgTempEl.classList.toggle('text-red-600', avgTemp > 38);
        }
        if (avgTempMobileEl) {
            avgTempMobileEl.textContent = avgTemp;
            avgTempMobileEl.classList.toggle('text-red-600', avgTemp > 38);
        }
    } else {
        if (avgTempEl) avgTempEl.textContent = '--';
        if (avgTempMobileEl) avgTempMobileEl.textContent = '--';
    }

    // Current weight
    const weightEntries = rangeEntries.filter(e => e.weight > 0).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (weightEntries.length > 0) {
        if (currentWeightEl) currentWeightEl.textContent = weightEntries[0].weight;
        if (currentWeightMobileEl) currentWeightMobileEl.textContent = weightEntries[0].weight;
    } else {
        if (currentWeightEl) currentWeightEl.textContent = '--';
        if (currentWeightMobileEl) currentWeightMobileEl.textContent = '--';
    }
}

// Initialize Trend Chart
function initTrendChart() {
    try {
        const canvas = document.getElementById('trendChart');
        if (!canvas) {
            console.error('trendChart canvas element not found');
            return;
        }
        const ctx = canvas.getContext('2d');
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Value',
                    data: [],
                    borderColor: 'rgb(14, 165, 233)',
                    backgroundColor: 'rgba(14, 165, 233, 0.14)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: 'rgb(14, 165, 233)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                    axis: 'x'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 10,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        displayColors: false,
                        callbacks: {
                            title: function (context) {
                                return context[0].label;
                            },
                            label: function (context) {
                                const value = context.parsed.y;
                                const metric = context.datasetIndex === 0 ? currentMetric : compareMetric;
                                const unit = getMetricUnit(metric);
                                return `${value}${unit}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        position: 'left',
                        grid: {
                            color: 'rgba(15, 23, 42, 0.05)'
                        }
                    },
                    y1: {
                        beginAtZero: false,
                        position: 'right',
                        display: false,
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(15, 23, 42, 0.04)'
                        }
                    }
                }
            }
        });
        console.log('Trend chart initialized successfully');
    } catch (error) {
        console.error('Failed to initialize trend chart:', error);
        trendChart = null;
    }
}

// Update Trend Chart
function updateTrendChart() {
    const rangeInfo = getRangeBounds(currentTimeRange);
    if (!rangeInfo) return;
    const { start, end, groupBy, label } = rangeInfo;
    const metric = currentMetric;
    const compare = compareMetric;
    const unit = getMetricUnit(metric);
    const compareUnit = compare ? getMetricUnit(compare) : unit;
    const rangeLabel = document.getElementById('range-label');
    const aggregationHint = document.getElementById('aggregation-hint');
    updateRangeLabel(rangeLabel, label);
    updateAggregationHint(aggregationHint, currentTimeRange);

    // Safety check: ensure trendChart is initialized
    if (!trendChart || !trendChart.data) {
        console.warn('trendChart not fully initialized yet');
        return;
    }

    const filteredEntries = entries
        .filter(e => {
            const ts = new Date(e.timestamp);
            return ts >= start && ts <= end;
        })
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (filteredEntries.length === 0) {
        trendChart.data.labels = ['No data'];
        trendChart.data.datasets[0].data = [];
        trendChart.update();
        updateTrendStats(null, null, null, null, unit);
        return;
    }

    const grouped = groupByTime(filteredEntries, groupBy, metric, start);
    const primaryValues = isCumulative ? toCumulative(grouped.values) : grouped.values;

    trendChart.data.labels = grouped.labels;
    trendChart.data.datasets[0].data = primaryValues;
    const colors = getMetricColor(metric, 0);
    trendChart.data.datasets[0].label = getMetricTitle(metric);
    trendChart.data.datasets[0].borderColor = colors.border;
    trendChart.data.datasets[0].backgroundColor = colors.bg;
    trendChart.data.datasets[0].pointBackgroundColor = colors.border;
    trendChart.data.datasets[0].borderWidth = 3;
    trendChart.data.datasets[0].pointRadius = 6;
    trendChart.data.datasets[0].pointHoverRadius = 8;
    trendChart.data.datasets[0].borderDash = [];
    trendChart.data.datasets[0].fill = true;
    trendChart.data.datasets[0].yAxisID = 'y';

    if (compare) {
        const groupedCompare = groupByTime(filteredEntries, groupBy, compare, start);
        // Ensure labels align; assume same labels; if mismatch, fallback to base labels length
        trendChart.data.datasets[1] = trendChart.data.datasets[1] || {};
        trendChart.data.datasets[1].data = groupedCompare.values;
        trendChart.data.datasets[1].label = getMetricTitle(compare);
        const cColors = getMetricColor(compare, 1);
        trendChart.data.datasets[1].borderColor = cColors.border;
        trendChart.data.datasets[1].backgroundColor = cColors.bg;
        trendChart.data.datasets[1].pointBackgroundColor = cColors.border;
        trendChart.data.datasets[1].borderWidth = 2;
        trendChart.data.datasets[1].pointRadius = 5;
        trendChart.data.datasets[1].pointHoverRadius = 7;
        trendChart.data.datasets[1].borderDash = [6, 4];
        trendChart.data.datasets[1].fill = false;
        trendChart.data.datasets[1].yAxisID = compareUnit !== unit ? 'y1' : 'y';
    } else {
        trendChart.data.datasets.splice(1);
    }

    document.getElementById('chart-title').textContent = compare
        ? `${getMetricTitle(metric)} vs ${getMetricTitle(compare)}`
        : getMetricTitle(metric);

    trendChart.options.scales.y.ticks = {
        callback: function (value) {
            return `${value}${unit}`;
        },
        maxTicksLimit: 5
    };
    if (compare && compareUnit !== unit) {
        trendChart.options.scales.y1 = {
            position: 'right',
            beginAtZero: false,
            grid: { display: false },
            ticks: {
                callback: function (value) {
                    return `${value}${compareUnit}`;
                },
                maxTicksLimit: 5
            }
        };
    } else {
        trendChart.options.scales.y1 = undefined;
    }
    trendChart.options.scales.x.ticks = {
        maxTicksLimit: Math.min(grouped.labels.length, groupBy === 'day' ? 12 : groupBy === 'week' ? 12 : 12) || 6,
        color: '#475569'
    };
    trendChart.options.scales.x.grid = { color: 'rgba(15, 23, 42, 0.05)' };
    trendChart.options.scales.y.grid = { color: 'rgba(15, 23, 42, 0.07)' };

    trendChart.options.plugins.legend = {
        display: !!compare,
        position: 'top',
        labels: { usePointStyle: true, boxWidth: 10 }
    };

    trendChart.options.plugins.tooltip.callbacks = {
        title: function (context) {
            return context[0].label;
        },
        label: function (context) {
            const value = context.parsed.y;
            const datasetLabel = context.dataset?.label ? `${context.dataset.label}: ` : '';
            const currentUnit = context.datasetIndex === 1 ? compareUnit : unit;
            return `${datasetLabel}${value}${currentUnit}`;
        }
    };

    trendChart.update();

    if (primaryValues.length > 0) {
        const startVal = primaryValues[0];
        const latest = primaryValues[primaryValues.length - 1];
        const change = latest - startVal;
        const avgChange = primaryValues.length > 1
            ? change / (primaryValues.length - 1)
            : 0;
        updateTrendStats(startVal, latest, change, avgChange, unit);
    }
}

function getRangeBounds(aggregation) {
    if (!trendRange.start || !trendRange.end) {
        const trendStartInput = document.getElementById('trend-start-date');
        const trendEndInput = document.getElementById('trend-end-date');
        const rangeLabelEl = document.getElementById('range-label');
        setDefaultTrendRange(trendStartInput, trendEndInput, rangeLabelEl);
    }

    if (!trendRange.start || !trendRange.end) return null;

    const groupBy = aggregation === 'hour'
        ? 'hour'
        : aggregation === 'week'
            ? 'week'
            : aggregation === 'month'
                ? 'month'
                : 'day';
    const label = formatRangeLabel(trendRange.start, trendRange.end);
    return { start: trendRange.start, end: trendRange.end, groupBy, label };
}

function formatRangeLabel(start, end) {
    if (!start || !end) return 'Range';

    const sameDay = start.toDateString() === end.toDateString();
    if (sameDay) {
        return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (start.getFullYear() === end.getFullYear()) {
        return `${startLabel} – ${endLabel}, ${start.getFullYear()}`;
    }

    return `${startLabel}, ${start.getFullYear()} – ${endLabel}, ${end.getFullYear()}`;
}

function updateRangeLabel(el, labelText) {
    if (!el) return;
    el.textContent = labelText || 'Range';
}

function updateAggregationHint(el, aggregation) {
    if (!el) return;
    const label = aggregation === 'hour' ? 'Grouped by Hour'
        : aggregation === 'day' ? 'Grouped by Day'
            : aggregation === 'month' ? 'Grouped by Month'
                : 'Grouped by Week';
    el.textContent = label;
}

// Group entries by time period
function groupByTime(entries, groupBy, metric, rangeStart) {
    const grouped = {};

    entries.forEach(entry => {
        const date = new Date(entry.timestamp);
        let key;

        if (groupBy === 'week') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            weekStart.setHours(0, 0, 0, 0);
            key = weekStart.toISOString();
        } else if (groupBy === 'hour') {
            const hourStart = new Date(date);
            hourStart.setMinutes(0, 0, 0);
            key = hourStart.toISOString();
        } else if (groupBy === 'month') {
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            monthStart.setHours(0, 0, 0, 0);
            key = monthStart.toISOString();
        } else {
            const dayKey = new Date(date);
            dayKey.setHours(0, 0, 0, 0);
            key = dayKey.toISOString();
        }

        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(entry);
    });

    const sortedKeys = Object.keys(grouped).sort();
    const labels = sortedKeys.map(key => {
        const d = new Date(key);
        if (groupBy === 'hour') {
            return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
        }
        if (groupBy === 'week') {
            return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        if (groupBy === 'month') {
            return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const values = sortedKeys.map(key => {
        const groupEntries = grouped[key];
        return calculateMetricValue(groupEntries, metric);
    });

    return { labels, values };
}

function computeDiaperCount(entries) {
    return entries.reduce((sum, entry) => {
        const itemType = getEntryItemType(entry);
        if (itemType !== 'diaper') return sum;
        return sum + (entry.susu_count || 0) + (entry.poti_count || 0);
    }, 0);
}

function toCumulative(values) {
    let running = 0;
    return values.map(v => {
        running += v;
        return running;
    });
}

// Calculate metric value for a group of entries
function calculateMetricValue(entries, metric) {
    switch (metric) {
        case 'weight-avg':
            const weights = entries.filter(e => e.weight > 0).map(e => e.weight);
            return weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : 0;

        case 'temp-avg':
            const temps = entries.filter(e => e.temperature).map(e => parseFloat(e.temperature));
            return temps.length > 0 ? parseFloat((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)) : 0;

        case 'feed-total':
            return entries.reduce((sum, e) => sum + (e.feed_amount || 0), 0);

        case 'feed-avg':
            const feedAmounts = entries.filter(e => e.feed_amount > 0).map(e => e.feed_amount);
            return feedAmounts.length > 0 ? Math.round(feedAmounts.reduce((a, b) => a + b, 0) / feedAmounts.length) : 0;

        case 'feed-count':
            return entries.filter(e => e.feed_amount > 0 || e.feed_type).length;

        case 'poti-count':
            return entries.reduce((sum, e) => sum + (e.poti_count || 0), 0);

        case 'susu-count':
            return entries.reduce((sum, e) => sum + (e.susu_count || 0), 0);

        case 'diaper-count':
            return computeDiaperCount(entries);

        default:
            return 0;
    }
}

// Get metric color scheme
function getMetricColor(metric, order = 0) {
    const palette = {
        'weight-avg': { border: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.14)' },
        'temp-avg': { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.12)' },
        'feed-total': { border: 'rgb(245, 158, 11)', bg: 'rgba(245, 158, 11, 0.12)' },
        'susu-count': { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.12)' },
        'poti-count': { border: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.12)' },
        'diaper-count': { border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.14)' }
    };
    const fallback = [
        { border: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.14)' },
        { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.12)' },
        { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.12)' },
        { border: 'rgb(245, 158, 11)', bg: 'rgba(245, 158, 11, 0.12)' },
        { border: 'rgb(99, 102, 241)', bg: 'rgba(99, 102, 241, 0.12)' }
    ];
    return palette[metric] || fallback[order % fallback.length];
}

// Get metric title
function getMetricTitle(metric) {
    const titles = {
        'weight-avg': 'Weight Trend',
        'temp-avg': 'Temperature Trend',
        'feed-total': 'Total Feed Volume',
        'feed-avg': 'Average Feed Volume',
        'feed-count': 'Feed Count',
        'poti-count': 'Soiled Diapers',
        'susu-count': 'Wet Diapers',
        'diaper-count': 'Diapers'
    };
    return titles[metric] || 'Trend';
}

// Get metric unit
function getMetricUnit(metric) {
    const units = {
        'weight-avg': 'g',
        'temp-avg': '°C',
        'feed-total': 'ml',
        'feed-avg': 'ml',
        'feed-count': '',
        'poti-count': '',
        'susu-count': '',
        'diaper-count': ''
    };
    return units[metric] || '';
}

// Update Trend Stats
function updateTrendStats(start, latest, change, avgChange, unit = '') {
    const startEl = document.getElementById('start-value');
    const latestEl = document.getElementById('latest-value');
    const changeEl = document.getElementById('value-change');
    const avgEl = document.getElementById('avg-change');
    const changeHelper = document.getElementById('change-helper');
    const avgHelper = document.getElementById('avg-helper');

    startEl.textContent = start !== null ? `${start}${unit}` : '--';
    latestEl.textContent = latest !== null ? `${latest}${unit}` : '--';

    if (change !== null) {
        const prefix = change >= 0 ? '+' : '';
        const valueText = `${prefix}${change.toFixed ? change.toFixed(1) : change}${unit}`;
        changeEl.textContent = valueText;
        const positive = change >= 0;
        changeEl.classList.toggle('text-emerald-700', positive);
        changeEl.classList.toggle('text-amber-600', !positive);
        changeHelper.textContent = positive ? 'Healthy gain this range' : 'Watch for dips';
    } else {
        changeEl.textContent = '--';
        changeHelper.textContent = 'Not enough data';
    }

    if (avgChange !== null) {
        const prefix = avgChange >= 0 ? '+' : '';
        const valueText = `${prefix}${avgChange.toFixed ? avgChange.toFixed(1) : avgChange}${unit}`;
        avgEl.textContent = valueText;
        const positive = avgChange >= 0;
        avgEl.classList.toggle('text-emerald-700', positive);
        avgEl.classList.toggle('text-amber-600', !positive);
        avgHelper.textContent = positive ? 'Steady upward trend' : 'Declining trend';
    } else {
        avgEl.textContent = '--';
        avgHelper.textContent = 'Not enough data';
    }
}

// Show Toast Message
function showToast(text, type) {
    const palette = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    const toast = document.createElement('div');
    toast.className = `fixed top-20 right-4 p-4 rounded-lg shadow-lg z-50 ${palette[type] || 'bg-slate-700'} text-white font-semibold animate-slide-in`;
    toast.textContent = text;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Re-transcribe entry
async function reTranscribeEntry(id) {
    id = parseInt(id);
    const entry = speechEntries.find(e => e.id === id);
    if (!entry) {
        showToast('Entry not found', 'error');
        return;
    }

    try {
        showToast('Processing cleanup...', 'info');

        // 1. Identify and delete auto-mapped entries
        const autoMappedIds = [];
        if (entry && entry.notes) {
            // Specific regex to only catch auto-mapped entries
            const regex = /\[Auto-mapped to entry #(\d+)\]/g;
            let match;
            while ((match = regex.exec(entry.notes)) !== null) {
                autoMappedIds.push(parseInt(match[1]));
            }
        }

        let deletedCount = 0;
        if (autoMappedIds.length > 0) {
            console.log(`Found ${autoMappedIds.length} auto-mapped entries to delete:`, autoMappedIds);

            const deletePromises = autoMappedIds.map(async (mappedId) => {
                try {
                    const deleteResp = await fetch(`${API_BASE_URL}/entries/${mappedId}`, { method: 'DELETE' });
                    return deleteResp.ok;
                } catch (e) {
                    console.error(`Failed to delete mapped entry #${mappedId}`, e);
                    return false;
                }
            });

            const results = await Promise.all(deletePromises);
            deletedCount = results.filter(r => r).length;

            // Clean up notes text
            const cleanedNotes = entry.notes.replace(/\[Auto-mapped to entry #\d+\]\s*/g, '').trim();

            // Update notes on server
            if (cleanedNotes !== entry.notes) {
                await fetch(`${SPEECH_ENTRIES_URL}/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: cleanedNotes })
                });
                // Update local model
                entry.notes = cleanedNotes;
            }
        }

        // 2. Trigger Re-transcription
        showToast('Requesting re-transcription...', 'info');

        // Optimistic UI update
        entry.transcription = '';
        renderEntries();

        const resp = await fetch(`${SPEECH_ENTRIES_URL}/${id}/retranscribe`, {
            method: 'POST'
        });

        if (!resp.ok) {
            const errorData = await resp.json().catch(() => ({}));
            throw new Error(errorData.error || 'Transcription request failed');
        }

        if (deletedCount > 0) {
            showToast(`Cleaned up ${deletedCount} old entries. Transcription started.`, 'success');
            // Refresh main entries list to reflect deletions
            loadEntries();
        } else {
            showToast('Transcription started. Use the refresh button in a few moments.', 'success');
        }

    } catch (err) {
        console.error(err);
        if (err.message.includes('No audio file associated')) {
            showToast('Cannot re-transcribe: missing audio file on server', 'error');
        } else {
            showToast(err.message || 'Failed to start transcription', 'error');
        }
    }
}

// Clear History
document.getElementById('clear-history-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete ALL entries from today? This cannot be undone.')) return;

    try {
        // Get today's entries
        const today = new Date().toDateString();
        const todayEntries = entries.filter(e => new Date(e.timestamp).toDateString() === today);

        // Delete each entry
        for (const entry of todayEntries) {
            await fetch(`${API_BASE_URL}/entries/${entry.id}`, {
                method: 'DELETE'
            });
        }

        await loadEntries();
        showToast('All entries cleared', 'success');
    } catch (error) {
        console.error('Error:', error);
        showToast('Error clearing entries', 'error');
    }
});

// Add CSS for toast animation
const style = document.createElement('style');
style.textContent = `
@keyframes slide-in {
from {
transform: translateX(400px);
opacity: 0;
}
to {
transform: translateX(0);
opacity: 1;
}
}
.animate-slide-in {
animation: slide-in 0.3s ease-out;
}
`;
document.head.appendChild(style);


// ==========================================
// SECTION: Long Press & Interaction Handlers
// ==========================================

// ----------------------------------------------------
// LONG PRESS / JIGGLE LOGIC
// ----------------------------------------------------
function handleLongPressStart(e, id) {
    console.log('handleLongPressStart called:', { event: e.type, id, button: e.button });

    // If already shaking, ignore
    const item = document.querySelector(`.timeline-item[data-id="${id}"]`);
    if (item && item.classList.contains('shaking')) return;

    // Only left click or touch
    if (e.type === 'mousedown' && e.button !== 0) return;

    // For touch, we need to handle preventDefault carefully
    // Only prevent default if we can (non-passive listener)
    if (e.type === 'touchstart' && e.cancelable) {
        e.preventDefault();
    }

    console.log('Starting long press timer for id:', id);
    longPressTimer = setTimeout(() => {
        console.log('Long press timer fired for id:', id);
        startShake(id);
        // Vibrate if supported
        if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION_MS);
}

function handleLongPressEnd() {
    console.log('handleLongPressEnd called, clearing timer');
    clearTimeout(longPressTimer);
}

function startShake(id) {
    console.log('startShake called for id:', id);
    // Stop any other shaking items first
    document.querySelectorAll('.shaking').forEach(el => {
        el.classList.remove('shaking');
    });

    const item = document.querySelector(`.timeline-item[data-id="${id}"]`);
    if (item) {
        console.log('Adding shaking class to item:', id);
        item.classList.add('shaking');
    } else {
        console.error('Timeline item not found for id:', id);
    }
}

function stopShake(id, e) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }

    const item = document.querySelector(`.timeline-item[data-id="${id}"]`);
    if (item) {
        item.classList.remove('shaking');
    }
}

// Expose functions to window for inline HTML event handlers
window.handleLongPressStart = handleLongPressStart;
window.handleLongPressEnd = handleLongPressEnd;
window.startShake = startShake;
window.stopShake = stopShake;
window.editEntry = editEntry;
window.duplicateEntry = duplicateEntry;
window.confirmDeleteEntry = confirmDeleteEntry;
window.closeContextMenu = closeContextMenu;
window.reTranscribeEntry = reTranscribeEntry;

console.log('Long press handlers exposed:', {
    handleLongPressStart: typeof window.handleLongPressStart,
    handleLongPressEnd: typeof window.handleLongPressEnd,
    startShake: typeof window.startShake,
    stopShake: typeof window.stopShake
});

// Close jiggle if clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.timeline-item')) {
        document.querySelectorAll('.shaking').forEach(el => {
            el.classList.remove('shaking');
        });
    }
});
