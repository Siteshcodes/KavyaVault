/**
 * काव्यकलश (KavyaVault) — Manuscript Repository (ManuscriptRepository.js)
 *
 * Phase 2 / Task 2.1: Manuscript Preservation Foundation
 *
 * Domain repository managing handwritten manuscript records.
 * Enforces the core preservation principle:
 *
 *   Original Manuscript → Digital Transcription
 *
 * The original manuscript image is an immutable primary archival artifact.
 * Once stored, it cannot be modified through normal metadata or transcription
 * updates. Only an explicit replaceOriginalManuscript() operation can replace
 * the original image data, enforcing deliberate intent.
 *
 * Decoupled from concrete storage drivers through IStorageAdapter.
 *
 * STORAGE LIMITATION: The current LocalStorageAdapter stores data as JSON
 * strings in browser localStorage, which has a typical ~5–10MB quota.
 * Base64-encoded manuscript images consume significant space. This foundation
 * is designed so that a future IndexedDB-backed adapter can be swapped in
 * through the IStorageAdapter interface without rewriting this domain layer.
 */

import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './storage/StorageError.js';
import { STORAGE_KEYS } from '../data/storageKeys.js';

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Deep clones any JSON-serializable object to guarantee repository immutability
 */
function deepClone(data) {
  if (data === null || data === undefined) return data;
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

/**
 * Generates a collision-resistant unique manuscript identifier
 */
function generateManuscriptId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_ms_${crypto.randomUUID()}`;
  }
  return `kv_ms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a unique artifact ID for the original manuscript image
 */
function generateArtifactId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_art_${crypto.randomUUID()}`;
  }
  return `kv_art_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Allowed MIME types for manuscript images
// ============================================================================

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp'
];

// ============================================================================
// Transcription status values
// ============================================================================

const VALID_TRANSCRIPTION_STATUSES = ['untranscribed', 'draft', 'verified'];

// ============================================================================
// Manuscript Repository
// ============================================================================

export class ManuscriptRepository {
  /**
   * @param {import('./storage/IStorageAdapter.js').IStorageAdapter} adapter
   */
  constructor(adapter = null) {
    this.adapter = adapter || new LocalStorageAdapter();
  }

  // --------------------------------------------------------------------------
  // Internal Storage Helpers
  // --------------------------------------------------------------------------

  /**
   * Internal helper: safely reads manuscripts array, recovering from corruption.
   * Non-destructive: does NOT overwrite raw storage on read.
   */
  _readManuscripts() {
    try {
      const data = this.adapter.get(STORAGE_KEYS.MANUSCRIPTS);
      if (data === null || data === undefined) {
        return [];
      }
      if (!Array.isArray(data)) {
        console.warn('[ManuscriptRepository] Stored manuscripts data was not an array. Returning empty collection safely.');
        return [];
      }
      return data;
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.DESERIALIZATION_ERROR) {
        console.error('[ManuscriptRepository] Corrupted manuscripts storage detected. Returning empty set safely.');
        return [];
      }
      throw err;
    }
  }

  /**
   * Internal helper: safely writes manuscripts array
   */
  _writeManuscripts(manuscripts) {
    this.adapter.set(STORAGE_KEYS.MANUSCRIPTS, deepClone(manuscripts));
  }

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------

  /**
   * Validates creation input for a new manuscript record
   */
  _validateCreateInput(data) {
    if (!data || typeof data !== 'object') {
      throw new StorageError(
        'पांडुलिपि का डेटा ऑब्जेक्ट होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Title validation
    if (data.title === undefined || typeof data.title !== 'string' || data.title.trim() === '') {
      throw new StorageError(
        'पांडुलिपि का शीर्षक (title) एक गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Original manuscript validation
    this._validateOriginalManuscript(data.originalManuscript);

    // Transcription validation (optional at creation, defaults applied later)
    if (data.transcription !== undefined) {
      this._validateTranscriptionInput(data.transcription);
    }

    // Provenance validation (optional at creation, defaults applied later)
    if (data.provenance !== undefined) {
      this._validateProvenanceInput(data.provenance);
    }

    // poemId validation
    if (data.poemId !== undefined && data.poemId !== null && typeof data.poemId !== 'string') {
      throw new StorageError(
        'कविता आईडी (poemId) स्ट्रिंग या null होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Validates the original manuscript artifact structure
   */
  _validateOriginalManuscript(original) {
    if (!original || typeof original !== 'object') {
      throw new StorageError(
        'मूल पांडुलिपि (originalManuscript) ऑब्जेक्ट अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // MIME type validation
    if (!original.mimeType || typeof original.mimeType !== 'string') {
      throw new StorageError(
        'मूल पांडुलिपि का MIME प्रकार (mimeType) आवश्यक है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(original.mimeType)) {
      throw new StorageError(
        `अमान्य MIME प्रकार "${original.mimeType}"। स्वीकृत प्रकार: ${ALLOWED_MIME_TYPES.join(', ')}`,
        StorageErrorCode.VALIDATION_ERROR,
        null,
        { mimeType: original.mimeType, allowed: ALLOWED_MIME_TYPES }
      );
    }

    // Image data validation
    if (!original.data || typeof original.data !== 'string' || original.data.trim() === '') {
      throw new StorageError(
        'मूल पांडुलिपि का छवि डेटा (data) एक गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Filename validation (optional but must be string if provided)
    if (original.filename !== undefined && original.filename !== null && typeof original.filename !== 'string') {
      throw new StorageError(
        'फ़ाइल नाम (filename) स्ट्रिंग या null होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // capturedAt validation (optional but must be valid ISO string if provided)
    if (original.capturedAt !== undefined && original.capturedAt !== null) {
      if (typeof original.capturedAt !== 'string' || isNaN(Date.parse(original.capturedAt))) {
        throw new StorageError(
          'मूल पांडुलिपि की कैप्चर तिथि (capturedAt) मान्य ISO प्रारूप में होनी चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
    }
  }

  /**
   * Validates transcription input structure
   */
  _validateTranscriptionInput(transcription) {
    if (typeof transcription !== 'object' || transcription === null) {
      throw new StorageError(
        'प्रतिलिपि (transcription) ऑब्जेक्ट होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (transcription.text !== undefined && typeof transcription.text !== 'string') {
      throw new StorageError(
        'प्रतिलिपि पाठ (text) स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (transcription.status !== undefined) {
      if (!VALID_TRANSCRIPTION_STATUSES.includes(transcription.status)) {
        throw new StorageError(
          `अमान्य प्रतिलिपि स्थिति "${transcription.status}"। स्वीकृत: ${VALID_TRANSCRIPTION_STATUSES.join(', ')}`,
          StorageErrorCode.VALIDATION_ERROR,
          null,
          { status: transcription.status, allowed: VALID_TRANSCRIPTION_STATUSES }
        );
      }
    }

    if (transcription.verifiedAt !== undefined && transcription.verifiedAt !== null) {
      if (typeof transcription.verifiedAt !== 'string' || isNaN(Date.parse(transcription.verifiedAt))) {
        throw new StorageError(
          'प्रतिलिपि सत्यापन तिथि (verifiedAt) मान्य ISO प्रारूप में होनी चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
    }
  }

  /**
   * Validates provenance input structure
   */
  _validateProvenanceInput(provenance) {
    if (typeof provenance !== 'object' || provenance === null) {
      throw new StorageError(
        'उद्गम (provenance) ऑब्जेक्ट होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (provenance.source !== undefined && typeof provenance.source !== 'string') {
      throw new StorageError(
        'उद्गम स्रोत (source) स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (provenance.recordedAt !== undefined && provenance.recordedAt !== null) {
      if (typeof provenance.recordedAt !== 'string' || isNaN(Date.parse(provenance.recordedAt))) {
        throw new StorageError(
          'उद्गम अभिलेखन तिथि (recordedAt) मान्य ISO प्रारूप में होनी चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
    }

    if (provenance.notes !== undefined && typeof provenance.notes !== 'string') {
      throw new StorageError(
        'उद्गम टिप्पणियाँ (notes) स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Validates metadata-only update input (must NOT contain originalManuscript)
   */
  _validateMetadataUpdateInput(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new StorageError(
        'संशोधन डेटा ऑब्जेक्ट होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // PROTECTION: metadata updates must NOT modify the original manuscript
    if (metadata.originalManuscript !== undefined) {
      throw new StorageError(
        'मूल पांडुलिपि (originalManuscript) को सामान्य मेटाडेटा अद्यतन से संशोधित नहीं किया जा सकता। कृपया replaceOriginalManuscript() का उपयोग करें।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (metadata.title !== undefined) {
      if (typeof metadata.title !== 'string' || metadata.title.trim() === '') {
        throw new StorageError(
          'शीर्षक (title) गैर-रिक्त स्ट्रिंग होना चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
    }

    if (metadata.poemId !== undefined && metadata.poemId !== null && typeof metadata.poemId !== 'string') {
      throw new StorageError(
        'कविता आईडी (poemId) स्ट्रिंग या null होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (metadata.provenance !== undefined) {
      this._validateProvenanceInput(metadata.provenance);
    }
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Retrieves all manuscript records, sorted by createdAt descending (newest first).
   * Filters out corrupted/invalid entries silently while preserving valid ones.
   * @returns {Array} Deep-cloned array of manuscript records
   */
  getAll() {
    const manuscripts = this._readManuscripts();
    const valid = manuscripts.filter(m => m && typeof m === 'object' && typeof m.id === 'string');

    valid.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return deepClone(valid);
  }

  /**
   * Retrieves a single manuscript record by unique ID.
   * @param {string} id
   * @returns {Object|null} Deep-cloned manuscript or null
   */
  getById(id) {
    if (!id || typeof id !== 'string') return null;
    const manuscripts = this._readManuscripts();
    const found = manuscripts.find(m => m && typeof m === 'object' && m.id === id);
    return found ? deepClone(found) : null;
  }

  /**
   * Creates and persists a new manuscript record.
   *
   * The originalManuscript artifact is stored as an immutable primary artifact.
   * The transcription defaults to { text: '', status: 'untranscribed', verifiedAt: null }.
   *
   * @param {Object} data
   * @param {string} data.title
   * @param {Object} data.originalManuscript
   * @param {string} data.originalManuscript.mimeType
   * @param {string} data.originalManuscript.data - Base64-encoded image data
   * @param {string} [data.originalManuscript.filename]
   * @param {string} [data.originalManuscript.capturedAt]
   * @param {string|null} [data.poemId=null]
   * @param {Object} [data.transcription]
   * @param {Object} [data.provenance]
   * @returns {Object} Created manuscript record (deep-cloned)
   */
  create(data) {
    this._validateCreateInput(data);

    const manuscripts = this._readManuscripts();
    const id = data.id && typeof data.id === 'string' && data.id.trim() !== ''
      ? data.id.trim()
      : generateManuscriptId();

    // Prevent duplicate ID insertion
    if (manuscripts.some(m => m && m.id === id)) {
      throw new StorageError(
        `आईडी "${id}" वाली पांडुलिपि पहले से उपस्थित है।`,
        StorageErrorCode.DUPLICATE_ID,
        null,
        { id }
      );
    }

    const now = new Date().toISOString();

    // Build transcription with safe defaults
    const transcription = data.transcription && typeof data.transcription === 'object'
      ? {
          text: typeof data.transcription.text === 'string' ? data.transcription.text : '',
          status: VALID_TRANSCRIPTION_STATUSES.includes(data.transcription.status) ? data.transcription.status : 'untranscribed',
          verifiedAt: data.transcription.verifiedAt || null
        }
      : {
          text: '',
          status: 'untranscribed',
          verifiedAt: null
        };

    // Build provenance with safe defaults
    const provenance = data.provenance && typeof data.provenance === 'object'
      ? {
          source: typeof data.provenance.source === 'string' ? data.provenance.source : 'handwritten_manuscript',
          recordedAt: data.provenance.recordedAt || now,
          notes: typeof data.provenance.notes === 'string' ? data.provenance.notes : ''
        }
      : {
          source: 'handwritten_manuscript',
          recordedAt: now,
          notes: ''
        };

    const newManuscript = {
      id,
      poemId: (data.poemId !== undefined && data.poemId !== null && typeof data.poemId === 'string')
        ? data.poemId.trim()
        : null,
      title: data.title.trim(),
      originalManuscript: {
        id: generateArtifactId(),
        filename: (data.originalManuscript.filename && typeof data.originalManuscript.filename === 'string')
          ? data.originalManuscript.filename.trim()
          : null,
        mimeType: data.originalManuscript.mimeType,
        data: data.originalManuscript.data,
        capturedAt: data.originalManuscript.capturedAt || null
      },
      transcription,
      provenance,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    };

    manuscripts.push(newManuscript);
    this._writeManuscripts(manuscripts);

    return deepClone(newManuscript);
  }

  /**
   * Updates manuscript metadata (title, poemId, provenance).
   *
   * PRESERVATION GUARANTEE: This method will NEVER modify the originalManuscript
   * artifact data. Attempting to include originalManuscript in the metadata
   * update will throw a validation error.
   *
   * @param {string} id
   * @param {Object} metadata - May contain: title, poemId, provenance
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  updateMetadata(id, metadata) {
    this._validateMetadataUpdateInput(metadata);

    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    const current = manuscripts[index];
    const now = new Date().toISOString();

    // Build updated provenance if provided, merging with existing
    let updatedProvenance = current.provenance;
    if (metadata.provenance && typeof metadata.provenance === 'object') {
      updatedProvenance = {
        ...current.provenance,
        source: metadata.provenance.source !== undefined ? metadata.provenance.source : current.provenance.source,
        recordedAt: metadata.provenance.recordedAt !== undefined ? metadata.provenance.recordedAt : current.provenance.recordedAt,
        notes: metadata.provenance.notes !== undefined ? metadata.provenance.notes : current.provenance.notes
      };
    }

    const updated = {
      ...current,
      title: metadata.title !== undefined ? metadata.title.trim() : current.title,
      poemId: metadata.poemId !== undefined ? metadata.poemId : current.poemId,
      provenance: updatedProvenance,
      // originalManuscript is NEVER touched here
      // transcription is NEVER touched here
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Updates the digital transcription of a manuscript.
   *
   * PRESERVATION GUARANTEE: This method will NEVER modify the originalManuscript
   * artifact data. It only updates the transcription text, status, and verifiedAt.
   *
   * @param {string} id
   * @param {Object} transcription - May contain: text, status, verifiedAt
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  updateTranscription(id, transcription) {
    this._validateTranscriptionInput(transcription);

    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    const current = manuscripts[index];
    const now = new Date().toISOString();

    const currentTranscription = current.transcription || { text: '', status: 'untranscribed', verifiedAt: null };

    const updatedTranscription = {
      text: transcription.text !== undefined ? transcription.text : currentTranscription.text,
      status: transcription.status !== undefined ? transcription.status : currentTranscription.status,
      verifiedAt: transcription.verifiedAt !== undefined ? transcription.verifiedAt : currentTranscription.verifiedAt
    };

    // Auto-set verifiedAt when status transitions to 'verified' and no explicit verifiedAt given
    if (updatedTranscription.status === 'verified' && !updatedTranscription.verifiedAt) {
      updatedTranscription.verifiedAt = now;
    }

    const updated = {
      ...current,
      transcription: updatedTranscription,
      // originalManuscript is NEVER touched here
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Explicitly replaces the original manuscript artifact.
   *
   * This is the ONLY operation that can modify the stored original image.
   * It requires a complete, valid new original manuscript object and
   * constitutes a deliberate archival replacement.
   *
   * @param {string} id
   * @param {Object} newOriginal - Complete replacement original manuscript
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  replaceOriginalManuscript(id, newOriginal) {
    this._validateOriginalManuscript(newOriginal);

    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    const current = manuscripts[index];
    const now = new Date().toISOString();

    const updated = {
      ...current,
      originalManuscript: {
        id: generateArtifactId(),
        filename: (newOriginal.filename && typeof newOriginal.filename === 'string')
          ? newOriginal.filename.trim()
          : null,
        mimeType: newOriginal.mimeType,
        data: newOriginal.data,
        capturedAt: newOriginal.capturedAt || null
      },
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Permanently deletes a manuscript record.
   * @param {string} id
   * @returns {boolean} True if deleted
   */
  delete(id) {
    if (!id || typeof id !== 'string') {
      throw new StorageError(
        'पांडुलिपि आईडी (id) मान्य स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === id);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${id}" वाली पांडुलिपि हटाने के लिए नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id }
      );
    }

    manuscripts.splice(index, 1);
    this._writeManuscripts(manuscripts);
    return true;
  }

  /**
   * Retrieves all manuscripts linked to a specific poem ID.
   * @param {string} poemId
   * @returns {Array} Deep-cloned array of matching manuscript records
   */
  getByPoemId(poemId) {
    if (!poemId || typeof poemId !== 'string') return [];
    const manuscripts = this._readManuscripts();
    const matches = manuscripts.filter(m => m && typeof m === 'object' && m.poemId === poemId);

    matches.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return deepClone(matches);
  }
}

// Global default singleton instance
export const manuscriptRepository = new ManuscriptRepository();
