/**
 * काव्यकलश (KavyaVault) — AI Analysis Provider Registry (providerRegistry.js)
 * Phase 4 / Task 4.4: AI Provider Integration + Privacy / Failure Hardening
 *
 * Minimal registry for resolving AI providers without coupling UI components
 * to specific vendor implementations.
 */

import { MockAIAnalysisProvider } from './MockAIAnalysisProvider.js';
import { ExternalAIAnalysisProvider } from './ExternalAIAnalysisProvider.js';
import { DEFAULT_EXTERNAL_CONFIG } from './aiConfig.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

const registry = new Map();

// Register default mock provider
registry.set('mock', new MockAIAnalysisProvider());

// Register unconfigured external provider (disabled by default)
registry.set('external', new ExternalAIAnalysisProvider(DEFAULT_EXTERNAL_CONFIG));

/**
 * Registers an AI analysis provider implementation
 * @param {string} id
 * @param {import('./IAIAnalysisProvider.js').IAIAnalysisProvider} provider
 */
export function registerAIAnalysisProvider(id, provider) {
  if (!id || typeof id !== 'string') {
    throw new StorageError(
      'प्रदाता आईडी (id) गैर-रिक्त स्ट्रिंग होनी चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  if (!provider || typeof provider.analyzePoem !== 'function') {
    throw new StorageError(
      'प्रदाता को IAIAnalysisProvider इंटरफ़ेस लागू करना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  registry.set(id.trim().toLowerCase(), provider);
}

/**
 * Resolves a registered provider by ID
 * @param {string} [id='mock']
 * @returns {import('./IAIAnalysisProvider.js').IAIAnalysisProvider}
 */
export function getAIAnalysisProvider(id = 'mock') {
  const normalizedId = (id || 'mock').trim().toLowerCase();
  const provider = registry.get(normalizedId);
  if (!provider) {
    throw new StorageError(
      `अज्ञात एआई विश्लेषण प्रदाता: "${id}"।`,
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  return provider;
}

/**
 * Returns safe public metadata for privacy disclosures
 * @param {string} [id='mock']
 * @returns {{ id: string, name: string, model: string, isLocal: boolean, isExternal: boolean, enabled: boolean }}
 */
export function getProviderMetadata(id = 'mock') {
  const provider = getAIAnalysisProvider(id);
  const providerId = provider.getId();
  const isMock = providerId === 'mock';
  const isEnabled = typeof provider.isEnabled === 'function' ? provider.isEnabled() : true;

  return {
    id: providerId,
    name: provider.getName(),
    model: provider.getModel(),
    isLocal: isMock,
    isExternal: !isMock,
    enabled: isEnabled
  };
}

/**
 * Lists all registered provider IDs
 * @returns {Array<string>}
 */
export function listAIAnalysisProviders() {
  return Array.from(registry.keys());
}

/**
 * Resets registry to default state (for testing)
 */
export function resetProviderRegistry() {
  registry.clear();
  registry.set('mock', new MockAIAnalysisProvider());
  registry.set('external', new ExternalAIAnalysisProvider(DEFAULT_EXTERNAL_CONFIG));
}
