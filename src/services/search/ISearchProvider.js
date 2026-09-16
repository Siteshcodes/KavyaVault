/**
 * काव्यकलश (KavyaVault) — Search Provider Interface (ISearchProvider.js)
 * Phase 5 / Task 5.1: Intelligent Search Foundation
 *
 * Abstract strategy interface defining the contract that any search provider
 * (Exact/Text, Semantic Vector, or Hybrid) must implement.
 */

export class ISearchProvider {
  /**
   * Returns the strategy search mode identifier (e.g. 'text', 'semantic', 'hybrid')
   * @returns {string}
   */
  getMode() {
    throw new Error('ISearchProvider.getMode() must be implemented by subclass');
  }

  /**
   * Human-readable name of the search strategy
   * @returns {string}
   */
  getName() {
    throw new Error('ISearchProvider.getName() must be implemented by subclass');
  }

  /**
   * Returns true if the strategy is currently configured and available for execution
   * @returns {boolean}
   */
  isAvailable() {
    throw new Error('ISearchProvider.isAvailable() must be implemented by subclass');
  }

  /**
   * Executes search for a normalized SearchQuery against poem collection/repository.
   *
   * @param {Object} query Normalized SearchQuery object
   * @param {Object} [options={}]
   * @param {Array<Object>} [options.poems] Collection of poems to search over
   * @param {Object} [options.repository] Optional repository reference
   * @returns {Promise<{
   *   results: Array<import('./searchTypes.js').SearchResult>,
   *   query: string,
   *   totalCount: number,
   *   status: string,
   *   message?: string
   * }>}
   */
  async search(query, options = {}) { // eslint-disable-line no-unused-vars
    throw new Error('ISearchProvider.search() must be implemented by subclass');
  }
}
