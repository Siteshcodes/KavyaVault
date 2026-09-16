/**
 * काव्यकलश (KavyaVault) — Semantic Domain Models & Validation (semanticTypes.js)
 * Phase 5 / Task 5.2: Local Semantic Representation
 *
 * Defines domain models and validators for local poem embeddings and vector representations.
 */

import { StorageError, StorageErrorCode } from '../../storage/StorageError.js';

/**
 * Validates an embedding vector.
 * An embedding vector must be a non-empty array or typed array of finite numbers.
 *
 * @param {Array<number>|Float32Array|Float64Array} vector
 * @param {number} [expectedDimensions] Optional expected dimension count
 * @throws {StorageError} if vector is malformed, has invalid dimensions, NaN, or Infinity
 */
export function validateEmbeddingVector(vector, expectedDimensions = null) {
  if (!vector || (!Array.isArray(vector) && !ArrayBuffer.isView(vector))) {
    throw new StorageError(
      'एम्बेडिंग वेक्टर (embedding vector) एक संख्यात्मक ऐरे होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  const length = vector.length;
  if (length === 0) {
    throw new StorageError(
      'एम्बेडिंग वेक्टर रिक्त (empty) नहीं हो सकता।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  if (expectedDimensions !== null && expectedDimensions !== undefined) {
    if (typeof expectedDimensions !== 'number' || expectedDimensions <= 0) {
      throw new StorageError(
        'अपेक्षित आयाम (dimensions) एक धनात्मक संख्या होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    if (length !== expectedDimensions) {
      throw new StorageError(
        `वेक्टर आयाम असंगत हैं: अपेक्षित ${expectedDimensions}, प्राप्त ${length}।`,
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  for (let i = 0; i < length; i++) {
    const val = vector[i];
    if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
      throw new StorageError(
        `वेक्टर सूचकांक ${i} पर अमान्य मान (${val}) पाया गया। केवल सीमित वास्तविक संख्याएँ मान्य हैं।`,
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }
}

/**
 * Creates and validates a normalized PoemEmbedding record.
 *
 * @param {Object} data
 * @param {string} data.poemId Identifier of the poem
 * @param {string} data.model Model identifier/version string
 * @param {number} data.dimensions Vector dimension count
 * @param {Array<number>|Float32Array|Float64Array} data.vector Embedding numerical vector
 * @param {string} data.sourceTextHash Deterministic hash of source text
 * @param {string} [data.createdAt] ISO timestamp
 * @returns {Readonly<{
 *   poemId: string,
 *   model: string,
 *   dimensions: number,
 *   vector: ReadonlyArray<number>,
 *   sourceTextHash: string,
 *   createdAt: string
 * }>}
 */
export function createPoemEmbedding(data) {
  if (!data || typeof data !== 'object') {
    throw new StorageError(
      'कविता एम्बेडिंग डेटा एक मान्य ऑब्जेक्ट होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  const { poemId, model, dimensions, vector, sourceTextHash, createdAt } = data;

  if (typeof poemId !== 'string' || poemId.trim() === '') {
    throw new StorageError(
      'कविता पहचानकर्ता (poemId) गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  if (typeof model !== 'string' || model.trim() === '') {
    throw new StorageError(
      'मॉडल संस्करण (model) स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  if (typeof dimensions !== 'number' || dimensions <= 0 || !Number.isInteger(dimensions)) {
    throw new StorageError(
      'वेक्टर आयाम (dimensions) एक धनात्मक पूर्णांक होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  if (typeof sourceTextHash !== 'string' || sourceTextHash.trim() === '') {
    throw new StorageError(
      'स्रोत पाठ हैश (sourceTextHash) गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  validateEmbeddingVector(vector, dimensions);

  // Deep clone and freeze vector values
  const frozenVector = Object.freeze(Array.from(vector));

  return Object.freeze({
    poemId: poemId.trim(),
    model: model.trim(),
    dimensions,
    vector: frozenVector,
    sourceTextHash: sourceTextHash.trim(),
    createdAt: (createdAt && typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)))
      ? createdAt
      : new Date().toISOString()
  });
}
