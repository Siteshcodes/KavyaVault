/**
 * काव्यकलश (KavyaVault) — Vector Store Contract (IVectorStore.js)
 * Phase 5 / Task 5.3: Local Vector Index + Semantic Retrieval Foundation
 *
 * Abstract contract for local vector persistence and indexing.
 * Pure vector repository isolated completely from poem domain storage.
 */

export class IVectorStore {
  /**
   * Generates a canonical compound key for an embedding record.
   *
   * @param {string} poemId
   * @param {string} model
   * @returns {string} `${poemId}::${model}`
   */
  static buildKey(poemId, model) {
    if (!poemId || typeof poemId !== 'string' || !model || typeof model !== 'string') {
      throw new Error('poemId और model स्ट्रिंग होना अनिवार्य है।');
    }
    return `${poemId.trim()}::${model.trim()}`;
  }

  /**
   * Indicates if the underlying vector store driver is operational.
   * @returns {Promise<boolean>|boolean}
   */
  async isAvailable() {
    throw new Error('IVectorStore.isAvailable() must be implemented.');
  }

  /**
   * Retrieves a single embedding record by its compound key.
   *
   * @param {string} id Compound key `${poemId}::${model}`
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    throw new Error('IVectorStore.get() must be implemented.');
  }

  /**
   * Persists an embedding record into the vector store.
   *
   * @param {Object} embedding PoemEmbedding domain record
   * @returns {Promise<string>} Saved record ID
   */
  async put(embedding) {
    throw new Error('IVectorStore.put() must be implemented.');
  }

  /**
   * Deletes an embedding record by its compound key.
   *
   * @param {string} id Compound key `${poemId}::${model}`
   * @returns {Promise<boolean>} True if record was deleted
   */
  async delete(id) {
    throw new Error('IVectorStore.delete() must be implemented.');
  }

  /**
   * Clears all stored vector records.
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('IVectorStore.clear() must be implemented.');
  }

  /**
   * Retrieves all embedding records, optionally filtered by model version.
   *
   * @param {Object} [filter={}]
   * @param {string} [filter.model]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(filter = {}) {
    throw new Error('IVectorStore.getAll() must be implemented.');
  }

  /**
   * Counts stored vector records.
   *
   * @param {Object} [filter={}]
   * @param {string} [filter.model]
   * @returns {Promise<number>}
   */
  async count(filter = {}) {
    throw new Error('IVectorStore.count() must be implemented.');
  }

  /**
   * Finds embedding records by poemId.
   *
   * @param {string} poemId
   * @param {string} [model]
   * @returns {Promise<Array<Object>>}
   */
  async findByPoemId(poemId, model = null) {
    throw new Error('IVectorStore.findByPoemId() must be implemented.');
  }

  /**
   * Finds all embedding records for a given model version.
   *
   * @param {string} model
   * @returns {Promise<Array<Object>>}
   */
  async findByModel(model) {
    throw new Error('IVectorStore.findByModel() must be implemented.');
  }

  /**
   * Finds an embedding record by its source text hash.
   *
   * @param {string} sourceTextHash
   * @param {string} [model]
   * @returns {Promise<Array<Object>>}
   */
  async findBySourceTextHash(sourceTextHash, model = null) {
    throw new Error('IVectorStore.findBySourceTextHash() must be implemented.');
  }
}
