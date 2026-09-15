/**
 * काव्यकलश (KavyaVault) — AI Analysis Provider Interface (IAIAnalysisProvider.js)
 * Phase 4 / Task 4.1: AI Analysis Foundation
 *
 * Abstract provider interface defining the contract that any AI provider adapter
 * (Mock, local, or future real LLM adapters) must implement.
 *
 * Guarantees:
 * - Provider-agnostic design
 * - Never tied to a specific vendor
 * - Strictly takes bounded poem input and returns suggested metadata
 */

export class IAIAnalysisProvider {
  /**
   * Unique identifier of the provider (e.g. 'mock', 'local-llm', etc.)
   * @returns {string}
   */
  getId() {
    throw new Error('IAIAnalysisProvider.getId() must be implemented by subclass');
  }

  /**
   * Human-readable name of the provider
   * @returns {string}
   */
  getName() {
    throw new Error('IAIAnalysisProvider.getName() must be implemented by subclass');
  }

  /**
   * Specific model version identifier
   * @returns {string}
   */
  getModel() {
    throw new Error('IAIAnalysisProvider.getModel() must be implemented by subclass');
  }

  /**
   * Analyzes poem text and suggests metadata.
   *
   * @param {Object} input
   * @param {string} input.poemId - Identifier of the saved poem
   * @param {string} input.title - Title of the poem
   * @param {string} input.body - Text content of the poem
   * @param {string} [input.author] - Optional author name
   * @param {Array<string>} [input.tags] - Optional existing tags
   * @returns {Promise<{
   *   result: {
   *     category: string,
   *     mood: string,
   *     themes: Array<string>,
   *     keywords: Array<string>,
   *     summary: string
   *   },
   *   rawResponseMetadata?: Object
   * }>}
   */
  async analyzePoem(input) { // eslint-disable-line no-unused-vars
    throw new Error('IAIAnalysisProvider.analyzePoem() must be implemented by subclass');
  }
}
