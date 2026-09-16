/**
 * काव्यकलश (KavyaVault) — Local Embedding Provider (LocalEmbeddingProvider.js)
 * Phase 5 / Task 5.2: Local Semantic Representation
 *
 * Implements IEmbeddingProvider for local on-device embedding generation.
 *
 * ARCHITECTURAL INTEGRITY GUARANTEE:
 * In accordance with Phase 5 / Task 5.2 tenets, heavy ML runtimes (>50MB Transformers/ONNX bundles)
 * and runtime weight downloads from external CDN servers are strictly prohibited.
 * This provider truthfully declares `isAvailable() = false` until an authorized local WASM/model
 * engine is explicitly provisioned.
 *
 * Zero fake semantic representations are returned to the user or search engine.
 */

import { IEmbeddingProvider } from './IEmbeddingProvider.js';
import { StorageError, StorageErrorCode } from '../../storage/StorageError.js';

export class LocalEmbeddingProvider extends IEmbeddingProvider {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.modelVersion='kavya-local-v1']
   * @param {number} [options.dimensions=384]
   */
  constructor(options = {}) {
    super();
    this.modelVersion = options.modelVersion || 'kavya-local-v1';
    this.dimensions = options.dimensions || 384;
  }

  getId() {
    return 'kavyavault-local-embedding';
  }

  getName() {
    return 'काव्यकलश स्थानीय सिमेंटिक मॉडल (Local Model)';
  }

  getModelVersion() {
    return this.modelVersion;
  }

  getDimensions() {
    return this.dimensions;
  }

  /**
   * Truthfully reports availability.
   * Currently false: external downloads are prohibited, heavy ML stacks are not bundled.
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }

  /**
   * Refuses execution when unavailable, returning dignified Hindi error.
   *
   * @param {string} text
   * @throws {StorageError}
   */
  async embed(text) {
    throw new StorageError(
      'स्थानीय सिमेंटिक एम्बेडिंग मॉडल वर्तमान में सक्रिय नहीं है। किसी बाह्य API या अज्ञात डाउनलोड की अनुमति नहीं है।',
      StorageErrorCode.STORAGE_UNAVAILABLE
    );
  }
}
