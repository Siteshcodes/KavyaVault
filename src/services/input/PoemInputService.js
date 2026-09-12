/**
 * काव्यकलश (KavyaVault) — Modern Input Foundation (PoemInputService.js)
 * Phase 3 / Task 3.1: Centralized domain service for poem-input sources.
 *
 * Enforces the architectural flow:
 *   Input Source (Type | Scan | Speak)
 *       ↓
 *   Input Intent
 *       ↓
 *   Poem Draft
 *       ↓
 *   Existing Poem Editor
 *       ↓
 *   Save Poem
 */

import { poemRepository } from '../PoemRepository.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

/**
 * Controlled input source enum constants
 */
export const INPUT_SOURCES = Object.freeze({
  TYPE: 'type',
  SCAN: 'scan',
  SPEAK: 'speak'
});

export const VALID_INPUT_SOURCES = Object.freeze([
  INPUT_SOURCES.TYPE,
  INPUT_SOURCES.SCAN,
  INPUT_SOURCES.SPEAK
]);

/**
 * Validates an Input Intent object
 * @param {Object} intent
 * @throws {StorageError} If intent is invalid
 */
export function validateInputIntent(intent) {
  if (!intent || typeof intent !== 'object') {
    throw new StorageError(
      'इनपुट इंटेंट (Input Intent) ऑब्जेक्ट होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 1. Source validation
  if (!intent.source || typeof intent.source !== 'string') {
    throw new StorageError(
      'इनपुट माध्यम (source) आवश्यक है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  if (!VALID_INPUT_SOURCES.includes(intent.source)) {
    throw new StorageError(
      `अमान्य इनपुट माध्यम "${intent.source}"। मान्य माध्यम: ${VALID_INPUT_SOURCES.join(', ')}`,
      StorageErrorCode.VALIDATION_ERROR,
      null,
      { source: intent.source, allowed: VALID_INPUT_SOURCES }
    );
  }

  // 2. Title validation (optional string)
  if (intent.title !== undefined && intent.title !== null) {
    if (typeof intent.title !== 'string') {
      throw new StorageError(
        'कविता का शीर्षक (title) स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  // 3. Text / Body validation (optional string)
  const textVal = intent.text !== undefined ? intent.text : intent.body;
  if (textVal !== undefined && textVal !== null) {
    if (typeof textVal !== 'string') {
      throw new StorageError(
        'कविता का पाठ (text/body) स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  // 4. Author validation (optional string)
  if (intent.author !== undefined && intent.author !== null) {
    if (typeof intent.author !== 'string') {
      throw new StorageError(
        'रचनाकार (author) स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  // 5. Tags validation (optional array)
  if (intent.tags !== undefined && intent.tags !== null) {
    if (!Array.isArray(intent.tags)) {
      throw new StorageError(
        'टैग (tags) एक ऐरे होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  // 6. Manuscript ID validation (optional string, especially relevant for Scan)
  if (intent.manuscriptId !== undefined && intent.manuscriptId !== null) {
    if (typeof intent.manuscriptId !== 'string' || intent.manuscriptId.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (manuscriptId) गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  // 7. Metadata validation (optional object)
  if (intent.metadata !== undefined && intent.metadata !== null) {
    if (typeof intent.metadata !== 'object' || Array.isArray(intent.metadata)) {
      throw new StorageError(
        'इनपुट मेटाडेटा (metadata) ऑब्जेक्ट होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }
}

/**
 * Creates a poem draft from an Input Intent and persists it via PoemRepository.
 * The draft is picked up by PoetryEditor when opened, remaining fully editable before save.
 *
 * @param {Object} intent Input Intent { source, title, text/body, author, tags, manuscriptId, metadata }
 * @param {import('../PoemRepository.js').PoemRepository} [repo=null]
 * @returns {Object} Persisted draft object
 */
export function createPoemDraft(intent, repo = null) {
  validateInputIntent(intent);
  const activeRepo = repo || poemRepository;

  const textContent = intent.text !== undefined ? intent.text : (intent.body || '');

  const draftData = {
    poemId: null, // New poem draft (never overwrites existing poem ID)
    title: typeof intent.title === 'string' ? intent.title.trim() : '',
    body: typeof textContent === 'string' ? textContent : '',
    author: typeof intent.author === 'string' ? intent.author.trim() : '',
    tags: Array.isArray(intent.tags) ? intent.tags : [],
    source: intent.source,
    manuscriptId: intent.manuscriptId || null,
    inputMetadata: intent.metadata || null
  };

  return activeRepo.saveDraft(draftData);
}

/**
 * Creates a draft for the Type input source
 * @param {Object} [data={}]
 * @param {import('../PoemRepository.js').PoemRepository} [repo=null]
 * @returns {Object} Persisted draft
 */
export function createTypeDraft(data = {}, repo = null) {
  return createPoemDraft({
    ...data,
    source: INPUT_SOURCES.TYPE
  }, repo);
}

/**
 * Creates a draft for the Scan input contract (Phase 2 manuscript integration)
 *
 * Contract:
 * - manuscriptId (string, required): reference to preserved manuscript
 * - text (string, optional): extracted or transcribed text
 * - title (string, optional): poem title
 * - metadata (object, optional): archival provenance context
 *
 * Guarantees:
 * - Never copies raw manuscript image bytes into poem storage.
 * - Never creates a final poem record without user review.
 *
 * @param {Object} data { manuscriptId, text, title, author, metadata }
 * @param {import('../PoemRepository.js').PoemRepository} [repo=null]
 * @param {import('../ManuscriptRepository.js').ManuscriptRepository} [manuscriptRepo=null]
 * @returns {Object} Persisted draft
 */
export function createScanDraft(data = {}, repo = null, manuscriptRepo = null) {
  if (!data || typeof data !== 'object') {
    throw new StorageError(
      'स्कैन डेटा ऑब्जेक्ट होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  if (!data.manuscriptId || typeof data.manuscriptId !== 'string' || data.manuscriptId.trim() === '') {
    throw new StorageError(
      'स्कैन इनपुट अनुबंध हेतु पांडुलिपि आईडी (manuscriptId) अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  let finalTitle = data.title;
  let finalText = data.text !== undefined ? data.text : data.transcriptionText;
  let metadata = data.metadata ? { ...data.metadata } : {};

  // If manuscript repository is provided, optionally resolve manuscript context
  if (manuscriptRepo && typeof manuscriptRepo.getById === 'function') {
    const ms = manuscriptRepo.getById(data.manuscriptId);
    if (!ms) {
      throw new StorageError(
        `आईडी "${data.manuscriptId}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { manuscriptId: data.manuscriptId }
      );
    }

    if (!finalTitle && ms.title) {
      finalTitle = ms.title;
    }

    if (finalText === undefined && ms.transcription && ms.transcription.text) {
      finalText = ms.transcription.text;
    }

    metadata = {
      ...metadata,
      manuscriptTitle: ms.title || null,
      manuscriptCapturedAt: ms.originalManuscript?.capturedAt || null,
      provenanceSource: ms.provenance?.source || null
    };
  }

  return createPoemDraft({
    source: INPUT_SOURCES.SCAN,
    manuscriptId: data.manuscriptId.trim(),
    title: finalTitle || '',
    text: finalText || '',
    author: data.author || '',
    tags: data.tags || [],
    metadata
  }, repo);
}

/**
 * Creates a draft for the Speak (voice) input contract
 *
 * Contract:
 * - text (string, required): recognized speech transcription
 * - title (string, optional)
 * - metadata (object, optional): e.g. { language: 'hi-IN', confidence: 0.95 }
 *
 * Guarantees:
 * - Hands off recognized text into standard draft
 * - User always reviews and edits in PoetryEditor before saving
 *
 * @param {Object} data { text, title, author, metadata }
 * @param {import('../PoemRepository.js').PoemRepository} [repo=null]
 * @returns {Object} Persisted draft
 */
export function createSpeakDraft(data = {}, repo = null) {
  if (!data || typeof data !== 'object') {
    throw new StorageError(
      'वाणी इनपुट डेटा ऑब्जेक्ट होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  const text = data.text !== undefined ? data.text : data.body;
  if (typeof text !== 'string') {
    throw new StorageError(
      'वाणी इनपुट अनुबंध हेतु पाठ (text) स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  return createPoemDraft({
    source: INPUT_SOURCES.SPEAK,
    title: data.title || '',
    text,
    author: data.author || '',
    tags: data.tags || [],
    metadata: data.metadata || { language: 'hi-IN' }
  }, repo);
}

/**
 * Translates input source identifier to dignified Hindi label
 * @param {string} source
 * @returns {string}
 */
export function formatInputSourceLabel(source) {
  switch (source) {
    case INPUT_SOURCES.TYPE:
      return 'टाइप (लेखन)';
    case INPUT_SOURCES.SCAN:
      return 'स्कैन (पांडुलिपि)';
    case INPUT_SOURCES.SPEAK:
      return 'ध्वनि (वाणी)';
    default:
      return source || 'सामान्य';
  }
}
