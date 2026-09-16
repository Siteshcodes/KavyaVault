/**
 * काव्यकलश (KavyaVault) — Text Search Provider (TextSearchProvider.js)
 * Phase 5 / Task 5.1: Intelligent Search Foundation
 *
 * Implements ISearchProvider using KavyaVault's deterministic, Unicode-safe
 * relevance scoring and multi-word matching engine.
 */

import { ISearchProvider } from './ISearchProvider.js';
import {
  SEARCH_MODE,
  SEARCH_STATUS,
  createSearchQuery,
  createSearchResult
} from './searchTypes.js';
import {
  normalizeSearchText,
  tokenizeQuery,
  scorePoemMatch
} from '../SearchService.js';
import { poemRepository } from '../PoemRepository.js';

export class TextSearchProvider extends ISearchProvider {
  /**
   * @param {Object} [options={}]
   * @param {Object} [options.poemRepo=poemRepository] Default poem repository
   */
  constructor(options = {}) {
    super();
    this.poemRepo = options.poemRepo || poemRepository;
  }

  getMode() {
    return SEARCH_MODE.TEXT;
  }

  getName() {
    return 'KavyaVault Deterministic Text Search';
  }

  isAvailable() {
    return true;
  }

  /**
   * Applies metadata filters to poems collection
   * @private
   */
  _applyFilters(poems, filters = {}) {
    if (!filters || typeof filters !== 'object') {
      return poems;
    }

    return poems.filter(poem => {
      if (!poem || typeof poem !== 'object') return false;

      // 1. Archive filter: default to excluding archived unless explicitly allowed
      if (typeof filters.isArchived === 'boolean') {
        if (Boolean(poem.isArchived) !== filters.isArchived) return false;
      } else if (filters.includeArchived !== true) {
        // If not specified, default to non-archived
        if (Boolean(poem.isArchived)) return false;
      }

      // 2. Favorite filter
      if (typeof filters.isFavorite === 'boolean') {
        if (Boolean(poem.isFavorite) !== filters.isFavorite) return false;
      }

      // 3. Category filter
      if (typeof filters.category === 'string' && filters.category.trim() !== '') {
        const normPoemCat = normalizeSearchText(poem.category || '');
        const normFilterCat = normalizeSearchText(filters.category);
        if (normPoemCat !== normFilterCat) return false;
      }

      // 4. Mood / Rasa filter
      if (typeof filters.mood === 'string' && filters.mood.trim() !== '') {
        const normPoemMood = normalizeSearchText(poem.mood || poem.rasa || '');
        const normFilterMood = normalizeSearchText(filters.mood);
        if (normPoemMood !== normFilterMood) return false;
      }

      // 5. Tags filter (matches if poem contains any of the filtered tags)
      if (Array.isArray(filters.tags) && filters.tags.length > 0) {
        const normPoemTags = Array.isArray(poem.tags) ? poem.tags.map(t => normalizeSearchText(t)) : [];
        const matchesAnyTag = filters.tags.some(ft => normPoemTags.includes(normalizeSearchText(ft)));
        if (!matchesAnyTag) return false;
      }

      return true;
    });
  }

  /**
   * Executes deterministic text search against poem collection
   *
   * @param {Object|string} queryInput
   * @param {Object} [options={}]
   * @param {Array<Object>} [options.poems] Optional explicit poems array
   * @returns {Promise<{
   *   results: Array<Object>,
   *   query: string,
   *   totalCount: number,
   *   status: string
   * }>}
   */
  async search(queryInput, options = {}) {
    const query = typeof queryInput === 'string'
      ? createSearchQuery({ text: queryInput })
      : createSearchQuery(queryInput);

    const normalizedQuery = normalizeSearchText(query.text);
    const terms = tokenizeQuery(query.text);

    // Empty query handling: return empty results array cleanly
    if (!normalizedQuery || terms.length === 0) {
      return {
        results: [],
        query: normalizedQuery,
        totalCount: 0,
        status: SEARCH_STATUS.EMPTY
      };
    }

    // Resolve poems collection (from options or repository)
    let candidatePoems = [];
    if (Array.isArray(options.poems)) {
      candidatePoems = options.poems;
    } else if (this.poemRepo && typeof this.poemRepo.getAll === 'function') {
      try {
        candidatePoems = this.poemRepo.getAll({ includeArchived: true });
      } catch (err) {
        candidatePoems = [];
      }
    }

    // Apply metadata filters
    candidatePoems = this._applyFilters(candidatePoems, query.filters);

    const matches = [];

    for (const poem of candidatePoems) {
      const match = scorePoemMatch(poem, terms, normalizedQuery);
      if (match.matched) {
        // Compute which specific fields contributed to the match
        const matchedFields = [];
        const normTitle = normalizeSearchText(poem.title || '');
        const normBody = normalizeSearchText(poem.body || '');
        const normAuthor = normalizeSearchText(poem.author || '');
        const normTags = Array.isArray(poem.tags) ? poem.tags.map(t => normalizeSearchText(t)) : [];
        const normCategory = normalizeSearchText(poem.category || '');

        if (terms.some(t => normTitle.includes(t))) matchedFields.push('title');
        if (terms.some(t => normBody.includes(t))) matchedFields.push('body');
        if (terms.some(t => normAuthor.includes(t))) matchedFields.push('author');
        if (terms.some(t => normTags.some(tag => tag.includes(t)))) matchedFields.push('tags');
        if (terms.some(t => normCategory.includes(t))) matchedFields.push('category');

        matches.push(
          createSearchResult({
            poemId: poem.id,
            poem,
            score: match.score,
            source: SEARCH_MODE.TEXT,
            matchedFields,
            matchContext: match.matchContext
          })
        );
      }
    }

    // Deterministic Sort:
    // 1. Relevance score descending
    // 2. Updated / created timestamp descending
    // 3. Poem ID ascending (guaranteed absolute tie-breaker)
    matches.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const timeA = new Date((a.poem && (a.poem.updatedAt || a.poem.createdAt)) || 0).getTime();
      const timeB = new Date((b.poem && (b.poem.updatedAt || b.poem.createdAt)) || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return String(a.poemId).localeCompare(String(b.poemId));
    });

    return {
      results: matches,
      query: normalizedQuery,
      totalCount: matches.length,
      status: matches.length > 0 ? SEARCH_STATUS.SUCCESS : SEARCH_STATUS.EMPTY
    };
  }
}
