/**
 * काव्यकलश (KavyaVault) — Semantic Search Provider Placeholder (SemanticSearchProvider.js)
 * Phase 5 / Task 5.1: Intelligent Search Foundation
 *
 * Future-ready contract placeholder for semantic vector search.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. TRUTHFUL CONTRACT: This provider is NOT yet operational in Task 5.1.
 * 2. ZERO FAKE RESULTS: Returns an explicit UNSUPPORTED status.
 * 3. ZERO VECTOR LIBRARIES: Does not bundle or load unneeded embedding models or vector databases.
 */

import { ISearchProvider } from './ISearchProvider.js';
import { SEARCH_MODE, SEARCH_STATUS, createSearchQuery } from './searchTypes.js';

export class SemanticSearchProvider extends ISearchProvider {
  getMode() {
    return SEARCH_MODE.SEMANTIC;
  }

  getName() {
    return 'KavyaVault Semantic Vector Search (Future)';
  }

  isAvailable() {
    return false;
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
