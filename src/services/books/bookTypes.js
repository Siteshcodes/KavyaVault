/**
 * काव्यकलश (KavyaVault) — Book Project Domain Types & Validators (bookTypes.js)
 * Phase 7 / Task 7.1: Book Project Foundation
 *
 * Defines explicit domain models, enums, validators, and normalization helpers for:
 * - BookProject: Root book project referencing poems without duplicating poem bodies
 * - BookSection: Ordered book chapters / divisions
 * - CoverConfig: Local cover configuration contract
 * - BookDocument: Export-neutral in-memory book representation for future PDF/EPUB generators
 */

import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

/**
 * Supported cover presentation styles
 */
export const COVER_TYPE = Object.freeze({
  CLASSIC: 'classic',
  SIMPLE: 'simple',
  MODERN: 'modern',
  ORNATE: 'ornate'
});

export const VALID_COVER_TYPES = Object.freeze(Object.values(COVER_TYPE));

/**
 * Generates a unique collision-resistant book project identifier
 * @returns {string}
 */
export function generateBookId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_book_${crypto.randomUUID()}`;
  }
  return `kv_book_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a unique collision-resistant section identifier
 * @returns {string}
 */
export function generateSectionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `kv_bsec_${crypto.randomUUID()}`;
  }
  return `kv_bsec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validates and normalizes string input with NFC Unicode normalization
 * @param {*} val
 * @returns {string}
 */
export function normalizeString(val) {
  if (typeof val !== 'string') return '';
  return val.normalize('NFC').trim();
}

/**
 * Creates and validates a CoverConfig object
 * @param {Object} [data={}]
 * @returns {Object}
 */
export function createCoverConfig(data = {}) {
  const type = (typeof data.type === 'string' && VALID_COVER_TYPES.includes(data.type))
    ? data.type
    : COVER_TYPE.CLASSIC;

  return {
    type,
    title: typeof data.title === 'string' ? normalizeString(data.title) : null,
    subtitle: typeof data.subtitle === 'string' ? normalizeString(data.subtitle) : null,
    author: typeof data.author === 'string' ? normalizeString(data.author) : null,
    background: typeof data.background === 'string' ? normalizeString(data.background) : 'bhojpatra',
    artworkReference: typeof data.artworkReference === 'string' && data.artworkReference.trim() !== ''
      ? data.artworkReference.trim()
      : null
  };
}

/**
 * Validates a BookSection object
 * @param {Object} data
 * @throws {StorageError} If validation fails
 */
export function validateBookSection(data) {
  if (!data || typeof data !== 'object') {
    throw new StorageError('खण्ड (Section) डेटा एक ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof data.title !== 'string' || normalizeString(data.title) === '') {
    throw new StorageError('खण्ड का शीर्षक (Title) रिक्त नहीं होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (data.id !== undefined && data.id !== null) {
    if (typeof data.id !== 'string' || data.id.trim() === '') {
      throw new StorageError('खण्ड आईडी एक अ-रिक्त स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (data.poemIds !== undefined && data.poemIds !== null) {
    if (!Array.isArray(data.poemIds)) {
      throw new StorageError('रचना सूचियाँ (poemIds) एक ऐरे होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
    for (const pid of data.poemIds) {
      if (typeof pid !== 'string' || pid.trim() === '') {
        throw new StorageError('प्रत्येक रचना आईडी एक मान्य स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
      }
    }
  }

  if (data.order !== undefined && data.order !== null) {
    if (typeof data.order !== 'number' || !Number.isInteger(data.order) || data.order < 0) {
      throw new StorageError('खण्ड क्रम (order) एक गैर-ऋणात्मक पूर्णांक होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }
}

/**
 * Creates a normalized BookSection entity
 * @param {Object} [data={}]
 * @returns {Object}
 */
export function createBookSection(data = {}) {
  validateBookSection(data);

  const now = new Date().toISOString();
  const id = (data.id && typeof data.id === 'string' && data.id.trim() !== '')
    ? data.id.trim()
    : generateSectionId();

  // Deduplicate poem IDs within the section while preserving specified order
  const rawPoemIds = Array.isArray(data.poemIds) ? data.poemIds : [];
  const seen = new Set();
  const poemIds = [];
  for (const pid of rawPoemIds) {
    const trimmed = typeof pid === 'string' ? pid.trim() : '';
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      poemIds.push(trimmed);
    }
  }

  return {
    id,
    title: normalizeString(data.title),
    description: typeof data.description === 'string' && normalizeString(data.description) !== ''
      ? normalizeString(data.description)
      : null,
    poemIds,
    order: typeof data.order === 'number' && Number.isInteger(data.order) && data.order >= 0
      ? data.order
      : 0,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now
  };
}

/**
 * Validates a BookProject creation or update payload
 * @param {Object} data
 * @throws {StorageError} If validation fails
 */
export function validateBookProject(data) {
  if (!data || typeof data !== 'object') {
    throw new StorageError('पुस्तक परियोजना डेटा एक ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (typeof data.title !== 'string' || normalizeString(data.title) === '') {
    throw new StorageError('पुस्तक का शीर्षक (Title) अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (data.id !== undefined && data.id !== null) {
    if (typeof data.id !== 'string' || data.id.trim() === '') {
      throw new StorageError('पुस्तक आईडी एक अ-रिक्त स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (data.sections !== undefined && data.sections !== null) {
    if (!Array.isArray(data.sections)) {
      throw new StorageError('पुस्तक के खण्ड (sections) एक ऐरे होने चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
    const sectionIds = new Set();
    for (const section of data.sections) {
      validateBookSection(section);
      if (section.id) {
        if (sectionIds.has(section.id)) {
          throw new StorageError(
            `डुप्लीकेट खण्ड आईडी पाई गई: "${section.id}"`,
            StorageErrorCode.DUPLICATE_ID,
            null,
            { sectionId: section.id }
          );
        }
        sectionIds.add(section.id);
      }
    }
  }
}

/**
 * Creates a normalized BookProject entity
 * A BookProject references poems by ID and never stores duplicate poem bodies in its persistent record.
 * @param {Object} [data={}]
 * @returns {Object}
 */
export function createBookProject(data = {}) {
  validateBookProject(data);

  const now = new Date().toISOString();
  const id = (data.id && typeof data.id === 'string' && data.id.trim() !== '')
    ? data.id.trim()
    : generateBookId();

  // Process sections: sort by order ASC and normalize
  const rawSections = Array.isArray(data.sections) ? data.sections : [];
  let sections = rawSections.map((sec, idx) => {
    return createBookSection({
      ...sec,
      order: (typeof sec.order === 'number' && Number.isInteger(sec.order)) ? sec.order : idx
    });
  });

  // If initial poemIds are provided directly without sections, construct a default main section
  if (sections.length === 0 && Array.isArray(data.poemIds) && data.poemIds.length > 0) {
    sections = [
      createBookSection({
        id: generateSectionId(),
        title: 'मुख्य संकलन',
        description: null,
        poemIds: data.poemIds,
        order: 0,
        createdAt: now,
        updatedAt: now
      })
    ];
  }

  // Sort sections by order
  sections.sort((a, b) => a.order - b.order);
  // Re-index orders deterministically to ensure consecutive 0, 1, 2...
  sections.forEach((sec, idx) => {
    sec.order = idx;
  });

  // Derive unique list of all poem IDs referenced across all sections in section/poem order
  const poemIdSet = new Set();
  const poemIds = [];
  for (const sec of sections) {
    for (const pid of sec.poemIds) {
      if (!poemIdSet.has(pid)) {
        poemIdSet.add(pid);
        poemIds.push(pid);
      }
    }
  }

  const title = normalizeString(data.title);
  const author = typeof data.author === 'string' && normalizeString(data.author) !== ''
    ? normalizeString(data.author)
    : 'अज्ञात';

  return {
    id,
    title,
    subtitle: typeof data.subtitle === 'string' && normalizeString(data.subtitle) !== ''
      ? normalizeString(data.subtitle)
      : null,
    author,
    dedication: typeof data.dedication === 'string' && normalizeString(data.dedication) !== ''
      ? normalizeString(data.dedication)
      : null,
    description: typeof data.description === 'string' && normalizeString(data.description) !== ''
      ? normalizeString(data.description)
      : null,
    language: typeof data.language === 'string' && data.language.trim() !== ''
      ? data.language.trim().toLowerCase()
      : 'hi',
    cover: createCoverConfig({
      ...(data.cover || {}),
      title: (data.cover && data.cover.title) || title,
      author: (data.cover && data.cover.author) || author,
      subtitle: (data.cover && data.cover.subtitle) || (typeof data.subtitle === 'string' ? data.subtitle : null)
    }),
    sections,
    poemIds,
    ordering: {
      sectionOrder: sections.map(s => s.id)
    },
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now
  };
}

/**
 * Creates an export-neutral BookDocument representation
 * Note: This is an in-memory generation contract and is NEVER persisted into storage.
 * @param {Object} data
 * @returns {Object}
 */
export function createBookDocument(data = {}) {
  const metadata = data.metadata || {};
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const stats = data.stats || {
    totalSections: sections.length,
    totalPoems: 0,
    missingPoemsCount: 0,
    wordCount: 0,
    verseCount: 0
  };
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];

  return {
    id: data.id || null,
    metadata: {
      title: metadata.title || '',
      subtitle: metadata.subtitle || null,
      author: metadata.author || 'अज्ञात',
      dedication: metadata.dedication || null,
      description: metadata.description || null,
      language: metadata.language || 'hi',
      cover: metadata.cover || null,
      createdAt: metadata.createdAt || null,
      updatedAt: metadata.updatedAt || null
    },
    sections,
    stats,
    warnings,
    generatedAt: data.generatedAt || new Date().toISOString()
  };
}
