/**
 * काव्यकलश (KavyaVault) — Semantic Search Provider (SemanticSearchProvider.js)
 * Phase 5 / Task 5.3: Local Vector Index + Semantic Retrieval Foundation
 *
 * Concrete search strategy implementing exact cosine-similarity semantic retrieval.
 *
 * ARCHITECTURAL CONSTRAINTS:
 * 1. TRUTHFUL CONTRACT: If local embedding provider is unavailable, returns SEARCH_STATUS.UNSUPPORTED.
 * 2. DETERMINISTIC EXACT RETRIEVAL: Uses brute-force cosine similarity over stored vectors.
 * 3. STABLE TIE-BREAKING: score DESC -> updatedAt DESC -> poemId ASC.
 * 4. RESULT NORMALIZATION: Common SearchResult envelope with source: 'semantic'.
 */

import { ISearchProvider } from './ISearchProvider.js';
import { SEARCH_MODE, SEARCH_STATUS, createSearchQuery, createSearchResult } from './searchTypes.js';
import { LocalEmbeddingProvider } from './semantic/LocalEmbeddingProvider.js';
import { IndexedDBVectorStore } from './vector/IndexedDBVectorStore.js';
import { prepareQuerySemanticText } from './semantic/semanticPreparation.js';
import { cosineSimilarity } from './semantic/vectorMath.js';
import { poemRepository } from '../PoemRepository.js';

const DEFAULT_TOP_K = 20;
const MAX_TOP_K = 100;

export class SemanticSearchProvider extends ISearchProvider {
  /**
   * @param {Object} [options={}]
   * @param {IEmbeddingProvider} [options.embeddingProvider]
   * @param {IVectorStore} [options.vectorStore]
   * @param {PoemRepository} [options.poemRepo]
   */
  constructor(options = {}) {
    super();
    this.embeddingProvider = options.embeddingProvider || new LocalEmbeddingProvider();
    this.vectorStore = options.vectorStore || new IndexedDBVectorStore();
    this.poemRepo = options.poemRepo || poemRepository;
  }

  getMode() {
    return SEARCH_MODE.SEMANTIC;
  }

  getName() {
    return 'काव्यकलश सिमेंटिक वेक्टर खोज (Semantic Search)';
  }

  /**
   * Returns true only if a verified, authorized embedding provider is operational.
   * Under Task 5.3 baseline, LocalEmbeddingProvider returns false.
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(this.embeddingProvider && this.embeddingProvider.isAvailable());
  }

  /**
   * Executes semantic retrieval using exact cosine similarity over vector store.
   *
   * @param {Object|string} queryInput
   * @param {Object} [options={}]
   * @param {number} [options.topK=20] Max results to return (bounded to 100)
   * @param {number} [options.limit=20] Alias for topK
   * @param {number} [options.minScore] Optional minimum similarity threshold [-1, 1]
   * @param {Array<Object>} [options.poems] Explicit poem corpus override
   * @returns {Promise<{
   *   results: Array<Object>,
   *   query: string,
   *   mode: string,
   *   totalCount: number,
   *   status: string,
   *   message?: string
   * }>}
   */
  async search(queryInput, options = {}) {
    const query = typeof queryInput === 'string'
      ? createSearchQuery({ text: queryInput, mode: SEARCH_MODE.SEMANTIC })
      : createSearchQuery({ ...queryInput, mode: SEARCH_MODE.SEMANTIC });

    // 1. Availability check: return controlled unsupported status if provider unavailable
    if (!this.isAvailable()) {
      return {
        results: [],
        query: query.text,
        mode: SEARCH_MODE.SEMANTIC,
        totalCount: 0,
        status: SEARCH_STATUS.UNSUPPORTED,
        message: 'सिमेंटिक खोज (Semantic Search) वर्तमान संस्करण में सक्रिय नहीं है। यह सुविधा भावी चरण हेतु आरक्षित है।'
      };
    }

    const cleanQueryText = prepareQuerySemanticText(query.text);
    if (!cleanQueryText) {
      return {
        results: [],
        query: query.text,
        mode: SEARCH_MODE.SEMANTIC,
        totalCount: 0,
        status: SEARCH_STATUS.EMPTY
      };
    }

    try {
      // 2. Generate query embedding vector
      const queryVector = await this.embeddingProvider.embed(cleanQueryText);
      const model = this.embeddingProvider.getModelVersion();

      // 3. Retrieve stored vectors for the active model version
      const storedVectors = await this.vectorStore.findByModel(model);
      if (!storedVectors || storedVectors.length === 0) {
        return {
          results: [],
          query: query.text,
          mode: SEARCH_MODE.SEMANTIC,
          totalCount: 0,
          status: SEARCH_STATUS.EMPTY
        };
      }

      // 4. Resolve candidate poems map for metadata enrichment
      let poemsMap = new Map();
      if (Array.isArray(options.poems)) {
        options.poems.forEach(p => p && p.id && poemsMap.set(String(p.id), p));
      } else if (this.poemRepo && typeof this.poemRepo.getAll === 'function') {
        try {
          const allPoems = this.poemRepo.getAll({ includeArchived: true });
          allPoems.forEach(p => p && p.id && poemsMap.set(String(p.id), p));
        } catch (e) {
          // Safe fallback if repo empty or unavailable
        }
      }

      // 5. Compute cosine similarities
      const scoredCandidates = [];
      const minScoreThreshold = typeof options.minScore === 'number' ? options.minScore : null;

      for (const record of storedVectors) {
        if (!record.vector || record.vector.length !== queryVector.length) {
          continue;
        }

        const score = cosineSimilarity(queryVector, record.vector);

        // Apply optional minScore threshold
        if (minScoreThreshold !== null && score < minScoreThreshold) {
          continue;
        }

        const poem = poemsMap.get(record.poemId) || null;

        scoredCandidates.push({
          poemId: record.poemId,
          poem,
          score,
          updatedAt: poem && poem.updatedAt ? Date.parse(poem.updatedAt) : 0
        });
      }

      // 6. Deterministic tie-breaking:
      //    1. score DESC
      //    2. updatedAt DESC
      //    3. poemId ASC
      scoredCandidates.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (b.updatedAt !== a.updatedAt) {
          return b.updatedAt - a.updatedAt;
        }
        return a.poemId.localeCompare(b.poemId);
      });

      // 7. Bounded top-K
      const requestedK = typeof options.topK === 'number'
        ? options.topK
        : (typeof options.limit === 'number' ? options.limit : DEFAULT_TOP_K);
      const safeK = Math.max(1, Math.min(requestedK, MAX_TOP_K));
      const sliced = scoredCandidates.slice(0, safeK);

      // 8. Result normalization to SearchResult format
      const normalizedResults = sliced.map(c => {
        return createSearchResult({
          poemId: c.poemId,
          poem: c.poem,
          score: Math.round(c.score * 1000) / 1000,
          source: SEARCH_MODE.SEMANTIC,
          matchedFields: [],
          matchContext: 'भावार्थ समानता'
        });
      });

      return {
        results: normalizedResults,
        query: query.text,
        mode: SEARCH_MODE.SEMANTIC,
        totalCount: normalizedResults.length,
        status: normalizedResults.length > 0 ? SEARCH_STATUS.SUCCESS : SEARCH_STATUS.EMPTY
      };
    } catch (err) {
      return {
        results: [],
        query: query.text,
        mode: SEARCH_MODE.SEMANTIC,
        totalCount: 0,
        status: SEARCH_STATUS.ERROR,
        message: err.message || 'सिमेंटिक खोज के दौरान त्रुटि।'
      };
    }
  }
}
