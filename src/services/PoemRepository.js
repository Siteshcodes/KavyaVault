/**
 * काव्यकलश (KavyaVault) — Poem Repository (PoemRepository.js)
 * Domain repository managing Poem and Draft entities.
 * Decoupled from concrete storage drivers through IStorageAdapter.
 */

import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './storage/StorageError.js';
import { STORAGE_KEYS } from '../data/storageKeys.js';
import { CollectionRepository } from './CollectionRepository.js';

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
 * Generates a collision-resistant unique poem identifier
 */
function generateUniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_poem_${crypto.randomUUID()}`;
  }
  return `kv_poem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class PoemRepository {
  /**
   * @param {import('./storage/IStorageAdapter.js').IStorageAdapter} [adapter=null]
   * @param {import('./CollectionRepository.js').CollectionRepository} [collectionRepo=null]
   * @param {import('./ManuscriptRepository.js').ManuscriptRepository} [manuscriptRepo=null]
   */
  constructor(adapter = null, collectionRepo = null, manuscriptRepo = null) {
    this.adapter = adapter || new LocalStorageAdapter();
    this.collectionRepo = collectionRepo || new CollectionRepository(this.adapter);
    this.manuscriptRepo = manuscriptRepo;
  }

  /**
   * Internal helper: safely reads poems array, recovering from any corruption
   */
  _readPoems() {
    try {
      const data = this.adapter.get(STORAGE_KEYS.POEMS);
      if (data === null || data === undefined) {
        return [];
      }
      if (!Array.isArray(data)) {
        console.warn('[PoemRepository] Stored poems data was not an array. Returning empty collection safely.');
        return [];
      }
      return data;
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.DESERIALIZATION_ERROR) {
        console.error('[PoemRepository] Corrupted poems storage detected. Returning empty set to prevent crash.');
        return [];
      }
      throw err;
    }
  }

  /**
   * Internal helper: safely writes poems array
   */
  _writePoems(poems) {
    this.adapter.set(STORAGE_KEYS.POEMS, deepClone(poems));
  }

  /**
   * Validates raw input for poem creation
   */
  _validateCreateInput(poemData) {
    if (!poemData || typeof poemData !== 'object') {
      throw new StorageError('कविता का डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    // ID validation if explicitly provided
    if (poemData.id !== undefined) {
      if (typeof poemData.id !== 'string' || poemData.id.trim() === '') {
        throw new StorageError('कविता आईडी (ID) गैर-रिक्त स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
      }
    }

    // Title validation
    if (poemData.title === undefined || typeof poemData.title !== 'string') {
      throw new StorageError('कविता का शीर्षक (Title) एक स्ट्रिंग होना अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    // Body validation
    if (poemData.body === undefined || typeof poemData.body !== 'string') {
      throw new StorageError('कविता का मुख्य पाठ (Body) एक स्ट्रिंग होना अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    // Author validation
    if (poemData.author !== undefined && typeof poemData.author !== 'string') {
      throw new StorageError('रचनाकार (Author) का नाम स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    // Tags validation
    if (poemData.tags !== undefined && !Array.isArray(poemData.tags)) {
      throw new StorageError('टैग (Tags) एक ऐरे होना अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    // Flags validation
    if (poemData.isFavorite !== undefined && typeof poemData.isFavorite !== 'boolean') {
      throw new StorageError('"isFavorite" फ्लैग बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (poemData.isArchived !== undefined && typeof poemData.isArchived !== 'boolean') {
      throw new StorageError('"isArchived" फ्लैग बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Validates changes object during updates
   */
  _validateUpdateInput(changes) {
    if (!changes || typeof changes !== 'object') {
      throw new StorageError('संशोधन डेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.title !== undefined && typeof changes.title !== 'string') {
      throw new StorageError('कविता का शीर्षक (Title) एक स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.body !== undefined && typeof changes.body !== 'string') {
      throw new StorageError('कविता का मुख्य पाठ (Body) एक स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.author !== undefined && typeof changes.author !== 'string') {
      throw new StorageError('रचनाकार (Author) का नाम स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.tags !== undefined && !Array.isArray(changes.tags)) {
      throw new StorageError('टैग (Tags) एक ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.isFavorite !== undefined && typeof changes.isFavorite !== 'boolean') {
      throw new StorageError('"isFavorite" फ्लैग बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (changes.isArchived !== undefined && typeof changes.isArchived !== 'boolean') {
      throw new StorageError('"isArchived" फ्लैग बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Validates a complete stored poem entity
   */
  validatePoem(poem) {
    if (!poem || typeof poem !== 'object') {
      throw new StorageError('कविता का प्रारूप अमान्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (typeof poem.id !== 'string' || poem.id.trim() === '') {
      throw new StorageError('कविता आईडी (ID) आवश्यक है।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (typeof poem.title !== 'string') {
      throw new StorageError('कविता का शीर्षक (Title) एक स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (typeof poem.body !== 'string') {
      throw new StorageError('कविता का मुख्य पाठ (Body) एक स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (typeof poem.author !== 'string') {
      throw new StorageError('रचनाकार (Author) का नाम आवश्यक है।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (typeof poem.isFavorite !== 'boolean') {
      throw new StorageError('"isFavorite" फ्लैग बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (typeof poem.isArchived !== 'boolean') {
      throw new StorageError('"isArchived" फ्लैग बूलियन होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (!Array.isArray(poem.tags)) {
      throw new StorageError('टैग (Tags) एक ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (!poem.createdAt || isNaN(Date.parse(poem.createdAt))) {
      throw new StorageError('रचना तिथि (createdAt) मान्य ISO प्रारूप में होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (!poem.updatedAt || isNaN(Date.parse(poem.updatedAt))) {
      throw new StorageError('अद्यतन तिथि (updatedAt) मान्य ISO प्रारूप में होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  /**
   * Retrieves all poems with optional filtering
   * @param {Object} options
   * @param {boolean} [options.includeArchived=false]
   * @param {boolean} [options.onlyFavorites=false]
   * @returns {Array} Deep-cloned list of poems
   */
  getAll({ includeArchived = false, onlyFavorites = false } = {}) {
    const rawPoems = this._readPoems();

    // Guard against null, undefined, or non-object corrupted entries
    const validPoems = rawPoems.filter(p => p && typeof p === 'object' && typeof p.id === 'string');

    let filtered = validPoems;
    if (!includeArchived) {
      filtered = filtered.filter(p => !p.isArchived);
    }
    if (onlyFavorites) {
      filtered = filtered.filter(p => Boolean(p.isFavorite));
    }

    // Default sort by updatedAt descending with safe timestamp fallback
    filtered.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return deepClone(filtered);
  }

  /**
   * Retrieves a single poem by its unique ID
   * @param {string} id
   * @returns {Object|null} Deep-cloned poem or null
   */
  getById(id) {
    if (!id || typeof id !== 'string') return null;
    const poems = this._readPoems();
    const found = poems.find(p => p && typeof p === 'object' && p.id === id);
    return found ? deepClone(found) : null;
  }

  /**
   * Creates and stores a new poem
   * @param {Object} poemData
   * @returns {Object} Created poem
   */
  create(poemData) {
    this._validateCreateInput(poemData);

    const poems = this._readPoems();
    const id = poemData.id ? poemData.id.trim() : generateUniqueId();

    // Prevent duplicate ID insertion
    if (poems.some(p => p.id === id)) {
      throw new StorageError(
        `आईडी "${id}" वाली रचना पहले से उपस्थित है।`,
        StorageErrorCode.DUPLICATE_ID,
        null,
        { id }
      );
    }

    const now = new Date().toISOString();
    const newPoem = {
      id,
      title: poemData.title.trim(),
      body: poemData.body,
      author: typeof poemData.author === 'string' && poemData.author.trim() !== '' ? poemData.author.trim() : 'अज्ञात',
      createdAt: poemData.createdAt || now,
      updatedAt: poemData.updatedAt || now,
      isFavorite: Boolean(poemData.isFavorite),
      isArchived: Boolean(poemData.isArchived),
      tags: Array.isArray(poemData.tags) ? poemData.tags.map(t => String(t).trim()) : [],
      mood: poemData.mood || null,
      rasa: poemData.rasa || null
    };

    this.validatePoem(newPoem);
    poems.push(newPoem);
    this._writePoems(poems);

    return deepClone(newPoem);
  }

  /**
   * Updates an existing poem
   * @param {string} id
   * @param {Object} changes
   * @returns {Object} Updated poem
   */
  update(id, changes) {
    this._validateUpdateInput(changes);

    const poems = this._readPoems();
    const index = poems.findIndex(p => p.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाली कविता नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    const current = poems[index];
    const now = new Date().toISOString();

    const updated = {
      ...current,
      title: changes.title !== undefined ? changes.title.trim() : current.title,
      body: changes.body !== undefined ? changes.body : current.body,
      author: changes.author !== undefined ? changes.author.trim() : current.author,
      isFavorite: changes.isFavorite !== undefined ? changes.isFavorite : current.isFavorite,
      isArchived: changes.isArchived !== undefined ? changes.isArchived : current.isArchived,
      tags: changes.tags !== undefined ? changes.tags.map(t => String(t).trim()) : current.tags,
      mood: changes.mood !== undefined ? changes.mood : current.mood,
      rasa: changes.rasa !== undefined ? changes.rasa : current.rasa,
      updatedAt: now
    };

    this.validatePoem(updated);
    poems[index] = updated;
    this._writePoems(poems);

    return deepClone(updated);
  }

  /**
   * Permanently deletes a poem
   * @param {string} id
   * @returns {boolean} True if deleted
   */
  delete(id) {
    const poems = this._readPoems();
    const index = poems.findIndex(p => p.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाली कविता हटाने के लिए नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    poems.splice(index, 1);
    this._writePoems(poems);

    // Safely cleanup dangling references in collections
    try {
      if (this.collectionRepo && typeof this.collectionRepo.removePoemFromAll === 'function') {
        this.collectionRepo.removePoemFromAll(id);
      }
    } catch {
      // Safe fallback
    }

    // Safely unlink any manuscripts pointing to this deleted poem
    try {
      if (this.manuscriptRepo && typeof this.manuscriptRepo.unlinkAllFromPoem === 'function') {
        this.manuscriptRepo.unlinkAllFromPoem(id);
      } else {
        const raw = this.adapter.get(STORAGE_KEYS.MANUSCRIPTS);
        if (Array.isArray(raw)) {
          let changed = false;
          const updated = raw.map(m => {
            if (m && m.poemId === id) {
              changed = true;
              return { ...m, poemId: null, updatedAt: new Date().toISOString() };
            }
            return m;
          });
          if (changed) {
            this.adapter.set(STORAGE_KEYS.MANUSCRIPTS, updated);
          }
        }
      }
    } catch {
      // Safe fallback
    }

    return true;
  }

  /**
   * Moves a poem to archive
   * @param {string} id
   * @returns {Object} Updated poem
   */
  archive(id) {
    return this.update(id, { isArchived: true });
  }

  /**
   * Restores an archived poem to main library
   * @param {string} id
   * @returns {Object} Updated poem
   */
  restore(id) {
    return this.update(id, { isArchived: false });
  }

  /**
   * Toggles or sets favorite status
   * @param {string} id
   * @param {boolean} value
   * @returns {Object} Updated poem
   */
  setFavorite(id, value) {
    return this.update(id, { isFavorite: Boolean(value) });
  }

  /* ========================================================================
     DRAFT PERSISTENCE
     ======================================================================== */

  /**
   * Retrieves the current unsaved draft
   * @returns {Object|null}
   */
  getDraft() {
    try {
      const draft = this.adapter.get(STORAGE_KEYS.DRAFTS);
      if (!draft || typeof draft !== 'object') {
        return null;
      }
      return deepClone(draft);
    } catch {
      return null;
    }
  }

  /**
   * Saves or updates current draft
   * @param {Object} draftData
   * @returns {Object} Saved draft
   */
  saveDraft(draftData) {
    if (!draftData || typeof draftData !== 'object') {
      throw new StorageError('ड्राफ्ट प्रारूप अमान्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    const draft = {
      poemId: draftData.poemId || null,
      title: typeof draftData.title === 'string' ? draftData.title : '',
      body: typeof draftData.body === 'string' ? draftData.body : '',
      author: typeof draftData.author === 'string' ? draftData.author : '',
      tags: Array.isArray(draftData.tags) ? draftData.tags : [],
      mood: draftData.mood || null,
      rasa: draftData.rasa || null,
      savedAt: new Date().toISOString()
    };

    this.adapter.set(STORAGE_KEYS.DRAFTS, deepClone(draft));
    return deepClone(draft);
  }

  /**
   * Clears existing draft
   */
  clearDraft() {
    this.adapter.remove(STORAGE_KEYS.DRAFTS);
  }
}

// Global default singleton instance
export const poemRepository = new PoemRepository();
