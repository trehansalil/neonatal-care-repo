/**
 * Entry Utility Functions
 * Helpers for determining entry types and properties
 */

import { parseSusuNotes, parsePotiNotes } from './note-parser.js';

/**
 * Determine entry type for filtering and UI labeling
 * @param {Object} entry - Entry object
 * @returns {string} Entry type: 'speech', 'feed', 'susu', 'poti', 'temp', 'weight', or 'unknown'
 */
export function getEntryType(entry) {
  if (entry.type === 'speech' || entry.audioUrl || entry.mode === 'speech') {
    return 'speech';
  }
  if (entry.feed_amount || entry.feed_type) {
    return 'feed';
  }
  if (entry.susu_count > 0) {
    return 'susu';
  }
  if (entry.poti_count > 0) {
    return 'poti';
  }
  if (entry.temperature) {
    return 'temp';
  }
  if (entry.weight) {
    return 'weight';
  }
  return 'unknown';
}

/**
 * Get item type (diaper/nappy) from entry notes
 * @param {Object} entry - Entry object
 * @returns {string|null} Item type: 'diaper', 'nappy', or null
 */
export function getEntryItemType(entry) {
  if (entry.susu_count > 0) {
    return parseSusuNotes(entry.notes).itemType;
  }
  if (entry.poti_count > 0) {
    return parsePotiNotes(entry.notes).itemType;
  }
  return null;
}

/**
 * Check if entry has diaper change data
 * @param {Object} entry - Entry object
 * @returns {boolean} True if entry has wet or soiled diaper data
 */
export function isDiaperEntry(entry) {
  return (entry.susu_count && entry.susu_count > 0) || (entry.poti_count && entry.poti_count > 0);
}

/**
 * Check if entry is a feed entry
 * @param {Object} entry - Entry object
 * @returns {boolean} True if entry has feed data
 */
export function isFeedEntry(entry) {
  return entry.feed_amount || entry.feed_type;
}

/**
 * Check if entry matches filter types
 * @param {Object} entry - Entry object
 * @param {Set<string>} typeFilters - Set of active filter types
 * @returns {boolean} True if entry matches at least one active filter
 */
export function matchesFilters(entry, typeFilters) {
  if (!typeFilters || typeFilters.size === 0) return true;

  const entryType = getEntryType(entry);
  return typeFilters.has(entryType);
}
