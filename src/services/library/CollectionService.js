/**
 * काव्यकलश (KavyaVault) — Collection Service (CollectionService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Coordinates collection management and poem membership:
 * - Creates, renames, updates, and deletes collections.
 * - Manages poem membership, preventing duplicate poem IDs within a collection.
 * - Supports multi-collection poem membership (a poem may belong to multiple collections).
 * - CRITICAL: Deleting a collection NEVER deletes or mutates poem records.
 * - Resolves actual poem objects from PoemRepository for presentation.
 */

import { collectionRepository } from '../CollectionRepository.js';
import { poemRepository } from '../PoemRepository.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';
import { createCollection, validateCollection } from './libraryTypes.js';

export class CollectionService {
  /**
   * @param {Object} [options={}]
   * @param {import('../CollectionRepository.js').CollectionRepository} [options.collectionRepo]
   * @param {import('../PoemRepository.js').PoemRepository} [options.poemRepo]
   */
  constructor(options = {}) {
    this.collectionRepo = options.collectionRepo || collectionRepository;
    this.poemRepo = options.poemRepo || poemRepository;
  }

  /**
   * Creates a new collection
   *
   * @param {Object} data
   * @param {string} data.name
   * @param {string} [data.description='']
   * @param {string[]} [data.poemIds=[]]
   * @returns {Object} Created collection
   */
  createCollection(data = {}) {
    if (!data || typeof data !== 'object') {
      throw new StorageError('संग्रह डेटा ऑब्जेक्ट होना अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    if (typeof data.name !== 'string' || data.name.trim() === '') {
      throw new StorageError('संग्रह का नाम अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    // Validate that provided poem IDs exist in poem repository (omitting missing ones)
    const validPoemIds = [];
    if (Array.isArray(data.poemIds)) {
      for (const pid of data.poemIds) {
        if (typeof pid === 'string' && pid.trim()) {
          const cleanId = pid.trim();
          if (this.poemRepo.getById(cleanId)) {
            validPoemIds.push(cleanId);
          }
        }
      }
    }

    return this.collectionRepo.create({
      name: data.name.trim(),
      description: typeof data.description === 'string' ? data.description.trim() : '',
      poemIds: Array.from(new Set(validPoemIds))
    });
  }

  /**
   * Renames an existing collection
   * @param {string} collectionId
   * @param {string} newName
   * @returns {Object} Updated collection
   */
  renameCollection(collectionId, newName) {
    if (!collectionId || typeof collectionId !== 'string') {
      throw new StorageError('संग्रह आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }
    if (!newName || typeof newName !== 'string' || newName.trim() === '') {
      throw new StorageError('संग्रह का नया नाम गैर-रिक्त होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    return this.collectionRepo.update(collectionId.trim(), {
      name: newName.trim()
    });
  }

  /**
   * Updates description of a collection
   * @param {string} collectionId
   * @param {string} newDescription
   * @returns {Object} Updated collection
   */
  updateDescription(collectionId, newDescription) {
    if (!collectionId || typeof collectionId !== 'string') {
      throw new StorageError('संग्रह आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }
    if (typeof newDescription !== 'string') {
      throw new StorageError('विवरण स्ट्रिंग होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    return this.collectionRepo.update(collectionId.trim(), {
      description: newDescription.trim()
    });
  }

  /**
   * Adds a poem to a collection, preventing duplicates
   * @param {string} collectionId
   * @param {string} poemId
   * @returns {Object} Updated collection
   */
  addPoemToCollection(collectionId, poemId) {
    if (!collectionId || typeof collectionId !== 'string' || !collectionId.trim()) {
      throw new StorageError('संग्रह आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }
    if (!poemId || typeof poemId !== 'string' || !poemId.trim()) {
      throw new StorageError('कविता आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    const cleanPoemId = poemId.trim();
    const cleanColId = collectionId.trim();

    // Verify poem exists in repository
    const poem = this.poemRepo.getById(cleanPoemId);
    if (!poem) {
      throw new StorageError(
        `आईडी "${cleanPoemId}" वाली कविता पुस्तकालय में नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { poemId: cleanPoemId }
      );
    }

    return this.collectionRepo.addPoem(cleanColId, cleanPoemId);
  }

  /**
   * Removes a poem from a collection
   * @param {string} collectionId
   * @param {string} poemId
   * @returns {Object} Updated collection
   */
  removePoemFromCollection(collectionId, poemId) {
    if (!collectionId || typeof collectionId !== 'string') {
      throw new StorageError('संग्रह आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }
    return this.collectionRepo.removePoem(collectionId.trim(), poemId ? poemId.trim() : '');
  }

  /**
   * Retrieves collection by ID
   * @param {string} collectionId
   * @returns {Object|null}
   */
  getCollection(collectionId) {
    if (!collectionId || typeof collectionId !== 'string') return null;
    return this.collectionRepo.getById(collectionId.trim());
  }

  /**
   * Lists all collections
   * @returns {Array<Object>}
   */
  listCollections() {
    return this.collectionRepo.getAll();
  }

  /**
   * Resolves and returns actual poem records contained within a collection.
   * Automatically filters out permanently deleted poem IDs.
   *
   * @param {string} collectionId
   * @returns {Array<Object>} List of poems
   */
  getCollectionPoems(collectionId) {
    const collection = this.getCollection(collectionId);
    if (!collection || !Array.isArray(collection.poemIds)) {
      return [];
    }

    const poems = [];
    for (const pid of collection.poemIds) {
      const poem = this.poemRepo.getById(pid);
      if (poem) {
        poems.push(poem);
      }
    }

    return poems;
  }

  /**
   * Deletes a collection.
   * CRITICAL GUARANTEE: Does NOT delete or modify any referenced poems in PoemRepository!
   *
   * @param {string} collectionId
   * @returns {boolean} True if deleted
   */
  deleteCollection(collectionId) {
    if (!collectionId || typeof collectionId !== 'string') {
      throw new StorageError('संग्रह आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }
    return this.collectionRepo.delete(collectionId.trim());
  }

  /**
   * Finds all collections that contain the specified poem ID
   * (demonstrating that a poem may belong to multiple collections)
   *
   * @param {string} poemId
   * @returns {Array<Object>}
   */
  getCollectionsForPoem(poemId) {
    if (!poemId || typeof poemId !== 'string') return [];
    const cleanId = poemId.trim();
    const allCollections = this.collectionRepo.getAll();
    return allCollections.filter(c => Array.isArray(c.poemIds) && c.poemIds.includes(cleanId));
  }
}

export const collectionService = new CollectionService();
