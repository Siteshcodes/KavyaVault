/**
 * काव्यकलश (KavyaVault) — Semantic Indexing Service (SemanticIndexService.js)
 * Phase 5 / Task 5.3: Local Vector Index + Semantic Retrieval Foundation
 *
 * Orchestrates poem embedding generation, source-hash invalidation,
 * and vector persistence in IVectorStore.
 */

import { IVectorStore } from './IVectorStore.js';
import { IndexedDBVectorStore } from './IndexedDBVectorStore.js';
import { LocalEmbeddingProvider } from '../semantic/LocalEmbeddingProvider.js';
import {
  preparePoemSemanticText,
  computeSourceTextHash
} from '../semantic/semanticPreparation.js';
import { createPoemEmbedding } from '../semantic/semanticTypes.js';

export class SemanticIndexService {
  /**
   * @param {Object} [options={}]
   * @param {IVectorStore} [options.vectorStore]
   * @param {IEmbeddingProvider} [options.embeddingProvider]
   */
  constructor(options = {}) {
    this.vectorStore = options.vectorStore || new IndexedDBVectorStore();
    this.embeddingProvider = options.embeddingProvider || new LocalEmbeddingProvider();
    this._inFlightIndexing = new Set();
  }

  /**
   * Indicates if the indexing service is currently operational.
   * Requires both embedding provider and vector store to be available.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    const providerOk = Boolean(this.embeddingProvider && this.embeddingProvider.isAvailable());
    const storeOk = Boolean(this.vectorStore && (await this.vectorStore.isAvailable()));
    return providerOk && storeOk;
  }

  /**
   * Indexes a single poem.
   *
   * Lifecycle:
   * 1. Check provider availability. If unavailable, return status: 'unsupported'.
   * 2. Prepare semantic text & compute source hash.
   * 3. Check existing vector record. If source hash matches current model, skip regeneration.
   * 4. Concurrency lock on `${poemId}::${model}`.
   * 5. Generate embedding, validate vector, persist into vector store.
   *
   * @param {Object} poem Poem domain record
   * @returns {Promise<{
   *   status: 'indexed'|'skipped'|'unsupported'|'error',
   *   poemId?: string,
   *   model?: string,
   *   sourceTextHash?: string,
   *   reason?: string
   * }>}
   */
  async indexPoem(poem) {
    if (!poem || typeof poem !== 'object' || !poem.id) {
      return {
        status: 'error',
        reason: 'अमान्य कविता डेटा या पहचानकर्ता (ID) अनुपस्थित।'
      };
    }

    const poemId = String(poem.id).trim();

    if (!this.embeddingProvider || !this.embeddingProvider.isAvailable()) {
      return {
        status: 'unsupported',
        poemId,
        reason: 'सिमेंटिक एम्बेडिंग प्रदाता उपलब्ध नहीं है।'
      };
    }

    const model = this.embeddingProvider.getModelVersion();
    const lockKey = IVectorStore.buildKey(poemId, model);

    // Prevent concurrent duplicate indexing of the same poem
    if (this._inFlightIndexing.has(lockKey)) {
      return {
        status: 'skipped',
        poemId,
        model,
        reason: 'कविता अनुक्रमण पहले से प्रगति पर है।'
      };
    }

    this._inFlightIndexing.add(lockKey);

    try {
      const semanticText = preparePoemSemanticText(poem);
      const sourceTextHash = computeSourceTextHash(semanticText);

      // Check for existing vector with identical source text hash
      const existing = await this.vectorStore.get(lockKey);
      if (existing && existing.sourceTextHash === sourceTextHash) {
        return {
          status: 'skipped',
          poemId,
          model,
          sourceTextHash,
          reason: 'स्रोत पाठ अपरिवर्तित है।'
        };
      }

      // Generate embedding
      const vector = await this.embeddingProvider.embed(semanticText);
      const dimensions = this.embeddingProvider.getDimensions();

      const embeddingRecord = createPoemEmbedding({
        poemId,
        model,
        dimensions,
        vector,
        sourceTextHash
      });

      await this.vectorStore.put(embeddingRecord);

      return {
        status: 'indexed',
        poemId,
        model,
        sourceTextHash
      };
    } catch (err) {
      return {
        status: 'error',
        poemId,
        model,
        reason: err.message || 'अनुक्रमण के दौरान अप्रत्याशित त्रुटि।'
      };
    } finally {
      this._inFlightIndexing.delete(lockKey);
    }
  }

  /**
   * Indexes a collection of poems in a bounded, controlled batch.
   *
   * @param {Array<Object>} poems
   * @returns {Promise<{
   *   total: number,
   *   indexed: number,
   *   skipped: number,
   *   failed: number,
   *   details: Array<Object>
   * }>}
   */
  async indexPoems(poems) {
    if (!Array.isArray(poems)) {
      return { total: 0, indexed: 0, skipped: 0, failed: 0, details: [] };
    }

    const details = [];
    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const poem of poems) {
      const result = await this.indexPoem(poem);
      details.push(result);

      if (result.status === 'indexed') {
        indexed++;
      } else if (result.status === 'skipped') {
        skipped++;
      } else {
        failed++;
      }
    }

    return {
      total: poems.length,
      indexed,
      skipped,
      failed,
      details
    };
  }

  /**
   * Removes a poem's vector record without touching the poem itself.
   *
   * @param {string} poemId
   * @param {string} [model] If omitted, removes vector for all models
   * @returns {Promise<number>} Number of deleted vector records
   */
  async removePoem(poemId, model = null) {
    if (!poemId || typeof poemId !== 'string') return 0;

    const pid = poemId.trim();
    if (model) {
      const key = IVectorStore.buildKey(pid, model);
      const deleted = await this.vectorStore.delete(key);
      return deleted ? 1 : 0;
    }

    const records = await this.vectorStore.findByPoemId(pid);
    let count = 0;
    for (const rec of records) {
      const key = rec.id || IVectorStore.buildKey(rec.poemId, rec.model);
      const deleted = await this.vectorStore.delete(key);
      if (deleted) count++;
    }
    return count;
  }

  /**
   * Rebuilds the index for the given list of poems on explicit demand.
   *
   * @param {Array<Object>} poems
   * @returns {Promise<{
   *   total: number,
   *   indexed: number,
   *   skipped: number,
   *   failed: number
   * }>}
   */
  async rebuildIndex(poems) {
    if (!Array.isArray(poems)) {
      return { total: 0, indexed: 0, skipped: 0, failed: 0 };
    }

    const model = this.embeddingProvider ? this.embeddingProvider.getModelVersion() : null;
    if (model) {
      // Clear current model vectors
      const existing = await this.vectorStore.findByModel(model);
      for (const rec of existing) {
        await this.vectorStore.delete(rec.id);
      }
    }

    return this.indexPoems(poems);
  }
}
