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
import { poemRepository } from './PoemRepository.js';

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
// Transcription Versioning Constants
// ============================================================================

export const MAX_TRANSCRIPTION_HISTORY = 25;
export const VALID_VERSION_SOURCES = ['manual-save', 'verification', 'restore'];

// ============================================================================
// Provenance & Archival Constants
// ============================================================================

export const VALID_PROVENANCE_SOURCES = [
  'handwritten-manuscript',
  'scanned-document',
  'camera-capture',
  'imported-image',
  'other',
  // Legacy & backward-compatible aliases
  'handwritten_manuscript',
  'scanned_document',
  'photo_capture',
  'handwritten'
];

export const VALID_ACQUISITION_METHODS = [
  'notebook-scan',
  'mobile-camera',
  'desktop-upload',
  'imported-file',
  'other'
];

/**
 * Validates ISO-8601 date string format (YYYY-MM-DD...)
 */
function isValidIsoDate(str) {
  if (typeof str !== 'string' || str.trim() === '') return false;
  const timestamp = Date.parse(str);
  if (isNaN(timestamp)) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(str.trim());
}

/**
 * Generates a unique identifier for transcription history versions
 */
function generateVersionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_trv_${crypto.randomUUID()}`;
  }
  return `kv_trv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Safely normalizes manuscript schema for provenance, archival, and version history migration
 */
function normalizeManuscript(m) {
  if (!m || typeof m !== 'object') return m;
  const trans = m.transcription || { text: '', status: 'untranscribed', verifiedAt: null };

  const rawProv = m.provenance;
  let normalizedProvenance;
  if (!rawProv || typeof rawProv !== 'object') {
    normalizedProvenance = {
      source: null,
      recordedAt: null,
      notes: '',
      recordedBy: null,
      location: null,
      acquisitionMethod: null
    };
  } else {
    normalizedProvenance = {
      source: rawProv.source !== undefined ? rawProv.source : null,
      recordedAt: rawProv.recordedAt !== undefined ? rawProv.recordedAt : null,
      notes: typeof rawProv.notes === 'string' ? rawProv.notes : '',
      recordedBy: typeof rawProv.recordedBy === 'string' ? rawProv.recordedBy : null,
      location: typeof rawProv.location === 'string' ? rawProv.location : null,
      acquisitionMethod: rawProv.acquisitionMethod !== undefined ? rawProv.acquisitionMethod : null
    };
  }

  const rawArchival = m.archival;
  let normalizedArchival;
  if (rawArchival && typeof rawArchival === 'object') {
    normalizedArchival = {
      ingestedAt: rawArchival.ingestedAt || m.createdAt || null,
      lastVerifiedAt: rawArchival.lastVerifiedAt || trans.verifiedAt || null,
      lastTranscribedAt: rawArchival.lastTranscribedAt || null
    };
  } else {
    normalizedArchival = {
      ingestedAt: m.createdAt || null,
      lastVerifiedAt: trans.verifiedAt || null,
      lastTranscribedAt: null
    };
  }

  return {
    ...m,
    provenance: normalizedProvenance,
    archival: normalizedArchival,
    transcription: {
      text: typeof trans.text === 'string' ? trans.text : '',
      status: VALID_TRANSCRIPTION_STATUSES.includes(trans.status) ? trans.status : 'untranscribed',
      verifiedAt: trans.verifiedAt || null,
      currentVersionId: trans.currentVersionId || null
    },
    transcriptionHistory: Array.isArray(m.transcriptionHistory) ? m.transcriptionHistory : []
  };
}

// ============================================================================
// Manuscript Repository
// ============================================================================

export class ManuscriptRepository {
  /**
   * @param {import('./storage/IStorageAdapter.js').IStorageAdapter} [adapter=null]
   * @param {import('./PoemRepository.js').PoemRepository} [poemRepo=null]
   */
  constructor(adapter = null, poemRepo = null) {
    this.adapter = adapter || new LocalStorageAdapter();
    this.poemRepo = poemRepo;
  }

  /**
   * Internal helper: returns the active PoemRepository instance
   * @returns {import('./PoemRepository.js').PoemRepository}
   */
  _getPoemRepo() {
    if (this.poemRepo) return this.poemRepo;
    return poemRepository;
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
      return data.map(m => normalizeManuscript(m));
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

      if (transcription.status === 'verified' && transcription.text !== undefined && transcription.text.trim() === '') {
        throw new StorageError(
          'प्रमाणित स्थिति (verified) के लिए सार्थक प्रतिलिपि पाठ अनिवार्य है।',
          StorageErrorCode.VALIDATION_ERROR
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

    // Source validation
    if (provenance.source !== undefined && provenance.source !== null) {
      if (typeof provenance.source !== 'string') {
        throw new StorageError(
          'उद्गम स्रोत (source) स्ट्रिंग होना चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
      if (!VALID_PROVENANCE_SOURCES.includes(provenance.source)) {
        throw new StorageError(
          `अमान्य उद्गम स्रोत "${provenance.source}"। मान्य स्रोत: ${VALID_PROVENANCE_SOURCES.join(', ')}`,
          StorageErrorCode.VALIDATION_ERROR,
          null,
          { source: provenance.source, allowed: VALID_PROVENANCE_SOURCES }
        );
      }
    }

    // Acquisition method validation
    if (provenance.acquisitionMethod !== undefined && provenance.acquisitionMethod !== null && provenance.acquisitionMethod !== '') {
      if (typeof provenance.acquisitionMethod !== 'string') {
        throw new StorageError(
          'प्राप्ति का माध्यम (acquisitionMethod) स्ट्रिंग होना चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
      if (!VALID_ACQUISITION_METHODS.includes(provenance.acquisitionMethod)) {
        throw new StorageError(
          `अमान्य प्राप्ति माध्यम "${provenance.acquisitionMethod}"। मान्य माध्यम: ${VALID_ACQUISITION_METHODS.join(', ')}`,
          StorageErrorCode.VALIDATION_ERROR,
          null,
          { acquisitionMethod: provenance.acquisitionMethod, allowed: VALID_ACQUISITION_METHODS }
        );
      }
    }

    // Recorded date validation
    if (provenance.recordedAt !== undefined && provenance.recordedAt !== null) {
      if (typeof provenance.recordedAt !== 'string' || !isValidIsoDate(provenance.recordedAt)) {
        throw new StorageError(
          'उद्गम अभिलेखन तिथि (recordedAt) मान्य ISO प्रारूप में होनी चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
    }

    // Notes validation
    if (provenance.notes !== undefined && provenance.notes !== null && typeof provenance.notes !== 'string') {
      throw new StorageError(
        'उद्गम टिप्पणियाँ (notes) स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Recorded by validation
    if (provenance.recordedBy !== undefined && provenance.recordedBy !== null && typeof provenance.recordedBy !== 'string') {
      throw new StorageError(
        'अभिलेखक (recordedBy) स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Location validation
    if (provenance.location !== undefined && provenance.location !== null && typeof provenance.location !== 'string') {
      throw new StorageError(
        'स्थान (location) स्ट्रिंग होना चाहिए।',
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

    // PROTECTION: metadata updates must NOT modify derived manuscript or transformation directly
    if (metadata.derivedManuscript !== undefined || metadata.transformation !== undefined) {
      throw new StorageError(
        'संपादित प्रति या रूपांतरण को सामान्य मेटाडेटा अद्यतन से संशोधित नहीं किया जा सकता। कृपया saveDerivedManuscript() का उपयोग करें।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // PROTECTION: metadata updates must NOT modify transcription or transcription history directly
    if (metadata.transcription !== undefined || metadata.transcriptionHistory !== undefined) {
      throw new StorageError(
        'प्रतिलिपि डेटा को सामान्य मेटाडेटा अद्यतन से संशोधित नहीं किया जा सकता। कृपया updateTranscription() का उपयोग करें।',
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

  /**
   * Validates derived manuscript artifact input structure
   */
  _validateDerivedArtifact(artifact, originalManuscriptId) {
    if (!artifact || typeof artifact !== 'object') {
      throw new StorageError(
        'संपादित पांडुलिपि (derivedManuscript) ऑब्जेक्ट अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // MIME type validation
    if (!artifact.mimeType || typeof artifact.mimeType !== 'string') {
      throw new StorageError(
        'संपादित पांडुलिपि का MIME प्रकार आवश्यक है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(artifact.mimeType)) {
      throw new StorageError(
        `अमान्य MIME प्रकार "${artifact.mimeType}"। स्वीकृत प्रकार: ${ALLOWED_MIME_TYPES.join(', ')}`,
        StorageErrorCode.VALIDATION_ERROR,
        null,
        { mimeType: artifact.mimeType, allowed: ALLOWED_MIME_TYPES }
      );
    }

    // Image data validation
    if (!artifact.data || typeof artifact.data !== 'string' || artifact.data.trim() === '') {
      throw new StorageError(
        'संपादित पांडुलिपि का छवि डेटा एक गैर-रिक्त स्ट्रिंग होना अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // sourceArtifactId validation: must match originalManuscript.id
    if (!artifact.sourceArtifactId || typeof artifact.sourceArtifactId !== 'string') {
      throw new StorageError(
        'मूल आर्टिफ़ैक्ट आईडी (sourceArtifactId) अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (artifact.sourceArtifactId !== originalManuscriptId) {
      throw new StorageError(
        `स्रोत आर्टिफ़ैक्ट आईडी "${artifact.sourceArtifactId}" मूल पांडुलिपि आईडी "${originalManuscriptId}" से मेल नहीं खाती।`,
        StorageErrorCode.VALIDATION_ERROR,
        null,
        { sourceArtifactId: artifact.sourceArtifactId, expected: originalManuscriptId }
      );
    }

    // Filename validation
    if (artifact.filename !== undefined && artifact.filename !== null && typeof artifact.filename !== 'string') {
      throw new StorageError(
        'फ़ाइल नाम (filename) स्ट्रिंग या null होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Validates transformation metadata
   */
  _validateTransformation(transformation) {
    if (!transformation || typeof transformation !== 'object') {
      throw new StorageError(
        'रूपांतरण (transformation) ऑब्जेक्ट अनिवार्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Rotation validation: strictly 0, 90, 180, 270
    const VALID_ROTATIONS = [0, 90, 180, 270];
    if (transformation.rotation === undefined || !VALID_ROTATIONS.includes(transformation.rotation)) {
      throw new StorageError(
        `अमान्य घूर्णन (rotation) कोण "${transformation.rotation}"। केवल 0, 90, 180 या 270 अंश मान्य हैं।`,
        StorageErrorCode.VALIDATION_ERROR,
        null,
        { rotation: transformation.rotation, allowed: VALID_ROTATIONS }
      );
    }

    // Crop validation
    if (transformation.crop !== undefined && transformation.crop !== null) {
      const crop = transformation.crop;
      if (typeof crop !== 'object') {
        throw new StorageError(
          'क्रॉप (crop) ऑब्जेक्ट होना चाहिए।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }

      if (
        typeof crop.x !== 'number' || isNaN(crop.x) || crop.x < 0 ||
        typeof crop.y !== 'number' || isNaN(crop.y) || crop.y < 0 ||
        typeof crop.width !== 'number' || isNaN(crop.width) || crop.width <= 0 ||
        typeof crop.height !== 'number' || isNaN(crop.height) || crop.height <= 0
      ) {
        throw new StorageError(
          'क्रॉप निर्देशांक अमान्य हैं। x, y >= 0 और चौड़ाई (width), ऊँचाई (height) > 0 होना अनिवार्य है।',
          StorageErrorCode.VALIDATION_ERROR,
          null,
          { crop }
        );
      }
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
          verifiedAt: data.transcription.verifiedAt || null,
          currentVersionId: data.transcription.currentVersionId || null
        }
      : {
          text: '',
          status: 'untranscribed',
          verifiedAt: null,
          currentVersionId: null
        };

    const transcriptionHistory = Array.isArray(data.transcriptionHistory)
      ? deepClone(data.transcriptionHistory)
      : [];

    // Build provenance with safe defaults
    const provenance = data.provenance && typeof data.provenance === 'object'
      ? {
          source: data.provenance.source !== undefined ? data.provenance.source : 'handwritten_manuscript',
          acquisitionMethod: data.provenance.acquisitionMethod || null,
          recordedAt: data.provenance.recordedAt !== undefined ? data.provenance.recordedAt : now,
          notes: typeof data.provenance.notes === 'string' ? data.provenance.notes : '',
          recordedBy: typeof data.provenance.recordedBy === 'string' ? data.provenance.recordedBy : null,
          location: typeof data.provenance.location === 'string' ? data.provenance.location : null
        }
      : {
          source: 'handwritten_manuscript',
          acquisitionMethod: null,
          recordedAt: now,
          notes: '',
          recordedBy: null,
          location: null
        };

    const archival = {
      ingestedAt: now,
      lastVerifiedAt: (data.transcription && data.transcription.status === 'verified' && data.transcription.verifiedAt) || null,
      lastTranscribedAt: (data.transcription && data.transcription.text) ? now : null
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
      derivedManuscript: data.derivedManuscript && typeof data.derivedManuscript === 'object'
        ? deepClone(data.derivedManuscript)
        : null,
      transformation: data.transformation && typeof data.transformation === 'object'
        ? deepClone(data.transformation)
        : null,
      transcription,
      transcriptionHistory,
      provenance,
      archival,
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
        source: metadata.provenance.source !== undefined ? metadata.provenance.source : current.provenance?.source,
        acquisitionMethod: metadata.provenance.acquisitionMethod !== undefined ? metadata.provenance.acquisitionMethod : (current.provenance?.acquisitionMethod || null),
        recordedAt: metadata.provenance.recordedAt !== undefined ? metadata.provenance.recordedAt : current.provenance?.recordedAt,
        notes: metadata.provenance.notes !== undefined ? metadata.provenance.notes : (current.provenance?.notes || ''),
        recordedBy: metadata.provenance.recordedBy !== undefined ? metadata.provenance.recordedBy : (current.provenance?.recordedBy || null),
        location: metadata.provenance.location !== undefined ? metadata.provenance.location : (current.provenance?.location || null)
      };
    }

    const updated = {
      ...current,
      title: metadata.title !== undefined ? metadata.title.trim() : current.title,
      poemId: metadata.poemId !== undefined ? metadata.poemId : current.poemId,
      provenance: updatedProvenance,
      archival: current.archival || {
        ingestedAt: current.createdAt || now,
        lastVerifiedAt: current.transcription?.verifiedAt || null,
        lastTranscribedAt: null
      },
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
   * or derivedManuscript artifact data. It only updates transcription text,
   * status, and verifiedAt.
   *
   * Status lifecycle:
   * - "untranscribed": initial state with no transcription.
   * - "draft": actively being edited or unverified transcription.
   * - "verified": confirmed transcription with ISO verifiedAt timestamp. Requires non-empty text.
   * - Editing text of a verified transcription automatically drops status back to "draft"
   *   and clears verifiedAt to null unless explicitly verified in the same call.
   * - Transitioning to "draft" or "untranscribed" always clears verifiedAt.
   *
   * @param {string} id
   * @param {Object} transcription - May contain: text, status, verifiedAt
   * @param {Object} [options={}] - Options: createVersion, source, changeNote
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  updateTranscription(id, transcription, options = {}) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (id) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    this._validateTranscriptionInput(transcription);

    const cleanId = id.trim();
    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === cleanId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${cleanId}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: cleanId }
      );
    }

    const current = manuscripts[index];
    const now = new Date().toISOString();
    const currentTranscription = current.transcription || { text: '', status: 'untranscribed', verifiedAt: null, currentVersionId: null };
    const history = Array.isArray(current.transcriptionHistory) ? [...current.transcriptionHistory] : [];

    const newText = transcription.text !== undefined ? transcription.text : currentTranscription.text;
    const isTextChanging = transcription.text !== undefined && transcription.text !== currentTranscription.text;

    // Determine target status
    let newStatus;
    if (transcription.status !== undefined) {
      newStatus = transcription.status;
    } else if (isTextChanging) {
      // Modifying text without explicit status transitions/downgrades to 'draft'
      newStatus = 'draft';
    } else {
      newStatus = currentTranscription.status;
    }

    // Verified status requires meaningful non-empty text
    if (newStatus === 'verified') {
      if (!newText || typeof newText !== 'string' || newText.trim() === '') {
        throw new StorageError(
          'प्रमाणित स्थिति (verified) के लिए सार्थक प्रतिलिपि पाठ अनिवार्य है।',
          StorageErrorCode.VALIDATION_ERROR
        );
      }
    }

    // Manage verifiedAt timestamp
    let newVerifiedAt = null;
    if (newStatus === 'verified') {
      if (transcription.verifiedAt !== undefined) {
        newVerifiedAt = transcription.verifiedAt;
      } else if (currentTranscription.status === 'verified' && !isTextChanging && currentTranscription.verifiedAt) {
        newVerifiedAt = currentTranscription.verifiedAt;
      } else {
        newVerifiedAt = now;
      }
    } else {
      // Draft or untranscribed clears verifiedAt
      newVerifiedAt = null;
    }

    // Version creation semantics:
    // Create a new version if:
    // 1. options.createVersion is explicitly true OR (options.createVersion !== false AND (newText.trim().length > 0 || history.length > 0))
    // 2. AND it is NOT a duplicate of the latest version snapshot
    let currentVersionId = currentTranscription.currentVersionId || null;
    const shouldCreateVersion = options.createVersion !== false && (newText.trim().length > 0 || history.length > 0);

    if (shouldCreateVersion) {
      const latestVersion = history.length > 0 ? history[history.length - 1] : null;
      const isDuplicate = latestVersion &&
        latestVersion.text === newText &&
        latestVersion.status === newStatus &&
        latestVersion.verifiedAt === newVerifiedAt;

      if (!isDuplicate) {
        let maxVersionNum = 0;
        for (const h of history) {
          if (h && typeof h.versionNumber === 'number' && h.versionNumber > maxVersionNum) {
            maxVersionNum = h.versionNumber;
          }
        }
        const versionNumber = maxVersionNum + 1;
        const source = options.source || (newStatus === 'verified' ? 'verification' : 'manual-save');
        const changeNote = typeof options.changeNote === 'string'
          ? options.changeNote.trim()
          : (newStatus === 'verified' ? 'प्रमाणित प्रतिलिपि' : (versionNumber === 1 ? 'प्रारंभिक प्रारूप' : ''));

        const snapshot = {
          id: generateVersionId(),
          versionNumber,
          text: newText,
          status: newStatus,
          verifiedAt: newVerifiedAt,
          createdAt: now,
          source,
          changeNote
        };

        history.push(snapshot);

        // Enforce MAX_TRANSCRIPTION_HISTORY cap (25)
        if (history.length > MAX_TRANSCRIPTION_HISTORY) {
          const pruneCount = history.length - MAX_TRANSCRIPTION_HISTORY;
          history.splice(0, pruneCount);
        }

        currentVersionId = snapshot.id;
      }
    }

    const updatedTranscription = {
      text: newText,
      status: newStatus,
      verifiedAt: newVerifiedAt,
      currentVersionId
    };

    let archival = current.archival ? { ...current.archival } : {
      ingestedAt: current.createdAt || now,
      lastVerifiedAt: current.transcription?.verifiedAt || null,
      lastTranscribedAt: null
    };

    if (newText && newText.trim().length > 0) {
      archival.lastTranscribedAt = now;
    }
    if (newStatus === 'verified' && newVerifiedAt) {
      archival.lastVerifiedAt = newVerifiedAt;
    }

    const updated = {
      ...current,
      transcription: updatedTranscription,
      transcriptionHistory: history,
      archival,
      // originalManuscript, derivedManuscript, transformation, poemId remain untouched
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Retrieves the transcription version history for a manuscript.
   *
   * @param {string} manuscriptId
   * @returns {Array<Object>} Deep-cloned array of historical versions (chronological order)
   */
  getTranscriptionHistory(manuscriptId) {
    if (!manuscriptId || typeof manuscriptId !== 'string' || manuscriptId.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (manuscriptId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    const ms = this.getById(manuscriptId.trim());
    if (!ms) {
      throw new StorageError(
        `आईडी "${manuscriptId.trim()}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: manuscriptId.trim() }
      );
    }
    return deepClone(Array.isArray(ms.transcriptionHistory) ? ms.transcriptionHistory : []);
  }

  /**
   * Explicitly creates a new transcription version snapshot for a manuscript.
   *
   * @param {string} manuscriptId
   * @param {Object} [metadata={}] - Optional metadata overrides: text, status, verifiedAt, source, changeNote
   * @returns {Object} Created version snapshot (deep-cloned)
   */
  createTranscriptionVersion(manuscriptId, metadata = {}) {
    if (!manuscriptId || typeof manuscriptId !== 'string' || manuscriptId.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (manuscriptId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    const cleanId = manuscriptId.trim();
    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === cleanId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${cleanId}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: cleanId }
      );
    }

    const ms = manuscripts[index];
    const trans = ms.transcription || { text: '', status: 'untranscribed', verifiedAt: null, currentVersionId: null };
    const history = Array.isArray(ms.transcriptionHistory) ? [...ms.transcriptionHistory] : [];

    const text = metadata.text !== undefined ? metadata.text : trans.text;
    const status = metadata.status !== undefined ? metadata.status : trans.status;
    const verifiedAt = metadata.verifiedAt !== undefined ? metadata.verifiedAt : trans.verifiedAt;
    const source = metadata.source || 'manual-save';
    const changeNote = typeof metadata.changeNote === 'string' ? metadata.changeNote.trim() : '';

    if (typeof text !== 'string') {
      throw new StorageError(
        'प्रतिलिपि पाठ (text) स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (!VALID_TRANSCRIPTION_STATUSES.includes(status)) {
      throw new StorageError(
        `अमान्य स्थिति "${status}"। स्वीकृत: ${VALID_TRANSCRIPTION_STATUSES.join(', ')}`,
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (!VALID_VERSION_SOURCES.includes(source)) {
      throw new StorageError(
        `अमान्य स्रोत "${source}"। स्वीकृत: ${VALID_VERSION_SOURCES.join(', ')}`,
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    // Duplicate protection
    const latestVersion = history.length > 0 ? history[history.length - 1] : null;
    if (
      latestVersion &&
      latestVersion.text === text &&
      latestVersion.status === status &&
      latestVersion.verifiedAt === verifiedAt
    ) {
      return deepClone(latestVersion);
    }

    let maxVersionNum = 0;
    for (const h of history) {
      if (h && typeof h.versionNumber === 'number' && h.versionNumber > maxVersionNum) {
        maxVersionNum = h.versionNumber;
      }
    }
    const versionNumber = maxVersionNum + 1;
    const now = new Date().toISOString();

    const snapshot = {
      id: generateVersionId(),
      versionNumber,
      text,
      status,
      verifiedAt: verifiedAt || null,
      createdAt: now,
      source,
      changeNote
    };

    history.push(snapshot);

    if (history.length > MAX_TRANSCRIPTION_HISTORY) {
      const pruneCount = history.length - MAX_TRANSCRIPTION_HISTORY;
      history.splice(0, pruneCount);
    }

    const updated = {
      ...ms,
      transcription: {
        ...trans,
        currentVersionId: snapshot.id
      },
      transcriptionHistory: history,
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(snapshot);
  }

  /**
   * Restores a historical transcription version as the active transcription.
   * Archival Guarantee: Does NOT delete any historical version. Instead, creates a
   * NEW version representing the restore action (source: 'restore').
   * Original manuscript images, derived images, and poem relations remain untouched.
   *
   * @param {string} manuscriptId
   * @param {string} versionId
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  restoreTranscriptionVersion(manuscriptId, versionId) {
    if (!manuscriptId || typeof manuscriptId !== 'string' || manuscriptId.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (manuscriptId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    if (!versionId || typeof versionId !== 'string' || versionId.trim() === '') {
      throw new StorageError(
        'संस्करण आईडी (versionId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    const cleanMsId = manuscriptId.trim();
    const cleanVerId = versionId.trim();

    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === cleanMsId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${cleanMsId}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: cleanMsId }
      );
    }

    const ms = manuscripts[index];
    const history = Array.isArray(ms.transcriptionHistory) ? [...ms.transcriptionHistory] : [];
    const targetVersion = history.find(v => v && v.id === cleanVerId);

    if (!targetVersion) {
      throw new StorageError(
        `संस्करण आईडी "${cleanVerId}" नहीं मिला।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { versionId: cleanVerId }
      );
    }

    const now = new Date().toISOString();
    const isVerified = targetVersion.status === 'verified';
    const targetStatus = targetVersion.status || (targetVersion.text.trim().length > 0 ? 'draft' : 'untranscribed');
    const targetVerifiedAt = isVerified ? (targetVersion.verifiedAt || now) : null;

    let maxVersionNum = 0;
    for (const h of history) {
      if (h && typeof h.versionNumber === 'number' && h.versionNumber > maxVersionNum) {
        maxVersionNum = h.versionNumber;
      }
    }
    const newVersionNumber = maxVersionNum + 1;

    const newRestoreSnapshot = {
      id: generateVersionId(),
      versionNumber: newVersionNumber,
      text: targetVersion.text,
      status: targetStatus,
      verifiedAt: targetVerifiedAt,
      createdAt: now,
      source: 'restore',
      changeNote: `संस्करण v${targetVersion.versionNumber} पुनर्स्थापित`
    };

    history.push(newRestoreSnapshot);

    if (history.length > MAX_TRANSCRIPTION_HISTORY) {
      const pruneCount = history.length - MAX_TRANSCRIPTION_HISTORY;
      history.splice(0, pruneCount);
    }

    const updatedTranscription = {
      text: targetVersion.text,
      status: targetStatus,
      verifiedAt: targetVerifiedAt,
      currentVersionId: newRestoreSnapshot.id
    };

    let archival = ms.archival ? { ...ms.archival } : {
      ingestedAt: ms.createdAt || now,
      lastVerifiedAt: ms.transcription?.verifiedAt || null,
      lastTranscribedAt: null
    };

    if (targetVersion.text && targetVersion.text.trim().length > 0) {
      archival.lastTranscribedAt = now;
    }
    if (isVerified && targetVerifiedAt) {
      archival.lastVerifiedAt = targetVerifiedAt;
    }

    const updated = {
      ...ms,
      transcription: updatedTranscription,
      transcriptionHistory: history,
      archival,
      // originalManuscript, derivedManuscript, transformation, poemId remain untouched
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Deletes a specific historical version snapshot.
   *
   * @param {string} manuscriptId
   * @param {string} versionId
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  deleteTranscriptionVersion(manuscriptId, versionId) {
    if (!manuscriptId || typeof manuscriptId !== 'string' || manuscriptId.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (manuscriptId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    if (!versionId || typeof versionId !== 'string' || versionId.trim() === '') {
      throw new StorageError(
        'संस्करण आईडी (versionId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    const cleanMsId = manuscriptId.trim();
    const cleanVerId = versionId.trim();

    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === cleanMsId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${cleanMsId}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: cleanMsId }
      );
    }

    const ms = manuscripts[index];
    const history = Array.isArray(ms.transcriptionHistory) ? [...ms.transcriptionHistory] : [];
    const vIndex = history.findIndex(v => v && v.id === cleanVerId);

    if (vIndex === -1) {
      throw new StorageError(
        `संस्करण आईडी "${cleanVerId}" नहीं मिला।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { versionId: cleanVerId }
      );
    }

    history.splice(vIndex, 1);
    const now = new Date().toISOString();

    const updated = {
      ...ms,
      transcriptionHistory: history,
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
   * Retrieves the derived/transformed manuscript artifact for a manuscript.
   * @param {string} id
   * @returns {Object|null} Deep-cloned derivedManuscript object or null
   */
  getDerivedManuscript(id) {
    const manuscript = this.getById(id);
    if (!manuscript || !manuscript.derivedManuscript) return null;
    return deepClone(manuscript.derivedManuscript);
  }

  /**
   * Saves a derived/transformed version of a manuscript image.
   *
   * PRESERVATION GUARANTEE: This method NEVER touches, overwrites, or alters
   * the archival originalManuscript artifact. Transformed image bytes are
   * stored strictly in derivedManuscript with a new unique artifact ID.
   *
   * @param {string} id - Manuscript ID
   * @param {Object} derivedArtifact - Transformed image artifact
   * @param {string} derivedArtifact.mimeType - MIME type (e.g. 'image/png')
   * @param {string} derivedArtifact.data - Transformed base64 image data
   * @param {string} derivedArtifact.sourceArtifactId - Must match originalManuscript.id
   * @param {string} [derivedArtifact.filename] - Optional filename
   * @param {Object} transformation - Transformation parameters
   * @param {number} transformation.rotation - 0, 90, 180, or 270
   * @param {Object|null} [transformation.crop=null] - Rectangular crop { x, y, width, height }
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  saveDerivedManuscript(id, derivedArtifact, transformation) {
    if (!id || typeof id !== 'string') {
      throw new StorageError(
        'पांडुलिपि आईडी (id) अमान्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

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
    this._validateDerivedArtifact(derivedArtifact, current.originalManuscript.id);
    this._validateTransformation(transformation);

    const now = new Date().toISOString();
    const currentVersion = current.derivedManuscript && typeof current.derivedManuscript.transformVersion === 'number'
      ? current.derivedManuscript.transformVersion
      : 0;
    const nextVersion = typeof derivedArtifact.transformVersion === 'number' && derivedArtifact.transformVersion > currentVersion
      ? derivedArtifact.transformVersion
      : currentVersion + 1;

    const newDerivedArtifact = {
      id: generateArtifactId(), // New unique kv_art_<uuid>, NEVER reuse original artifact ID
      filename: (derivedArtifact.filename && typeof derivedArtifact.filename === 'string')
        ? derivedArtifact.filename.trim()
        : (current.originalManuscript.filename ? `derived_${current.originalManuscript.filename}` : null),
      mimeType: derivedArtifact.mimeType,
      data: derivedArtifact.data,
      createdAt: derivedArtifact.createdAt || now,
      sourceArtifactId: current.originalManuscript.id, // Strictly points to original
      transformVersion: nextVersion
    };

    const cleanTransformation = {
      rotation: transformation.rotation,
      crop: transformation.crop
        ? {
            x: Math.round(transformation.crop.x),
            y: Math.round(transformation.crop.y),
            width: Math.round(transformation.crop.width),
            height: Math.round(transformation.crop.height)
          }
        : null,
      transformVersion: nextVersion,
      transformedAt: now
    };

    const updated = {
      ...current,
      // originalManuscript remains strictly untouched and identical byte-for-byte
      derivedManuscript: newDerivedArtifact,
      transformation: cleanTransformation,
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Resets/clears the derived manuscript artifact, returning to the untouched original.
   *
   * PRESERVATION GUARANTEE: Does NOT modify or delete the original manuscript.
   *
   * @param {string} id - Manuscript ID
   * @returns {Object} Updated manuscript record (deep-cloned)
   */
  clearDerivedManuscript(id) {
    if (!id || typeof id !== 'string') {
      throw new StorageError(
        'पांडुलिपि आईडी (id) अमान्य है।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

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
      derivedManuscript: null,
      transformation: null,
      // originalManuscript is NEVER touched here
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

  /**
   * Retrieves all manuscripts linked to a specific poem ID (alias for getByPoemId).
   * @param {string} poemId
   * @returns {Array} Deep-cloned array of matching manuscript records
   */
  getManuscriptsForPoem(poemId) {
    return this.getByPoemId(poemId);
  }

  /**
   * Links a manuscript to an existing poem.
   *
   * Enforces referential integrity:
   * - Validates manuscript exists
   * - Validates poem exists in PoemRepository
   * - Does NOT mutate original or derived manuscript artifacts
   * - Idempotent if already linked to the same poem
   *
   * @param {string} manuscriptId Unique manuscript ID
   * @param {string} poemId Unique poem ID
   * @returns {Object} Deep-cloned updated manuscript
   */
  linkToPoem(manuscriptId, poemId) {
    if (!manuscriptId || typeof manuscriptId !== 'string' || manuscriptId.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (manuscriptId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    if (!poemId || typeof poemId !== 'string' || poemId.trim() === '') {
      throw new StorageError(
        'कविता आईडी (poemId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    const cleanMsId = manuscriptId.trim();
    const cleanPoemId = poemId.trim();

    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === cleanMsId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${cleanMsId}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: cleanMsId }
      );
    }

    // Validate poem existence
    const poemRepo = this._getPoemRepo();
    const poem = poemRepo ? poemRepo.getById(cleanPoemId) : null;
    if (!poem) {
      throw new StorageError(
        `आईडी "${cleanPoemId}" वाली कविता उपस्थित नहीं है।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { poemId: cleanPoemId }
      );
    }

    const current = manuscripts[index];

    // Idempotent: already linked to the exact same poem
    if (current.poemId === cleanPoemId) {
      return deepClone(current);
    }

    const now = new Date().toISOString();
    const updated = {
      ...current,
      poemId: cleanPoemId,
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Unlinks a manuscript from any associated poem.
   *
   * Idempotent if already unlinked.
   *
   * @param {string} manuscriptId Unique manuscript ID
   * @returns {Object} Deep-cloned updated manuscript
   */
  unlinkFromPoem(manuscriptId) {
    if (!manuscriptId || typeof manuscriptId !== 'string' || manuscriptId.trim() === '') {
      throw new StorageError(
        'पांडुलिपि आईडी (manuscriptId) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }

    const cleanMsId = manuscriptId.trim();
    const manuscripts = this._readManuscripts();
    const index = manuscripts.findIndex(m => m && m.id === cleanMsId);

    if (index === -1) {
      throw new StorageError(
        `आईडी "${cleanMsId}" वाली पांडुलिपि नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: cleanMsId }
      );
    }

    const current = manuscripts[index];

    // Idempotent: already unlinked
    if (current.poemId === null) {
      return deepClone(current);
    }

    const now = new Date().toISOString();
    const updated = {
      ...current,
      poemId: null,
      updatedAt: now
    };

    manuscripts[index] = updated;
    this._writeManuscripts(manuscripts);

    return deepClone(updated);
  }

  /**
   * Retrieves the linked poem record for a manuscript, if present and valid.
   * @param {string} manuscriptId Unique manuscript ID
   * @returns {Object|null} Deep-cloned poem or null
   */
  getLinkedPoem(manuscriptId) {
    if (!manuscriptId || typeof manuscriptId !== 'string') return null;
    const ms = this.getById(manuscriptId.trim());
    if (!ms || !ms.poemId) return null;

    const poemRepo = this._getPoemRepo();
    if (!poemRepo) return null;
    return poemRepo.getById(ms.poemId);
  }

  /**
   * Unlinks all manuscripts pointing to a specific poem ID (used during poem deletion).
   * Safe, non-destructive to manuscript images.
   * @param {string} poemId
   * @returns {number} Count of unlinked manuscripts
   */
  unlinkAllFromPoem(poemId) {
    if (!poemId || typeof poemId !== 'string') return 0;
    const cleanPoemId = poemId.trim();

    const manuscripts = this._readManuscripts();
    let unlinkedCount = 0;
    const now = new Date().toISOString();

    const updated = manuscripts.map(m => {
      if (m && m.poemId === cleanPoemId) {
        unlinkedCount++;
        return {
          ...m,
          poemId: null,
          updatedAt: now
        };
      }
      return m;
    });

    if (unlinkedCount > 0) {
      this._writeManuscripts(updated);
    }

    return unlinkedCount;
  }
}

// Global default singleton instance
export const manuscriptRepository = new ManuscriptRepository();
