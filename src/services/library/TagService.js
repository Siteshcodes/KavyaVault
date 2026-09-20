/**
 * काव्यकलश (KavyaVault) — Tag Service (TagService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Manages tag extraction, normalization, and aggregation across poetry library.
 * Preserves user's authentic display casing while ensuring reliable normalized matching.
 * Full Unicode & Devanagari fidelity, zero external dependencies.
 */

import {
  createTag,
  normalizeTagName
} from './libraryTypes.js';

export class TagService {
  /**
   * Normalizes a tag string consistently for comparison and lookup
   * @param {string} rawTag
   * @returns {string}
   */
  normalize(rawTag) {
    return normalizeTagName(rawTag);
  }

  /**
   * Extracts all unique tags from a poem collection with usage counts and original display form
   *
   * @param {Array<Object>} poems
   * @returns {Array<{
   *   id: string,
   *   name: string,
   *   normalizedName: string,
   *   poemCount: number,
   *   poemIds: string[],
   *   createdAt: string,
   *   updatedAt: string
   * }>}
   */
  extractTagsFromPoems(poems = []) {
    if (!Array.isArray(poems)) {
      return [];
    }

    const tagMap = new Map(); // normalizedName -> { tag, poemIds: Set, displayForm }

    for (const poem of poems) {
      if (!poem || !Array.isArray(poem.tags) || poem.isArchived) {
        continue;
      }

      for (const rawTag of poem.tags) {
        if (typeof rawTag !== 'string' || !rawTag.trim()) continue;

        const normalized = this.normalize(rawTag);
        if (!normalized) continue;

        const cleanDisplay = rawTag.trim().replace(/^#+/, '').trim();
        // Integrity guard: skip tags that become empty after hash/whitespace stripping
        if (!cleanDisplay) continue;

        if (tagMap.has(normalized)) {
          const entry = tagMap.get(normalized);
          entry.poemIds.add(poem.id);
          // Keep the earliest or most complete display form
          if (poem.updatedAt && poem.updatedAt > entry.updatedAt) {
            entry.updatedAt = poem.updatedAt;
          }
        } else {
          tagMap.set(normalized, {
            name: cleanDisplay,
            normalizedName: normalized,
            poemIds: new Set([poem.id]),
            createdAt: poem.createdAt || new Date().toISOString(),
            updatedAt: poem.updatedAt || new Date().toISOString()
          });
        }
      }
    }

    const result = [];
    for (const [normKey, entry] of tagMap.entries()) {
      const tagDomain = createTag({
        name: entry.name,
        normalizedName: entry.normalizedName,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      });

      result.push({
        ...tagDomain,
        poemCount: entry.poemIds.size,
        poemIds: Array.from(entry.poemIds)
      });
    }

    return result;
  }

  /**
   * Lists tags with configurable sorting
   * @param {Array<Object>} poems
   * @param {Object} [options={}]
   * @param {'count'|'name'|'updatedAt'} [options.sortBy='count']
   * @param {'asc'|'desc'} [options.order='desc']
   * @returns {Array<Object>}
   */
  listTags(poems = [], { sortBy = 'count', order = 'desc' } = {}) {
    const tags = this.extractTagsFromPoems(poems);

    tags.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'count') {
        comparison = b.poemCount - a.poemCount;
      } else if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, 'hi');
      } else if (sortBy === 'updatedAt') {
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        comparison = tb - ta;
      }

      // Deterministic tie-breaking by normalizedName ASC
      if (comparison === 0) {
        comparison = a.normalizedName.localeCompare(b.normalizedName, 'hi');
      }

      return order === 'asc' ? -comparison : comparison;
    });

    return tags;
  }

  /**
   * Retrieves metadata and poems associated with a specific tag
   * @param {Array<Object>} poems
   * @param {string} rawTag
   * @returns {Object|null}
   */
  getTag(poems = [], rawTag = '') {
    const targetNorm = this.normalize(rawTag);
    if (!targetNorm) return null;

    const allTags = this.extractTagsFromPoems(poems);
    return allTags.find(t => t.normalizedName === targetNorm) || null;
  }

  /**
   * Filters poems collection to only those matching the tag
   * @param {Array<Object>} poems
   * @param {string} rawTag
   * @returns {Array<Object>}
   */
  filterPoemsByTag(poems = [], rawTag = '') {
    const targetNorm = this.normalize(rawTag);
    if (!targetNorm || !Array.isArray(poems)) return [];

    return poems.filter(poem => {
      if (!poem || !Array.isArray(poem.tags)) return false;
      return poem.tags.some(t => this.normalize(t) === targetNorm);
    });
  }
}

export const tagService = new TagService();
