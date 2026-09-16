/**
 * काव्यकलश (KavyaVault) — Semantic Search Provider (SemanticSearchProvider.js)
 * Phase 5 / Tasks 5.1 & 5.2: Intelligent Search Foundation & Local Semantic Representation
 *
 * Future-ready contract placeholder for semantic vector search.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. TRUTHFUL CONTRACT: Reflects active embedding provider capability.
 * 2. ZERO FAKE RESULTS: Returns an explicit UNSUPPORTED status.
 * 3. ZERO UNVERIFIED VECTOR RETRIEVAL: Vector indexing/retrieval is deferred to Task 5.3.
 */

import { ISearchProvider } from './ISearchProvider.js';
import { SEARCH_MODE, SEARCH_STATUS, createSearchQuery } from './searchTypes.js';
import { LocalEmbeddingProvider } from './semantic/LocalEmbeddingProvider.js';

export class SemanticSearchProvider extends ISearchProvider {
  /**
   * @param {Object} [options={}]
   * @param {IEmbeddingProvider} [options.embeddingProvider]
   */
  constructor(options = {}) {
    super();
    this.embeddingProvider = options.embeddingProvider || new LocalEmbeddingProvider();
  }

  getMode() {
    return SEARCH_MODE.SEMANTIC;
  }

  getName() {
    return 'काव्यकलश सिमेंटिक वेक्टर खोज (Semantic Search)';
  }

  /**
   * Returns true only if a verified, authorized embedding provider is operational.
   * Under Task 5.2 local-first baseline, LocalEmbeddingProvider returns false.
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(this.embeddingProvider && this.embeddingProvider.isAvailable());
  }

  /**
   * Returns explicit unsupported state without returning fabricated results.
   *
   * @param {Object|string} queryInput
   * @returns {Promise<{
   *   results: Array<Object>,
   *   query: string,
   *   totalCount: number,
   *   status: string,
   *   message: string
   * }>}
   */
  async search(queryInput) {
    const query = typeof queryInput === 'string'
      ? createSearchQuery({ text: queryInput, mode: SEARCH_MODE.SEMANTIC })
      : createSearchQuery({ ...queryInput, mode: SEARCH_MODE.SEMANTIC });

    return {
      results: [],
      query: query.text,
      totalCount: 0,
      status: SEARCH_STATUS.UNSUPPORTED,
      message: 'सिमेंटिक खोज (Semantic Search) वर्तमान संस्करण में सक्रिय नहीं है। यह सुविधा भावी चरण हेतु आरक्षित है।'
    };
  }
}
