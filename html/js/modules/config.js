/**
 * File: config.js
 * Purpose: API Configuration and Constants
 * Part of: tracker.html modular JavaScript
 */

// API Endpoints
const API_BASE_URL = '/api';
const SPEECH_UPLOAD_URL = `${API_BASE_URL}/speech/upload`;
const SPEECH_TRANSCRIBE_URL = `${API_BASE_URL}/speech/transcribe`;
const SPEECH_ENTRIES_URL = `${API_BASE_URL}/speech_entries`;

// Constants
const DIAPER_ALERT_HOURS = 3; // Alert threshold in hours

const STORAGE_KEYS = {
    metric: 'tracker.metric',
    range: 'tracker.range',
    view: 'tracker.view',
    cumulative: 'tracker.cumulative'
};

// Rotating placeholder prompts for speech input
const placeholderPrompts = [
    'Say: "50ml formula milk at 2pm"...',
    'Say: "Stool was soft and yellow"...',
    'Say: "Baby had susu just now"...',
    'Say: "Fed 60ml at lunch time"...',
    'Say: "Urine diaper at 3:30pm"...',
    'Say: "Temperature log of 98.6°F"...',
    'Say: "Weight entry of 4.312 Kg"...'
];
