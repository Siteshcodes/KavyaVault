/**
 * काव्यकलश (KavyaVault) — Search Domain Model & Enums (searchTypes.js)
 * Phase 5 / Task 5.1: Intelligent Search Foundation
 *
 * Defines controlled search modes, query validation rules, and normalized result schemas.
 */

import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

/**
 * Controlled search execution modes
 */
export const SEARCH_MODE = Object.freeze({
  TEXT: 'text',
  SEMANTIC: 'semantic',
  HYBRID: 'hybrid'
});

export const VALID_SEARCH_MODES = Object.freeze(Object.values(SEARCH_MODE));

/**
 * Search operation result statuses
 */
export const SEARCH_STATUS = Object.freeze({
  SUCCESS: 'success',
  EMPTY: 'empty',
  UNSUPPORTED: 'unsupported',
  ERROR: 'error'
});

export const VALID_SEARCH_STATUSES = Object.freeze(Object.values(SEARCH_STATUS));

/**
 * Validates a search query object.
 *
 * @param {Object} query
 * @throws {StorageError} if query is malformed or invalid
 */
export function validateSearchQuery(query) {
  if (!query || typeof query !== 'object') {
    throw new StorageError(
      'खोज अनुरोध (Search Query) एक ऑब्जेक्ट होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // Text is required and must be a string (can be empty string)
  if (typeof query.text !== 'string') {
    throw new StorageError(
      'खोज पाठ (text) स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // Mode validation
  if (query.mode !== undefined && query.mode !== null) {
    if (typeof query.mode !== 'string' || !VALID_SEARCH_MODES.includes(query.mode.toLowerCase())) {
      throw new StorageError(
        `अमान्य खोज मोड: "${query.mode}"। मान्य मोड: ${VALID_SEARCH_MODES.join(', ')}।`,
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  // Filters validation (if provided, must be object)
  if (query.filters !== undefined && query.filters !== null) {
    if (typeof query.filters !== 'object' || Array.isArray(query.filters)) {
      throw new StorageError(
        'खोज फ़िल्टर (filters) एक ऑब्जेक्ट होना अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    const { category, tags, mood, isFavorite, isArchived } = query.filters;

    if (category !== undefined && category !== null && typeof category !== 'string') {
      throw new StorageError('श्रेणी फ़िल्टर (category) स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
      throw new StorageError('टैग फ़िल्टर (tags) ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (mood !== undefined && mood !== null && typeof mood !== 'string') {
      throw new StorageError('मूड/भाव फ़िल्टर (mood) स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (isFavorite !== undefined && typeof isFavorite !== 'boolean') {
      throw new StorageError('पसंदीदा फ़िल्टर (isFavorite) बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (isArchived !== undefined && typeof isArchived !== 'boolean') {
      throw new StorageError('अभिलेखागार फ़िल्टर (isArchived) बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }
}

/**
 * Creates and normalizes a SearchQuery object.
 *
 * @param {Object} options
 * @param {string} [options.text='']
 * @param {string} [options.mode='text']
 * @param {Object} [options.filters={}]
 * @returns {Readonly<{
 *   text: string,
 *   mode: string,
 *   filters: Object
 * }>}
 */
export function createSearchQuery(options = {}) {
  const mode = (options.mode !== undefined && options.mode !== null)
    ? (typeof options.mode === 'string' ? options.mode.trim().toLowerCase() : options.mode)
    : SEARCH_MODE.TEXT;

  const query = {
    text: typeof options.text === 'string' ? options.text : '',
    mode,
    filters: options.filters && typeof options.filters === 'object' && !Array.isArray(options.filters)
      ? { ...options.filters }
      : {}
  };

  validateSearchQuery(query);
  return Object.freeze(query);
}

/**
 * Normalizes an individual search result item.
 *
 * @param {Object} data
 * @returns {Readonly<{
 *   poemId: string,
 *   poem: Object|null,
 *   score: number,
 *   source: string,
 *   matchedFields: Array<string>,
 *   matchContext: string|null
 * }>}
 */
export function createSearchResult(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new StorageError('खोज परिणाम डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  const poemId = String(data.poemId || (data.poem && data.poem.id) || '');
  if (!poemId) {
    throw new StorageError('खोज परिणाम में मान्य कविता आईडी (poemId) होना अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  const score = typeof data.score === 'number' && Number.isFinite(data.score) ? data.score : 0;
  const source = typeof data.source === 'string' ? data.source : SEARCH_MODE.TEXT;
  const matchedFields = Array.isArray(data.matchedFields)
    ? [...new Set(data.matchedFields.filter(f => typeof f === 'string'))]
    : [];
  const matchContext = typeof data.matchContext === 'string' ? data.matchContext : null;
  const poem = data.poem && typeof data.poem === 'object' ? data.poem : null;

  return Object.freeze({
    poemId,
    poem,
    score,
    source,
    matchedFields,
    matchContext
  });
}
