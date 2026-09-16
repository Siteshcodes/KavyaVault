/**
 * काव्यकलश (KavyaVault) — Test Embedding Provider (TestEmbeddingProvider.js)
 * Phase 5 / Task 5.2: Local Semantic Representation
 *
 * Deterministic embedding provider strictly for automated test suites.
 *
 * EXPLICIT ARCHITECTURAL DISCLAIMER:
 * This provider generates deterministic numerical test vectors using mathematical hashing.
 * It is used EXCLUSIVELY in test suites to verify vector math, normalization, symmetry,
 * and pipeline contracts.
 * It does NOT claim semantic or literary natural-language understanding.
 */

import { IEmbeddingProvider } from './IEmbeddingProvider.js';
import { normalizeVector } from './vectorMath.js';
import { normalizeSemanticText } from './semanticPreparation.js';

export class TestEmbeddingProvider extends IEmbeddingProvider {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.dimensions=16]
   * @param {string} [options.modelVersion='kavya-test-v1']
   */
  constructor(options = {}) {
    super();
    this.dimensions = options.dimensions || 16;
    this.modelVersion = options.modelVersion || 'kavya-test-v1';
  }

  getId() {
    return 'test-deterministic-embedding';
  }

  getName() {
    return 'परीक्षण एम्बेडिंग प्रदाता (Test Provider Only)';
  }

  getModelVersion() {
    return this.modelVersion;
  }

  getDimensions() {
    return this.dimensions;
  }

  isAvailable() {
    return true;
  }

  /**
   * Generates a deterministic normalized unit vector for test verification.
   *
   * @param {string} text
   * @returns {Promise<Array<number>>}
   */
  async embed(text) {
    const norm = normalizeSemanticText(text);
    const vector = new Array(this.dimensions).fill(0);

    if (!norm) {
      return vector;
    }

    // Deterministic pseudo-frequency projection across dimensions
    for (let i = 0; i < norm.length; i++) {
      const charCode = norm.charCodeAt(i);
      const dimIndex = (charCode + i) % this.dimensions;
      vector[dimIndex] += (charCode % 17) + 1;
    }

    return normalizeVector(vector);
  }
}
