/**
 * काव्यकलश (KavyaVault) — IndexedDB Vector Store (IndexedDBVectorStore.js)
 * Phase 5 / Task 5.3: Local Vector Index + Semantic Retrieval Foundation
 *
 * Dedicated local vector store backed by browser IndexedDB.
 * Completely isolated from poem repository and LocalStorage.
 * Includes in-memory fallback driver for headless and Node test environments.
 */

import { IVectorStore } from './IVectorStore.js';
import { createPoemEmbedding, validateEmbeddingVector } from '../semantic/semanticTypes.js';
import { StorageError, StorageErrorCode } from '../../storage/StorageError.js';

const DB_NAME = 'kavyavault_vectors_db';
const DB_VERSION = 1;
const STORE_NAME = 'poem_vectors';

export class IndexedDBVectorStore extends IVectorStore {
  /**
   * @param {Object} [options={}]
   * @param {IDBFactory} [options.indexedDB] Explicit IndexedDB factory
   * @param {Map<string, Object>} [options.memoryDriver] In-memory store override (for tests/headless)
   */
  constructor(options = {}) {
    super();
    this._customIndexedDB = options.indexedDB || null;
    this._memoryDriver = options.memoryDriver || null;
    this._dbPromise = null;
  }

  /**
   * Resolves the available IndexedDB factory
   * @returns {IDBFactory|null}
   */
  _getIndexedDB() {
    if (this._customIndexedDB) return this._customIndexedDB;
    if (typeof window !== 'undefined' && window.indexedDB) return window.indexedDB;
    if (typeof globalThis !== 'undefined' && globalThis.indexedDB) return globalThis.indexedDB;
    return null;
  }

  /**
   * Determines if the vector store is operational.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (this._memoryDriver) return true;
    const idb = this._getIndexedDB();
    if (!idb) return true; // In-memory fallback available
    try {
      await this._getDB();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Opens or resolves the IndexedDB database instance
   * @private
   */
  async _getDB() {
    if (this._memoryDriver) return null;

    const idb = this._getIndexedDB();
    if (!idb) {
      // In headless Node.js without polyfill, use internal in-memory Map
      if (!this._memoryStore) {
        this._memoryStore = new Map();
      }
      return null;
    }

    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
      try {
        const request = idb.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('by_poemId', 'poemId', { unique: false });
            store.createIndex('by_model', 'model', { unique: false });
            store.createIndex('by_sourceTextHash', 'sourceTextHash', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = (event) => {
          this._dbPromise = null;
          reject(new StorageError(
            'IndexedDB वेक्टर डेटाबेस खोलने में विफल।',
            StorageErrorCode.STORAGE_UNAVAILABLE,
            event.target.error
          ));
        };
      } catch (err) {
        this._dbPromise = null;
        reject(new StorageError(
          'IndexedDB वेक्टर डेटाबेस आरंभ करने में त्रुटि।',
          StorageErrorCode.STORAGE_UNAVAILABLE,
          err
        ));
      }
    });

    return this._dbPromise;
  }

  /**
   * Clones and freezes an embedding record for immutability
   * @private
   */
  _sanitizeRecord(record) {
    if (!record) return null;
    const copy = {
      id: record.id,
      poemId: record.poemId,
      model: record.model,
      dimensions: record.dimensions,
      vector: Object.freeze(Array.from(record.vector)),
      sourceTextHash: record.sourceTextHash,
      createdAt: record.createdAt
    };
    return Object.freeze(copy);
  }

  /**
   * Retrieves an embedding record by compound key
   *
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    if (!id || typeof id !== 'string') return null;

    if (this._memoryDriver || (!this._getIndexedDB() && this._memoryStore)) {
      const store = this._memoryDriver || this._memoryStore;
      const rec = store.get(id);
      return rec ? this._sanitizeRecord(rec) : null;
    }

    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => {
          resolve(req.result ? this._sanitizeRecord(req.result) : null);
        };
        req.onerror = (e) => {
          reject(new StorageError(
            'वेक्टर रिकॉर्ड प्राप्त करने में विफल।',
            StorageErrorCode.STORAGE_UNAVAILABLE,
            e.target.error
          ));
        };
      } catch (err) {
        reject(new StorageError(
          'वेक्टर ट्रांजेक्शन विफल।',
          StorageErrorCode.STORAGE_UNAVAILABLE,
          err
        ));
      }
    });
  }

  /**
   * Persists a validated PoemEmbedding record into the vector store.
   *
   * @param {Object} embedding PoemEmbedding object
   * @returns {Promise<string>} Stored compound key
   */
  async put(embedding) {
    if (!embedding || typeof embedding !== 'object') {
      throw new StorageError(
        'अमान्य एम्बेडिंग ऑब्जेक्ट।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Strict validation before write
    const validated = createPoemEmbedding(embedding);
    const key = IVectorStore.buildKey(validated.poemId, validated.model);

    const recordToSave = {
      id: key,
      poemId: validated.poemId,
      model: validated.model,
      dimensions: validated.dimensions,
      vector: Array.from(validated.vector),
      sourceTextHash: validated.sourceTextHash,
      createdAt: validated.createdAt
    };

    if (this._memoryDriver || (!this._getIndexedDB() && this._memoryStore)) {
      const store = this._memoryDriver || this._memoryStore;
      store.set(key, recordToSave);
      return key;
    }

    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(recordToSave);

        req.onsuccess = () => resolve(key);
        req.onerror = (e) => {
          reject(new StorageError(
            'वेक्टर रिकॉर्ड सहेजने में विफल।',
            StorageErrorCode.STORAGE_UNAVAILABLE,
            e.target.error
          ));
        };
      } catch (err) {
        reject(new StorageError(
          'वेक्टर राइट ट्रांजेक्शन विफल।',
          StorageErrorCode.STORAGE_UNAVAILABLE,
          err
        ));
      }
    });
  }

  /**
   * Deletes a record by compound key
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    if (!id || typeof id !== 'string') return false;

    if (this._memoryDriver || (!this._getIndexedDB() && this._memoryStore)) {
      const store = this._memoryDriver || this._memoryStore;
      return store.delete(id);
    }

    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);

        req.onsuccess = () => resolve(true);
        req.onerror = (e) => {
          reject(new StorageError(
            'वेक्टर रिकॉर्ड हटाने में विफल।',
            StorageErrorCode.STORAGE_UNAVAILABLE,
            e.target.error
          ));
        };
      } catch (err) {
        reject(new StorageError(
          'वेक्टर डिलीट ट्रांजेक्शन विफल।',
          StorageErrorCode.STORAGE_UNAVAILABLE,
          err
        ));
      }
    });
  }

  /**
   * Clears all vector records in the object store.
   * @returns {Promise<void>}
   */
  async clear() {
    if (this._memoryDriver || (!this._getIndexedDB() && this._memoryStore)) {
      const store = this._memoryDriver || this._memoryStore;
      store.clear();
      return;
    }

    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = (e) => {
          reject(new StorageError(
            'वेक्टर स्टोर रिक्त करने में विफल।',
            StorageErrorCode.STORAGE_UNAVAILABLE,
            e.target.error
          ));
        };
      } catch (err) {
        reject(new StorageError(
          'वेक्टर क्लियर ट्रांजेक्शन विफल।',
          StorageErrorCode.STORAGE_UNAVAILABLE,
          err
        ));
      }
    });
  }

  /**
   * Retrieves all embedding records, optionally filtered by model.
   *
   * @param {Object} [filter={}]
   * @param {string} [filter.model]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(filter = {}) {
    const targetModel = filter.model ? filter.model.trim() : null;

    if (this._memoryDriver || (!this._getIndexedDB() && this._memoryStore)) {
      const store = this._memoryDriver || this._memoryStore;
      const results = [];
      for (const rec of store.values()) {
        if (!targetModel || rec.model === targetModel) {
          results.push(this._sanitizeRecord(rec));
        }
      }
      return results;
    }

    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = targetModel
          ? store.index('by_model').getAll(targetModel)
          : store.getAll();

        req.onsuccess = () => {
          const sanitized = (req.result || []).map(r => this._sanitizeRecord(r));
          resolve(sanitized);
        };
        req.onerror = (e) => {
          reject(new StorageError(
            'वेक्टर सूची प्राप्त करने में विफल।',
            StorageErrorCode.STORAGE_UNAVAILABLE,
            e.target.error
          ));
        };
      } catch (err) {
        reject(new StorageError(
          'वेक्टर रीड ट्रांजेक्शन विफल।',
          StorageErrorCode.STORAGE_UNAVAILABLE,
          err
        ));
      }
    });
  }

  /**
   * Counts stored vector records.
   *
   * @param {Object} [filter={}]
   * @param {string} [filter.model]
   * @returns {Promise<number>}
   */
  async count(filter = {}) {
    const targetModel = filter.model ? filter.model.trim() : null;

    if (this._memoryDriver || (!this._getIndexedDB() && this._memoryStore)) {
      const store = this._memoryDriver || this._memoryStore;
      if (!targetModel) return store.size;
      let cnt = 0;
      for (const rec of store.values()) {
        if (rec.model === targetModel) cnt++;
      }
      return cnt;
    }

    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = targetModel
          ? store.index('by_model').count(targetModel)
          : store.count();

        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = (e) => {
          reject(new StorageError(
            'वेक्टर गणना में विफल।',
            StorageErrorCode.STORAGE_UNAVAILABLE,
            e.target.error
          ));
        };
      } catch (err) {
        reject(new StorageError(
          'वेक्टर काउंट ट्रांजेक्शन विफल।',
          StorageErrorCode.STORAGE_UNAVAILABLE,
          err
        ));
      }
    });
  }

  /**
   * Finds vector records by poemId.
   *
   * @param {string} poemId
   * @param {string} [model]
   * @returns {Promise<Array<Object>>}
   */
  async findByPoemId(poemId, model = null) {
    if (!poemId || typeof poemId !== 'string') return [];
    const all = await this.getAll({ model });
    return all.filter(r => r.poemId === poemId.trim());
  }

  /**
   * Finds all vector records for a specific model version.
   *
   * @param {string} model
   * @returns {Promise<Array<Object>>}
   */
  async findByModel(model) {
    if (!model || typeof model !== 'string') return [];
    return this.getAll({ model });
  }

  /**
   * Finds records matching a source text hash.
   *
   * @param {string} sourceTextHash
   * @param {string} [model]
   * @returns {Promise<Array<Object>>}
   */
  async findBySourceTextHash(sourceTextHash, model = null) {
    if (!sourceTextHash || typeof sourceTextHash !== 'string') return [];
    const all = await this.getAll({ model });
    return all.filter(r => r.sourceTextHash === sourceTextHash.trim());
  }
}
