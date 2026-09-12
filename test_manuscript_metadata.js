/**
 * KavyaVault (काव्यकलश) — Phase 2 / Task 2.8 Test Suite
 * Manuscript Archival Metadata & Provenance Hardening
 *
 * Covers all 37 verification specifications:
 *  1. existing provenance remains readable
 *  2. null provenance normalizes safely
 *  3. valid source accepted
 *  4. invalid source rejected
 *  5. valid acquisitionMethod accepted
 *  6. invalid acquisitionMethod rejected
 *  7. valid recordedAt accepted
 *  8. invalid recordedAt rejected
 *  9. notes require string type
 * 10. optional recordedBy validation
 * 11. optional location validation
 * 12. metadata update persists
 * 13. metadata update changes updatedAt
 * 14. original image bytes unchanged
 * 15. original artifact metadata unchanged
 * 16. derived image unchanged
 * 17. transformation unchanged
 * 18. transcription unchanged
 * 19. transcription history unchanged
 * 20. poem relationship unchanged
 * 21. legacy provenance migration works
 * 22. missing provenance fields recover safely
 * 23. no fabricated dates are introduced
 * 24. Unicode Hindi provenance preserved
 * 25. XSS-safe metadata rendering
 * 26. reader displays archival metadata
 * 27. linked poem display preserved
 * 28. unlinked poem state preserved
 * 29. verified transcription metadata displayed
 * 30. malformed archival metadata does not crash reads
 * 31. persistence survives reload
 * 32. quota/storage failure preserves previous valid metadata
 * 33. metadata editor loads current values
 * 34. metadata editor save flow works
 * 35. metadata editor validation errors render correctly
 * 36. accessibility labels exist
 * 37. archival reassurance block renders
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import {
  ManuscriptRepository,
  VALID_PROVENANCE_SOURCES,
  VALID_ACQUISITION_METHODS
} from './src/services/ManuscriptRepository.js';
import { ManuscriptView } from './src/components/manuscripts/ManuscriptView.js';
import { PoemReader } from './src/components/reader/PoemReader.js';
import { STORAGE_KEYS } from './src/data/storageKeys.js';

// In-memory mock storage
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
  }
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

// Rich MockElement for Component Tests
class MockElement {
  constructor(tag = 'div', attributes = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attributes };
    this._innerHTML = '';
    this.listeners = new Map();
    this.style = {};
    this.value = attributes.value || '';
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
  }

  getAttribute(attr) {
    return this.attributes[attr] !== undefined ? this.attributes[attr] : null;
  }

  setAttribute(attr, val) {
    this.attributes[attr] = String(val);
  }

  removeAttribute(attr) {
    delete this.attributes[attr];
  }

  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(h => h !== handler));
  }

  closest(selector) {
    if (selector.startsWith('[data-action="')) {
      const match = selector.match(/\[data-action="([^"]+)"\]/);
      if (match && this.getAttribute('data-action') === match[1]) {
        return this;
      }
    }
    return null;
  }

  querySelector(selector) {
    if (this._childrenMap && this._childrenMap.has(selector)) {
      return this._childrenMap.get(selector);
    }
    return null;
  }

  querySelectorAll(selector) {
    if (this._childrenMap && this._childrenMap.has(selector)) {
      return [this._childrenMap.get(selector)];
    }
    return [];
  }

  registerMockChild(selector, element) {
    if (!this._childrenMap) this._childrenMap = new Map();
    this._childrenMap.set(selector, element);
  }
}

const SAMPLE_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SAMPLE_DERIVED_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M/AwMDEwMAAAAcAAwEqw8IAAAAASUVORK5CYII=';

async function runMetadataTests() {
  console.log('\n================================================================');
  console.log('  KAVYAVAULT ARCHIVE METADATA & PROVENANCE TEST SUITE');
  console.log('  (Phase 2 / Task 2.8)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ [Test ${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [Test ${total}] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  function createTestRepositories(customStorage = null) {
    const storage = customStorage || new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const poemRepo = new PoemRepository(adapter);
    const manuscriptRepo = new ManuscriptRepository(adapter, poemRepo);
    return { storage, adapter, poemRepo, manuscriptRepo };
  }

  // --- Group 1: Repository Provenance Read & Migration Normalization ---
  console.log('--- Group 1: Provenance Read & Migration Normalization ---');

  test('1. existing provenance remains readable', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'प्राचीन दोहे',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: {
        source: 'handwritten-manuscript',
        recordedAt: '2026-08-15T10:00:00.000Z',
        notes: 'कवि की पारिवारिक डायरी से प्राप्त'
      }
    });

    const fetched = manuscriptRepo.getById(ms.id);
    assert(fetched !== null, 'Manuscript must be fetched');
    assert(fetched.provenance.source === 'handwritten-manuscript', 'Source remains readable');
    assert(fetched.provenance.recordedAt === '2026-08-15T10:00:00.000Z', 'recordedAt remains readable');
    assert(fetched.provenance.notes === 'कवि की पारिवारिक डायरी से प्राप्त', 'Notes remain readable');
  });

  test('2. null provenance normalizes safely', () => {
    const storage = new MockStorage();
    const { manuscriptRepo } = createTestRepositories(storage);
    // Seed raw manuscript record with provenance: null
    const rawRecord = {
      id: 'kv_ms_legacy_null',
      title: 'अभिलेख बिना उद्गम',
      originalManuscript: { id: 'art_1', mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    storage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify([rawRecord]));

    const fetched = manuscriptRepo.getById('kv_ms_legacy_null');
    assert(fetched !== null, 'Record must be read safely');
    assert(typeof fetched.provenance === 'object' && fetched.provenance !== null, 'Provenance normalized to object');
    assert(fetched.provenance.source === null, 'source normalized to null');
    assert(fetched.provenance.recordedAt === null, 'recordedAt normalized to null');
    assert(fetched.provenance.notes === '', 'notes normalized to empty string');
    assert(fetched.provenance.recordedBy === null, 'recordedBy normalized to null');
    assert(fetched.provenance.location === null, 'location normalized to null');
    assert(fetched.provenance.acquisitionMethod === null, 'acquisitionMethod normalized to null');
  });

  test('3. valid source accepted', () => {
    const { manuscriptRepo } = createTestRepositories();
    for (const validSrc of ['handwritten-manuscript', 'scanned-document', 'camera-capture', 'imported-image', 'other']) {
      const ms = manuscriptRepo.create({
        title: `परीक्षण ${validSrc}`,
        originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
        provenance: { source: validSrc }
      });
      assert(ms.provenance.source === validSrc, `Source ${validSrc} accepted on create`);
    }
  });

  test('4. invalid source rejected', () => {
    const { manuscriptRepo } = createTestRepositories();
    let threw = false;
    try {
      manuscriptRepo.create({
        title: 'अमान्य स्रोत',
        originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
        provenance: { source: 'invented-magic-source' }
      });
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR) {
        threw = true;
      }
    }
    assert(threw, 'Invalid source must throw StorageError VALIDATION_ERROR');
  });

  test('5. valid acquisitionMethod accepted', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'पुस्तिका स्कैन',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    for (const method of VALID_ACQUISITION_METHODS) {
      const updated = manuscriptRepo.updateMetadata(ms.id, {
        provenance: { acquisitionMethod: method }
      });
      assert(updated.provenance.acquisitionMethod === method, `Acquisition method ${method} accepted`);
    }
  });

  test('6. invalid acquisitionMethod rejected', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'अमान्य माध्यम परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    let threw = false;
    try {
      manuscriptRepo.updateMetadata(ms.id, {
        provenance: { acquisitionMethod: 'telepathic-scan' }
      });
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR) {
        threw = true;
      }
    }
    assert(threw, 'Invalid acquisitionMethod must throw VALIDATION_ERROR');
  });

  test('7. valid recordedAt accepted', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'दिनांक परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const validIso = '2026-07-20T14:30:00.000Z';
    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { recordedAt: validIso }
    });
    assert(updated.provenance.recordedAt === validIso, 'Valid ISO recordedAt accepted');
  });

  test('8. invalid recordedAt rejected', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'गलत दिनांक',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    let threw = false;
    try {
      manuscriptRepo.updateMetadata(ms.id, {
        provenance: { recordedAt: 'not-an-iso-date' }
      });
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR) {
        threw = true;
      }
    }
    assert(threw, 'Invalid recordedAt must throw VALIDATION_ERROR');
  });

  test('9. notes require string type', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'टिप्पणी प्रकार',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    let threw = false;
    try {
      manuscriptRepo.updateMetadata(ms.id, {
        provenance: { notes: 12345 }
      });
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR) {
        threw = true;
      }
    }
    assert(threw, 'Non-string notes must throw VALIDATION_ERROR');
  });

  test('10. optional recordedBy validation', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'अभिलेखक परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { recordedBy: 'आचार्य रामचंद्र शुक्ल' }
    });
    assert(updated.provenance.recordedBy === 'आचार्य रामचंद्र शुक्ल', 'Valid recordedBy string accepted');

    let threw = false;
    try {
      manuscriptRepo.updateMetadata(ms.id, {
        provenance: { recordedBy: { invalid: true } }
      });
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR) {
        threw = true;
      }
    }
    assert(threw, 'Non-string recordedBy must throw VALIDATION_ERROR');
  });

  test('11. optional location validation', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'स्थान परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { location: 'काशी नागरी प्रचारिणी सभा, वाराणसी' }
    });
    assert(updated.provenance.location === 'काशी नागरी प्रचारिणी सभा, वाराणसी', 'Valid location string accepted');

    let threw = false;
    try {
      manuscriptRepo.updateMetadata(ms.id, {
        provenance: { location: [1, 2, 3] }
      });
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR) {
        threw = true;
      }
    }
    assert(threw, 'Non-string location must throw VALIDATION_ERROR');
  });

  // --- Group 2: Immutability & Preservation Contracts ---
  console.log('--- Group 2: Immutability & Preservation Contracts ---');

  test('12. metadata update persists', () => {
    const storage = new MockStorage();
    const { manuscriptRepo: repo1 } = createTestRepositories(storage);
    const ms = repo1.create({
      title: 'स्थायित्व परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: { source: 'handwritten-manuscript', notes: 'शुरुआती टिप्पणी' }
    });

    repo1.updateMetadata(ms.id, {
      provenance: {
        source: 'scanned-document',
        acquisitionMethod: 'desktop-upload',
        notes: 'अद्यतन की गई टिप्पणी',
        location: 'प्रयागराज'
      }
    });

    const { manuscriptRepo: repo2 } = createTestRepositories(storage);
    const reloaded = repo2.getById(ms.id);
    assert(reloaded.provenance.source === 'scanned-document', 'source persisted');
    assert(reloaded.provenance.acquisitionMethod === 'desktop-upload', 'acquisitionMethod persisted');
    assert(reloaded.provenance.notes === 'अद्यतन की गई टिप्पणी', 'notes persisted');
    assert(reloaded.provenance.location === 'प्रयागराज', 'location persisted');
  });

  test('13. metadata update changes updatedAt', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'अपडेटेडएट परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    const originalUpdatedAt = ms.updatedAt;
    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { notes: 'नई टिप्पणी' }
    });

    assert(updated.updatedAt !== originalUpdatedAt, 'updatedAt must change on metadata update');
    assert(!isNaN(Date.parse(updated.updatedAt)), 'updatedAt must be a valid ISO date');
    assert(new Date(updated.updatedAt).getTime() >= new Date(originalUpdatedAt).getTime(), 'updatedAt must be newer');
  });

  test('14. original image bytes unchanged', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'मूल बाइट्स सुरक्षा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const origBytesBefore = ms.originalManuscript.data;
    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: {
        source: 'camera-capture',
        notes: 'बाइट्स अपरिवर्तित रहने चाहिए'
      }
    });

    assert(updated.originalManuscript.data === origBytesBefore, 'Original image bytes must remain 100% untouched');
  });

  test('15. original artifact metadata unchanged', () => {
    const { manuscriptRepo } = createTestRepositories();
    const capturedTimestamp = '2026-05-10T08:15:00.000Z';
    const ms = manuscriptRepo.create({
      title: 'आर्टिफ़ैक्ट मेटाडेटा',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_IMAGE_BASE64,
        filename: 'manuscript_scan_01.png',
        capturedAt: capturedTimestamp
      }
    });

    const origId = ms.originalManuscript.id;
    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { notes: 'अभिलेखीय अद्यतन' }
    });

    assert(updated.originalManuscript.id === origId, 'originalManuscript.id remains identical');
    assert(updated.originalManuscript.filename === 'manuscript_scan_01.png', 'filename remains identical');
    assert(updated.originalManuscript.capturedAt === capturedTimestamp, 'capturedAt remains identical');
    assert(updated.originalManuscript.mimeType === 'image/png', 'mimeType remains identical');
  });

  test('16. derived image unchanged', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'संपादित प्रति सुरक्षा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    manuscriptRepo.saveDerivedManuscript(
      ms.id,
      { mimeType: 'image/png', data: SAMPLE_DERIVED_BASE64, sourceArtifactId: ms.originalManuscript.id },
      { rotation: 90, crop: null }
    );

    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { notes: 'मेटाडेटा बदला' }
    });

    assert(updated.derivedManuscript !== null, 'Derived manuscript exists');
    assert(updated.derivedManuscript.data === SAMPLE_DERIVED_BASE64, 'Derived image data remains identical');
  });

  test('17. transformation unchanged', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'रूपांतरण सुरक्षा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    manuscriptRepo.saveDerivedManuscript(
      ms.id,
      { mimeType: 'image/png', data: SAMPLE_DERIVED_BASE64, sourceArtifactId: ms.originalManuscript.id },
      { rotation: 180, crop: { x: 10, y: 10, width: 50, height: 50 } }
    );

    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { source: 'other' }
    });

    assert(updated.transformation.rotation === 180, 'Rotation unchanged');
    assert(updated.transformation.crop.width === 50, 'Crop unchanged');
  });

  test('18. transcription unchanged', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'प्रतिलिपि सुरक्षा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'करत-करत अभ्यास के जड़मति होत सुजान।',
      status: 'draft'
    });

    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { notes: 'उद्गम टिप्पणी' }
    });

    assert(updated.transcription.text === 'करत-करत अभ्यास के जड़मति होत सुजान।', 'Transcription text unchanged');
    assert(updated.transcription.status === 'draft', 'Transcription status unchanged');
  });

  test('19. transcription history unchanged', () => {
    const { manuscriptRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'इतिहास सुरक्षा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण एक', status: 'draft' }, { createVersion: true });
    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण दो', status: 'verified' });

    const historyBefore = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(historyBefore.length === 2, 'History has 2 versions');

    manuscriptRepo.updateMetadata(ms.id, {
      provenance: { notes: 'टिप्पणी अद्यतन' }
    });

    const historyAfter = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(historyAfter.length === 2, 'History count remains identical');
    assert(historyAfter[0].text === 'संस्करण एक', 'v1 text identical');
    assert(historyAfter[1].text === 'संस्करण दो', 'v2 text identical');
  });

  test('20. poem relationship unchanged', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const poem = poemRepo.create({ title: 'मधुशाला', body: 'मदिरालय जाने को घर से चलता है पीने वाला...' });
    const ms = manuscriptRepo.create({
      title: 'मधुशाला पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    manuscriptRepo.linkToPoem(ms.id, poem.id);
    const before = manuscriptRepo.getById(ms.id);
    assert(before.poemId === poem.id, 'Manuscript linked to poem');

    const updated = manuscriptRepo.updateMetadata(ms.id, {
      provenance: { source: 'imported-image', notes: 'हरिवंश राय बच्चन जी के पत्र से' }
    });

    assert(updated.poemId === poem.id, 'poemId remains unchanged after provenance update');
  });

  // --- Group 3: Migration, Dates & Recovery ---
  console.log('--- Group 3: Migration, Dates & Recovery ---');

  test('21. legacy provenance migration works', () => {
    const storage = new MockStorage();
    const { manuscriptRepo } = createTestRepositories(storage);
    const rawRecord = {
      id: 'kv_ms_legacy_src',
      title: 'पुरातन पांडुलिपि',
      originalManuscript: { id: 'art_orig', mimeType: 'image/jpeg', data: SAMPLE_IMAGE_BASE64 },
      provenance: { source: 'handwritten' },
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z'
    };
    storage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify([rawRecord]));

    const fetched = manuscriptRepo.getById('kv_ms_legacy_src');
    assert(fetched.provenance.source === 'handwritten', 'Preserves legacy source name');
    assert(fetched.provenance.notes === '', 'Recovers missing notes safely');
  });

  test('22. missing provenance fields recover safely', () => {
    const storage = new MockStorage();
    const { manuscriptRepo } = createTestRepositories(storage);
    const rawRecord = {
      id: 'kv_ms_partial',
      title: 'आंशिक उद्गम',
      originalManuscript: { id: 'art_p', mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: { source: 'scanned-document' },
      createdAt: '2026-03-01T00:00:00.000Z'
    };
    storage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify([rawRecord]));

    const fetched = manuscriptRepo.getById('kv_ms_partial');
    assert(fetched.provenance.source === 'scanned-document', 'source recovered');
    assert(fetched.provenance.recordedAt === null, 'recordedAt defaulted to null');
    assert(fetched.provenance.notes === '', 'notes defaulted to empty string');
    assert(fetched.provenance.recordedBy === null, 'recordedBy defaulted to null');
    assert(fetched.provenance.location === null, 'location defaulted to null');
    assert(fetched.provenance.acquisitionMethod === null, 'acquisitionMethod defaulted to null');
  });

  test('23. no fabricated dates are introduced', () => {
    const storage = new MockStorage();
    const { manuscriptRepo } = createTestRepositories(storage);
    const rawRecord = {
      id: 'kv_ms_no_dates',
      title: 'तिथिहीन पांडुलिपि',
      originalManuscript: { id: 'art_nd', mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64, capturedAt: null },
      provenance: { source: 'handwritten-manuscript', recordedAt: null, notes: '' },
      createdAt: '2026-04-01T00:00:00.000Z'
    };
    storage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify([rawRecord]));

    const fetched = manuscriptRepo.getById('kv_ms_no_dates');
    assert(fetched.provenance.recordedAt === null, 'recordedAt must NOT be fabricated with today’s date');
    assert(fetched.originalManuscript.capturedAt === null, 'capturedAt must NOT be fabricated');
  });

  test('24. Unicode Hindi provenance preserved', () => {
    const { manuscriptRepo } = createTestRepositories();
    const hindiNotes = 'यह पांडुलिपि गोस्वामी तुलसीदास जी की "रामचरितमानस" की अयोध्या कांड प्रति से प्रेरित है।॥ ॐ नमः शिवाय। ख़ास संकलन!';
    const hindiLocation = 'तुलसी घाट, वाराणसी, उत्तर प्रदेश';
    const hindiRecordedBy = 'पं. विद्याधर त्रिपाठी';

    const ms = manuscriptRepo.create({
      title: 'रामचरितमानस हस्तलेख',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: {
        source: 'handwritten-manuscript',
        notes: hindiNotes,
        location: hindiLocation,
        recordedBy: hindiRecordedBy
      }
    });

    const fetched = manuscriptRepo.getById(ms.id);
    assert(fetched.provenance.notes === hindiNotes, 'Hindi notes with conjuncts and dandas preserved');
    assert(fetched.provenance.location === hindiLocation, 'Hindi location preserved');
    assert(fetched.provenance.recordedBy === hindiRecordedBy, 'Hindi recordedBy preserved');
  });

  // --- Group 4: UI, Security & Accessibility ---
  console.log('--- Group 4: UI, Security & Accessibility ---');

  test('25. XSS-safe metadata rendering', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const maliciousNotes = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const maliciousLocation = '<svg onload=alert("loc")>';
    const maliciousRecordedBy = '<b>Hacker</b>';

    const ms = manuscriptRepo.create({
      title: 'सुरक्षा जाँच',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64, filename: 'attack<script>.png' },
      provenance: {
        source: 'other',
        notes: maliciousNotes,
        location: maliciousLocation,
        recordedBy: maliciousRecordedBy
      }
    });

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });

    view.manuscript = ms;
    const html = view.render();

    assert(!html.includes('<script>alert("xss")</script>'), 'Malicious script tag must NOT be unescaped');
    assert(html.includes('&lt;script&gt;'), 'Notes must be escaped');
    assert(html.includes('&lt;svg onload=alert(&quot;loc&quot;)&gt;'), 'Location must be escaped');
    assert(html.includes('&lt;b&gt;Hacker&lt;/b&gt;'), 'RecordedBy must be escaped');
  });

  test('26. reader displays archival metadata', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const poem = poemRepo.create({ title: 'कामायनी', body: 'हिमगिरि के उत्तुंग शिखर पर...' });
    const ms = manuscriptRepo.create({
      title: 'कामायनी प्रथम प्रारूप',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: {
        source: 'handwritten-manuscript',
        notes: 'जयशंकर प्रसाद जी के संकलन से'
      }
    });
    manuscriptRepo.linkToPoem(ms.id, poem.id);

    const mockContainer = new MockElement();
    const reader = new PoemReader({
      container: mockContainer,
      router: {},
      poemId: poem.id,
      poemRepo,
      manuscriptRepo
    });

    const sectionHtml = reader.renderLinkedManuscriptsSection();
    assert(sectionHtml.includes('हस्तलिखित पांडुलिपि'), 'Reader displays source label in Hindi');
    assert(sectionHtml.includes('जयशंकर प्रसाद जी के संकलन से'), 'Reader displays provenance notes');
  });

  test('27. linked poem display preserved', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const poem = poemRepo.create({ title: 'रश्मिरथी', body: 'दिनकर जी की अमर रचना...' });
    const ms = manuscriptRepo.create({
      title: 'रश्मिरथी हस्तलेख',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });
    manuscriptRepo.linkToPoem(ms.id, poem.id);

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = manuscriptRepo.getById(ms.id);
    const html = view.renderArchivalRecordSection();

    assert(html.includes('रश्मिरथी'), 'Displays linked poem title');
    assert(html.includes('कविता पढ़ें'), 'Displays "कविता पढ़ें" link/button');
  });

  test('28. unlinked poem state preserved', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'असंबंध पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = ms;
    const html = view.renderArchivalRecordSection();

    assert(html.includes('अभी किसी कविता से संबद्ध नहीं'), 'Displays unlinked reassurance text');
  });

  test('29. verified transcription metadata displayed', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'सत्यापित पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'सत्यापित डिजिटल पाठ सामग्री',
      status: 'verified'
    });

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = manuscriptRepo.getById(ms.id);
    const html = view.renderArchivalRecordSection();

    assert(html.includes('प्रमाणित'), 'Displays verified status badge');
    assert(html.includes('सत्यापित:'), 'Displays verification timestamp label');
  });

  test('30. malformed archival metadata does not crash reads', () => {
    const storage = new MockStorage();
    const { manuscriptRepo } = createTestRepositories(storage);
    const corruptedRecord = {
      id: 'kv_ms_corrupt',
      title: 'भ्रष्ट मेटाडेटा',
      originalManuscript: { id: 'art_c', mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: 'this-should-have-been-an-object',
      archival: 9999,
      createdAt: '2026-06-01T00:00:00.000Z'
    };
    storage.setItem(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify([corruptedRecord]));

    let all = [];
    let threw = false;
    try {
      all = manuscriptRepo.getAll();
    } catch (_) {
      threw = true;
    }

    assert(!threw, 'getAll must not crash on malformed provenance/archival');
    assert(all.length === 1, 'Recovers record');
    assert(typeof all[0].provenance === 'object', 'Normalizes provenance safely');
    assert(typeof all[0].archival === 'object', 'Normalizes archival safely');
  });

  test('31. persistence survives reload', () => {
    const storage = new MockStorage();
    const { manuscriptRepo: repo1 } = createTestRepositories(storage);
    const ms = repo1.create({
      title: 'रिलोड परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: {
        source: 'scanned-document',
        acquisitionMethod: 'notebook-scan',
        notes: 'पारिवारिक धरोहर बक्से से',
        location: 'जबलपुर'
      }
    });

    // Fresh instance simulating browser page refresh
    const { manuscriptRepo: repo2 } = createTestRepositories(storage);
    const loaded = repo2.getById(ms.id);
    assert(loaded.provenance.source === 'scanned-document', 'source preserved after reload');
    assert(loaded.provenance.acquisitionMethod === 'notebook-scan', 'acquisitionMethod preserved after reload');
    assert(loaded.provenance.notes === 'पारिवारिक धरोहर बक्से से', 'notes preserved after reload');
    assert(loaded.provenance.location === 'जबलपुर', 'location preserved after reload');
  });

  test('32. quota/storage failure preserves previous valid metadata', () => {
    const storage = new MockStorage();
    const { manuscriptRepo } = createTestRepositories(storage);
    const ms = manuscriptRepo.create({
      title: 'कोटा परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: { source: 'handwritten-manuscript', notes: 'मूल वैध टिप्पणी' }
    });

    // Force storage failure
    storage.setItem = () => {
      const err = new Error('Storage Quota Exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    };

    let threw = false;
    try {
      manuscriptRepo.updateMetadata(ms.id, {
        provenance: { notes: 'यह सहेजी नहीं जा सकेगी' }
      });
    } catch (_) {
      threw = true;
    }
    assert(threw, 'Update fails on quota limit');

    // Restore setItem and verify previous state survived untouched
    storage.setItem = (k, v) => storage.store.set(k, String(v));
    const current = manuscriptRepo.getById(ms.id);
    assert(current.provenance.notes === 'मूल वैध टिप्पणी', 'Previous valid metadata remains untouched');
  });

  // --- Group 5: Metadata Editor Component Workflows ---
  console.log('--- Group 5: Metadata Editor Component Workflows ---');

  test('33. metadata editor loads current values', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'संपादक लोड परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: {
        source: 'camera-capture',
        acquisitionMethod: 'mobile-camera',
        recordedAt: '2026-08-01T10:00:00.000Z',
        notes: 'फोन से खींची गई पुरानी तस्वीर',
        recordedBy: 'Sitesh',
        location: 'गोरखपुर'
      }
    });

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = ms;
    view.showEditMetadataModal = true;
    const modalHtml = view.renderEditMetadataModal();

    assert(modalHtml.includes('value="camera-capture" selected'), 'Loads preselected source');
    assert(modalHtml.includes('value="mobile-camera" selected'), 'Loads preselected acquisitionMethod');
    assert(modalHtml.includes('value="2026-08-01"'), 'Loads prefilled recorded date');
    assert(modalHtml.includes('फोन से खींची गई पुरानी तस्वीर'), 'Loads prefilled notes');
    assert(modalHtml.includes('value="Sitesh"'), 'Loads prefilled recordedBy');
    assert(modalHtml.includes('value="गोरखपुर"'), 'Loads prefilled location');
  });

  test('34. metadata editor save flow works', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'संपादक सेव फ्लो',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 },
      provenance: { source: 'handwritten-manuscript', notes: 'शुरुआती' }
    });

    const mockContainer = new MockElement();
    mockContainer.registerMockChild('#meta-source-input', { value: 'scanned-document' });
    mockContainer.registerMockChild('#meta-method-input', { value: 'desktop-upload' });
    mockContainer.registerMockChild('#meta-recorded-at-input', { value: '2026-09-05' });
    mockContainer.registerMockChild('#meta-recorded-by-input', { value: 'अभिलेखपाल' });
    mockContainer.registerMockChild('#meta-location-input', { value: 'नई दिल्ली' });
    mockContainer.registerMockChild('#meta-notes-input', { value: 'नई अद्यतन टिप्पणी' });

    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = ms;
    view.showEditMetadataModal = true;

    view.handleSaveMetadata();

    assert(view.showEditMetadataModal === false, 'Modal closes on successful save');
    assert(view.metadataEditError === null, 'No error remaining');
    assert(view.manuscript.provenance.source === 'scanned-document', 'Source updated');
    assert(view.manuscript.provenance.acquisitionMethod === 'desktop-upload', 'Acquisition method updated');
    assert(view.manuscript.provenance.notes === 'नई अद्यतन टिप्पणी', 'Notes updated');
    assert(view.manuscript.provenance.location === 'नई दिल्ली', 'Location updated');
    assert(view.manuscript.provenance.recordedBy === 'अभिलेखपाल', 'RecordedBy updated');
  });

  test('35. metadata editor validation errors render correctly', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'त्रुटि प्रतिपादन',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const mockContainer = new MockElement();
    mockContainer.registerMockChild('#meta-source-input', { value: 'handwritten-manuscript' });
    mockContainer.registerMockChild('#meta-method-input', { value: '' });
    mockContainer.registerMockChild('#meta-recorded-at-input', { value: 'invalid-date-string' });
    mockContainer.registerMockChild('#meta-recorded-by-input', { value: '' });
    mockContainer.registerMockChild('#meta-location-input', { value: '' });
    mockContainer.registerMockChild('#meta-notes-input', { value: 'टिप्पणी' });

    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = ms;
    view.showEditMetadataModal = true;

    view.handleSaveMetadata();

    assert(view.metadataEditError !== null, 'Metadata edit error set');
    const modalHtml = view.renderEditMetadataModal();
    assert(modalHtml.includes('metadata-error-banner'), 'Error banner rendered');
    assert(modalHtml.includes('अमान्य तिथि'), 'Error message displayed');
  });

  test('36. accessibility labels exist', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'सुगम्यता परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = ms;
    view.showEditMetadataModal = true;

    const modalHtml = view.renderEditMetadataModal();
    assert(modalHtml.includes('role="dialog"'), 'Dialog has role="dialog"');
    assert(modalHtml.includes('aria-modal="true"'), 'Dialog has aria-modal="true"');
    assert(modalHtml.includes('aria-labelledby="edit-metadata-dialog-title"'), 'Dialog has aria-labelledby');
    assert(modalHtml.includes('aria-label="स्रोत चुनें"'), 'Source select has aria-label');
    assert(modalHtml.includes('aria-label="प्राप्ति का माध्यम चुनें"'), 'Method select has aria-label');
    assert(modalHtml.includes('aria-label="दर्ज की गई तिथि"'), 'Date input has aria-label');
    assert(modalHtml.includes('aria-label="अभिलेखक का नाम"'), 'RecordedBy input has aria-label');
    assert(modalHtml.includes('aria-label="अभिलेखन स्थान"'), 'Location input has aria-label');
    assert(modalHtml.includes('aria-label="अभिलेखीय टिप्पणियाँ"'), 'Notes input has aria-label');
  });

  test('37. archival reassurance block renders', () => {
    const { manuscriptRepo, poemRepo } = createTestRepositories();
    const ms = manuscriptRepo.create({
      title: 'आश्वासन ब्लॉक',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_IMAGE_BASE64 }
    });

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.manuscript = ms;

    const sectionHtml = view.renderArchivalRecordSection();
    assert(sectionHtml.includes('मूल पांडुलिपि सुरक्षित है'), 'Section contains reassurance title');
    assert(sectionHtml.includes('अभिलेखीय विवरण बदलने से मूल छवि प्रभावित नहीं होती।'), 'Section contains reassurance text');

    view.showEditMetadataModal = true;
    const modalHtml = view.renderEditMetadataModal();
    assert(modalHtml.includes('मूल पांडुलिपि सुरक्षित है'), 'Modal contains reassurance title');
    assert(modalHtml.includes('अभिलेखीय विवरण बदलने से मूल छवि प्रभावित नहीं होती।'), 'Modal contains reassurance text');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} ARCHIVE METADATA TESTS PASSED!`);
  console.log('================================================================\n');

  if (passed !== total || total !== 37) {
    process.exitCode = 1;
  }
}

runMetadataTests();
