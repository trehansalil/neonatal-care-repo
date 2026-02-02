/**
 * File: state.js
 * Purpose: Application State Management
 * Part of: tracker.html modular JavaScript
 */

// Main application state
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

// Speech recording state
let speechRecorder = null;
let speechStream = null;
let speechChunks = [];
let speechTimerInterval = null;
let speechStartTime = null;
let speechDraft = null;
let speechStatus = 'idle';
let selectedMimeType = 'audio/webm';
let currentPlaceholderIndex = 0;
let placeholderRotationInterval = null;

// Transcription polling state - using SSE for push notifications
let sseConnection = null;
let pendingSpeechEntries = new Set(); // Track entries waiting for transcription

// Diaper timer state
let diaperTimerInterval = null;
let lastDiaperChangeTime = null;
let webhookConfig = { configured: false, webhook_url: null, diaper_alert_hours: 3 };
