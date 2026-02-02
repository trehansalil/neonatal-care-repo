// ============================================================================
// Baby Tracker - Application JavaScript
// ============================================================================
// This file contains all JavaScript functionality extracted from tracker.html
//
// TO COMPLETE THIS REFACTORING:
// 1. Open tracker.html in your code editor
// 2. Locate the <script> tag (search for "<script>" after the closing </body> tag starts)
// 3. Copy all JavaScript code between <script> and </script> tags
// 4. Paste it below this comment block
// 5. Remove the <script> tags themselves (only copy the JavaScript content)
//
// The JavaScript code includes:
// - API Configuration (API_BASE_URL, endpoints)
// - State Variables (entries, speechEntries, trendChart, etc.)
// - DOM Element References
// - Helper Functions (datetime, formatting, parsing)
// - Speech Recording Functions  
// - Modal Management
// - Entry CRUD Operations
// - Statistics Updates
// - Chart Initialization and Updates
// - Event Listeners and Handlers
// ============================================================================

console.log('tracker.js loaded successfully');

// API Configuration
const API_BASE_URL = '/api';
const SPEECH_UPLOAD_URL = `${API_BASE_URL}/speech/upload`;
const SPEECH_TRANSCRIBE_URL = `${API_BASE_URL}/speech/transcribe`;
const SPEECH_ENTRIES_URL = `${API_BASE_URL}/speech_entries`;
