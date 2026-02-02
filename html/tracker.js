/** 
 * tracker.js 
 * Baby Tracker Application Logic 
 * 
 * @author Salil Trehan 
 * @created 2026-02-02 
 * @version 1.0.0 
 */

'use strict';

const API_BASE_URL = '/api';
const SPEECH_UPLOAD_URL = `${API_BASE_URL}/speech/upload`;
const SPEECH_TRANSCRIBE_URL = `${API_BASE_URL}/speech/transcribe`;
const SPEECH_ENTRIES_URL = `${API_BASE_URL}/speech_entries`;

let entries = [];
let speechEntries = [];
let speechStatus = 'idle';

function startSpeechRecording() {
  console.log('Recording started...');
}

function stopSpeechRecording() {
  console.log('Recording stopped...');
}

function initializeSSE() {
  console.log('Initializing SSE...');
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('Baby Tracker Initialized');
  initializeSSE();
});
