/**
 * काव्यकलश (KavyaVault) — Book Project Repository (BookProjectRepository.js)
 * Phase 7 / Task 7.1: Book Project Foundation
 *
 * Domain repository managing BookProject entities.
 * Strictly adheres to the decoupled storage architecture via IStorageAdapter.
 * BookProjects reference poems by ID only (no duplicated poem records).
 */

import { LocalStorageAdapter } from '../storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';
import { STORAGE_KEYS } from '../../data/storageKeys.js';
import {
  createBookProject,
  validateBookProject,
  createBookSection,
  validateBookSection,
  normalizeString
} from './bookTypes.js';

/**
 * Deep clones any JSON-serializable object to guarantee repository immutability
 * @param {*} data
 * @returns {*}
 */
function deepClone(data) {
  if (data === null || data === undefined) return data;
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

export class BookProjectRepository {
  /**
   * @param {import('../storage/IStorageAdapter.js').IStorageAdapter} [adapter=null]
   */
  constructor(adapter = null) {
    this.adapter = adapter || new LocalStorageAdapter();
  }

  /**
   * Internal helper: safely reads books array, recovering from storage corruption
   * @returns {Array<Object>}
   */
  _readBooks() {
    try {
      const data = this.adapter.get(STORAGE_KEYS.BOOK_PROJECTS);
      if (!Array.isArray(data)) {
        return [];
      }
      // Read boundary hardening: filter out malformed entries, nulls, or non-objects
      return data.filter(b => b && typeof b === 'object' && typeof b.id === 'string' && b.id.trim() !== '');
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.DESERIALIZATION_ERROR) {
        console.error('[BookProjectRepository] Corrupted book projects storage detected. Returning empty list safely.');
        return [];
      }
      throw err;
    }
  }

  /**
   * Internal helper: safely writes books array to storage adapter
   * @param {Array<Object>} books
   */
  _writeBooks(books) {
    this.adapter.set(STORAGE_KEYS.BOOK_PROJECTS, deepClone(books));
  }

  /**
   * Retrieves all book projects
   * @returns {Array<Object>}
   */
  getAll() {
    return deepClone(this._readBooks());
  }

  /**
   * Retrieves a single book project by ID
   * @param {string} id
   * @returns {Object|null}
   */
  get(id) {
    if (!id || typeof id !== 'string') return null;
    const books = this._readBooks();
    const found = books.find(b => b.id === id.trim());
    return found ? deepClone(found) : null;
  }

  /**
   * Checks whether a book project exists
   * @param {string} id
   * @returns {boolean}
   */
  exists(id) {
    if (!id || typeof id !== 'string') return false;
    const books = this._readBooks();
    return books.some(b => b.id === id.trim());
  }

  /**
   * Returns total count of stored book projects
   * @returns {number}
   */
  count() {
    return this._readBooks().length;
  }

  /**
   * Creates a new book project
   * @param {Object} bookData
   * @returns {Object} Created book project (deep cloned)
   * @throws {StorageError} If validation fails or ID is duplicate
   */
  create(bookData) {
    validateBookProject(bookData);

    const books = this._readBooks();
    const newBook = createBookProject(bookData);

    if (books.some(b => b.id === newBook.id)) {
      throw new StorageError(
        `पुस्तक आईडी "${newBook.id}" पहले से उपस्थित है।`,
        StorageErrorCode.DUPLICATE_ID,
        null,
        { id: newBook.id }
      );
    }

    books.push(newBook);
    this._writeBooks(books);
    return deepClone(newBook);
  }

  /**
   * Updates an existing book project's fields
   * @param {string} id
   * @param {Object} changes
   * @returns {Object} Updated book project (deep cloned)
   * @throws {StorageError} If book not found or validation fails
   */
  update(id, changes) {
    if (!id || typeof id !== 'string') {
      throw new StorageError('पुस्तक आईडी अमान्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (!changes || typeof changes !== 'object') {
      throw new StorageError('परिवर्तन डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const books = this._readBooks();
    const index = books.findIndex(b => b.id === id.trim());
    if (index === -1) {
      throw new StorageError(
        `पुस्तक आईडी "${id}" नहीं मिली।`,
        StorageErrorCode.NOT_FOUND,
        null,
        { id }
      );
    }

    const current = books[index];
    const now = new Date().toISOString();

    // Validate title if changed
    if (changes.title !== undefined) {
      if (typeof changes.title !== 'string' || normalizeString(changes.title) === '') {
        throw new StorageError('पुस्तक का शीर्षक रिक्त नहीं हो सकता।', StorageErrorCode.VALIDATION_ERROR);
      }
    }

    // Merge sections if provided
    let sections = current.sections;
    if (changes.sections !== undefined) {
      if (!Array.isArray(changes.sections)) {
        throw new StorageError('खण्ड सूची एक ऐरे होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
      }
      sections = changes.sections.map((sec, idx) => {
        validateBookSection(sec);
        return createBookSection({
          ...sec,
          order: typeof sec.order === 'number' ? sec.order : idx
        });
      });
      sections.sort((a, b) => a.order - b.order);
      sections.forEach((sec, idx) => {
        sec.order = idx;
      });
    }

    // Derive updated poemIds across sections
    const poemIdSet = new Set();
    const poemIds = [];
    for (const sec of sections) {
      for (const pid of sec.poemIds) {
        if (!poemIdSet.has(pid)) {
          poemIdSet.add(pid);
          poemIds.push(pid);
        }
      }
    }

    const updated = {
      ...current,
      title: changes.title !== undefined ? normalizeString(changes.title) : current.title,
      subtitle: changes.subtitle !== undefined
        ? (typeof changes.subtitle === 'string' && normalizeString(changes.subtitle) !== '' ? normalizeString(changes.subtitle) : null)
        : current.subtitle,
      author: changes.author !== undefined
        ? (typeof changes.author === 'string' && normalizeString(changes.author) !== '' ? normalizeString(changes.author) : 'अज्ञात')
        : current.author,
      dedication: changes.dedication !== undefined
        ? (typeof changes.dedication === 'string' && normalizeString(changes.dedication) !== '' ? normalizeString(changes.dedication) : null)
        : current.dedication,
      description: changes.description !== undefined
        ? (typeof changes.description === 'string' && normalizeString(changes.description) !== '' ? normalizeString(changes.description) : null)
        : current.description,
      language: changes.language !== undefined
        ? (typeof changes.language === 'string' && changes.language.trim() !== '' ? changes.language.trim().toLowerCase() : 'hi')
        : current.language,
      cover: changes.cover !== undefined
        ? { ...current.cover, ...changes.cover }
        : current.cover,
      sections,
      poemIds,
      ordering: {
        sectionOrder: sections.map(s => s.id)
      },
      updatedAt: now
    };

    books[index] = updated;
    this._writeBooks(books);
    return deepClone(updated);
  }

  /**
   * Deletes a book project by ID
   * Non-destructive: Strictly deletes the book record only, never deleting referenced poems.
   * @param {string} id
   * @returns {boolean} True if deleted, false if not found
   */
  delete(id) {
    if (!id || typeof id !== 'string') return false;
    const books = this._readBooks();
    const index = books.findIndex(b => b.id === id.trim());
    if (index === -1) return false;

    books.splice(index, 1);
    this._writeBooks(books);
    return true;
  }

  /**
   * Clears all book projects from storage
   */
  clear() {
    this.adapter.remove(STORAGE_KEYS.BOOK_PROJECTS);
  }
}

export const bookProjectRepository = new BookProjectRepository();
