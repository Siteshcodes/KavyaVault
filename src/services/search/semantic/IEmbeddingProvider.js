/**
 * काव्यकलश (KavyaVault) — Embedding Provider Contract (IEmbeddingProvider.js)
 * Phase 5 / Task 5.2: Local Semantic Representation
 *
 * Abstract contract for local and future semantic embedding generation.
 * Independent of any specific ML library or backend runtime.
 */

import { preparePoemSemanticText, prepareQuerySemanticText } from './semanticPreparation.js';

export class IEmbeddingProvider {
  /**
   * Unique machine-readable provider identifier
   * @returns {string}
   */
  getId() {
    throw new Error('IEmbeddingProvider.getId() must be implemented.');
  }

  /**
   * Human-readable provider label in Hindi
   * @returns {string}
   */
  getName() {
    throw new Error('IEmbeddingProvider.getName() must be implemented.');
  }

  /**
   * Model version / identifier string for schema consistency & cache invalidation
   * @returns {string}
   */
  getModelVersion() {
    throw new Error('IEmbeddingProvider.getModelVersion() must be implemented.');
  }

  /**
   * Vector dimensions produced by this provider
   * @returns {number}
   */
  getDimensions() {
    throw new Error('IEmbeddingProvider.getDimensions() must be implemented.');
  }

  /**
   * Indicates whether this provider is currently available and ready to generate embeddings
   * @returns {boolean}
   */
  isAvailable() {
    throw new Error('IEmbeddingProvider.isAvailable() must be implemented.');
  }

  /**
   * Generates a normalized numerical embedding vector for arbitrary text.
   *
   * @param {string} text
   * @returns {Promise<Array<number>>}
   */
  async embed(text) {
    throw new Error('IEmbeddingProvider.embed() must be implemented.');
  }

  /**
   * Prepares and embeds a poem entity into a normalized vector.
   *
   * @param {Object} poem Poem record
   * @returns {Promise<Array<number>>}
   */
  async embedPoem(poem) {
    const semanticText = preparePoemSemanticText(poem);
    return this.embed(semanticText);
  }

  /**
   * Prepares and embeds a search query string into a normalized vector.
   *
   * @param {string} queryText User search query
   * @returns {Promise<Array<number>>}
   */
  async embedQuery(queryText) {
    const semanticText = prepareQuerySemanticText(queryText);
    return this.embed(semanticText);
  }
}
