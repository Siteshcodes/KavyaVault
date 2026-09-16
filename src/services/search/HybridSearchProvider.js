/**
 * काव्यकलश (KavyaVault) — Hybrid Search Provider (HybridSearchProvider.js)
 * Phase 5 / Task 5.4: Hybrid Search + Natural-Language Search UX
 *
 * Coordinates deterministic text search and semantic vector retrieval
 * using standard Reciprocal Rank Fusion (RRF k=60).
 *
 * Provides graceful degradation to text search when local semantic model is offline.
 */

import { ISearchProvider } from './ISearchProvider.js';
import {
  SEARCH_MODE,
  SEARCH_STATUS,
  createSearchQuery,
  createSearchResult
} from './searchTypes.js';
import { TextSearchProvider } from './TextSearchProvider.js';
import { SemanticSearchProvider } from './SemanticSearchProvider.js';

export const DEFAULT_RRF_K = 60;
const DEFAULT_TOP_K = 20;
const MAX_TOP_K = 100;

/**
 * Computes standard Reciprocal Rank Fusion (RRF) over two ranked result lists.
 *
 * Formula:
 *   RRF(d) = sum_i( 1 / (k + rank_i(d)) )
 *
 * Ranks are 1-based (1, 2, 3...).
 * Raw scores from different scoring spaces are never mixed directly.
 * Deduplicates results strictly by canonical poemId.
 *
 * @param {Array<Object>} textResults Results from TextSearchProvider
 * @param {Array<Object>} semanticResults Results from SemanticSearchProvider
 * @param {number} [k=60] Smoothing parameter k
 * @returns {Array<{
 *   poemId: string,
 *   poem: Object|null,
 *   fusedScore: number,
 *   textRank: number|null,
 *   semanticRank: number|null,
 *   bestRank: number,
 *   inBoth: boolean,
 *   matchedFields: Array<string>,
 *   textContext?: string,
 *   semanticContext?: string,
 *   updatedAt: number
 * }>}
 */
export function computeRRF(textResults = [], semanticResults = [], k = DEFAULT_RRF_K) {
  const map = new Map();

  // 1. Accumulate text ranks (1-based)
  if (Array.isArray(textResults)) {
    textResults.forEach((item, index) => {
      if (!item || !item.poemId) return;
      const pid = String(item.poemId);
      const rank = index + 1;
      const rrfContribution = 1 / (k + rank);

      const poem = item.poem || null;
      const updatedAt = poem && poem.updatedAt ? Date.parse(poem.updatedAt) : 0;
      const matchedFields = Array.isArray(item.matchedFields) ? [...item.matchedFields] : [];

      map.set(pid, {
        poemId: pid,
        poem,
        fusedScore: rrfContribution,
        textRank: rank,
        semanticRank: null,
        bestRank: rank,
        inBoth: false,
        matchedFields,
        textContext: item.matchContext || null,
        semanticContext: null,
        updatedAt
      });
    });
  }

  // 2. Accumulate semantic ranks (1-based)
  if (Array.isArray(semanticResults)) {
    semanticResults.forEach((item, index) => {
      if (!item || !item.poemId) return;
      const pid = String(item.poemId);
      const rank = index + 1;
      const rrfContribution = 1 / (k + rank);

      if (map.has(pid)) {
        // Appears in both lists: combine scores and metadata
        const existing = map.get(pid);
        existing.fusedScore += rrfContribution;
        existing.semanticRank = rank;
        existing.bestRank = Math.min(existing.bestRank, rank);
        existing.inBoth = true;
        existing.semanticContext = item.matchContext || 'भावार्थ समानता';
        if (!existing.poem && item.poem) {
          existing.poem = item.poem;
          existing.updatedAt = item.poem.updatedAt ? Date.parse(item.poem.updatedAt) : 0;
        }
      } else {
        // Appears only in semantic list
        const poem = item.poem || null;
        const updatedAt = poem && poem.updatedAt ? Date.parse(poem.updatedAt) : 0;

        map.set(pid, {
          poemId: pid,
          poem,
          fusedScore: rrfContribution,
          textRank: null,
          semanticRank: rank,
          bestRank: rank,
          inBoth: false,
          matchedFields: [],
          textContext: null,
          semanticContext: item.matchContext || 'भावार्थ समानता',
          updatedAt
        });
      }
    });
  }

  return Array.from(map.values());
}

export class HybridSearchProvider extends ISearchProvider {
  /**
   * @param {Object} [options={}]
   * @param {TextSearchProvider} [options.textProvider]
   * @param {SemanticSearchProvider} [options.semanticProvider]
   * @param {number} [options.rrfK=60]
   */
  constructor(options = {}) {
    super();
    this.textProvider = options.textProvider || new TextSearchProvider({ poemRepo: options.poemRepo });
    this.semanticProvider = options.semanticProvider || new SemanticSearchProvider({
      poemRepo: options.poemRepo,
      vectorStore: options.vectorStore,
      embeddingProvider: options.embeddingProvider
    });
    this.rrfK = typeof options.rrfK === 'number' && options.rrfK > 0 ? options.rrfK : DEFAULT_RRF_K;
  }

  getMode() {
    return SEARCH_MODE.HYBRID;
  }

  getName() {
    return 'काव्यकलश मिश्रित खोज (Hybrid Search)';
  }

  /**
   * Hybrid search is operational when both text and semantic providers are available.
   * Truthfully reports false when local embedding provider is offline.
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(
      this.textProvider && this.textProvider.isAvailable() &&
      this.semanticProvider && this.semanticProvider.isAvailable()
    );
  }

  /**
   * Checks if true two-sided hybrid retrieval is operational.
   * @returns {boolean}
   */
  isSemanticAvailable() {
    return Boolean(this.semanticProvider && this.semanticProvider.isAvailable());
  }

  /**
   * Executes hybrid search over query.
   *
   * @param {Object|string} queryInput
   * @param {Object} [options={}]
   * @param {number} [options.topK=20]
   * @param {number} [options.limit=20]
   * @param {boolean} [options.allowDegraded=true]
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
      ? createSearchQuery({ text: queryInput, mode: SEARCH_MODE.HYBRID })
      : createSearchQuery({ ...queryInput, mode: SEARCH_MODE.HYBRID });

    if (!query.text.trim()) {
      return {
        results: [],
        query: query.text,
        mode: SEARCH_MODE.HYBRID,
        totalCount: 0,
        status: SEARCH_STATUS.EMPTY
      };
    }

    // 1. Check if semantic provider is available
    const semanticOk = this.isSemanticAvailable();

    // 2. Semantic Unavailable Behavior:
    // If semantic provider is offline, hybrid search cannot run true RRF fusion.
    // When text matches exist, degrades gracefully to text retrieval (SEARCH_STATUS.DEGRADED).
    // When no text matches exist (or allowDegraded is false), returns SEARCH_STATUS.UNSUPPORTED.
    if (!semanticOk) {
      if (options.allowDegraded === false) {
        return {
          results: [],
          query: query.text,
          mode: SEARCH_MODE.HYBRID,
          totalCount: 0,
          status: SEARCH_STATUS.UNSUPPORTED,
          message: 'भावार्थ खोज (Semantic Search) वर्तमान में उपलब्ध नहीं है।'
        };
      }

      const textResponse = await this.textProvider.search(query, options);
      const textHits = textResponse.results || [];

      if (textHits.length === 0) {
        return {
          results: [],
          query: query.text,
          mode: SEARCH_MODE.HYBRID,
          totalCount: 0,
          status: SEARCH_STATUS.UNSUPPORTED,
          message: 'भावार्थ खोज उपलब्ध नहीं है; पाठ खोज से परिणाम नहीं मिले।'
        };
      }

      const degradedResults = textHits.map(r => {
        return createSearchResult({
          poemId: r.poemId,
          poem: r.poem,
          score: r.score,
          source: SEARCH_MODE.TEXT,
          matchedFields: r.matchedFields || [],
          matchContext: r.matchContext || 'शीर्षक / पाठ में मिला'
        });
      });

      return {
        results: degradedResults,
        query: query.text,
        mode: SEARCH_MODE.HYBRID,
        totalCount: degradedResults.length,
        status: SEARCH_STATUS.DEGRADED,
        message: 'भावार्थ खोज उपलब्ध नहीं है; केवल पाठ खोज के परिणाम प्रदर्शित किए गए हैं।'
      };
    }

    // 3. Full Two-Sided Hybrid Retrieval: execute text and semantic branches concurrently
    try {
      const [textRes, semanticRes] = await Promise.all([
        this.textProvider.search(query, options),
        this.semanticProvider.search(query, options)
      ]);

      const textHits = textRes.results || [];
      const semanticHits = semanticRes.results || [];

      if (textHits.length === 0 && semanticHits.length === 0) {
        return {
          results: [],
          query: query.text,
          mode: SEARCH_MODE.HYBRID,
          totalCount: 0,
          status: SEARCH_STATUS.EMPTY
        };
      }

      // 4. Reciprocal Rank Fusion (k=60)
      const fusedItems = computeRRF(textHits, semanticHits, this.rrfK);

      // 5. Deterministic tie-breaking:
      //    1. fusedScore DESC
      //    2. bestRank ASC (lowest rank number first)
      //    3. updatedAt DESC
      //    4. poemId ASC
      fusedItems.sort((a, b) => {
        if (Math.abs(b.fusedScore - a.fusedScore) > 1e-9) {
          return b.fusedScore - a.fusedScore;
        }
        if (a.bestRank !== b.bestRank) {
          return a.bestRank - b.bestRank;
        }
        if (a.updatedAt !== b.updatedAt) {
          return b.updatedAt - a.updatedAt;
        }
        return a.poemId.localeCompare(b.poemId);
      });

      // 6. Safe top-K bounds
      const requestedK = typeof options.topK === 'number'
        ? options.topK
        : (typeof options.limit === 'number' ? options.limit : DEFAULT_TOP_K);
      const safeK = Math.max(1, Math.min(requestedK, MAX_TOP_K));
      const sliced = fusedItems.slice(0, safeK);

      // 7. Result normalization to SearchResult schema
      const normalizedResults = sliced.map(item => {
        let matchContext = 'मिश्रित';
        if (item.inBoth) {
          matchContext = 'शब्द + भावार्थ';
        } else if (item.textContext) {
          matchContext = item.textContext;
        } else if (item.semanticContext) {
          matchContext = item.semanticContext;
        }

        return createSearchResult({
          poemId: item.poemId,
          poem: item.poem,
          score: Math.round(item.fusedScore * 10000) / 10000,
          source: SEARCH_MODE.HYBRID,
          matchedFields: item.matchedFields,
          matchContext
        });
      });

      return {
        results: normalizedResults,
        query: query.text,
        mode: SEARCH_MODE.HYBRID,
        totalCount: normalizedResults.length,
        status: normalizedResults.length > 0 ? SEARCH_STATUS.SUCCESS : SEARCH_STATUS.EMPTY
      };
    } catch (err) {
      return {
        results: [],
        query: query.text,
        mode: SEARCH_MODE.HYBRID,
        totalCount: 0,
        status: SEARCH_STATUS.ERROR,
        message: err.message || 'मिश्रित खोज के दौरान त्रुटि।'
      };
    }
  }
}
