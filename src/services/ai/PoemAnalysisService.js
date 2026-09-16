/**
 * काव्यकलश (KavyaVault) — Central AI Poetry Analysis Service (PoemAnalysisService.js)
 * Phase 4 / Task 4.4: AI Provider Integration + Privacy / Failure Hardening
 *
 * Coordinates poem organization and metadata analysis:
 * 1. Validates poem input and mandatory explicit user consent
 * 2. Deduplicates in-flight concurrent requests per poemId
 * 3. Invokes selected provider (Mock or registered external adapter)
 * 4. Validates and normalizes provider output against strict constraints
 * 5. Returns structured, controlled analysis envelope
 *
 * Strict Architectural Guarantees:
 * - ZERO storage writes (does not write to LocalStorage or repository)
 * - ZERO original poem mutation (title, body, author, provenance remain untouched)
 * - ZERO secrets in client bundles
 * - Rate / duplicate protection via in-flight request coalescing
 * - Safe error handling (never crashes UI on malformed output or provider failure)
 * - Safe logging (never logs poem body, headers, or keys)
 */

import {
  ANALYSIS_STATUS,
  validateAnalysisRequest,
  validateAndNormalizeAnalysisResult
} from './analysisTypes.js';
import { getAIAnalysisProvider } from './providerRegistry.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

export class PoemAnalysisService {
  /**
   * @param {Object} [options={}]
   * @param {import('./IAIAnalysisProvider.js').IAIAnalysisProvider} [options.provider=null] Optional direct provider injection
   */
  constructor(options = {}) {
    this.providerOverride = options.provider || null;
    this._inFlightRequests = new Map(); // poemId -> Promise
  }

  /**
   * Resolves active provider for analysis
   * @param {string} [providerId='mock']
   * @returns {import('./IAIAnalysisProvider.js').IAIAnalysisProvider}
   */
  _resolveProvider(providerId = 'mock') {
    if (this.providerOverride) {
      return this.providerOverride;
    }
    return getAIAnalysisProvider(providerId);
  }

  /**
   * Analyzes a poem and returns suggested metadata envelope.
   * Coalesces concurrent in-flight requests for the same poemId.
   *
   * @param {Object} request
   * @param {string} request.poemId - ID of the poem being analyzed
   * @param {string} request.title - Title of the poem
   * @param {string} request.body - Text of the poem
   * @param {boolean} request.analysisConsent - User explicit consent (must be true)
   * @param {string} [request.author] - Optional author
   * @param {Array<string>} [request.tags] - Optional tags
   * @param {string} [request.providerId='mock'] - Optional provider identifier
   * @returns {Promise<{
   *   poemId: string,
   *   requestedAt: string,
   *   provider: string,
   *   model: string,
   *   status: string,
   *   consentGranted: boolean,
   *   result: {
   *     category: string,
   *     mood: string,
   *     themes: Array<string>,
   *     keywords: Array<string>,
   *     summary: string
   *   } | null,
   *   rawResponseMetadata?: Object,
   *   error?: string
   * }>}
   */
  async analyzePoem(request) {
    const requestedAt = new Date().toISOString();

    // 1. Validate request envelope and explicit consent
    try {
      validateAnalysisRequest(request);
    } catch (err) {
      return {
        poemId: request && typeof request.poemId === 'string' ? request.poemId : 'unknown',
        requestedAt,
        provider: 'none',
        model: 'none',
        status: ANALYSIS_STATUS.FAILED,
        consentGranted: Boolean(request && request.analysisConsent === true),
        result: null,
        error: err.message || 'विश्लेषण अनुरोध सत्यापन में विफल रहा।'
      };
    }

    const poemId = request.poemId;

    // 2. In-flight request deduplication / coalescing
    if (this._inFlightRequests.has(poemId)) {
      return this._inFlightRequests.get(poemId);
    }

    const executionPromise = this._executeAnalysis(request, requestedAt);
    this._inFlightRequests.set(poemId, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this._inFlightRequests.delete(poemId);
    }
  }

  /**
   * Internal execution handler
   * @private
   */
  async _executeAnalysis(request, requestedAt) {
    let provider;
    try {
      provider = this._resolveProvider(request.providerId || 'mock');
    } catch (err) {
      return {
        poemId: request.poemId,
        requestedAt,
        provider: request.providerId || 'unknown',
        model: 'unknown',
        status: ANALYSIS_STATUS.FAILED,
        consentGranted: true,
        result: null,
        error: err.message || 'एआई प्रदाता लोड करने में विफल।'
      };
    }

    const providerId = provider.getId();
    const model = provider.getModel();

    // 3. Invoke provider adapter
    let rawResponse;
    try {
      rawResponse = await provider.analyzePoem({
        poemId: request.poemId,
        title: request.title,
        body: request.body,
        author: request.author,
        tags: request.tags
      });
    } catch (err) {
      return {
        poemId: request.poemId,
        requestedAt,
        provider: providerId,
        model,
        status: ANALYSIS_STATUS.FAILED,
        consentGranted: true,
        result: null,
        error: err.message || 'प्रदाता विश्लेषण निष्पादित करने में असमर्थ रहा।'
      };
    }

    // 4. Validate and normalize provider response
    try {
      if (!rawResponse || typeof rawResponse !== 'object' || !rawResponse.result) {
        throw new StorageError(
          'प्रदाता ने अमान्य या रिक्त परिणाम संरचना वापस की।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }

      const normalizedResult = validateAndNormalizeAnalysisResult(rawResponse.result);

      return {
        poemId: request.poemId,
        requestedAt,
        provider: providerId,
        model,
        status: ANALYSIS_STATUS.COMPLETED,
        consentGranted: true,
        result: normalizedResult,
        rawResponseMetadata: rawResponse.rawResponseMetadata || null
      };
    } catch (err) {
      return {
        poemId: request.poemId,
        requestedAt,
        provider: providerId,
        model,
        status: ANALYSIS_STATUS.FAILED,
        consentGranted: true,
        result: null,
        error: `विश्लेषण परिणाम सत्यापन त्रुटि: ${err.message}`
      };
    }
  }
}

export const poemAnalysisService = new PoemAnalysisService();
