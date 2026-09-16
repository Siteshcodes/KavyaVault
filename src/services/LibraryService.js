/**
 * काव्यकलश (KavyaVault) — Library Organization Service & Facade (LibraryService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Central domain service layer unifying:
 * - Collections
 * - Categories
 * - Tags
 * - Favorites
 * - Recent poems history
 * - Chronological timeline metadata
 * - Multi-criteria library filtering and deterministic sorting
 */

import { poemRepository } from './PoemRepository.js';
import { collectionRepository } from './CollectionRepository.js';

import {
  SORT_FIELD,
  VALID_SORT_FIELDS,
  SORT_ORDER,
  VALID_SORT_ORDERS,
  TIMELINE_EVENT_TYPE,
  VALID_TIMELINE_EVENT_TYPES,
  generateCollectionId,
  generateCategoryId,
  generateTagId,
  normalizeTagName,
  generateCategorySlug,
  validateCollection,
  createCollection,
  validateCategory,
  createCategory,
  validateTag,
  createTag,
  validateRecentActivity,
  createRecentActivity,
  validateLibraryFilter,
  createLibraryFilter,
  createTimelineEntry
} from './library/libraryTypes.js';

import { TagService, tagService } from './library/TagService.js';
import { CategoryService, categoryService } from './library/CategoryService.js';
import { FavoritesService, favoritesService } from './library/FavoritesService.js';
import { RecentPoemService, recentPoemService } from './library/RecentPoemService.js';
import { TimelineService, timelineService } from './library/TimelineService.js';
import { LibraryFilterService, libraryFilterService } from './library/LibraryFilterService.js';
import { CollectionService, collectionService } from './library/CollectionService.js';

export class LibraryOrganizationService {
  /**
   * @param {Object} [options={}]
   * @param {PoemRepository} [options.poemRepo]
   * @param {CollectionRepository} [options.collectionRepo]
   * @param {TagService} [options.tagService]
   * @param {CategoryService} [options.categoryService]
   * @param {FavoritesService} [options.favoritesService]
   * @param {RecentPoemService} [options.recentService]
   * @param {TimelineService} [options.timelineService]
   * @param {LibraryFilterService} [options.filterService]
   * @param {CollectionService} [options.collectionService]
   */
  constructor(options = {}) {
    this.poemRepo = options.poemRepo || poemRepository;
    this.collectionRepo = options.collectionRepo || collectionRepository;

    this.tags = options.tagService || tagService;
    this.categories = options.categoryService || categoryService;
    this.favorites = options.favoritesService || new FavoritesService({ poemRepo: this.poemRepo });
    this.recent = options.recentService || recentPoemService;
    this.timeline = options.timelineService || timelineService;
    this.collections = options.collectionService || new CollectionService({
      collectionRepo: this.collectionRepo,
      poemRepo: this.poemRepo
    });
    this.filter = options.filterService || new LibraryFilterService({
      collectionRepo: this.collectionRepo,
      recentService: this.recent
    });
  }

  /**
   * Queries the library with multi-criteria filtering, deterministic sorting, and pagination
   * @param {Object} [filterInput={}]
   * @param {Object} [options={}]
   * @returns {{
   *   poems: Array<Object>,
   *   totalCount: number,
   *   offset: number,
   *   limit: number|null,
   *   filter: Object
   * }}
   */
  query(filterInput = {}, options = {}) {
    const poems = options.poems || this.poemRepo.getAll({ includeArchived: true });
    return this.filter.query(poems, filterInput, options);
  }

  /**
   * Returns statistics and overview counts for the library
   * @returns {{
   *   totalPoems: number,
   *   activePoems: number,
   *   archivedPoems: number,
   *   favoritePoems: number,
   *   collectionCount: number,
   *   categoryCount: number,
   *   tagCount: number,
   *   recentCount: number
   * }}
   */
  getLibraryStats() {
    const allPoems = this.poemRepo.getAll({ includeArchived: true });
    const activePoems = allPoems.filter(p => !p.isArchived);
    const archivedPoems = allPoems.filter(p => Boolean(p.isArchived));
    const favoritePoems = activePoems.filter(p => Boolean(p.isFavorite));

    const collections = this.collections.listCollections();
    const categories = this.categories.extractCategoriesFromPoems(activePoems);
    const tags = this.tags.extractTagsFromPoems(activePoems);
    const recentCount = this.recent.count();

    return {
      totalPoems: allPoems.length,
      activePoems: activePoems.length,
      archivedPoems: archivedPoems.length,
      favoritePoems: favoritePoems.length,
      collectionCount: collections.length,
      categoryCount: categories.length,
      tagCount: tags.length,
      recentCount
    };
  }
}

export const libraryService = new LibraryOrganizationService();

// Re-export all domain models, services, and utilities
export {
  SORT_FIELD,
  VALID_SORT_FIELDS,
  SORT_ORDER,
  VALID_SORT_ORDERS,
  TIMELINE_EVENT_TYPE,
  VALID_TIMELINE_EVENT_TYPES,
  generateCollectionId,
  generateCategoryId,
  generateTagId,
  normalizeTagName,
  generateCategorySlug,
  validateCollection,
  createCollection,
  validateCategory,
  createCategory,
  validateTag,
  createTag,
  validateRecentActivity,
  createRecentActivity,
  validateLibraryFilter,
  createLibraryFilter,
  createTimelineEntry,
  TagService,
  tagService,
  CategoryService,
  categoryService,
  FavoritesService,
  favoritesService,
  RecentPoemService,
  recentPoemService,
  TimelineService,
  timelineService,
  LibraryFilterService,
  libraryFilterService,
  CollectionService,
  collectionService
};
