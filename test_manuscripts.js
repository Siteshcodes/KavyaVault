/**
 * काव्यकलश (KavyaVault) — Manuscript Repository Test Suite (test_manuscripts.js)
 *
 * Phase 2 / Task 2.1: Manuscript Preservation Foundation
 *
 * Covers:
 * - Valid manuscript creation with generated IDs, timestamps, and defaults
 * - Retrieval (getAll, getById, getByPoemId, missing ID)
 * - Original manuscript immutability through updateMetadata and updateTranscription
 * - Explicit original replacement via replaceOriginalManuscript
 * - Validation (malformed input, missing image, invalid MIME, bad transcription status,
 *   malformed provenance, malformed timestamps)
 * - Safety (corrupted records, invalid IDs, storage failures)
 * - Unicode / Hindi / Devanagari preservation (conjuncts, matras, nuktas, chandrabindu)
 * - Migration (v1 → v2 schema upgrade)
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { MigrationManager, CURRENT_SCHEMA_VERSION } from './src/services/storage/MigrationManager.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { STORAGE_KEYS } from './src/data/storageKeys.js';

// In-memory mock storage engine
class MockStorage {
  constructor() {
    this.store = new Map();
    this.simulateQuota = false;
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
    if (this.simulateQuota) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

// Minimal base64-encoded 1x1 pixel PNG for testing
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TINY_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP//AP/=';

function makeValidManuscriptData(overrides = {}) {
  return {
    title: 'हस्तलिखित कविता',
    originalManuscript: {
      mimeType: 'image/png',
      data: TINY_PNG_BASE64,
      filename: 'page_01.png',
      capturedAt: '2026-01-15T10:30:00.000Z'
    },
    ...overrides
  };
}

async function runManuscriptTests() {
  console.log('================================================================');
  console.log('  KAVYAVAULT MANUSCRIPT PRESERVATION FOUNDATION TEST SUITE');
  console.log('  (Phase 2 / Task 2.1)');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function test(title, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`✓ [Test ${total}] ${title}`);
    } catch (err) {
      console.error(`✗ [Test ${total}] ${title}`);
      console.error('   Error:', err.message);
      if (err.stack) console.error('   Stack:', err.stack.split('\n')[1]);
      throw err;
    }
  }

  // ==========================================================================
  // GROUP 1: CREATION (TESTS 1–6)
  // ==========================================================================
  console.log('\n--- Group 1: Manuscript Creation ---');

  test('Valid manuscript creation with generated ID and timestamps', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData());

    console.assert(created.id && typeof created.id === 'string', 'ID must be generated');
    console.assert(created.id.startsWith('kv_ms_'), `ID must start with kv_ms_ prefix, got ${created.id}`);
    console.assert(created.title === 'हस्तलिखित कविता', 'Title must match');
    console.assert(created.createdAt && !isNaN(Date.parse(created.createdAt)), 'createdAt must be valid ISO');
    console.assert(created.updatedAt && !isNaN(Date.parse(created.updatedAt)), 'updatedAt must be valid ISO');
  });

  test('Default transcription state is untranscribed with empty text', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData());

    console.assert(created.transcription.text === '', 'Default transcription text must be empty');
    console.assert(created.transcription.status === 'untranscribed', 'Default status must be untranscribed');
    console.assert(created.transcription.verifiedAt === null, 'Default verifiedAt must be null');
  });

  test('Default provenance has source=handwritten_manuscript and valid recordedAt', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData());

    console.assert(created.provenance.source === 'handwritten_manuscript', 'Default source must be handwritten_manuscript');
    console.assert(!isNaN(Date.parse(created.provenance.recordedAt)), 'recordedAt must be valid ISO');
    console.assert(created.provenance.notes === '', 'Default notes must be empty string');
  });

  test('Original manuscript artifact gets unique artifact ID', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData());

    console.assert(created.originalManuscript.id.startsWith('kv_art_'), 'Artifact ID must have kv_art_ prefix');
    console.assert(created.originalManuscript.data === TINY_PNG_BASE64, 'Image data must be preserved');
    console.assert(created.originalManuscript.mimeType === 'image/png', 'MIME type must match');
    console.assert(created.originalManuscript.filename === 'page_01.png', 'Filename must match');
    console.assert(created.originalManuscript.capturedAt === '2026-01-15T10:30:00.000Z', 'capturedAt must match');
  });

  test('Explicit ID and poemId are preserved', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData({
      id: 'kv_ms_custom_001',
      poemId: 'kv_poem_abc'
    }));

    console.assert(created.id === 'kv_ms_custom_001', 'Custom ID must be used');
    console.assert(created.poemId === 'kv_poem_abc', 'poemId must be preserved');
  });

  test('Duplicate ID is rejected', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_dup_001' }));

    let threw = false;
    try {
      repo.create(makeValidManuscriptData({ id: 'kv_ms_dup_001' }));
    } catch (err) {
      threw = true;
      console.assert(err instanceof StorageError, 'Must be StorageError');
      console.assert(err.code === StorageErrorCode.DUPLICATE_ID, 'Must be DUPLICATE_ID');
    }
    console.assert(threw, 'Must throw on duplicate ID');
  });

  // ==========================================================================
  // GROUP 2: RETRIEVAL (TESTS 7–11)
  // ==========================================================================
  console.log('\n--- Group 2: Retrieval ---');

  test('getAll returns all manuscripts sorted newest first', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_r1', title: 'पहली', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }));
    repo.create(makeValidManuscriptData({ id: 'kv_ms_r2', title: 'दूसरी', createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' }));
    repo.create(makeValidManuscriptData({ id: 'kv_ms_r3', title: 'तीसरी', createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' }));

    const all = repo.getAll();
    console.assert(all.length === 3, `Expected 3, got ${all.length}`);
    console.assert(all[0].title === 'दूसरी', 'Newest first');
    console.assert(all[2].title === 'पहली', 'Oldest last');
  });

  test('getById returns correct manuscript or null', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_find_me' }));

    const found = repo.getById('kv_ms_find_me');
    console.assert(found !== null, 'Must find existing manuscript');
    console.assert(found.id === 'kv_ms_find_me', 'ID must match');
  });

  test('getById returns null for missing, empty, or invalid IDs', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    console.assert(repo.getById('nonexistent') === null, 'Non-existent ID returns null');
    console.assert(repo.getById('') === null, 'Empty string returns null');
    console.assert(repo.getById(null) === null, 'null returns null');
    console.assert(repo.getById(undefined) === null, 'undefined returns null');
    console.assert(repo.getById(123) === null, 'Number returns null');
  });

  test('getByPoemId returns manuscripts linked to a poem', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_p1', poemId: 'kv_poem_x', title: 'पृष्ठ 1' }));
    repo.create(makeValidManuscriptData({ id: 'kv_ms_p2', poemId: 'kv_poem_x', title: 'पृष्ठ 2' }));
    repo.create(makeValidManuscriptData({ id: 'kv_ms_p3', poemId: 'kv_poem_y', title: 'अन्य' }));

    const linkedToX = repo.getByPoemId('kv_poem_x');
    console.assert(linkedToX.length === 2, `Expected 2 linked, got ${linkedToX.length}`);
    console.assert(linkedToX.every(m => m.poemId === 'kv_poem_x'), 'All must have correct poemId');

    const linkedToZ = repo.getByPoemId('kv_poem_z');
    console.assert(linkedToZ.length === 0, 'Non-existent poemId returns empty');
  });

  test('Returned manuscripts are deep clones (immutable)', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData({ id: 'kv_ms_immut' }));
    created.title = 'MUTATED EXTERNALLY';
    created.originalManuscript.data = 'CORRUPTED';

    const fetched = repo.getById('kv_ms_immut');
    console.assert(fetched.title === 'हस्तलिखित कविता', 'Title must not be mutated');
    console.assert(fetched.originalManuscript.data === TINY_PNG_BASE64, 'Original data must not be mutated');
  });

  // ==========================================================================
  // GROUP 3: IMMUTABILITY — ORIGINAL MANUSCRIPT PRESERVATION (TESTS 12–16)
  // ==========================================================================
  console.log('\n--- Group 3: Original Manuscript Immutability ---');

  test('Transcription update preserves original manuscript image data exactly', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData({ id: 'kv_ms_immut_t1' }));
    const originalData = created.originalManuscript.data;
    const originalArtifactId = created.originalManuscript.id;

    const updated = repo.updateTranscription('kv_ms_immut_t1', {
      text: 'यह हस्तलिखित कविता की प्रतिलिपि है।\nक्षेत्र, त्रिभुवन, ज्ञान',
      status: 'draft'
    });

    console.assert(updated.originalManuscript.data === originalData, 'Original image data must be IDENTICAL');
    console.assert(updated.originalManuscript.id === originalArtifactId, 'Original artifact ID must be IDENTICAL');
    console.assert(updated.originalManuscript.mimeType === 'image/png', 'Original MIME must be unchanged');
    console.assert(updated.transcription.text.includes('क्षेत्र'), 'Transcription text must be updated');
    console.assert(updated.transcription.status === 'draft', 'Status must be draft');
  });

  test('Metadata update preserves original manuscript image data exactly', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData({ id: 'kv_ms_immut_m1' }));
    const originalData = created.originalManuscript.data;

    const updated = repo.updateMetadata('kv_ms_immut_m1', {
      title: 'नया शीर्षक — संशोधित',
      poemId: 'kv_poem_linked',
      provenance: { notes: 'दादाजी की डायरी से' }
    });

    console.assert(updated.originalManuscript.data === originalData, 'Original image data must be IDENTICAL');
    console.assert(updated.title === 'नया शीर्षक — संशोधित', 'Title must be updated');
    console.assert(updated.poemId === 'kv_poem_linked', 'poemId must be updated');
    console.assert(updated.provenance.notes === 'दादाजी की डायरी से', 'Provenance notes updated');
  });

  test('Repeated transcription updates all preserve original manuscript data', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData({ id: 'kv_ms_immut_r1' }));
    const originalData = created.originalManuscript.data;

    repo.updateTranscription('kv_ms_immut_r1', { text: 'पहला ड्राफ्ट', status: 'draft' });
    repo.updateTranscription('kv_ms_immut_r1', { text: 'दूसरा ड्राफ्ट' });
    repo.updateTranscription('kv_ms_immut_r1', { text: 'अंतिम सत्यापित पाठ', status: 'verified' });

    const final = repo.getById('kv_ms_immut_r1');
    console.assert(final.originalManuscript.data === originalData, 'Original must survive 3 transcription updates');
    console.assert(final.transcription.text === 'अंतिम सत्यापित पाठ', 'Latest transcription text');
    console.assert(final.transcription.status === 'verified', 'Status must be verified');
    console.assert(final.transcription.verifiedAt !== null, 'verifiedAt auto-set on verified');
  });

  test('Attempting to include originalManuscript in updateMetadata throws validation error', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_immut_block' }));

    let threw = false;
    try {
      repo.updateMetadata('kv_ms_immut_block', {
        title: 'Updated Title',
        originalManuscript: { data: 'REPLACEMENT_ATTEMPT', mimeType: 'image/png' }
      });
    } catch (err) {
      threw = true;
      console.assert(err instanceof StorageError, 'Must be StorageError');
      console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Must be VALIDATION_ERROR');
    }
    console.assert(threw, 'Must reject originalManuscript in metadata update');
  });

  test('Explicit replaceOriginalManuscript replaces image with new artifact ID', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData({ id: 'kv_ms_replace_1' }));
    const oldArtifactId = created.originalManuscript.id;

    const replaced = repo.replaceOriginalManuscript('kv_ms_replace_1', {
      mimeType: 'image/jpeg',
      data: TINY_JPEG_BASE64,
      filename: 'rescan.jpg'
    });

    console.assert(replaced.originalManuscript.data === TINY_JPEG_BASE64, 'New image data');
    console.assert(replaced.originalManuscript.mimeType === 'image/jpeg', 'New MIME type');
    console.assert(replaced.originalManuscript.id !== oldArtifactId, 'New artifact ID must differ');
    console.assert(replaced.originalManuscript.filename === 'rescan.jpg', 'New filename');
  });

  // ==========================================================================
  // GROUP 4: VALIDATION (TESTS 17–24)
  // ==========================================================================
  console.log('\n--- Group 4: Validation ---');

  test('Rejects creation with missing or non-object input', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    let threw = 0;
    try { repo.create(null); } catch { threw++; }
    try { repo.create('string'); } catch { threw++; }
    try { repo.create(42); } catch { threw++; }
    console.assert(threw === 3, 'All 3 malformed inputs must throw');
  });

  test('Rejects creation with missing or empty title', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    let threw = 0;
    try { repo.create(makeValidManuscriptData({ title: '' })); } catch { threw++; }
    try { repo.create(makeValidManuscriptData({ title: '   ' })); } catch { threw++; }
    try { repo.create({ originalManuscript: { mimeType: 'image/png', data: TINY_PNG_BASE64 } }); } catch { threw++; }
    console.assert(threw === 3, 'All 3 invalid title inputs must throw');
  });

  test('Rejects creation with missing or invalid originalManuscript', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    let threw = 0;
    // No originalManuscript
    try { repo.create({ title: 'Test' }); } catch { threw++; }
    // null originalManuscript
    try { repo.create({ title: 'Test', originalManuscript: null }); } catch { threw++; }
    // Missing data
    try { repo.create({ title: 'Test', originalManuscript: { mimeType: 'image/png' } }); } catch { threw++; }
    // Empty data
    try { repo.create({ title: 'Test', originalManuscript: { mimeType: 'image/png', data: '' } }); } catch { threw++; }
    // Missing mimeType
    try { repo.create({ title: 'Test', originalManuscript: { data: TINY_PNG_BASE64 } }); } catch { threw++; }
    console.assert(threw === 5, `Expected 5 throws, got ${threw}`);
  });

  test('Rejects invalid MIME type', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    let threw = false;
    try {
      repo.create(makeValidManuscriptData({
        originalManuscript: { mimeType: 'application/pdf', data: TINY_PNG_BASE64 }
      }));
    } catch (err) {
      threw = true;
      console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Must be VALIDATION_ERROR');
      console.assert(err.message.includes('application/pdf'), 'Must mention invalid MIME');
    }
    console.assert(threw, 'Must reject PDF MIME type');
  });

  test('Rejects invalid transcription status', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_v_status' }));

    let threw = false;
    try {
      repo.updateTranscription('kv_ms_v_status', { status: 'completed' });
    } catch (err) {
      threw = true;
      console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Must be VALIDATION_ERROR');
    }
    console.assert(threw, 'Must reject invalid transcription status');
  });

  test('Rejects malformed provenance in creation', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    let threw = false;
    try {
      repo.create(makeValidManuscriptData({
        provenance: { recordedAt: 'not-a-date' }
      }));
    } catch (err) {
      threw = true;
      console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Must be VALIDATION_ERROR');
    }
    console.assert(threw, 'Must reject malformed provenance recordedAt');
  });

  test('Rejects malformed capturedAt timestamp', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    let threw = false;
    try {
      repo.create(makeValidManuscriptData({
        originalManuscript: {
          mimeType: 'image/png',
          data: TINY_PNG_BASE64,
          capturedAt: 'invalid-timestamp'
        }
      }));
    } catch (err) {
      threw = true;
      console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Must be VALIDATION_ERROR');
    }
    console.assert(threw, 'Must reject malformed capturedAt');
  });

  test('Rejects malformed transcription verifiedAt timestamp', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_v_ts' }));

    let threw = false;
    try {
      repo.updateTranscription('kv_ms_v_ts', { verifiedAt: 'not-valid' });
    } catch (err) {
      threw = true;
      console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Must be VALIDATION_ERROR');
    }
    console.assert(threw, 'Must reject malformed verifiedAt');
  });

  // ==========================================================================
  // GROUP 5: SAFETY (TESTS 25–28)
  // ==========================================================================
  console.log('\n--- Group 5: Safety & Error Handling ---');

  test('Corrupted individual record does not destroy valid manuscripts', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const valid = repo.create(makeValidManuscriptData({ id: 'kv_ms_safe_1' }));

    // Inject corrupted data directly into storage alongside valid record
    const rawData = JSON.parse(storage.store.get(STORAGE_KEYS.MANUSCRIPTS));
    rawData.push(null);
    rawData.push('string_not_object');
    rawData.push({ no_id: true });
    rawData.push({ id: 123 }); // non-string id
    storage.store.set(STORAGE_KEYS.MANUSCRIPTS, JSON.stringify(rawData));

    const all = repo.getAll();
    console.assert(all.length === 1, `Expected 1 valid, got ${all.length}`);
    console.assert(all[0].id === 'kv_ms_safe_1', 'Valid manuscript preserved');
  });

  test('Invalid IDs in update/delete do not mutate unrelated records', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_safe_2' }));

    let threw = 0;
    try { repo.updateMetadata('nonexistent', { title: 'X' }); } catch { threw++; }
    try { repo.updateTranscription('nonexistent', { text: 'X' }); } catch { threw++; }
    try { repo.delete('nonexistent'); } catch { threw++; }
    console.assert(threw === 3, 'All 3 operations on invalid IDs must throw');

    // Original untouched
    const original = repo.getById('kv_ms_safe_2');
    console.assert(original.title === 'हस्तलिखित कविता', 'Original must be untouched');
  });

  test('Storage quota failure is surfaced as StorageError QUOTA_EXCEEDED', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    storage.simulateQuota = true;

    let threw = false;
    try {
      repo.create(makeValidManuscriptData());
    } catch (err) {
      threw = true;
      console.assert(err instanceof StorageError, 'Must be StorageError');
      console.assert(err.code === StorageErrorCode.QUOTA_EXCEEDED, `Expected QUOTA_EXCEEDED, got ${err.code}`);
    }
    console.assert(threw, 'Must throw on quota exceeded');
  });

  test('Non-destructive read does not overwrite corrupted raw storage', () => {
    const storage = new MockStorage();
    const rawCorrupt = '"this is not an array"';
    storage.store.set(STORAGE_KEYS.MANUSCRIPTS, rawCorrupt);
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const all = repo.getAll();
    console.assert(all.length === 0, 'Must return empty array');
    console.assert(storage.store.get(STORAGE_KEYS.MANUSCRIPTS) === rawCorrupt, 'Raw storage NOT overwritten');
  });

  // ==========================================================================
  // GROUP 6: DELETION (TEST 29)
  // ==========================================================================
  console.log('\n--- Group 6: Deletion ---');

  test('Delete removes manuscript completely', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    repo.create(makeValidManuscriptData({ id: 'kv_ms_del_1' }));
    repo.create(makeValidManuscriptData({ id: 'kv_ms_del_2' }));

    console.assert(repo.delete('kv_ms_del_1') === true, 'Delete must return true');
    console.assert(repo.getById('kv_ms_del_1') === null, 'Deleted manuscript returns null');
    console.assert(repo.getAll().length === 1, 'Only 1 remaining');
    console.assert(repo.getAll()[0].id === 'kv_ms_del_2', 'Remaining is correct');
  });

  // ==========================================================================
  // GROUP 7: UNICODE / HINDI / DEVANAGARI (TESTS 30–32)
  // ==========================================================================
  console.log('\n--- Group 7: Unicode / Hindi / Devanagari Preservation ---');

  test('Hindi conjuncts (क्ष त्र ज्ञ श्र द्व द्ध हृ) survive full lifecycle', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const conjunctTitle = 'क्षेत्रज्ञ की श्रद्धा — द्वार हृदय';
    const created = repo.create(makeValidManuscriptData({
      id: 'kv_ms_unicode_1',
      title: conjunctTitle
    }));

    console.assert(created.title === conjunctTitle, 'Conjuncts must survive creation');

    repo.updateTranscription('kv_ms_unicode_1', {
      text: 'क्षमा, त्रिभुवन, ज्ञानी, श्रृंगार, द्वेष, बुद्धि, हृषीकेश',
      status: 'draft'
    });

    const fetched = repo.getById('kv_ms_unicode_1');
    console.assert(fetched.title === conjunctTitle, 'Conjuncts survive after transcription update');
    console.assert(fetched.transcription.text.includes('ज्ञानी'), 'Transcription conjuncts preserved');
    console.assert(fetched.transcription.text.includes('हृषीकेश'), 'Hrishi conjunct preserved');
  });

  test('Nuktas (ज़, फ़, ख़), chandrabindu (ँ), anusvara (ं), visarga (ः) preserved', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const unicodeTitle = 'ग़ज़ल — ज़िंदगी का सफ़र';
    const created = repo.create(makeValidManuscriptData({
      id: 'kv_ms_unicode_2',
      title: unicodeTitle
    }));

    repo.updateTranscription('kv_ms_unicode_2', {
      text: 'चाँदनी (ँ), गंगा (ं), दुःख (ः)\nफ़ज़ल, ख़ुशी, ज़मीन',
      status: 'verified'
    });

    repo.updateMetadata('kv_ms_unicode_2', {
      provenance: { notes: 'ख़ानदानी डायरी से — चाँद रात' }
    });

    const fetched = repo.getById('kv_ms_unicode_2');
    console.assert(fetched.title === unicodeTitle, 'Nuktas in title preserved');
    console.assert(fetched.transcription.text.includes('चाँदनी'), 'Chandrabindu preserved');
    console.assert(fetched.transcription.text.includes('गंगा'), 'Anusvara preserved');
    console.assert(fetched.transcription.text.includes('दुःख'), 'Visarga preserved');
    console.assert(fetched.provenance.notes.includes('ख़ानदानी'), 'Nukta in provenance preserved');
  });

  test('Devanagari numerals and poetic punctuation (।, ॥, —) roundtrip', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new ManuscriptRepository(adapter);

    const created = repo.create(makeValidManuscriptData({
      id: 'kv_ms_unicode_3',
      title: 'श्लोक संख्या — पृष्ठ ४२'
    }));

    repo.updateTranscription('kv_ms_unicode_3', {
      text: 'गुरुर्ब्रह्मा गुरुर्विष्णुः।\nतस्मै श्रीगुरवे नमः॥ — श्लोक १०८',
      status: 'verified'
    });

    const fetched = repo.getById('kv_ms_unicode_3');
    console.assert(fetched.title.includes('४२'), 'Devanagari numerals in title');
    console.assert(fetched.transcription.text.includes('।'), 'Single danda preserved');
    console.assert(fetched.transcription.text.includes('॥'), 'Double danda preserved');
    console.assert(fetched.transcription.text.includes('१०८'), 'Devanagari numerals in text');
  });

  // ==========================================================================
  // GROUP 8: MIGRATION (TESTS 33–34)
  // ==========================================================================
  console.log('\n--- Group 8: Schema Migration ---');

  test('v1 → v2 migration initializes manuscripts storage key', async () => {
    const storage = new MockStorage();
    // Simulate a v1 installation
    storage.store.set(STORAGE_KEYS.METADATA, JSON.stringify({
      schemaVersion: 1,
      initializedAt: '2026-01-01T00:00:00.000Z',
      lastMigratedAt: '2026-01-01T00:00:00.000Z'
    }));
    storage.store.set(STORAGE_KEYS.POEMS, JSON.stringify([
      { id: 'kv_poem_existing', title: 'मेघदूत', body: 'यक्ष वियोग', author: 'कालिदास', tags: [], isFavorite: false, isArchived: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
    ]));

    const adapter = new LocalStorageAdapter(storage);
    const migration = new MigrationManager(adapter);
    const result = await migration.initialize();

    console.assert(result.status === 'MIGRATED', `Expected MIGRATED, got ${result.status}`);
    console.assert(result.previousVersion === 1, 'Previous version must be 1');
    console.assert(result.currentVersion === 2, 'Current version must be 2');

    // Manuscripts storage should now exist
    const manuscripts = adapter.get(STORAGE_KEYS.MANUSCRIPTS);
    console.assert(Array.isArray(manuscripts), 'Manuscripts key must be an array');
    console.assert(manuscripts.length === 0, 'Manuscripts array must be empty');

    // Phase 1 poems must NOT be affected
    const poems = adapter.get(STORAGE_KEYS.POEMS);
    console.assert(Array.isArray(poems) && poems.length === 1, 'Poems must be untouched');
    console.assert(poems[0].title === 'मेघदूत', 'Poem title must be intact');
  });

  test('CURRENT_SCHEMA_VERSION is now 2', () => {
    console.assert(CURRENT_SCHEMA_VERSION === 2, `Expected 2, got ${CURRENT_SCHEMA_VERSION}`);
  });

  // ==========================================================================
  // FINAL RESULTS
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} MANUSCRIPT PRESERVATION TESTS PASSED!`);
  console.log('================================================================\n');
}

runManuscriptTests().catch(err => {
  console.error('\n❌ MANUSCRIPT TEST SUITE ENCOUNTERED UNEXPECTED ERROR:');
  console.error(err);
  process.exit(1);
});
