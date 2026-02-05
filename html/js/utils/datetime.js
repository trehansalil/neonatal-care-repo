/**
 * Date and Time Utility Functions
 * Handles datetime formatting and calculations
 */

/**
 * Get current date and time in local timezone
 * @returns {{date: string, time: string}} Date in YYYY-MM-DD, time in HH:mm
 */
export function getCurrentDateTime() {
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

/**
 * Format duration in milliseconds to mm:ss
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration (e.g., "03:45")
 */
export function formatDuration(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * Format time elapsed since a timestamp
 * @param {string|Date} timestamp - Timestamp to compare against
 * @returns {{hours: number, minutes: number, display: string}}
 */
export function formatTimeSince(timestamp) {
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
 * Parse date and time strings into Date object
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} timeStr - Time string (HH:mm)
 * @param {boolean} asRangeEnd - If true, sets time to end of minute (59.999s)
 * @returns {Date|null}
 */
export function parseDateTime(dateStr, timeStr, asRangeEnd = false) {
  if (!dateStr || !timeStr) return null;

  const ts = new Date(`${dateStr}T${timeStr}`);
  if (isNaN(ts)) return null;

  if (asRangeEnd) {
    ts.setSeconds(59, 999);
  } else {
    ts.setSeconds(0, 0);
  }

  return ts;
}

/**
 * Format Date object as local datetime string (YYYY-MM-DDTHH:mm:ss.SSS)
 * This ensures the backend interprets it as local time, not UTC
 * @param {Date} date - Date object to format
 * @returns {string|null} Formatted datetime string
 */
export function formatDateTimeForBackend(date) {
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

/**
 * Combine date and time inputs into timestamp string
 * @param {string} dateValue - Date value (YYYY-MM-DD)
 * @param {string} timeValue - Time value (HH:mm)
 * @returns {string} Combined timestamp (YYYY-MM-DDTHH:mm)
 */
export function combineDateTime(dateValue, timeValue) {
  return `${dateValue}T${timeValue}`;
}
