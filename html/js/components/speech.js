/**
 * Speech Recording Module
 *
 * Handles all speech recording functionality including:
 * - Audio recording with MediaRecorder API
 * - Real-time transcription via SSE
 * - Speech entry management
 * - UI updates for recording states
 * - Fallback polling for transcription status
 *
 * @module components/speech
 */

import { state } from '../core/state.js';
import { api } from '../core/api.js';
import { formatDuration, getCurrentDateTime } from '../utils/datetime.js';
import { showToast } from '../utils/toast.js';

// ============================================================================
// DOM Element References
// ============================================================================

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

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Rotating placeholder prompts shown when user is idle
 */
const placeholderPrompts = [
    'Say: "50ml formula milk at 2pm"...',
    'Say: "Stool was soft and yellow"...',
    'Say: "Baby had susu just now"...',
    'Say: "Fed 60ml at lunch time"...',
    'Say: "Urine diaper at 3:30pm"...',
    'Say: "Temperature log of 98.6°F"...',
    'Say: "Weight entry of 4.312 Kg"...'
];

// ============================================================================
// Module State
// ============================================================================

let speechRecorder = null;
let speechStream = null;
let speechChunks = [];
let speechTimerInterval = null;
let speechStartTime = null;
let speechDraft = null;
let speechStatus = 'idle'; // 'idle' | 'recording' | 'paused' | 'stopped'
let selectedMimeType = 'audio/webm';
let currentPlaceholderIndex = 0;
let placeholderRotationInterval = null;
let sseConnection = null;
let pendingSpeechEntries = new Set(); // Track entries waiting for transcription
let fallbackPollingInterval = null;

// ============================================================================
// Placeholder Rotation
// ============================================================================

/**
 * Start rotating placeholder prompts when idle
 */
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

/**
 * Stop rotating placeholder prompts
 */
function stopPlaceholderRotation() {
    if (placeholderRotationInterval) {
        clearInterval(placeholderRotationInterval);
        placeholderRotationInterval = null;
    }
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Reset speech waveform bars to default or active state
 * @param {boolean} active - Whether to show active (animated) state
 */
function resetSpeechBars(active = false) {
    speechBars.forEach(bar => {
        const height = active ? 30 + Math.random() * 50 : 8;
        bar.style.height = `${Math.round(height)}%`;
        bar.style.backgroundColor = active ? '#fb7185' : '#e2e8f0';
    });
}

/**
 * Update all speech UI elements to reflect current state
 */
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
                <button onclick="window.speech.discard()"
                    class="px-3 py-1.5 rounded-lg font-medium text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition-all"
                    aria-label="Discard">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Discard</span>
                </button>
                <button onclick="window.speech.save()"
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

/**
 * Stop the speech timer interval
 */
function stopSpeechTimer() {
    if (speechTimerInterval) {
        clearInterval(speechTimerInterval);
        speechTimerInterval = null;
    }
}

/**
 * Handle speech recording stop event
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

// ============================================================================
// Recording Lifecycle Functions
// ============================================================================

/**
 * Start speech recording
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

/**
 * Pause speech recording
 */
function pauseSpeechRecording() {
    if (speechRecorder && speechRecorder.state === 'recording') {
        speechRecorder.pause();
        speechStatus = 'paused';
        resetSpeechBars(false);
        updateSpeechUI();
    }
}

/**
 * Resume speech recording
 */
function resumeSpeechRecording() {
    if (speechRecorder && speechRecorder.state === 'paused') {
        speechRecorder.resume();
        speechStatus = 'recording';
        resetSpeechBars(true);
        updateSpeechUI();
    }
}

/**
 * Stop speech recording
 */
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

/**
 * Reset speech state to idle
 */
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

// ============================================================================
// Entry Management
// ============================================================================

/**
 * Clear speech draft text fields
 */
function clearSpeechDraft() {
    if (speechTranscriptionEl) speechTranscriptionEl.value = '';
    if (speechNotesEl) speechNotesEl.value = '';
}

/**
 * Discard current speech recording
 */
function discardSpeech() {
    resetSpeechState();
    // Close modal - needs to be called from external module
    const event = new CustomEvent('speech:close-modal');
    window.dispatchEvent(event);
}

/**
 * Save speech entry to server
 */
async function saveSpeechEntry() {
    if (!speechDraft) {
        showToast('Record a clip before saving.', 'error');
        return;
    }

    const appState = state.getState();
    const currentEditingEntry = appState.currentEditingEntry;

    // Parse datetime from form fields
    const dateTimeResult = getCurrentDateTime();
    const ts = (speechDateEl?.value && speechTimeEl?.value)
        ? new Date(`${speechDateEl.value}T${speechTimeEl.value}`)
        : new Date();

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
            const uploadResp = await api.uploadSpeech(formData);
            uploadResult = uploadResp;
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
        let saved;

        if (isEdit) {
            saved = await api.updateSpeechEntry(currentEditingEntry.id, payload);
        } else {
            saved = await api.createSpeechEntry(payload);
        }

        // Update state
        const newSpeechEntries = [saved, ...appState.speechEntries.filter(e => e.id !== saved.id)];
        state.setState({ speechEntries: newSpeechEntries });

        // Dispatch event to refresh UI
        const event = new CustomEvent('speech:saved', { detail: saved });
        window.dispatchEvent(event);

        // Show message about transcription status
        if (!transcription) {
            showToast('Speech saved. Waiting for transcription...', 'success');
            // Track this entry as pending
            pendingSpeechEntries.add(saved.id);
        } else {
            showToast('Speech saved.', 'success');
        }

        resetSpeechState();

        // Close modal - dispatch event for external handler
        const closeEvent = new CustomEvent('speech:close-modal');
        window.dispatchEvent(closeEvent);
    } catch (err) {
        console.error(err);
        showToast('Could not save speech entry', 'error');
    }
}

/**
 * Render recent speech entries
 */
function renderSpeechRecent() {
    if (!speechRecentEl) return;

    const appState = state.getState();
    const speechEntries = appState.speechEntries || [];

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

// ============================================================================
// SSE and Real-time Updates
// ============================================================================

/**
 * Initialize Server-Sent Events for real-time transcription updates
 */
function initializeSSE() {
    console.log('🔌 Initializing SSE connection...');
    // Close existing connection if any
    if (sseConnection) {
        sseConnection.close();
    }

    const sseUrl = `/api/events/transcription`;
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

            const { speech_entry_id, entry_id, success } = data;

            if (success) {
                // Refresh both speech entries (for notes update) and regular entries (for new entry)
                await Promise.all([
                    refreshSpeechEntries(),
                    refreshEntries()
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

/**
 * Refresh speech entries from server
 */
async function refreshSpeechEntries() {
    try {
        const speechEntries = await api.fetchSpeechEntries();
        state.setState({ speechEntries });
        renderSpeechRecent();

        // Dispatch event to notify other modules
        const event = new CustomEvent('speech:refreshed');
        window.dispatchEvent(event);

        console.log('🔄 Speech entries refreshed');
    } catch (error) {
        console.error('Failed to refresh speech entries:', error);
    }
}

/**
 * Refresh regular entries from server (for auto-mapping)
 */
async function refreshEntries() {
    try {
        const event = new CustomEvent('entries:refresh');
        window.dispatchEvent(event);
    } catch (error) {
        console.error('Failed to refresh entries:', error);
    }
}

/**
 * Start fallback polling for transcription status
 */
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
        await refreshEntries();
    }, 5000); // Poll every 5 seconds as fallback
}

/**
 * Stop fallback polling
 */
function stopFallbackPolling() {
    if (fallbackPollingInterval) {
        clearInterval(fallbackPollingInterval);
        fallbackPollingInterval = null;
        console.log('⏹️ Stopped fallback polling');
    }
}

// ============================================================================
// Re-transcription
// ============================================================================

/**
 * Re-transcribe a speech entry
 * @param {number} id - Speech entry ID
 */
async function reTranscribeEntry(id) {
    id = parseInt(id);
    const appState = state.getState();
    const entry = appState.speechEntries.find(e => e.id === id);

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
                    await api.deleteEntry(mappedId);
                    return true;
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
                await api.updateSpeechEntry(id, { notes: cleanedNotes });
                // Update local model
                entry.notes = cleanedNotes;
            }
        }

        // 2. Trigger Re-transcription
        showToast('Requesting re-transcription...', 'info');

        // Optimistic UI update
        entry.transcription = '';

        // Dispatch event to refresh UI
        const event = new CustomEvent('speech:transcription-started', { detail: { id } });
        window.dispatchEvent(event);

        await api.retranscribeSpeechEntry(id);

        if (deletedCount > 0) {
            showToast(`Cleaned up ${deletedCount} old entries. Transcription started.`, 'success');
            // Refresh main entries list to reflect deletions
            await refreshEntries();
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

// ============================================================================
// Public API - Export module functions
// ============================================================================

export const speech = {
    // Recording lifecycle
    start: startSpeechRecording,
    pause: pauseSpeechRecording,
    resume: resumeSpeechRecording,
    stop: stopSpeechRecording,
    reset: resetSpeechState,

    // Entry management
    save: saveSpeechEntry,
    discard: discardSpeech,
    clearDraft: clearSpeechDraft,

    // UI updates
    updateUI: updateSpeechUI,
    renderRecent: renderSpeechRecent,

    // SSE and real-time updates
    initSSE: initializeSSE,
    refresh: refreshSpeechEntries,

    // Re-transcription
    reTranscribe: reTranscribeEntry,

    // Placeholder rotation
    startPlaceholderRotation,
    stopPlaceholderRotation
};

// Export for window.speech access (for onclick handlers)
if (typeof window !== 'undefined') {
    window.speech = speech;
}

export default speech;
