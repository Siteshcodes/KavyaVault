/**
 * काव्यकलश (KavyaVault) — Semantic Text Preparation & Source Hashing (semanticPreparation.js)
 * Phase 5 / Task 5.2: Local Semantic Representation
 *
 * Prepares poem and query texts for semantic representation.
 * Preserves Hindi Devanagari Unicode faithfully without destructive normalization.
 */

/**
 * Normalizes text for semantic processing:
 * - NFC Unicode normalization.
 * - Trims leading and trailing whitespace.
 * - Collapses consecutive spaces/tabs to a single space while preserving line structure.
 * - Preserves Devanagari conjuncts, matras, nuktas, halant, chandrabindu, and emojis.
 *
 * @param {*} input
 * @returns {string} Normalized string
 */
export function normalizeSemanticText(input) {
  if (input === null || input === undefined) {
    return '';
  }

  const str = String(input);
  if (str.trim() === '') {
    return '';
  }

  return str
    .normalize('NFC')
    .replace(/[^\S\r\n]+/g, ' ') // Collapse horizontal whitespace
    .replace(/\r\n/g, '\n')      // Normalize line breaks
    .replace(/\n{3,}/g, '\n\n')  // Bound excessive empty lines
    .trim();
}

/**
 * Prepares semantic text representation from a poem record.
 * Includes only fields genuinely useful for semantic retrieval:
 * - title
 * - body
 * - author (if present)
 * - tags (if present)
 *
 * Strictly EXCLUDES:
 * - manuscript image data or base64 blobs
 * - internal storage keys / identifiers
 * - user browser state / favorites / archive flags
 * - AI analysis internal status
 *
 * @param {Object} poem
 * @returns {string} Clean, normalized semantic text representation
 */
export function preparePoemSemanticText(poem) {
  if (!poem || typeof poem !== 'object') {
    return '';
  }

  const parts = [];

  // Title
  if (poem.title && typeof poem.title === 'string') {
    const normTitle = normalizeSemanticText(poem.title);
    if (normTitle) {
      parts.push(`शीर्षक: ${normTitle}`);
    }
  }

  // Author
  if (poem.author && typeof poem.author === 'string') {
    const normAuthor = normalizeSemanticText(poem.author);
    if (normAuthor) {
      parts.push(`रचनाकार: ${normAuthor}`);
    }
  }

  // Tags
  if (Array.isArray(poem.tags) && poem.tags.length > 0) {
    const validTags = poem.tags
      .map(t => normalizeSemanticText(t))
      .filter(t => t.length > 0);
    if (validTags.length > 0) {
      parts.push(`विषय / टैग: ${validTags.join(', ')}`);
    }
  }

  // Body
  if (poem.body && typeof poem.body === 'string') {
    const normBody = normalizeSemanticText(poem.body);
    if (normBody) {
      parts.push(normBody);
    }
  }

  return parts.join('\n\n');
}

/**
 * Prepares semantic text representation from a user query string.
 *
 * @param {string} query
 * @returns {string} Clean, normalized query string
 */
export function prepareQuerySemanticText(query) {
  if (typeof query !== 'string') {
    return '';
  }
  return normalizeSemanticText(query);
}

/**
 * Computes a deterministic 32-bit FNV-1a hash of semantic source text.
 * Used strictly for cache invalidation and change detection.
 * Does NOT leak poem content into the hash string.
 *
 * @param {string} text
 * @returns {string} Hexadecimal hash string (e.g. "fnv1a_a1b2c3d4")
 */
export function computeSourceTextHash(text) {
  const norm = normalizeSemanticText(text);
  if (!norm) {
    return 'fnv1a_00000000';
  }

  // 32-bit FNV-1a algorithm
  let hash = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    const code = norm.charCodeAt(i);
    hash ^= (code & 0xff);
    hash = Math.imul(hash, 0x01000193);
    if (code > 0xff) {
      hash ^= ((code >> 8) & 0xff);
      hash = Math.imul(hash, 0x01000193);
    }
  }

  // Convert to unsigned 32-bit hex
  const unsigned = hash >>> 0;
  return `fnv1a_${unsigned.toString(16).padStart(8, '0')}`;
}
