/**
 * काव्यकलश (KavyaVault) — Hybrid Search Provider Placeholder (HybridSearchProvider.js)
 * Phase 5 / Task 5.1: Intelligent Search Foundation
 *
 * Future-ready contract placeholder for unified hybrid (text + semantic) search.
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. TRUTHFUL CONTRACT: This provider is NOT yet operational in Task 5.1.
 * 2. ZERO FAKE RESULTS: Returns an explicit UNSUPPORTED status.
 */

import { ISearchProvider } from './ISearchProvider.js';
import { SEARCH_MODE, SEARCH_STATUS, createSearchQuery } from './searchTypes.js';

export class HybridSearchProvider extends ISearchProvider {
  getMode() {
    return SEARCH_MODE.HYBRID;
  }

  getName() {
    return 'KavyaVault Hybrid Search (Future)';
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
      ? createSearchQuery({ text: queryInput, mode: SEARCH_MODE.HYBRID })
      : createSearchQuery({ ...queryInput, mode: SEARCH_MODE.HYBRID });

    return {
      results: [],
      query: query.text,
      totalCount: 0,
      status: SEARCH_STATUS.UNSUPPORTED,
      message: 'हाइब्रिड खोज (Hybrid Search) वर्तमान संस्करण में सक्रिय नहीं है। यह सुविधा भावी चरण हेतु आरक्षित है।'
    };
  }
}
