/**
 * काव्यकलश (KavyaVault) — Library Domain Types & Validators (libraryTypes.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Defines explicit domain models, enums, normalization helpers, and validators for:
 * - Collections
 * - Categories
 * - Tags
 * - Recent Activities
 * - Library Filter & Sort Queries
 * - Timeline Metadata
 */

import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

/**
 * Supported sort fields for library queries
 */
export const SORT_FIELD = Object.freeze({
  UPDATED_AT: 'updatedAt',
  CREATED_AT: 'createdAt',
  TITLE: 'title',
  AUTHORED_DATE: 'authoredDate',
  VIEWED_AT: 'viewedAt'
});

export const VALID_SORT_FIELDS = Object.freeze(Object.values(SORT_FIELD));

/**
 * Sort direction
 */
export const SORT_ORDER = Object.freeze({
  ASC: 'asc',
  DESC: 'desc'
});

export const VALID_SORT_ORDERS = Object.freeze(Object.values(SORT_ORDER));

/**
 * Timeline event types
 */
export const TIMELINE_EVENT_TYPE = Object.freeze({
  CREATED: 'created',
  UPDATED: 'updated',
  AUTHORED: 'authored',
  DIGITIZED: 'digitized'
});

export const VALID_TIMELINE_EVENT_TYPES = Object.freeze(Object.values(TIMELINE_EVENT_TYPE));

/**
 * Generates a unique collection ID
 * @returns {string}
 */
export function generateCollectionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_col_${crypto.randomUUID()}`;
  }
  return `kv_col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a unique category ID
 * @param {string} [name='']
 * @returns {string}
 */
export function generateCategoryId(name = '') {
  const slug = generateCategorySlug(name);
  return slug ? `kv_cat_${slug}` : `kv_cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Generates a unique tag ID
 * @param {string} [name='']
 * @returns {string}
 */
export function generateTagId(name = '') {
  const norm = normalizeTagName(name);
  return norm ? `kv_tag_${encodeURIComponent(norm)}` : `kv_tag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Normalizes tag strings consistently for matching:
 * - Strips leading '#' symbol if present
 * - Normalizes via Unicode NFC
 * - Trims and collapses multiple horizontal spaces
 * - Lowercases Latin characters while preserving Devanagari characters untouched
 *
 * @param {string} rawTag
 * @returns {string}
 */
export function normalizeTagName(rawTag) {
  if (typeof rawTag !== 'string') return '';
  let cleaned = rawTag.normalize('NFC').trim();
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.substring(1).trim();
  }
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');
  // Lowercase Latin characters while preserving Devanagari Unicode
  return cleaned.replace(/[A-Za-z]/g, c => c.toLowerCase());
}

/**
 * Generates a clean URL/identifier slug for categories:
 * - NFC normalization
 * - Replaces whitespace with hyphens
 * - Lowercases Latin characters, preserves Devanagari
 *
 * @param {string} rawCategory
 * @returns {string}
 */
export function generateCategorySlug(rawCategory) {
  if (typeof rawCategory !== 'string') return '';
  const cleaned = rawCategory.normalize('NFC').trim();
  if (!cleaned) return '';
  return cleaned
    .replace(/[A-Za-z]/g, c => c.toLowerCase())
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{M}\p{N}\-_]/gu, '') // Keep letters, combining marks (matras/nuktas/viramas), numbers, hyphens, underscores
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validates a Collection entity
 * @param {Object} collection
 * @returns {boolean}
 */
export function validateCollection(collection) {
  if (!collection || typeof collection !== 'object') {
    throw new StorageError('संग्रह (Collection) ऑब्जेक्ट होना अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof collection.id !== 'string' || collection.id.trim() === '') {
    throw new StorageError('संग्रह आईडी (id) गैर-रिक्त स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof collection.name !== 'string' || collection.name.trim() === '') {
    throw new StorageError('संग्रह का नाम (name) गैर-रिक्त स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof collection.description !== 'string') {
    throw new StorageError('संग्रह का विवरण (description) स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!Array.isArray(collection.poemIds)) {
    throw new StorageError('कविता सूची (poemIds) एक ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  for (const pid of collection.poemIds) {
    if (typeof pid !== 'string' || pid.trim() === '') {
      throw new StorageError('कविता आईडी अमान्य है।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (!collection.createdAt || isNaN(Date.parse(collection.createdAt))) {
    throw new StorageError('संग्रह निर्माण तिथि (createdAt) मान्य ISO तिथि होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!collection.updatedAt || isNaN(Date.parse(collection.updatedAt))) {
    throw new StorageError('संग्रह अद्यतन तिथि (updatedAt) मान्य ISO तिथि होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  return true;
}

/**
 * Creates a validated Collection domain object
 * @param {Object} data
 * @returns {Object}
 */
export function createCollection(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new StorageError('संग्रह डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof data.name !== 'string' || data.name.trim() === '') {
    throw new StorageError('संग्रह का नाम अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  const now = new Date().toISOString();
  const id = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : generateCollectionId();
  const rawIds = Array.isArray(data.poemIds) ? data.poemIds.map(id => String(id).trim()).filter(Boolean) : [];
  // Ensure uniqueness of poem IDs
  const uniquePoemIds = Array.from(new Set(rawIds));

  const collection = {
    id,
    name: data.name.normalize('NFC').trim(),
    description: typeof data.description === 'string' ? data.description.normalize('NFC').trim() : '',
    poemIds: uniquePoemIds,
    createdAt: data.createdAt && !isNaN(Date.parse(data.createdAt)) ? new Date(data.createdAt).toISOString() : now,
    updatedAt: data.updatedAt && !isNaN(Date.parse(data.updatedAt)) ? new Date(data.updatedAt).toISOString() : now
  };

  validateCollection(collection);
  return Object.freeze(collection);
}

/**
 * Validates a Category entity
 * @param {Object} category
 * @returns {boolean}
 */
export function validateCategory(category) {
  if (!category || typeof category !== 'object') {
    throw new StorageError('श्रेणी (Category) ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof category.id !== 'string' || category.id.trim() === '') {
    throw new StorageError('श्रेणी आईडी गैर-रिक्त स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof category.name !== 'string' || category.name.trim() === '') {
    throw new StorageError('श्रेणी का नाम गैर-रिक्त स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof category.slug !== 'string' || category.slug.trim() === '') {
    throw new StorageError('श्रेणी का स्लग (slug) गैर-रिक्त होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!category.createdAt || isNaN(Date.parse(category.createdAt))) {
    throw new StorageError('रचना तिथि मान्य ISO प्रारूप में होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!category.updatedAt || isNaN(Date.parse(category.updatedAt))) {
    throw new StorageError('अद्यतन तिथि मान्य ISO प्रारूप में होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  return true;
}

/**
 * Creates a validated Category domain object
 * @param {Object} data
 * @returns {Object}
 */
export function createCategory(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new StorageError('श्रेणी डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof data.name !== 'string' || data.name.trim() === '') {
    throw new StorageError('श्रेणी का नाम अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  const name = data.name.normalize('NFC').trim();
  const slug = typeof data.slug === 'string' && data.slug.trim()
    ? data.slug.trim()
    : generateCategorySlug(name);

  const now = new Date().toISOString();
  const id = typeof data.id === 'string' && data.id.trim()
    ? data.id.trim()
    : generateCategoryId(name);

  const category = {
    id,
    name,
    slug,
    createdAt: data.createdAt && !isNaN(Date.parse(data.createdAt)) ? new Date(data.createdAt).toISOString() : now,
    updatedAt: data.updatedAt && !isNaN(Date.parse(data.updatedAt)) ? new Date(data.updatedAt).toISOString() : now
  };

  validateCategory(category);
  return Object.freeze(category);
}

/**
 * Validates a Tag entity
 * @param {Object} tag
 * @returns {boolean}
 */
export function validateTag(tag) {
  if (!tag || typeof tag !== 'object') {
    throw new StorageError('टैग (Tag) ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof tag.id !== 'string' || tag.id.trim() === '') {
    throw new StorageError('टैग आईडी आवश्यक है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof tag.name !== 'string' || tag.name.trim() === '') {
    throw new StorageError('टैग का नाम आवश्यक है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof tag.normalizedName !== 'string' || tag.normalizedName.trim() === '') {
    throw new StorageError('सामान्यीकृत टैग नाम आवश्यक है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!tag.createdAt || isNaN(Date.parse(tag.createdAt))) {
    throw new StorageError('रचना तिथि मान्य ISO प्रारूप में होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!tag.updatedAt || isNaN(Date.parse(tag.updatedAt))) {
    throw new StorageError('अद्यतन तिथि मान्य ISO प्रारूप में होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  return true;
}

/**
 * Creates a validated Tag domain object
 * @param {Object} data
 * @returns {Object}
 */
export function createTag(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new StorageError('टैग डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof data.name !== 'string' || data.name.trim() === '') {
    throw new StorageError('टैग का नाम अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  const name = data.name.normalize('NFC').trim();
  const normalizedName = typeof data.normalizedName === 'string' && data.normalizedName.trim()
    ? data.normalizedName.trim()
    : normalizeTagName(name);

  const now = new Date().toISOString();
  const id = typeof data.id === 'string' && data.id.trim()
    ? data.id.trim()
    : generateTagId(name);

  const tag = {
    id,
    name,
    normalizedName,
    createdAt: data.createdAt && !isNaN(Date.parse(data.createdAt)) ? new Date(data.createdAt).toISOString() : now,
    updatedAt: data.updatedAt && !isNaN(Date.parse(data.updatedAt)) ? new Date(data.updatedAt).toISOString() : now
  };

  validateTag(tag);
  return Object.freeze(tag);
}

/**
 * Validates a RecentActivity entity
 * @param {Object} item
 * @returns {boolean}
 */
export function validateRecentActivity(item) {
  if (!item || typeof item !== 'object') {
    throw new StorageError('गतिविधि (RecentActivity) ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof item.poemId !== 'string' || item.poemId.trim() === '') {
    throw new StorageError('कविता आईडी (poemId) अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!item.viewedAt || isNaN(Date.parse(item.viewedAt))) {
    throw new StorageError('दर्शन समय (viewedAt) मान्य ISO प्रारूप में होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  return true;
}

/**
 * Creates a validated RecentActivity domain object
 * @param {Object} data
 * @returns {Object}
 */
export function createRecentActivity(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new StorageError('गतिविधि डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof data.poemId !== 'string' || data.poemId.trim() === '') {
    throw new StorageError('कविता आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  const viewedAt = data.viewedAt && !isNaN(Date.parse(data.viewedAt))
    ? new Date(data.viewedAt).toISOString()
    : new Date().toISOString();

  const activity = {
    poemId: data.poemId.trim(),
    viewedAt
  };

  validateRecentActivity(activity);
  return Object.freeze(activity);
}

/**
 * Validates a LibraryFilter query object
 * @param {Object} filter
 * @returns {boolean}
 */
export function validateLibraryFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    throw new StorageError('लाइब्रेरी फ़िल्टर ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.collectionId !== undefined && filter.collectionId !== null && typeof filter.collectionId !== 'string') {
    throw new StorageError('collectionId स्ट्रिंग या null होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.category !== undefined && filter.category !== null && typeof filter.category !== 'string') {
    throw new StorageError('category स्ट्रिंग या null होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.tags !== undefined && !Array.isArray(filter.tags)) {
    throw new StorageError('tags एक ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.isFavorite !== undefined && filter.isFavorite !== null && typeof filter.isFavorite !== 'boolean') {
    throw new StorageError('isFavorite बूलियन या null होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.isArchived !== undefined && filter.isArchived !== null && typeof filter.isArchived !== 'boolean') {
    throw new StorageError('isArchived बूलियन या null होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.sort !== undefined && !VALID_SORT_FIELDS.includes(filter.sort)) {
    throw new StorageError(`अमान्य सॉर्ट फ़ील्ड: "${filter.sort}"। मान्य फ़ील्ड: ${VALID_SORT_FIELDS.join(', ')}`, StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.order !== undefined && !VALID_SORT_ORDERS.includes(filter.order)) {
    throw new StorageError(`अमान्य सॉर्ट दिशा: "${filter.order}"। मान्य दिशा: ${VALID_SORT_ORDERS.join(', ')}`, StorageErrorCode.VALIDATION_ERROR);
  }

  // Date range validations
  const dateRangeKeys = ['createdDateRange', 'updatedDateRange', 'authoredDateRange'];
  for (const key of dateRangeKeys) {
    if (filter[key] !== undefined && filter[key] !== null) {
      if (typeof filter[key] !== 'object') {
        throw new StorageError(`${key} एक ऑब्जेक्ट होना चाहिए।`, StorageErrorCode.VALIDATION_ERROR);
      }
      if (filter[key].from !== undefined && filter[key].from !== null && isNaN(Date.parse(filter[key].from))) {
        throw new StorageError(`${key}.from अमान्य तिथि है।`, StorageErrorCode.VALIDATION_ERROR);
      }
      if (filter[key].to !== undefined && filter[key].to !== null && isNaN(Date.parse(filter[key].to))) {
        throw new StorageError(`${key}.to अमान्य तिथि है।`, StorageErrorCode.VALIDATION_ERROR);
      }
    }
  }

  if (filter.offset !== undefined && (typeof filter.offset !== 'number' || filter.offset < 0)) {
    throw new StorageError('offset गैर-ऋणात्मक संख्या होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (filter.limit !== undefined && (typeof filter.limit !== 'number' || filter.limit <= 0)) {
    throw new StorageError('limit धनात्मक संख्या होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  return true;
}

/**
 * Creates a normalized LibraryFilter object with safe defaults
 * @param {Object} [filterInput={}]
 * @returns {Object}
 */
export function createLibraryFilter(filterInput = {}) {
  const input = filterInput || {};
  validateLibraryFilter(input);

  const filter = {
    collectionId: input.collectionId && typeof input.collectionId === 'string' ? input.collectionId.trim() : null,
    category: input.category && typeof input.category === 'string' ? input.category.trim() : null,
    tags: Array.isArray(input.tags) ? input.tags.map(t => normalizeTagName(String(t))).filter(Boolean) : [],
    isFavorite: typeof input.isFavorite === 'boolean' ? input.isFavorite : null,
    isArchived: typeof input.isArchived === 'boolean' ? input.isArchived : false, // Default: exclude archived
    includeArchived: Boolean(input.includeArchived),
    createdDateRange: input.createdDateRange ? { ...input.createdDateRange } : null,
    updatedDateRange: input.updatedDateRange ? { ...input.updatedDateRange } : null,
    authoredDateRange: input.authoredDateRange ? { ...input.authoredDateRange } : null,
    sort: input.sort || SORT_FIELD.UPDATED_AT,
    order: input.order || SORT_ORDER.DESC,
    offset: typeof input.offset === 'number' ? Math.max(0, input.offset) : 0,
    limit: typeof input.limit === 'number' ? Math.max(1, input.limit) : null
  };

  return Object.freeze(filter);
}

/**
 * Creates a normalized TimelineEntry object
 * @param {Object} entry
 * @returns {Object}
 */
export function createTimelineEntry(entry = {}) {
  if (!entry || typeof entry !== 'object') {
    throw new StorageError('टाइमलाइन प्रविष्टि ऑब्जेक्ट होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof entry.poemId !== 'string' || entry.poemId.trim() === '') {
    throw new StorageError('कविता आईडी (poemId) अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (!entry.eventType || !VALID_TIMELINE_EVENT_TYPES.includes(entry.eventType)) {
    throw new StorageError(`अमान्य टाइमलाइन घटना प्रकार: "${entry.eventType}"।`, StorageErrorCode.VALIDATION_ERROR);
  }

  if (!entry.date || isNaN(Date.parse(entry.date))) {
    throw new StorageError('टाइमलाइन तिथि अमान्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  const timestamp = new Date(entry.date).getTime();

  return Object.freeze({
    poemId: entry.poemId.trim(),
    poemTitle: typeof entry.poemTitle === 'string' ? entry.poemTitle.trim() : 'शीर्षकहीन रचना',
    eventType: entry.eventType,
    date: new Date(entry.date).toISOString(),
    timestamp,
    label: typeof entry.label === 'string' ? entry.label.trim() : entry.eventType
  });
}
