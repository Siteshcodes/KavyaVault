/**
 * काव्यकलश (KavyaVault) — Collection Repository (CollectionRepository.js)
 * Domain repository managing user-created poetry collections.
 * Collections reference poems by ID only (no duplicated poem records).
 * Decoupled from concrete storage drivers through IStorageAdapter.
 */

import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './storage/StorageError.js';
import { STORAGE_KEYS } from '../data/storageKeys.js';

/**
 * Deep clones any JSON-serializable object to guarantee repository immutability
 */
function deepClone(data) {
  if (data === null || data === undefined) return data;
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

/**
 * Generates a collision-resistant unique collection identifier
 */
function generateUniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_col_${crypto.randomUUID()}`;
  }
  return `kv_col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class CollectionRepository {
  /**
   * @param {import('./storage/IStorageAdapter.js').IStorageAdapter} adapter
   */
  constructor(adapter = null) {
    this.adapter = adapter || new LocalStorageAdapter();
  }

  /**
   * Internal helper: safely reads collections array, recovering from any corruption
   */
  _readCollections() {
    try {
      const data = this.adapter.get(STORAGE_KEYS.COLLECTIONS);
      if (!Array.isArray(data)) {
        return [];
      }
      return data;
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.DESERIALIZATION_ERROR) {
        console.error('[CollectionRepository] Corrupted collections storage detected. Returning empty list safely.');
        return [];
      }
      throw err;
    }
  }

  /**
   * Internal helper: safely writes collections array
   */
  _writeCollections(collections) {
    this.adapter.set(STORAGE_KEYS.COLLECTIONS, deepClone(collections));
  }

  /**
   * Validates creation input
   */
  _validateCreateInput(data) {
    if (!data || typeof data !== 'object') {
      throw new StorageError('संग्रह का डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (data.name === undefined || typeof data.name !== 'string' || data.name.trim() === '') {
      throw new StorageError('संग्रह का नाम अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (data.description !== undefined && typeof data.description !== 'string') {
      throw new StorageError('संग्रह का विवरण स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (data.poemIds !== undefined && !Array.isArray(data.poemIds)) {
      throw new StorageError('कविता सूची (poemIds) एक ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Validates update input
   */
  _validateUpdateInput(changes) {
    if (!changes || typeof changes !== 'object') {
      throw new StorageError('संशोधन डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.name !== undefined) {
      if (typeof changes.name !== 'string' || changes.name.trim() === '') {
        throw new StorageError('संग्रह का नाम गैर-रिक्त होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
      }
    }

    if (changes.description !== undefined && typeof changes.description !== 'string') {
      throw new StorageError('संग्रह का विवरण स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.poemIds !== undefined && !Array.isArray(changes.poemIds)) {
      throw new StorageError('कविता सूची (poemIds) एक ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Retrieves all collections, sorted newest created first
   * @returns {Array} Deep-cloned array of collections
   */
  getAll() {
    const collections = this._readCollections();
    const valid = collections.filter(c => c && typeof c === 'object' && typeof c.id === 'string');
    valid.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    return deepClone(valid.map(c => ({
      ...c,
      poemIds: Array.isArray(c.poemIds) ? c.poemIds : []
    })));
  }

  /**
   * Retrieves a single collection by unique ID
   * @param {string} id
   * @returns {Object|null}
   */
  getById(id) {
    if (!id || typeof id !== 'string') return null;
    const collections = this._readCollections();
    const found = collections.find(c => c && typeof c === 'object' && c.id === id);
    if (!found) return null;
    const cloned = deepClone(found);
    if (!Array.isArray(cloned.poemIds)) {
      cloned.poemIds = [];
    }
    return cloned;
  }

  /**
   * Creates and persists a new collection
   * @param {Object} data
   * @param {string} data.name
   * @param {string} [data.description='']
   * @param {string[]} [data.poemIds=[]]
   * @returns {Object} Created collection
   */
  create(data) {
    this._validateCreateInput(data);

    const collections = this._readCollections();
    const id = data.id && typeof data.id === 'string' && data.id.trim() !== ''
      ? data.id.trim()
      : generateUniqueId();

    if (collections.some(c => c.id === id)) {
      throw new StorageError(
        `आईडी "${id}" वाला संग्रह पहले से उपस्थित है।`,
        StorageErrorCode.DUPLICATE_ID,
        null,
        { id }
      );
    }

    const now = new Date().toISOString();
    const rawIds = Array.isArray(data.poemIds) ? data.poemIds.map(String) : [];
    // Ensure uniqueness of poem IDs within collection
    const uniqueIds = Array.from(new Set(rawIds));

    const newCollection = {
      id,
      name: data.name.trim(),
      description: typeof data.description === 'string' ? data.description.trim() : '',
      poemIds: uniqueIds,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    };

    collections.push(newCollection);
    this._writeCollections(collections);

    return deepClone(newCollection);
  }

  /**
   * Updates an existing collection's name or description
   * @param {string} id
   * @param {Object} changes
   * @returns {Object} Updated collection
   */
  update(id, changes) {
    this._validateUpdateInput(changes);

    const collections = this._readCollections();
    const index = collections.findIndex(c => c.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाला संग्रह नहीं मिला।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    const current = collections[index];
    const now = new Date().toISOString();

    let updatedPoemIds = current.poemIds;
    if (changes.poemIds !== undefined) {
      updatedPoemIds = Array.from(new Set(changes.poemIds.map(String)));
    }

    const updated = {
      ...current,
      name: changes.name !== undefined ? changes.name.trim() : current.name,
      description: changes.description !== undefined ? changes.description.trim() : current.description,
      poemIds: updatedPoemIds,
      updatedAt: now
    };

    collections[index] = updated;
    this._writeCollections(collections);

    return deepClone(updated);
  }

  /**
   * Deletes a collection. Does NOT delete referenced poems.
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    const collections = this._readCollections();
    const index = collections.findIndex(c => c.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाला संग्रह हटाने के लिए नहीं मिला।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    collections.splice(index, 1);
    this._writeCollections(collections);
    return true;
  }

  /**
   * Adds a poem ID to a collection safely, preventing duplicates
   * @param {string} collectionId
   * @param {string} poemId
   * @returns {Object} Updated collection
   */
  addPoem(collectionId, poemId) {
    if (!poemId || typeof poemId !== 'string' || poemId.trim() === '') {
      throw new StorageError('कविता आईडी मान्य स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const collections = this._readCollections();
    const index = collections.findIndex(c => c.id === collectionId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${collectionId}" वाला संग्रह नहीं मिला।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { collectionId }
      );
    }

    const current = collections[index];
    if (!Array.isArray(current.poemIds)) {
      current.poemIds = [];
    }
    const cleanPoemId = poemId.trim();

    // Prevent duplicate poem IDs within collection
    if (!current.poemIds.includes(cleanPoemId)) {
      current.poemIds.push(cleanPoemId);
      current.updatedAt = new Date().toISOString();
      collections[index] = current;
      this._writeCollections(collections);
    }

    return deepClone(current);
  }

  /**
   * Removes a poem ID from a collection
   * @param {string} collectionId
   * @param {string} poemId
   * @returns {Object} Updated collection
   */
  removePoem(collectionId, poemId) {
    if (!poemId || typeof poemId !== 'string') {
      return this.getById(collectionId);
    }

    const collections = this._readCollections();
    const index = collections.findIndex(c => c.id === collectionId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${collectionId}" वाला संग्रह नहीं मिला।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { collectionId }
      );
    }

    const current = collections[index];
    if (!Array.isArray(current.poemIds)) {
      current.poemIds = [];
    }
    const cleanPoemId = poemId.trim();

    if (current.poemIds.includes(cleanPoemId)) {
      current.poemIds = current.poemIds.filter(id => id !== cleanPoemId);
      current.updatedAt = new Date().toISOString();
      collections[index] = current;
      this._writeCollections(collections);
    }

    return deepClone(current);
  }

  /**
   * Cleans up all references to a deleted poem ID across all collections
   * @param {string} poemId
   */
  removePoemFromAll(poemId) {
    if (!poemId || typeof poemId !== 'string') return;

    const collections = this._readCollections();
    let modified = false;

    for (const c of collections) {
      if (Array.isArray(c.poemIds) && c.poemIds.includes(poemId)) {
        c.poemIds = c.poemIds.filter(id => id !== poemId);
        c.updatedAt = new Date().toISOString();
        modified = true;
      }
    }

    if (modified) {
      this._writeCollections(collections);
    }
  }
}

// Global default singleton instance
export const collectionRepository = new CollectionRepository();
