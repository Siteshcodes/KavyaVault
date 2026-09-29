/**
 * काव्यकलश (KavyaVault) — Book Project Service (BookProjectService.js)
 * Phase 7 / Task 7.1: Book Project Foundation
 *
 * High-level domain service orchestrating book project operations:
 * - Book lifecycle: create, get, list, update metadata, delete
 * - Section management: add, update, remove, reorder
 * - Poem ordering: add, remove, move up, move down, reorder
 * - Library selection: construct books from collections, categories, tags, favorites, explicit IDs
 * - Export-neutral generation: assemble live BookDocument with missing-poem resilience
 *
 * Adheres strictly to the local-first, privacy-first, non-destructive architecture.
 * BookProjects store LIVE poem references and never duplicate poem bodies into persistent storage.
 */

import { BookProjectRepository, bookProjectRepository } from './BookProjectRepository.js';
import { PoemRepository, poemRepository } from '../PoemRepository.js';
import { CollectionRepository, collectionRepository } from '../CollectionRepository.js';
import { TagService, tagService } from '../library/TagService.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';
import {
  createBookProject,
  validateBookProject,
  createBookSection,
  validateBookSection,
  createBookDocument,
  normalizeString,
  generateSectionId
} from './bookTypes.js';

/**
 * Deep clones any JSON-serializable object
 * @param {*} data
 * @returns {*}
 */
function deepClone(data) {
  if (data === null || data === undefined) return data;
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

export class BookProjectService {
  /**
   * @param {Object} [options={}]
   * @param {BookProjectRepository} [options.bookRepo]
   * @param {PoemRepository} [options.poemRepo]
   * @param {CollectionRepository} [options.collectionRepo]
   * @param {TagService} [options.tagService]
   */
  constructor(options = {}) {
    this.bookRepo = options.bookRepo || bookProjectRepository;
    this.poemRepo = options.poemRepo || poemRepository;
    this.collectionRepo = options.collectionRepo || collectionRepository;
    this.tagService = options.tagService || tagService;
  }

  // ==========================================================================
  // 1. BOOK PROJECT LIFECYCLE
  // ==========================================================================

  /**
   * Creates a new book project
   * @param {Object} data
   * @returns {Object} Created book project
   */
  createBook(data) {
    return this.bookRepo.create(data);
  }

  /**
   * Retrieves a single book project by ID
   * @param {string} id
   * @returns {Object|null}
   */
  getBook(id) {
    return this.bookRepo.get(id);
  }

  /**
   * Retrieves all book projects
   * @returns {Array<Object>}
   */
  getAllBooks() {
    return this.bookRepo.getAll();
  }

  /**
   * Updates metadata of an existing book project
   * @param {string} id
   * @param {Object} metadata
   * @returns {Object} Updated book project
   */
  updateBookMetadata(id, metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new StorageError('मेटाडेटा ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const allowed = {};
    if (metadata.title !== undefined) allowed.title = metadata.title;
    if (metadata.subtitle !== undefined) allowed.subtitle = metadata.subtitle;
    if (metadata.author !== undefined) allowed.author = metadata.author;
    if (metadata.dedication !== undefined) allowed.dedication = metadata.dedication;
    if (metadata.description !== undefined) allowed.description = metadata.description;
    if (metadata.language !== undefined) allowed.language = metadata.language;
    if (metadata.cover !== undefined) allowed.cover = metadata.cover;

    return this.bookRepo.update(id, allowed);
  }

  /**
   * Deletes a book project by ID
   * Non-destructive: Strictly deletes the book record only, never deleting referenced poems.
   * @param {string} id
   * @returns {boolean} True if deleted, false if not found
   */
  deleteBook(id) {
    return this.bookRepo.delete(id);
  }

  // ==========================================================================
  // 2. SECTION MANAGEMENT
  // ==========================================================================

  /**
   * Adds a new section to an existing book project
   * @param {string} bookId
   * @param {Object} sectionData
   * @returns {Object} Updated book project
   */
  addSection(bookId, sectionData) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    validateBookSection(sectionData);

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const newSection = createBookSection({
      ...sectionData,
      order: sections.length
    });

    if (sections.some(s => s.id === newSection.id)) {
      throw new StorageError(
        `खण्ड आईडी "${newSection.id}" पहले से उपस्थित है।`,
        StorageErrorCode.DUPLICATE_ID,
        null,
        { sectionId: newSection.id }
      );
    }

    sections.push(newSection);
    return this.bookRepo.update(bookId, { sections });
  }

  /**
   * Updates an existing section in a book project
   * @param {string} bookId
   * @param {string} sectionId
   * @param {Object} sectionData
   * @returns {Object} Updated book project
   */
  updateSection(bookId, sectionId, sectionData) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const index = sections.findIndex(s => s.id === sectionId);
    if (index === -1) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    const current = sections[index];
    if (sectionData.title !== undefined) {
      if (typeof sectionData.title !== 'string' || normalizeString(sectionData.title) === '') {
        throw new StorageError('खण्ड का शीर्षक रिक्त नहीं हो सकता।', StorageErrorCode.VALIDATION_ERROR);
      }
    }

    sections[index] = {
      ...current,
      title: sectionData.title !== undefined ? normalizeString(sectionData.title) : current.title,
      description: sectionData.description !== undefined
        ? (typeof sectionData.description === 'string' && normalizeString(sectionData.description) !== '' ? normalizeString(sectionData.description) : null)
        : current.description,
      updatedAt: new Date().toISOString()
    };

    return this.bookRepo.update(bookId, { sections });
  }

  /**
   * Deletes a section from a book project
   * Non-destructive: Does not delete referenced poems from PoemRepository.
   * @param {string} bookId
   * @param {string} sectionId
   * @returns {Object} Updated book project
   */
  deleteSection(bookId, sectionId) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = (book.sections || []).filter(s => s.id !== sectionId);
    // Re-index orders deterministically
    sections.forEach((sec, idx) => {
      sec.order = idx;
    });

    return this.bookRepo.update(bookId, { sections });
  }

  // ==========================================================================
  // 3. POEM ORDERING & SECTION MEMBERSHIP
  // ==========================================================================

  /**
   * Adds a poem reference to a specific section
   * Idempotent within the section: duplicate additions do not create duplicate poem entries.
   * @param {string} bookId
   * @param {string} sectionId
   * @param {string} poemId
   * @returns {Object} Updated book project
   */
  addPoemToSection(bookId, sectionId, poemId) {
    if (typeof poemId !== 'string' || poemId.trim() === '') {
      throw new StorageError('रचना आईडी मान्य स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    const trimmedPid = poemId.trim();
    if (!section.poemIds.includes(trimmedPid)) {
      section.poemIds.push(trimmedPid);
      section.updatedAt = new Date().toISOString();
      return this.bookRepo.update(bookId, { sections });
    }

    return book;
  }

  /**
   * Removes a poem reference from a specific section
   * Non-destructive: Strictly removes reference from section, never deleting the poem itself.
   * @param {string} bookId
   * @param {string} sectionId
   * @param {string} poemId
   * @returns {Object} Updated book project
   */
  removePoemFromSection(bookId, sectionId, poemId) {
    if (typeof poemId !== 'string' || poemId.trim() === '') {
      throw new StorageError('रचना आईडी मान्य स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    const trimmedPid = poemId.trim();
    const initialLen = section.poemIds.length;
    section.poemIds = section.poemIds.filter(pid => pid !== trimmedPid);

    if (section.poemIds.length !== initialLen) {
      section.updatedAt = new Date().toISOString();
      return this.bookRepo.update(bookId, { sections });
    }

    return book;
  }

  /**
   * Reorders all sections in a book project
   * @param {string} bookId
   * @param {Array<string>} sectionIds - Ordered array of section IDs
   * @returns {Object} Updated book project
   */
  reorderSections(bookId, sectionIds) {
    if (!Array.isArray(sectionIds)) {
      throw new StorageError('खण्ड आईडी सूची एक ऐरे होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    if (sectionIds.length !== sections.length) {
      throw new StorageError('खण्ड सूची में सभी उपस्थित खण्ड सम्मिलित होने चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const sectionMap = new Map(sections.map(s => [s.id, s]));
    const reordered = [];

    for (let idx = 0; idx < sectionIds.length; idx++) {
      const sid = sectionIds[idx];
      const sec = sectionMap.get(sid);
      if (!sec) {
        throw new StorageError(`अज्ञात खण्ड आईडी: "${sid}"`, StorageErrorCode.VALIDATION_ERROR);
      }
      sec.order = idx;
      sec.updatedAt = new Date().toISOString();
      reordered.push(sec);
      sectionMap.delete(sid);
    }

    return this.bookRepo.update(bookId, { sections: reordered });
  }

  /**
   * Reorders poems within a specific section
   * @param {string} bookId
   * @param {string} sectionId
   * @param {Array<string>} poemIds - Ordered array of poem IDs
   * @returns {Object} Updated book project
   */
  reorderPoems(bookId, sectionId, poemIds) {
    if (!Array.isArray(poemIds)) {
      throw new StorageError('रचना आईडी सूची एक ऐरे होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    const currentSet = new Set(section.poemIds);
    if (poemIds.length !== currentSet.size) {
      throw new StorageError('रचना क्रम में खण्ड की सभी रचनाएँ सम्मिलित होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }

    const checked = new Set();
    for (const pid of poemIds) {
      if (!currentSet.has(pid) || checked.has(pid)) {
        throw new StorageError(`अमान्य या डुप्लीकेट रचना आईडी: "${pid}"`, StorageErrorCode.VALIDATION_ERROR);
      }
      checked.add(pid);
    }

    section.poemIds = [...poemIds];
    section.updatedAt = new Date().toISOString();

    return this.bookRepo.update(bookId, { sections });
  }

  /**
   * Moves a section up by one position
   * @param {string} bookId
   * @param {string} sectionId
   * @returns {Object} Updated book project
   */
  moveSectionUp(bookId, sectionId) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const index = sections.findIndex(s => s.id === sectionId);
    if (index === -1) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    if (index === 0) return book; // Already at the top

    // Swap
    const temp = sections[index - 1];
    sections[index - 1] = sections[index];
    sections[index] = temp;

    sections.forEach((sec, idx) => {
      sec.order = idx;
    });

    return this.bookRepo.update(bookId, { sections });
  }

  /**
   * Moves a section down by one position
   * @param {string} bookId
   * @param {string} sectionId
   * @returns {Object} Updated book project
   */
  moveSectionDown(bookId, sectionId) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const index = sections.findIndex(s => s.id === sectionId);
    if (index === -1) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    if (index >= sections.length - 1) return book; // Already at the bottom

    // Swap
    const temp = sections[index + 1];
    sections[index + 1] = sections[index];
    sections[index] = temp;

    sections.forEach((sec, idx) => {
      sec.order = idx;
    });

    return this.bookRepo.update(bookId, { sections });
  }

  /**
   * Moves a poem up by one position within a section
   * @param {string} bookId
   * @param {string} sectionId
   * @param {string} poemId
   * @returns {Object} Updated book project
   */
  movePoemUp(bookId, sectionId, poemId) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    const index = section.poemIds.indexOf(poemId);
    if (index === -1) {
      throw new StorageError(`रचना आईडी "${poemId}" इस खण्ड में नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { poemId });
    }

    if (index === 0) return book; // Already at top of section

    const temp = section.poemIds[index - 1];
    section.poemIds[index - 1] = section.poemIds[index];
    section.poemIds[index] = temp;
    section.updatedAt = new Date().toISOString();

    return this.bookRepo.update(bookId, { sections });
  }

  /**
   * Moves a poem down by one position within a section
   * @param {string} bookId
   * @param {string} sectionId
   * @param {string} poemId
   * @returns {Object} Updated book project
   */
  movePoemDown(bookId, sectionId, poemId) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    const index = section.poemIds.indexOf(poemId);
    if (index === -1) {
      throw new StorageError(`रचना आईडी "${poemId}" इस खण्ड में नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { poemId });
    }

    if (index >= section.poemIds.length - 1) return book; // Already at bottom of section

    const temp = section.poemIds[index + 1];
    section.poemIds[index + 1] = section.poemIds[index];
    section.poemIds[index] = temp;
    section.updatedAt = new Date().toISOString();

    return this.bookRepo.update(bookId, { sections });
  }

  // ==========================================================================
  // 4. SELECTION FROM EXISTING LIBRARY
  // ==========================================================================

  /**
   * Resolves poem IDs from a selection criteria descriptor without copying poem bodies
   * Supports:
   * - selection.poemIds: explicit IDs
   * - selection.collectionId: IDs from collection
   * - selection.category: IDs matching poem category
   * - selection.tag / selection.tags: IDs matching normalized tags
   * - selection.isFavorite / selection.favorites: favorite poem IDs
   * @param {Object} selection
   * @returns {Array<string>} Deduplicated array of referenced poem IDs
   */
  resolvePoemIdsFromSelection(selection = {}) {
    if (!selection || typeof selection !== 'object') return [];

    let candidateIds = [];

    // 1. Explicit poem IDs
    if (Array.isArray(selection.poemIds)) {
      candidateIds.push(...selection.poemIds.filter(id => typeof id === 'string' && id.trim() !== ''));
    }

    // 2. Collection selection
    if (typeof selection.collectionId === 'string' && selection.collectionId.trim() !== '') {
      const colId = selection.collectionId.trim();
      const col = typeof this.collectionRepo.getById === 'function'
        ? this.collectionRepo.getById(colId)
        : (typeof this.collectionRepo.get === 'function' ? this.collectionRepo.get(colId) : null);
      if (col && Array.isArray(col.poemIds)) {
        candidateIds.push(...col.poemIds);
      }
    }

    // 3. Category selection
    if (typeof selection.category === 'string' && selection.category.trim() !== '') {
      const targetCat = normalizeString(selection.category);
      const allPoems = this.poemRepo.getAll({ includeArchived: Boolean(selection.includeArchived) });
      const matched = allPoems.filter(p => p.category && normalizeString(p.category) === targetCat);
      candidateIds.push(...matched.map(p => p.id));
    }

    // 4. Tag selection
    if (selection.tag || Array.isArray(selection.tags)) {
      const normalizeTagHelper = (tagStr) => {
        if (this.tagService && typeof this.tagService.normalize === 'function') {
          return this.tagService.normalize(tagStr);
        }
        if (this.tagService && typeof this.tagService.normalizeTagName === 'function') {
          return this.tagService.normalizeTagName(tagStr);
        }
        let cleaned = String(tagStr).normalize('NFC').trim();
        if (cleaned.startsWith('#')) cleaned = cleaned.substring(1).trim();
        return cleaned.toLowerCase();
      };

      const rawTags = Array.isArray(selection.tags) ? selection.tags : [selection.tag];
      const targetNormTags = rawTags
        .filter(t => typeof t === 'string' && t.trim() !== '')
        .map(t => normalizeTagHelper(t));

      if (targetNormTags.length > 0) {
        const allPoems = this.poemRepo.getAll({ includeArchived: Boolean(selection.includeArchived) });
        const matched = allPoems.filter(p => {
          if (!Array.isArray(p.tags) || p.tags.length === 0) return false;
          return p.tags.some(pt => targetNormTags.includes(normalizeTagHelper(pt)));
        });
        candidateIds.push(...matched.map(p => p.id));
      }
    }

    // 5. Favorites selection
    if (selection.isFavorite === true || selection.favorites === true) {
      const allPoems = this.poemRepo.getAll({ includeArchived: Boolean(selection.includeArchived) });
      const favorites = allPoems.filter(p => Boolean(p.isFavorite));
      candidateIds.push(...favorites.map(p => p.id));
    }

    // Deduplicate while preserving resolution order
    const seen = new Set();
    const result = [];
    for (const id of candidateIds) {
      const trimmed = typeof id === 'string' ? id.trim() : '';
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        result.push(trimmed);
      }
    }

    return result;
  }

  /**
   * Constructs a new book project from existing library selections
   * Non-destructive: Copies references only, never poem bodies.
   * @param {Object} metadata - Book metadata (title, author, subtitle, etc.)
   * @param {Object} selection - Selection criteria
   * @returns {Object} Created book project
   */
  createBookFromSelection(metadata = {}, selection = {}) {
    const poemIds = this.resolvePoemIdsFromSelection(selection);
    const sectionTitle = typeof selection.sectionTitle === 'string' && normalizeString(selection.sectionTitle) !== ''
      ? normalizeString(selection.sectionTitle)
      : 'संकलित रचनाएँ';

    const section = createBookSection({
      id: generateSectionId(),
      title: sectionTitle,
      description: typeof selection.sectionDescription === 'string' ? normalizeString(selection.sectionDescription) : null,
      poemIds,
      order: 0
    });

    return this.createBook({
      ...metadata,
      sections: [section]
    });
  }

  /**
   * Adds library selection references into an existing book section
   * @param {string} bookId
   * @param {string} sectionId
   * @param {Object} selection
   * @returns {Object} Updated book project
   */
  addSelectionToSection(bookId, sectionId, selection = {}) {
    const newPoemIds = this.resolvePoemIdsFromSelection(selection);
    if (newPoemIds.length === 0) return this.bookRepo.get(bookId);

    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const sections = Array.isArray(book.sections) ? [...book.sections] : [];
    const section = sections.find(s => s.id === sectionId);
    if (!section) {
      throw new StorageError(`खण्ड आईडी "${sectionId}" नहीं मिला।`, StorageErrorCode.NOT_FOUND, null, { sectionId });
    }

    const existingSet = new Set(section.poemIds);
    let addedCount = 0;
    for (const pid of newPoemIds) {
      if (!existingSet.has(pid)) {
        section.poemIds.push(pid);
        existingSet.add(pid);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      section.updatedAt = new Date().toISOString();
      return this.bookRepo.update(bookId, { sections });
    }

    return book;
  }

  // ==========================================================================
  // 5. EXPORT-NEUTRAL BOOK DOCUMENT GENERATION
  // ==========================================================================

  /**
   * Generates a live, export-neutral BookDocument by resolving poem references from PoemRepository
   *
   * Crucial Guarantees:
   * - Pure in-memory generation contract: does NOT persist duplicated poem bodies in BookProject storage.
   * - Missing-poem resilience: handles missing/deleted/stale poem references gracefully without crashing.
   * - Does NOT fabricate synthetic poems or silently replace missing poems.
   * - Gathers warnings for missing or archived references.
   *
   * @param {string} bookId
   * @param {Object} [options={}]
   * @param {boolean} [options.includeArchived=true] - Whether to include archived poems
   * @returns {Object} BookDocument
   */
  generateBookDocument(bookId, options = {}) {
    const book = this.bookRepo.get(bookId);
    if (!book) {
      throw new StorageError(`पुस्तक आईडी "${bookId}" नहीं मिली।`, StorageErrorCode.NOT_FOUND, null, { bookId });
    }

    const includeArchived = options.includeArchived !== false; // Default true for author's explicit book assembly

    // Retrieve all live poems into a Map for fast lookup
    const allPoems = this.poemRepo.getAll({ includeArchived: true });
    const poemMap = new Map(allPoems.map(p => [p.id, p]));

    const warnings = [];
    let totalResolvedPoems = 0;
    let totalMissingPoems = 0;
    let totalWordCount = 0;
    let totalVerseCount = 0;

    const sections = (book.sections || []).map(section => {
      const sectionPoems = [];
      const missingPoemIds = [];

      for (const pid of (section.poemIds || [])) {
        const poem = poemMap.get(pid);

        if (!poem) {
          missingPoemIds.push(pid);
          totalMissingPoems++;
          warnings.push(`खण्ड ‘${section.title}’: रचना आईडी "${pid}" पुस्तकालय में नहीं मिली (हटा दी गई या अनुपलब्ध)।`);
          continue;
        }

        if (poem.isArchived && !includeArchived) {
          warnings.push(`खण्ड ‘${section.title}’: रचना ‘${poem.title}’ अभिलेखागार में है और इसे छोड़ दिया गया है।`);
          continue;
        }

        if (poem.isArchived) {
          warnings.push(`खण्ड ‘${section.title}’: रचना ‘${poem.title}’ अभिलेखागार से सम्मिलित की गई है।`);
        }

        // Live resolved poem (deep-cloned to protect repository state)
        const resolvedPoem = deepClone(poem);
        sectionPoems.push(resolvedPoem);
        totalResolvedPoems++;

        // Metric computations
        const body = typeof resolvedPoem.body === 'string' ? resolvedPoem.body : '';
        const lines = body.split('\n').filter(l => l.trim().length > 0);
        const words = body.trim().split(/\s+/).filter(Boolean);
        totalVerseCount += lines.length;
        totalWordCount += words.length;
      }

      return {
        id: section.id,
        title: section.title,
        description: section.description,
        order: section.order,
        poems: sectionPoems,
        missingPoemIds
      };
    });

    const stats = {
      totalSections: sections.length,
      totalPoems: totalResolvedPoems,
      missingPoemsCount: totalMissingPoems,
      wordCount: totalWordCount,
      verseCount: totalVerseCount
    };

    return createBookDocument({
      id: book.id,
      metadata: {
        title: book.title,
        subtitle: book.subtitle,
        author: book.author,
        dedication: book.dedication,
        description: book.description,
        language: book.language,
        cover: deepClone(book.cover),
        createdAt: book.createdAt,
        updatedAt: book.updatedAt
      },
      sections,
      stats,
      warnings,
      generatedAt: new Date().toISOString()
    });
  }

  // ==========================================================================
  // 6. LIBRARY MEDIATION FOR BOOK CURATION
  // ==========================================================================

  /**
   * Retrieves a single poem by ID from the library for book curation/display
   * Domain-mediated access decoupling UI from direct repository imports
   * @param {string} id
   * @returns {Object|null}
   */
  getPoem(id) {
    if (!id || typeof id !== 'string') return null;
    return this.poemRepo ? this.poemRepo.getById(id.trim()) : null;
  }

  /**
   * Retrieves library poems for book curation and poem picker
   * Domain-mediated access decoupling UI from direct repository imports
   * @param {Object} [options={}]
   * @param {boolean} [options.includeArchived=true]
   * @returns {Array<Object>}
   */
  getLibraryPoems(options = {}) {
    const includeArchived = options.includeArchived !== false;
    return this.poemRepo ? this.poemRepo.getAll({ includeArchived }) : [];
  }
}

export const bookProjectService = new BookProjectService();
