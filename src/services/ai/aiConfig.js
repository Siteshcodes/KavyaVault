/**
 * काव्यकलश (KavyaVault) — AI Provider Configuration Abstraction (aiConfig.js)
 * Phase 4 / Task 4.4: AI Provider Integration + Privacy / Failure Hardening
 *
 * Provides a minimal, validated configuration abstraction for AI analysis providers.
 *
 * CRITICAL ARCHITECTURAL & PRIVACY CONSTRAINTS:
 * 1. ZERO SECRETS IN SOURCE: Never store API keys, tokens, or secret credentials.
 * 2. NO CLIENT-SIDE CREDENTIALS: In a client-side architecture, external AI calls
 *    requiring private credentials must route through a secure backend boundary/proxy.
 *    No secret API keys may be bundled in client assets or client environment variables.
 * 3. BOUNDED TIMEOUTS: Safe minimum (1s) and maximum (60s) bounds for all requests.
 */

import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

export const AI_CONFIG_BOUNDS = Object.freeze({
  MIN_TIMEOUT_MS: 1000,        // 1 second
  MAX_TIMEOUT_MS: 60000,       // 60 seconds
  DEFAULT_TIMEOUT_MS: 10000    // 10 seconds
});

/**
 * Validates an AI provider configuration object.
 * Rejects invalid types, out-of-bounds timeouts, or missing required fields.
 *
 * @param {Object} config
 * @throws {StorageError} if configuration is invalid
 */
export function validateProviderConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new StorageError(
      'प्रदाता कॉन्फ़िगरेशन (Provider Config) एक मान्य ऑब्जेक्ट होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 1. id is required and must be non-empty string
  if (typeof config.id !== 'string' || config.id.trim() === '') {
    throw new StorageError(
      'प्रदाता आईडी (id) गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 2. name is required and must be non-empty string
  if (typeof config.name !== 'string' || config.name.trim() === '') {
    throw new StorageError(
      'प्रदाता नाम (name) गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 3. model is required and must be non-empty string
  if (typeof config.model !== 'string' || config.model.trim() === '') {
    throw new StorageError(
      'मॉडल पहचानकर्ता (model) गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 4. enabled must be a boolean
  if (typeof config.enabled !== 'boolean') {
    throw new StorageError(
      'प्रदाता सक्रिय स्थिति (enabled) बूलियन होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 5. timeoutMs must be a number within safe bounds [1000, 60000]
  if (typeof config.timeoutMs !== 'number' || !Number.isFinite(config.timeoutMs)) {
    throw new StorageError(
      'समय-सीमा (timeoutMs) एक मान्य संख्या होनी चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  if (
    config.timeoutMs < AI_CONFIG_BOUNDS.MIN_TIMEOUT_MS ||
    config.timeoutMs > AI_CONFIG_BOUNDS.MAX_TIMEOUT_MS
  ) {
    throw new StorageError(
      `समय-सीमा ${AI_CONFIG_BOUNDS.MIN_TIMEOUT_MS}ms से ${AI_CONFIG_BOUNDS.MAX_TIMEOUT_MS}ms के मध्य होनी चाहिए।`,
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 6. endpoint is optional string; but if provided it must be non-empty
  if (config.endpoint !== undefined && config.endpoint !== null) {
    if (typeof config.endpoint !== 'string' || config.endpoint.trim() === '') {
      throw new StorageError(
        'एंडपॉइंट (endpoint) एक गैर-रिक्त स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  // 7. Security audit: Prohibit secret keys or passwords in configuration
  const secretKeywords = ['apikey', 'api_key', 'secret', 'password', 'token', 'authkey'];
  for (const key of Object.keys(config)) {
    if (secretKeywords.includes(key.toLowerCase())) {
      throw new StorageError(
        'क्लाइंट कॉन्फ़िगरेशन में संवेदनशील क्रेडेंशियल (Secrets/API Keys) रखना वर्जित है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }
}

/**
 * Creates a normalized and validated provider configuration.
 *
 * @param {Object} options
 * @param {string} options.id
 * @param {string} options.name
 * @param {string} options.model
 * @param {string} [options.endpoint]
 * @param {number} [options.timeoutMs=10000]
 * @param {boolean} [options.enabled=true]
 * @returns {Readonly<{
 *   id: string,
 *   name: string,
 *   model: string,
 *   endpoint?: string,
 *   timeoutMs: number,
 *   enabled: boolean
 * }>}
 */
export function createProviderConfig(options = {}) {
  const config = {
    id: typeof options.id === 'string' ? options.id.trim().toLowerCase() : '',
    name: typeof options.name === 'string' ? options.name.trim() : '',
    model: typeof options.model === 'string' ? options.model.trim() : '',
    endpoint: typeof options.endpoint === 'string' && options.endpoint.trim() ? options.endpoint.trim() : undefined,
    timeoutMs: typeof options.timeoutMs === 'number' ? options.timeoutMs : AI_CONFIG_BOUNDS.DEFAULT_TIMEOUT_MS,
    enabled: typeof options.enabled === 'boolean' ? options.enabled : true
  };

  validateProviderConfig(config);
  return Object.freeze(config);
}

/**
 * Default configuration for deterministic local mock provider
 */
export const DEFAULT_MOCK_CONFIG = Object.freeze(
  createProviderConfig({
    id: 'mock',
    name: 'KavyaVault Local Mock AI Analyzer',
    model: 'kavyavault-mock-analyzer-v1',
    timeoutMs: 5000,
    enabled: true
  })
);

/**
 * Default configuration placeholder for future external provider adapter.
 * Kept disabled and unconfigured by default to prevent unintended external calls.
 */
export const DEFAULT_EXTERNAL_CONFIG = Object.freeze(
  createProviderConfig({
    id: 'external',
    name: 'KavyaVault External AI Gateway',
    model: 'neutral-metadata-analyzer-v1',
    endpoint: undefined,
    timeoutMs: AI_CONFIG_BOUNDS.DEFAULT_TIMEOUT_MS,
    enabled: false
  })
);
