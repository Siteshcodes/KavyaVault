/**
 * काव्यकलश (KavyaVault) — Category Service (CategoryService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Manages category organization, slug generation, and poem grouping.
 * Preserves authentic Hindi Devanagari categories and handles mixed Latin categories safely.
 */

import {
  createCategory,
  generateCategorySlug
} from './libraryTypes.js';

export class CategoryService {
  /**
   * Generates a clean URL/identifier slug from a category name
   * @param {string} rawCategory
   * @returns {string}
   */
  generateSlug(rawCategory) {
    return generateCategorySlug(rawCategory);
  }

  /**
   * Extracts all unique categories present in the poem collection with counts
   *
   * @param {Array<Object>} poems
   * @returns {Array<{
   *   id: string,
   *   name: string,
   *   slug: string,
   *   poemCount: number,
   *   poemIds: string[],
   *   createdAt: string,
   *   updatedAt: string
   * }>}
   */
  extractCategoriesFromPoems(poems = []) {
    if (!Array.isArray(poems)) {
      return [];
    }

    const categoryMap = new Map(); // slug -> { name, slug, poemIds: Set, createdAt, updatedAt }

    for (const poem of poems) {
      if (!poem || !poem.category || typeof poem.category !== 'string' || poem.isArchived) {
        continue;
      }

      const cleanName = poem.category.normalize('NFC').trim();
      if (!cleanName) continue;

      const slug = this.generateSlug(cleanName);
      if (!slug) continue;

      if (categoryMap.has(slug)) {
        const entry = categoryMap.get(slug);
        entry.poemIds.add(poem.id);
        if (poem.updatedAt && poem.updatedAt > entry.updatedAt) {
          entry.updatedAt = poem.updatedAt;
        }
      } else {
        categoryMap.set(slug, {
          name: cleanName,
          slug,
          poemIds: new Set([poem.id]),
          createdAt: poem.createdAt || new Date().toISOString(),
          updatedAt: poem.updatedAt || new Date().toISOString()
        });
      }
    }

    const result = [];
    for (const [slugKey, entry] of categoryMap.entries()) {
      const catDomain = createCategory({
        name: entry.name,
        slug: entry.slug,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      });

      result.push({
        ...catDomain,
        poemCount: entry.poemIds.size,
        poemIds: Array.from(entry.poemIds)
      });
    }

    return result;
  }

  /**
   * Lists categories with configurable sorting
   * @param {Array<Object>} poems
   * @param {Object} [options={}]
   * @param {'count'|'name'|'updatedAt'} [options.sortBy='count']
   * @param {'asc'|'desc'} [options.order='desc']
   * @returns {Array<Object>}
   */
  listCategories(poems = [], { sortBy = 'count', order = 'desc' } = {}) {
    const categories = this.extractCategoriesFromPoems(poems);

    categories.sort((a, b) => {
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

      // Deterministic tie-breaking by slug ASC
      if (comparison === 0) {
        comparison = a.slug.localeCompare(b.slug);
      }

      return order === 'asc' ? -comparison : comparison;
    });

    return categories;
  }

  /**
   * Finds category metadata by name or slug
   * @param {Array<Object>} poems
   * @param {string} nameOrSlug
   * @returns {Object|null}
   */
  getCategory(poems = [], nameOrSlug = '') {
    if (!nameOrSlug || typeof nameOrSlug !== 'string') return null;
    const targetSlug = this.generateSlug(nameOrSlug);
    const targetNorm = nameOrSlug.normalize('NFC').trim().toLowerCase();

    const categories = this.extractCategoriesFromPoems(poems);
    return categories.find(c => c.slug === targetSlug || c.name.toLowerCase() === targetNorm) || null;
  }

  /**
   * Filters poems by category name or slug
   * @param {Array<Object>} poems
   * @param {string} nameOrSlug
   * @returns {Array<Object>}
   */
  filterPoemsByCategory(poems = [], nameOrSlug = '') {
    if (!nameOrSlug || typeof nameOrSlug !== 'string' || !Array.isArray(poems)) return [];
    const targetSlug = this.generateSlug(nameOrSlug);

    return poems.filter(poem => {
      if (!poem || !poem.category || typeof poem.category !== 'string') return false;
      return this.generateSlug(poem.category) === targetSlug;
    });
  }
}

export const categoryService = new CategoryService();
