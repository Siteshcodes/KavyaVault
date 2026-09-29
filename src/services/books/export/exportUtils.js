/**
 * काव्यकलश (KavyaVault) — Export Utilities (exportUtils.js)
 * Phase 7 / Task 7.4: Local PDF & EPUB Export
 *
 * Safe utilities for:
 * - Deterministic, sanitized file name generation
 * - Strict XML/XHTML escaping for EPUB
 * - PDF text string and hex encoding
 * - HTML/XSS sanitization preventing malicious injection
 */

/**
 * Generates a safe, sanitized filename for exported books
 * Strips filesystem-illegal characters across Windows, macOS, and Linux
 * @param {string} rawTitle - Book title
 * @param {string} ext - File extension ('pdf' | 'epub')
 * @returns {string} Sanitized filename
 */
export function generateSafeExportFilename(rawTitle, ext) {
  const cleanExt = (ext || 'pdf').toLowerCase().replace(/^\.+/, '');
  
  if (!rawTitle || typeof rawTitle !== 'string' || rawTitle.trim() === '') {
    return `kavyavault-book.${cleanExt}`;
  }

  // Unicode normalize NFKC
  let normalized = rawTitle.normalize('NFKC').trim();

  // Strip illegal filesystem characters: \ / : * ? " < > | and control chars (0x00-0x1F)
  // Also strip carriage returns and newlines
  normalized = normalized
    .replace(/[\\/:*?"<>|\r\n\t\x00-\x1F]/g, '')
    // Replace multiple spaces or tabs with single space
    .replace(/\s+/g, ' ')
    .trim();

  // Limit to 64 characters to prevent OS path limit overflow
  if (normalized.length > 64) {
    normalized = normalized.slice(0, 64).trim();
  }

  if (normalized === '') {
    return `kavyavault-book.${cleanExt}`;
  }

  return `${normalized}.${cleanExt}`;
}

/**
 * Escapes characters for XML text content
 * Strict XML 1.0 entity encoding
 * @param {*} str
 * @returns {string}
 */
export function xmlEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes characters for XML attribute values (includes quotes)
 * @param {*} str
 * @returns {string}
 */
export function xmlAttributeEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitizes arbitrary text against script injection or malicious links
 * Strips script tags, iframes, and javascript: pseudo-protocols
 * @param {string} text
 * @returns {string} Safe text
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<img\b[^>]*\/?>/gi, '')
    .replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, 'unsafe-link:');
}

/**
 * Converts a JavaScript Unicode string into UTF-16BE hex format for PDF text strings
 * Example: 'क' (U+0915) -> '0915'
 * Enclosed in angle brackets: '<0915...>'
 * @param {string} str
 * @returns {string} Hex encoded string (e.g. '<09150935...>')
 */
export function encodeUtf16BeHex(str) {
  if (!str) return '<>';
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const hexVal = code.toString(16).toUpperCase().padStart(4, '0');
    hex += hexVal;
  }
  return `<${hex}>`;
}

/**
 * Converts Western digits to Devanagari numerals (०-९)
 * @param {number|string} num
 * @returns {string}
 */
export function toDevanagariNumerals(num) {
  if (num === null || num === undefined) return '';
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, d => digits[Number(d)]);
}
