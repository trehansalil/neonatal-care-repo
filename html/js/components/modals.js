/**
 * Modal Management Module
 *
 * Handles all modal operations including:
 * - Opening/closing modals for different entry types
 * - Pre-filling forms when editing entries
 * - Setting current date/time for new entries
 * - Modal background click-to-close behavior
 * - Temperature warning display
 *
 * @module components/modals
 */

import { state } from '../core/state.js';
import { getCurrentDateTime } from '../utils/datetime.js';
import { parseSusuNotes, parsePotiNotes } from '../utils/note-parser.js';

// ============================================================================
// Module Configuration
// ============================================================================

/**
 * List of supported modal types
 */
const MODAL_TYPES = ['feed', 'susu', 'poti', 'temp', 'weight', 'speech'];

// ============================================================================
// Core Modal Functions
// ============================================================================

/**
 * Open a modal for creating or editing an entry
 * @param {string} type - Modal type (feed, susu, poti, temp, weight, speech)
 * @param {Object|null} entry - Entry data to edit (null for new entry)
 */
function openModal(type, entry = null) {
    // Update editing state
    state.setState({
        ui: {
            activeModal: type,
            editingEntry: entry
        }
    });

    const modal = document.getElementById(`${type}-modal`);
    if (!modal) {
        console.warn(`Modal not found: ${type}-modal`);
        return;
    }

    // Handle speech-specific initialization
    if (type === 'speech') {
        // Notify speech module to reset state and render recent entries
        const event = new CustomEvent('modal:speech-opened');
        window.dispatchEvent(event);
    }

    // Show modal
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
        preFillForm(type, entry);
    } else {
        // Set current date/time when creating new entry
        setCurrentDateTime(type);
    }
}

/**
 * Close a modal
 * @param {string} type - Modal type to close
 */
function closeModal(type) {
    const modal = document.getElementById(`${type}-modal`);
    if (!modal) {
        console.warn(`Modal not found: ${type}-modal`);
        return;
    }

    modal.classList.remove('active');
    document.body.style.overflow = 'auto';

    // Reset form
    const form = document.getElementById(`${type}-form`);
    if (form) form.reset();

    // Clear editing state
    state.setState({
        ui: {
            activeModal: null,
            editingEntry: null
        }
    });

    // Reset modal title
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
        modalTitle.textContent = modalTitle.textContent.replace('Edit ', '');
    }

    // Hide temp warning if visible
    if (type === 'temp') {
        const warning = document.getElementById('temp-warning');
        if (warning) warning.classList.add('hidden');
    }

    // Handle speech-specific cleanup
    if (type === 'speech') {
        // Notify speech module to reset state and render recent entries
        const event = new CustomEvent('modal:speech-closed');
        window.dispatchEvent(event);
    }
}

/**
 * Close all open modals
 */
function closeAllModals() {
    MODAL_TYPES.forEach(type => {
        const modal = document.getElementById(`${type}-modal`);
        if (modal && modal.classList.contains('active')) {
            closeModal(type);
        }
    });
}

// ============================================================================
// Form Pre-filling
// ============================================================================

/**
 * Pre-fill form fields with entry data for editing
 * @param {string} type - Modal type
 * @param {Object} entry - Entry data
 */
function preFillForm(type, entry) {
    // Fill date and time fields
    const entryDate = new Date(entry.timestamp);

    // Use local date parts to avoid UTC shift when prefilling
    const year = entryDate.getFullYear();
    const month = String(entryDate.getMonth() + 1).padStart(2, '0');
    const day = String(entryDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = entryDate.toTimeString().slice(0, 5);

    const dateField = document.getElementById(`${type}-date`);
    const timeField = document.getElementById(`${type}-time`);

    if (dateField) dateField.value = dateStr;
    if (timeField) timeField.value = timeStr;

    // Fill type-specific fields
    switch (type) {
        case 'feed':
            preFillFeedForm(entry);
            break;
        case 'susu':
            preFillSusuForm(entry);
            break;
        case 'poti':
            preFillPotiForm(entry);
            break;
        case 'temp':
            preFillTempForm(entry);
            break;
        case 'weight':
            preFillWeightForm(entry);
            break;
        case 'speech':
            preFillSpeechForm(entry);
            break;
    }
}

/**
 * Pre-fill feed form fields
 * @param {Object} entry - Feed entry data
 */
function preFillFeedForm(entry) {
    const feedTypeField = document.getElementById('feed-type');
    const feedAmountField = document.getElementById('feed-amount');
    const feedNotesField = document.getElementById('feed-notes');

    if (entry.feed_type && feedTypeField) {
        feedTypeField.value = entry.feed_type;
    }
    if (entry.feed_amount && feedAmountField) {
        feedAmountField.value = entry.feed_amount;
    }
    if (entry.notes && feedNotesField) {
        feedNotesField.value = entry.notes;
    }
}

/**
 * Pre-fill susu (wet diaper) form fields
 * @param {Object} entry - Susu entry data
 */
function preFillSusuForm(entry) {
    const susuCountField = document.getElementById('susu-count');
    const susuItemTypeField = document.getElementById('susu-item-type');
    const susuColorField = document.getElementById('susu-color');
    const susuNotesField = document.getElementById('susu-notes');

    if (entry.susu_count && susuCountField) {
        susuCountField.value = entry.susu_count;
    }

    // Parse structured metadata from notes
    const { itemType, color, text } = parseSusuNotes(entry.notes);

    if (itemType && susuItemTypeField) {
        susuItemTypeField.value = itemType;
    }
    if (color && susuColorField) {
        susuColorField.value = color;
    }
    if (text && susuNotesField) {
        susuNotesField.value = text;
    } else if (entry.notes && !color && !itemType && susuNotesField) {
        // Fallback to raw notes if no structured data
        susuNotesField.value = entry.notes;
    }
}

/**
 * Pre-fill poti (soiled diaper) form fields
 * @param {Object} entry - Poti entry data
 */
function preFillPotiForm(entry) {
    const potiCountField = document.getElementById('poti-count');
    const potiColorField = document.getElementById('poti-color');
    const potiItemTypeField = document.getElementById('poti-item-type');
    const potiConsistencyField = document.getElementById('poti-consistency');
    const potiNotesField = document.getElementById('poti-notes');

    if (entry.poti_count && potiCountField) {
        potiCountField.value = entry.poti_count;
    }
    if (entry.poti_color && potiColorField) {
        potiColorField.value = entry.poti_color;
    }

    // Parse structured metadata from notes
    const { itemType, consistency, text } = parsePotiNotes(entry.notes);

    if (itemType && potiItemTypeField) {
        potiItemTypeField.value = itemType;
    }
    if (consistency && potiConsistencyField) {
        potiConsistencyField.value = consistency;
    }
    if (text && potiNotesField) {
        potiNotesField.value = text;
    } else if (entry.notes && !consistency && !itemType && potiNotesField) {
        // Fallback to raw notes if no structured data
        potiNotesField.value = entry.notes;
    }
}

/**
 * Pre-fill temperature form fields
 * @param {Object} entry - Temperature entry data
 */
function preFillTempForm(entry) {
    const tempValueField = document.getElementById('temp-value');
    const tempNotesField = document.getElementById('temp-notes');

    if (entry.temperature && tempValueField) {
        tempValueField.value = entry.temperature;

        // Trigger temperature warning if needed
        const temp = parseFloat(entry.temperature);
        const warning = document.getElementById('temp-warning');
        if (warning && temp >= 38) {
            warning.classList.remove('hidden');
        }
    }
    if (entry.notes && tempNotesField) {
        tempNotesField.value = entry.notes;
    }
}

/**
 * Pre-fill weight form fields
 * @param {Object} entry - Weight entry data
 */
function preFillWeightForm(entry) {
    const weightValueField = document.getElementById('weight-value');
    const weightNotesField = document.getElementById('weight-notes');

    if (entry.weight && weightValueField) {
        weightValueField.value = entry.weight;
    }
    if (entry.notes && weightNotesField) {
        weightNotesField.value = entry.notes;
    }
}

/**
 * Pre-fill speech form fields
 * @param {Object} entry - Speech entry data
 */
function preFillSpeechForm(entry) {
    const speechTranscriptionField = document.getElementById('speech-transcription');
    const speechNotesField = document.getElementById('speech-notes');
    const speechCategoryField = document.getElementById('speech-category');
    const speechModeField = document.getElementById('speech-mode');
    const speechAudioEl = document.getElementById('speech-audio');

    if (entry.transcription && speechTranscriptionField) {
        speechTranscriptionField.value = entry.transcription;
    }
    if (entry.notes && speechNotesField) {
        speechNotesField.value = entry.notes;
    }
    if (entry.category && speechCategoryField) {
        speechCategoryField.value = entry.category;
    }
    if (entry.mode && speechModeField) {
        speechModeField.value = entry.mode;
    }

    // Notify speech module about the entry being edited
    const event = new CustomEvent('modal:speech-editing', { detail: entry });
    window.dispatchEvent(event);
}

// ============================================================================
// Date/Time Helpers
// ============================================================================

/**
 * Set date and time fields to current date/time
 * @param {string} type - Modal type
 */
function setCurrentDateTime(type) {
    const { date, time } = getCurrentDateTime();

    const dateField = document.getElementById(`${type}-date`);
    const timeField = document.getElementById(`${type}-time`);

    if (dateField) dateField.value = date;
    if (timeField) timeField.value = time;
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Initialize modal event listeners
 */
function initializeModalListeners() {
    // Close modal on background click
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            MODAL_TYPES.forEach(type => {
                if (event.target.id === `${type}-modal`) {
                    closeModal(type);
                }
            });
        }
    });

    // Temperature warning
    const tempValueField = document.getElementById('temp-value');
    if (tempValueField) {
        tempValueField.addEventListener('input', (e) => {
            const temp = parseFloat(e.target.value);
            const warning = document.getElementById('temp-warning');
            if (warning) {
                if (temp >= 38) {
                    warning.classList.remove('hidden');
                } else {
                    warning.classList.add('hidden');
                }
            }
        });
    }

    // Listen for speech module events
    window.addEventListener('speech:close-modal', () => {
        closeModal('speech');
    });
}

// Initialize listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModalListeners);
} else {
    initializeModalListeners();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Modal management API
 */
export const modals = {
    /**
     * Open a modal
     * @param {string} type - Modal type (feed, susu, poti, temp, weight, speech)
     * @param {Object|null} entry - Entry data to edit (null for new entry)
     */
    open: openModal,

    /**
     * Close a modal
     * @param {string} type - Modal type to close
     */
    close: closeModal,

    /**
     * Close all open modals
     */
    closeAll: closeAllModals,

    /**
     * Set current date/time for a modal
     * @param {string} type - Modal type
     */
    setCurrentDateTime: setCurrentDateTime
};

// Export for window.modals access (for onclick handlers in HTML)
if (typeof window !== 'undefined') {
    window.modals = modals;
}

export default modals;
