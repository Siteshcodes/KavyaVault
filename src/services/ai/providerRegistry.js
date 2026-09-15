/**
 * काव्यकलश (KavyaVault) — AI Analysis Provider Registry (providerRegistry.js)
 * Phase 4 / Task 4.1: AI Analysis Foundation
 *
 * Minimal registry for resolving AI providers without coupling UI components
 * to specific vendor implementations.
 */

import { MockAIAnalysisProvider } from './MockAIAnalysisProvider.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

const registry = new Map();

// Register default mock provider
registry.set('mock', new MockAIAnalysisProvider());

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
 * Lists all registered provider IDs
 * @returns {Array<string>}
 */
export function listAIAnalysisProviders() {
  return Array.from(registry.keys());
}
