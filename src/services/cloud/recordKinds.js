import { STORAGE_KEYS } from '../../data/storageKeys.js';

export const RECORD_KINDS = Object.freeze({
  poems: STORAGE_KEYS.POEMS,
  collections: STORAGE_KEYS.COLLECTIONS,
  manuscripts: STORAGE_KEYS.MANUSCRIPTS,
  books: STORAGE_KEYS.BOOK_PROJECTS,
  drafts: STORAGE_KEYS.DRAFTS,
  theme: STORAGE_KEYS.THEME,
  categories: STORAGE_KEYS.CATEGORIES,
  tags: STORAGE_KEYS.TAGS
});
export const ARRAY_KINDS = new Set(['poems', 'collections', 'manuscripts', 'books']);
export const kindForKey = key => Object.keys(RECORD_KINDS).find(kind => RECORD_KINDS[kind] === key);
