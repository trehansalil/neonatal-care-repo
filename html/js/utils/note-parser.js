/**
 * Note Parsing Utilities
 * Extracts structured metadata from note text fields
 */

/**
 * Generic note metadata parser for "Label: value" prefixes
 * @param {string} noteText - Note text to parse
 * @param {string} label - Label to search for (e.g., "Item", "Urine color")
 * @param {string[]} validValues - Optional array of valid values to validate against
 * @returns {{value: string|null, remaining: string, error: string|null}}
 */
export function parseNoteField(noteText, label, validValues = []) {
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

/**
 * Build notes string with structured metadata prefixes
 * @param {Array<{label: string, value: string}>} metadataParts - Array of label-value pairs
 * @param {string} freeText - Free-form text to append
 * @returns {string} Combined notes string
 */
export function buildNotes(metadataParts, freeText) {
  const meta = metadataParts
    .filter(part => part.value)
    .map(part => `${part.label}: ${part.value}`)
    .join('. ');

  const text = freeText?.trim();
  return [meta, text].filter(Boolean).join('. ').trim();
}

/**
 * Parse susu (wet diaper) notes to extract structured metadata
 * @param {string} noteText - Notes text from entry
 * @returns {{itemType: string|null, color: string|null, text: string, errors: string[]}}
 */
export function parseSusuNotes(noteText) {
  if (!noteText) return { itemType: null, color: null, text: '', errors: [] };

  const itemParsed = parseNoteField(noteText, 'Item', ['diaper', 'nappy']);
  const colorParsed = parseNoteField(itemParsed.remaining, 'Urine color', [
    'clear',
    'pale_yellow',
    'dark_yellow',
    'orange',
    'red'
  ]);

  return {
    itemType: itemParsed.value,
    color: colorParsed.value,
    text: colorParsed.remaining || itemParsed.remaining,
    errors: [itemParsed.error, colorParsed.error].filter(Boolean)
  };
}

/**
 * Parse poti (soiled diaper) notes to extract structured metadata
 * @param {string} noteText - Notes text from entry
 * @returns {{itemType: string|null, consistency: string|null, text: string, errors: string[]}}
 */
export function parsePotiNotes(noteText) {
  if (!noteText) return { itemType: null, consistency: null, text: '', errors: [] };

  const itemParsed = parseNoteField(noteText, 'Item', ['diaper', 'nappy']);
  const consistencyParsed = parseNoteField(itemParsed.remaining, 'Consistency', [
    'loose',
    'soft',
    'normal',
    'hard',
    'watery'
  ]);

  return {
    itemType: itemParsed.value,
    consistency: consistencyParsed.value,
    text: consistencyParsed.remaining || itemParsed.remaining,
    errors: [itemParsed.error, consistencyParsed.error].filter(Boolean)
  };
}

/**
 * Format item subtitle with count and descriptor
 * @param {number} count - Number of items
 * @param {string} descriptor - Descriptor (e.g., "wet", "soiled")
 * @param {string} itemType - Type of item ("diaper", "nappy", or null)
 * @returns {string} Formatted subtitle
 */
export function formatItemSubtitle(count, descriptor, itemType) {
  const base = itemType === 'nappy' ? 'nappy' : itemType === 'diaper' ? 'diaper' : 'item';
  const pluralBase = count === 1 ? base : `${base}s`;
  return `${count} ${descriptor} ${pluralBase}`;
}
