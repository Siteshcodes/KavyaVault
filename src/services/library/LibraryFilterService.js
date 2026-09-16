/**
 * काव्यकलश (KavyaVault) — Library Filter & Sort Service (LibraryFilterService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Provides a unified query & organizational evaluation layer over poem collections:
 * - Multi-criteria filtering (collection, category, tags, favorite, archive, date ranges)
 * - Deterministic sorting (updatedAt, createdAt, title, authoredDate, viewedAt)
 * - Multi-tier tie-breaking: primary field -> updatedAt DESC -> poemId ASC
 * - Bounded pagination support (offset, limit)
 */

import {
  SORT_FIELD,
  SORT_ORDER,
  createLibraryFilter,
  normalizeTagName,
  generateCategorySlug
} from './libraryTypes.js';

export class LibraryFilterService {
  /**
   * @param {Object} [options={}]
   * @param {import('../CollectionRepository.js').CollectionRepository} [options.collectionRepo]
   * @param {import('./RecentPoemService.js').RecentPoemService} [options.recentService]
   */
  constructor(options = {}) {
    this.collectionRepo = options.collectionRepo || null;
    this.recentService = options.recentService || null;
  }

  /**
   * Evaluates library filter criteria and returns sorted, paginated results
   *
   * @param {Array<Object>} poems Corpus of poems
   * @param {Object} [filterInput={}] Library filter specification
   * @param {Object} [options={}] Context overrides
   * @param {Set<string>} [options.collectionPoemIds] Pre-resolved collection poem IDs
   * @param {Map<string, number>} [options.viewedAtMap] Pre-resolved poemId -> viewedAt timestamp
   * @returns {{
   *   poems: Array<Object>,
   *   totalCount: number,
   *   offset: number,
   *   limit: number|null,
   *   filter: Object
   * }}
   */
  query(poems = [], filterInput = {}, options = {}) {
    if (!Array.isArray(poems)) {
      return {
        poems: [],
        totalCount: 0,
        offset: 0,
        limit: null,
        filter: createLibraryFilter()
      };
    }

    const filter = createLibraryFilter(filterInput);

    // Resolve collection poem IDs if filtering by collection
    let collectionIdsSet = options.collectionPoemIds || null;
    if (filter.collectionId && !collectionIdsSet && this.collectionRepo) {
      try {
        const collection = this.collectionRepo.getById(filter.collectionId);
        if (collection && Array.isArray(collection.poemIds)) {
          collectionIdsSet = new Set(collection.poemIds);
        } else {
          // Nonexistent collection yields empty set
          collectionIdsSet = new Set();
        }
      } catch {
        collectionIdsSet = new Set();
      }
    }

    // Resolve recent viewedAt map if sorting by viewedAt
    let viewedAtMap = options.viewedAtMap || null;
    if (filter.sort === SORT_FIELD.VIEWED_AT && !viewedAtMap && this.recentService) {
      try {
        const recentItems = this.recentService.getRecent();
        viewedAtMap = new Map();
        for (const item of recentItems) {
          viewedAtMap.set(item.poemId, new Date(item.viewedAt).getTime());
        }
      } catch {
        viewedAtMap = new Map();
      }
    }

    // 1. FILTERING PASS
    const filtered = poems.filter(poem => {
      if (!poem || typeof poem !== 'object' || !poem.id) return false;

      // Collection filter
      if (filter.collectionId) {
        if (!collectionIdsSet || !collectionIdsSet.has(poem.id)) {
          return false;
        }
      }

      // Archive filter
      if (typeof filter.isArchived === 'boolean') {
        if (Boolean(poem.isArchived) !== filter.isArchived) return false;
      } else if (!filter.includeArchived) {
        if (Boolean(poem.isArchived)) return false;
      }

      // Favorite filter
      if (typeof filter.isFavorite === 'boolean') {
        if (Boolean(poem.isFavorite) !== filter.isFavorite) return false;
      }

      // Category filter
      if (filter.category) {
        if (!poem.category || typeof poem.category !== 'string') return false;
        const poemCatSlug = generateCategorySlug(poem.category);
        const filterCatSlug = generateCategorySlug(filter.category);
        if (poemCatSlug !== filterCatSlug) return false;
      }

      // Tags filter (matches if poem contains ANY of the filtered tags)
      if (Array.isArray(filter.tags) && filter.tags.length > 0) {
        if (!Array.isArray(poem.tags) || poem.tags.length === 0) return false;
        const normPoemTags = poem.tags.map(t => normalizeTagName(String(t)));
        const matchesTag = filter.tags.some(ft => normPoemTags.includes(ft));
        if (!matchesTag) return false;
      }

      // Created date range
      if (filter.createdDateRange) {
        const pCreated = poem.createdAt ? new Date(poem.createdAt).getTime() : 0;
        if (filter.createdDateRange.from) {
          const fromTime = new Date(filter.createdDateRange.from).getTime();
          if (pCreated < fromTime) return false;
        }
        if (filter.createdDateRange.to) {
          const toTime = new Date(filter.createdDateRange.to).getTime();
          if (pCreated > toTime) return false;
        }
      }

      // Updated date range
      if (filter.updatedDateRange) {
        const pUpdated = poem.updatedAt ? new Date(poem.updatedAt).getTime() : 0;
        if (filter.updatedDateRange.from) {
          const fromTime = new Date(filter.updatedDateRange.from).getTime();
          if (pUpdated < fromTime) return false;
        }
        if (filter.updatedDateRange.to) {
          const toTime = new Date(filter.updatedDateRange.to).getTime();
          if (pUpdated > toTime) return false;
        }
      }

      // Authored date range
      if (filter.authoredDateRange) {
        const rawAuthored = poem.authoredDate || poem.writtenDate;
        if (!rawAuthored || isNaN(Date.parse(rawAuthored))) return false;
        const pAuthored = new Date(rawAuthored).getTime();
        if (filter.authoredDateRange.from) {
          const fromTime = new Date(filter.authoredDateRange.from).getTime();
          if (pAuthored < fromTime) return false;
        }
        if (filter.authoredDateRange.to) {
          const toTime = new Date(filter.authoredDateRange.to).getTime();
          if (pAuthored > toTime) return false;
        }
      }

      return true;
    });

    const totalCount = filtered.length;

    // 2. DETERMINISTIC SORTING PASS
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (filter.sort) {
        case SORT_FIELD.TITLE: {
          const titleA = a.title || '';
          const titleB = b.title || '';
          comparison = titleA.localeCompare(titleB, 'hi');
          break;
        }
        case SORT_FIELD.CREATED_AT: {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case SORT_FIELD.AUTHORED_DATE: {
          const dateA = a.authoredDate || a.writtenDate;
          const dateB = b.authoredDate || b.writtenDate;
          const timeA = dateA && !isNaN(Date.parse(dateA)) ? new Date(dateA).getTime() : 0;
          const timeB = dateB && !isNaN(Date.parse(dateB)) ? new Date(dateB).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case SORT_FIELD.VIEWED_AT: {
          const timeA = viewedAtMap ? (viewedAtMap.get(a.id) || 0) : 0;
          const timeB = viewedAtMap ? (viewedAtMap.get(b.id) || 0) : 0;
          comparison = timeA - timeB;
          break;
        }
        case SORT_FIELD.UPDATED_AT:
        default: {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
      }

      // Apply sort order direction
      if (filter.order === SORT_ORDER.DESC) {
        comparison = -comparison;
      }

      // Deterministic tie-breaking tier 1: updatedAt DESC
      if (comparison === 0) {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        comparison = timeB - timeA;
      }

      // Deterministic tie-breaking tier 2: poemId ASC
      if (comparison === 0) {
        comparison = String(a.id).localeCompare(String(b.id));
      }

      return comparison;
    });

    // 3. PAGINATION / SLICING PASS
    const offset = filter.offset || 0;
    const limit = filter.limit;
    const sliced = limit !== null
      ? filtered.slice(offset, offset + limit)
      : filtered.slice(offset);

    return {
      poems: sliced,
      totalCount,
      offset,
      limit,
      filter
    };
  }
}

export const libraryFilterService = new LibraryFilterService();
