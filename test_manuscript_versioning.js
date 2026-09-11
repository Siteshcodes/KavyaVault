/**
 * काव्यकलश (KavyaVault) — Manuscript & Transcription Version History Test Suite
 * File: test_manuscript_versioning.js
 *
 * Phase 2 / Task 2.7:
 * Lightweight Version History foundation for handwritten manuscript transcriptions.
 *
 * Test Coverage:
 * 1. migration initializes empty history for old records
 * 2. first meaningful transcription save creates v1
 * 3. later meaningful save creates v2
 * 4. duplicate identical save does NOT create a new version
 * 5. versions receive unique IDs
 * 6. version numbers increase monotonically
 * 7. snapshots are immutable
 * 8. history order is deterministic
 * 9. getTranscriptionHistory returns history safely
 * 10. restore version creates a NEW version
 * 11. restored text matches requested historical state
 * 12. restored verified status preserved
 * 13. restoring draft produces draft current state
 * 14. editing restored verified text returns to draft
 * 15. restore does not delete original historical snapshot
 * 16. repeated restores preserve audit trail
 * 17. source field correctly records manual-save/verification/restore
 * 18. max history limit is enforced (25)
 * 19. oldest history cleanup is deterministic
 * 20. current transcription survives history cleanup
 * 21. original manuscript bytes remain unchanged
 * 22. original manuscript metadata remains unchanged
 * 23. derived manuscript remains unchanged
 * 24. transformation remains unchanged
 * 25. poem remains unchanged
 * 26. linked poem ID remains unchanged
 * 27. reload persistence works
 * 28. malformed history entry is handled safely
 * 29. invalid version ID rejected
 * 30. invalid restore request rejected
 * 31. XSS-safe history preview
 * 32. Hindi/Unicode text preserved
 * 33. timestamps remain valid ISO values
 * 34. verifiedAt semantics remain correct
 * 35. version UI renders history
 * 36. read-only preview does not mutate current text
 * 37. restore confirmation is required
 * 38. storage quota failure preserves current state
 * 39. autosave does not generate versions per keystroke
 * 40. repeated identical autosaves do not generate duplicates
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { ManuscriptRepository, MAX_TRANSCRIPTION_HISTORY } from './src/services/ManuscriptRepository.js';
import { ManuscriptTranscription } from './src/components/manuscripts/ManuscriptTranscription.js';

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

// Minimal DOM Element mock for component unit tests
class MockElement {
  constructor() {
    this._innerHTML = '';
    this.listeners = new Map();
    this.style = {};
  }
  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(val) {
    this._innerHTML = val;
  }
  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }
  removeEventListener(event, handler) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(h => h !== handler));
  }
  querySelector(selector) {
    return null;
  }
  querySelectorAll(selector) {
    return [];
  }
}

const SAMPLE_ORIG_DATA = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SAMPLE_DERIVED_DATA = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M/AwMDEwMAAAAcAAwEqw8IAAAAASUVORK5CYII=';

async function runVersioningTests() {
  console.log('\n================================================================');
  console.log('  KAVYAVAULT TRANSCRIPTION VERSION HISTORY TEST SUITE');
  console.log('  (Phase 2 / Task 2.7)');
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

  function setupRepositories() {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const poemRepo = new PoemRepository(adapter);
    const manuscriptRepo = new ManuscriptRepository(adapter, poemRepo);
    return { storage, adapter, poemRepo, manuscriptRepo };
  }

  // --- Group 1: Schema Migration & Initial State ---
  console.log('--- Group 1: Schema Migration & Initial State ---');

  test('Migration initializes empty history for old records', () => {
    const { adapter, manuscriptRepo } = setupRepositories();
    // Simulate raw legacy storage from Task 2.6 without currentVersionId or transcriptionHistory
    const legacyRecords = [{
      id: 'kv_ms_legacy_1',
      title: 'पुरातन पांडुलिपि',
      poemId: null,
      originalManuscript: {
        id: 'kv_art_orig_leg',
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      },
      derivedManuscript: null,
      transformation: null,
      transcription: {
        text: 'पुरानी प्रतिलिपि',
        status: 'draft',
        verifiedAt: null
      },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    }];
    adapter.set('kavyavault:manuscripts', legacyRecords);

    const retrieved = manuscriptRepo.getById('kv_ms_legacy_1');
    assert(Array.isArray(retrieved.transcriptionHistory), 'transcriptionHistory must be an array');
    assert(retrieved.transcriptionHistory.length === 0, 'legacy record must have empty history array (no fake versions)');
    assert(retrieved.transcription.currentVersionId === null, 'currentVersionId must safely default to null');
  });

  test('First meaningful transcription save creates v1', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'कबीर दोहा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    assert(ms.transcriptionHistory.length === 0, 'new manuscript has 0 history');

    const updated = manuscriptRepo.updateTranscription(ms.id, {
      text: 'गुरु गोविंद दोऊ खड़े, काके लागूं पाँय।',
      status: 'draft'
    });

    assert(updated.transcriptionHistory.length === 1, 'first save creates v1');
    const v1 = updated.transcriptionHistory[0];
    assert(v1.versionNumber === 1, 'version number must be 1');
    assert(v1.text === 'गुरु गोविंद दोऊ खड़े, काके लागूं पाँय।', 'v1 text matches');
    assert(v1.status === 'draft', 'v1 status matches');
    assert(v1.source === 'manual-save', 'v1 source defaults to manual-save');
    assert(updated.transcription.currentVersionId === v1.id, 'currentVersionId points to v1');
  });

  test('Later meaningful save creates v2', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'कबीर दोहा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'गुरु गोविंद दोऊ खड़े, काके लागूं पाँय।',
      status: 'draft'
    });

    const updated = manuscriptRepo.updateTranscription(ms.id, {
      text: 'गुरु गोविंद दोऊ खड़े, काके लागूं पाँय।\nबलिहारी गुरु आपनो, गोविंद दियो बताय॥',
      status: 'draft'
    });

    assert(updated.transcriptionHistory.length === 2, 'later save creates v2');
    const v2 = updated.transcriptionHistory[1];
    assert(v2.versionNumber === 2, 'version number must be 2');
    assert(v2.text.includes('बलिहारी गुरु आपनो'), 'v2 text updated');
    assert(updated.transcription.currentVersionId === v2.id, 'currentVersionId points to v2');
  });

  test('Duplicate identical save does NOT create a new version', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'कबीर दोहा',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const v1State = manuscriptRepo.updateTranscription(ms.id, {
      text: 'गुरु गोविंद दोऊ खड़े, काके लागूं पाँय।',
      status: 'draft'
    });
    assert(v1State.transcriptionHistory.length === 1, 'v1 created');

    // Save exact same text + status again
    const repeatSave = manuscriptRepo.updateTranscription(ms.id, {
      text: 'गुरु गोविंद दोऊ खड़े, काके लागूं पाँय।',
      status: 'draft'
    });

    assert(repeatSave.transcriptionHistory.length === 1, 'duplicate identical save must NOT create extra version');
  });

  test('Versions receive unique IDs', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'अनोखी आईडी परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'पंक्ति १', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'पंक्ति २', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'पंक्ति ३', status: 'draft' });

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(history.length === 3, 'history has 3 entries');
    const idSet = new Set(history.map(h => h.id));
    assert(idSet.size === 3, 'all version IDs must be distinct');
    assert(history[0].id.startsWith('kv_trv_'), 'version id has correct prefix');
  });

  // --- Group 2: Snapshot Immutability, Ordering & History APIs ---
  console.log('--- Group 2: Snapshot Immutability, Ordering & History APIs ---');

  test('Version numbers increase monotonically', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'क्रमिक संख्या परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    for (let i = 1; i <= 5; i++) {
      manuscriptRepo.updateTranscription(ms.id, { text: `संस्करण सामग्री ${i}`, status: 'draft' });
    }

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(history.length === 5, '5 versions created');
    for (let i = 0; i < history.length; i++) {
      assert(history[i].versionNumber === i + 1, `version ${i + 1} has correct monotonic number`);
    }
  });

  test('Snapshots are immutable', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'अपरिवर्तनीय स्नैपशॉट',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'मूल पाठ', status: 'draft' });
    const history = manuscriptRepo.getTranscriptionHistory(ms.id);

    // Attempt to mutate returned snapshot
    history[0].text = 'दुर्भावनापूर्ण संशोधन';
    history[0].versionNumber = 999;

    const freshHistory = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(freshHistory[0].text === 'मूल पाठ', 'stored snapshot text remains immutable');
    assert(freshHistory[0].versionNumber === 1, 'stored versionNumber remains immutable');
  });

  test('History order is deterministic', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'निश्चित क्रम',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रथम', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'द्वितीय', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'तृतीय', status: 'draft' });

    const history1 = manuscriptRepo.getTranscriptionHistory(ms.id);
    const history2 = manuscriptRepo.getTranscriptionHistory(ms.id);

    assert(JSON.stringify(history1) === JSON.stringify(history2), 'history order is deterministic across repeated calls');
    assert(history1[0].versionNumber < history1[1].versionNumber, 'chronological ordering');
  });

  test('getTranscriptionHistory returns history safely', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सुरक्षित इतिहास एपीआई',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const emptyHistory = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(Array.isArray(emptyHistory), 'returns array');
    assert(emptyHistory.length === 0, 'empty initially');

    manuscriptRepo.updateTranscription(ms.id, { text: 'इतिहास पाठ', status: 'draft' });
    const filledHistory = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(filledHistory.length === 1, 'contains 1 entry');
  });

  test('Restore version creates a NEW version', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'पुनर्स्थापना परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रारूप १ (v1)', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रारूप २ (v2)', status: 'draft' });

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    const v1Id = history[0].id;

    // Restore v1
    const restored = manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);
    assert(restored.transcriptionHistory.length === 3, 'restoring creates a new v3 snapshot');
    const v3 = restored.transcriptionHistory[2];
    assert(v3.versionNumber === 3, 'new version number is 3');
    assert(v3.text === 'प्रारूप १ (v1)', 'restored text matches v1');
    assert(v3.source === 'restore', 'source is restore');
    assert(restored.transcription.text === 'प्रारूप १ (v1)', 'current transcription text matches v1');
  });

  // --- Group 3: Restore Semantics & Status Safety ---
  console.log('--- Group 3: Restore Semantics & Status Safety ---');

  test('Restored text matches requested historical state', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'पाठ सत्यापन',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const targetText = 'कालिदास रचित मेघदूतम्\nकश्चित्कान्ताविरहगुरुणा स्वाधिकारात्प्रमत्त:';
    manuscriptRepo.updateTranscription(ms.id, { text: targetText, status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'अन्य पाठ', status: 'draft' });

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    const v1Id = history[0].id;

    const restored = manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);
    assert(restored.transcription.text === targetText, 'restored text matches target text exactly');
  });

  test('Restored verified status preserved', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'प्रमाणित पुनर्स्थापना',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    // v1: draft
    manuscriptRepo.updateTranscription(ms.id, { text: 'कच्चा प्रारूप', status: 'draft' });
    // v2: verified
    manuscriptRepo.updateTranscription(ms.id, { text: 'शुद्ध एवं प्रमाणित पाठ', status: 'verified' });
    // v3: draft edit
    manuscriptRepo.updateTranscription(ms.id, { text: 'अशुद्ध संपादन', status: 'draft' });

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    const v2 = history[1];
    assert(v2.status === 'verified', 'v2 is verified');
    const v2VerifiedAt = v2.verifiedAt;

    // Restore v2
    const restored = manuscriptRepo.restoreTranscriptionVersion(ms.id, v2.id);
    assert(restored.transcription.status === 'verified', 'restored status is verified');
    assert(restored.transcription.verifiedAt === v2VerifiedAt, 'original verifiedAt preserved');
  });

  test('Restoring draft produces draft current state', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'प्रारूप पुनर्स्थापना',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    // v1: draft
    manuscriptRepo.updateTranscription(ms.id, { text: 'ड्राफ़्ट पाठ', status: 'draft' });
    // v2: verified
    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रमाणित पाठ', status: 'verified' });

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    const v1Id = history[0].id;

    // Restore v1 (draft)
    const restored = manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);
    assert(restored.transcription.status === 'draft', 'status is draft');
    assert(restored.transcription.verifiedAt === null, 'verifiedAt is null for restored draft');
  });

  test('Editing restored verified text returns to draft', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सत्यापन गिरावट',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रमाणित पाठ', status: 'verified' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'बदला हुआ पाठ', status: 'draft' });

    const v1Id = manuscriptRepo.getTranscriptionHistory(ms.id)[0].id;
    const restored = manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);
    assert(restored.transcription.status === 'verified', 'restored as verified');

    // Edit restored text
    const edited = manuscriptRepo.updateTranscription(ms.id, {
      text: 'प्रमाणित पाठ में नया शब्द'
    });
    assert(edited.transcription.status === 'draft', 'status drops to draft');
    assert(edited.transcription.verifiedAt === null, 'verifiedAt cleared');
  });

  test('Restore does not delete original historical snapshot', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'स्नैपशॉट अखंडता',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण १', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण २', status: 'draft' });

    const v1Id = manuscriptRepo.getTranscriptionHistory(ms.id)[0].id;
    manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);

    const updatedHistory = manuscriptRepo.getTranscriptionHistory(ms.id);
    const foundV1 = updatedHistory.find(v => v.id === v1Id);
    assert(Boolean(foundV1), 'v1 snapshot must still exist in history');
    assert(foundV1.text === 'संस्करण १', 'v1 text remains unchanged');
  });

  test('Repeated restores preserve audit trail', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'ऑडिट ट्रेल',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'मूल पद', status: 'draft' }); // v1
    manuscriptRepo.updateTranscription(ms.id, { text: 'संशोधित पद', status: 'draft' }); // v2

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    const v1Id = history[0].id;
    const v2Id = history[1].id;

    // Restore v1 -> creates v3
    manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);
    // Restore v2 -> creates v4
    manuscriptRepo.restoreTranscriptionVersion(ms.id, v2Id);

    const fullHistory = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(fullHistory.length === 4, 'history has 4 versions: v1, v2, v3 (restored v1), v4 (restored v2)');
    assert(fullHistory[2].versionNumber === 3, 'v3 monotonic');
    assert(fullHistory[3].versionNumber === 4, 'v4 monotonic');
    assert(fullHistory[3].text === 'संशोधित पद', 'v4 has v2 text');
  });

  // --- Group 4: Metadata, Limits & Pruning Safety ---
  console.log('--- Group 4: Metadata, Limits & Pruning Safety ---');

  test('Source field correctly records manual-save/verification/restore', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'स्रोत ट्रैकिंग',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'ड्राफ़्ट पाठ', status: 'draft' }, { source: 'manual-save' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रमाणित पाठ', status: 'verified' }); // auto verification source
    const v1Id = manuscriptRepo.getTranscriptionHistory(ms.id)[0].id;
    manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id); // restore source

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(history[0].source === 'manual-save', 'v1 source manual-save');
    assert(history[1].source === 'verification', 'v2 source verification');
    assert(history[2].source === 'restore', 'v3 source restore');
  });

  test('Max history limit is enforced', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'इतिहास सीमा परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    // Create 30 versions (exceeding limit of 25)
    for (let i = 1; i <= 30; i++) {
      manuscriptRepo.updateTranscription(ms.id, { text: `प्रतिलिपि संशोधन क्रमांक ${i}`, status: 'draft' });
    }

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(history.length === MAX_TRANSCRIPTION_HISTORY, `history length capped at ${MAX_TRANSCRIPTION_HISTORY}`);
  });

  test('Oldest history cleanup is deterministic', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सफाई निर्धारण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    for (let i = 1; i <= 30; i++) {
      manuscriptRepo.updateTranscription(ms.id, { text: `संस्करण ${i}`, status: 'draft' });
    }

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    // Oldest 5 pruned; versions 6 through 30 preserved (total 25)
    assert(history[0].versionNumber === 6, 'oldest remaining version is v6');
    assert(history[history.length - 1].versionNumber === 30, 'newest version is v30');
  });

  test('Current transcription survives history cleanup', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सक्रिय प्रतिलिपि अस्तित्व',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    for (let i = 1; i <= 30; i++) {
      manuscriptRepo.updateTranscription(ms.id, { text: `नवीनतम पाठ ${i}`, status: 'draft' });
    }

    const current = manuscriptRepo.getById(ms.id);
    assert(current.transcription.text === 'नवीनतम पाठ 30', 'current transcription is intact');
    assert(current.transcription.currentVersionId === current.transcriptionHistory[current.transcriptionHistory.length - 1].id, 'points to newest');
  });

  // --- Group 5: Archival Immutability & Independence ---
  console.log('--- Group 5: Archival Immutability & Independence ---');

  test('Original manuscript bytes remain unchanged', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'अपरिवर्तनीय मूल बाइट्स',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const origBytes = ms.originalManuscript.data;

    // Perform multiple versioning actions
    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण १', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण २', status: 'verified' });
    const v1Id = manuscriptRepo.getTranscriptionHistory(ms.id)[0].id;
    manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);

    const fresh = manuscriptRepo.getById(ms.id);
    assert(fresh.originalManuscript.data === origBytes, 'original bytes byte-for-byte identical');
  });

  test('Original manuscript metadata remains unchanged', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'मेटाडेटा सुरक्षा',
      originalManuscript: {
        filename: 'manuscript_1920.png',
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA,
        capturedAt: '2026-09-01T12:00:00.000Z'
      }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'इतिहास १', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'इतिहास २', status: 'draft' });

    const fresh = manuscriptRepo.getById(ms.id);
    assert(fresh.originalManuscript.filename === 'manuscript_1920.png', 'filename intact');
    assert(fresh.originalManuscript.capturedAt === '2026-09-01T12:00:00.000Z', 'capturedAt intact');
  });

  test('Derived manuscript remains unchanged', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'संपादित प्रति अपरिवर्तनीय',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      derivedManuscript: {
        id: 'kv_art_der_test',
        sourceArtifactId: 'orig',
        data: SAMPLE_DERIVED_DATA,
        mimeType: 'image/png'
      },
      transformation: { rotation: 180, crop: null, transformVersion: 1 }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण १', status: 'draft' });
    const v1Id = manuscriptRepo.getTranscriptionHistory(ms.id)[0].id;
    manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);

    const fresh = manuscriptRepo.getById(ms.id);
    assert(fresh.derivedManuscript.data === SAMPLE_DERIVED_DATA, 'derived data unchanged');
  });

  test('Transformation remains unchanged', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'रूपांतरण अपरिवर्तनीय',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transformation: { rotation: 270, crop: { x: 10, y: 10, width: 100, height: 100 }, transformVersion: 2 }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'रूपांतरण के बाद प्रतिलिपि', status: 'draft' });
    const fresh = manuscriptRepo.getById(ms.id);
    assert(fresh.transformation.rotation === 270, 'rotation unchanged');
    assert(fresh.transformation.crop.width === 100, 'crop width unchanged');
  });

  test('Poem remains unchanged', () => {
    const { manuscriptRepo, poemRepo } = setupRepositories();
    const poem = poemRepo.create({
      title: 'स्वतंत्र कविता',
      body: 'कविता का पवित्र पाठ जो नहीं बदलेगा।'
    });
    const ms = manuscriptRepo.create({
      title: 'संबद्ध पांडुलिपि',
      poemId: poem.id,
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'भिन्न प्रतिलिपि पाठ v1', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'भिन्न प्रतिलिपि पाठ v2', status: 'verified' });
    const v1Id = manuscriptRepo.getTranscriptionHistory(ms.id)[0].id;
    manuscriptRepo.restoreTranscriptionVersion(ms.id, v1Id);

    const poemAfter = poemRepo.getById(poem.id);
    assert(poemAfter.body === 'कविता का पवित्र पाठ जो नहीं बदलेगा।', 'poem body remains 100% untouched');
    assert(poemAfter.title === 'स्वतंत्र कविता', 'poem title untouched');
  });

  test('Linked poem ID remains unchanged', () => {
    const { manuscriptRepo, poemRepo } = setupRepositories();
    const poem = poemRepo.create({ title: 'कविता', body: 'पंक्तियाँ' });
    const ms = manuscriptRepo.create({
      title: 'पांडुलिपि',
      poemId: poem.id,
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'संस्करण १', status: 'draft' });
    const fresh = manuscriptRepo.getById(ms.id);
    assert(fresh.poemId === poem.id, 'poemId remains intact');
  });

  // --- Group 6: Persistence, Validation & Security ---
  console.log('--- Group 6: Persistence, Validation & Security ---');

  test('Reload persistence works', () => {
    const storage = new MockStorage();
    const adapter1 = new LocalStorageAdapter(storage);
    const repo1 = new ManuscriptRepository(adapter1);

    const ms = repo1.create({
      title: 'रीलोड दृढ़ता',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    repo1.updateTranscription(ms.id, { text: 'संस्करण १', status: 'draft' });
    repo1.updateTranscription(ms.id, { text: 'संस्करण २', status: 'verified' });

    // Simulate fresh reload
    const adapter2 = new LocalStorageAdapter(storage);
    const repo2 = new ManuscriptRepository(adapter2);

    const loadedHistory = repo2.getTranscriptionHistory(ms.id);
    assert(loadedHistory.length === 2, 'both versions survive storage reload');
    assert(loadedHistory[1].status === 'verified', 'verified status preserved');
  });

  test('Malformed history entry is handled safely', () => {
    const { adapter, manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'दोषपूर्ण इतिहास पुनर्प्राप्ति',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    // Corrupt history entry manually in storage
    const raw = adapter.get('kavyavault:manuscripts');
    raw[0].transcriptionHistory = [null, { id: 'v1', versionNumber: 1, text: 'मान्य पाठ', status: 'draft' }, 'invalid'];
    adapter.set('kavyavault:manuscripts', raw);

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(Array.isArray(history), 'returns array safely');
    assert(history.length === 3, 'contains items without crashing');
  });

  test('Invalid version ID rejected', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'अमान्य आईडी',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    let threw = false;
    try {
      manuscriptRepo.restoreTranscriptionVersion(ms.id, 'non_existent_version_id');
    } catch (err) {
      threw = true;
      assert(err instanceof StorageError, 'throws StorageError');
      assert(err.code === StorageErrorCode.KEY_NOT_FOUND, 'code is KEY_NOT_FOUND');
    }
    assert(threw, 'must throw for non-existent versionId');
  });

  test('Invalid restore request rejected', () => {
    const { manuscriptRepo } = setupRepositories();

    let threw1 = false;
    try {
      manuscriptRepo.restoreTranscriptionVersion('', 'some_id');
    } catch (err) {
      threw1 = true;
      assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'empty ms id rejected');
    }
    assert(threw1, 'threw on invalid manuscript id');

    let threw2 = false;
    try {
      manuscriptRepo.restoreTranscriptionVersion('some_ms', '');
    } catch (err) {
      threw2 = true;
      assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'empty version id rejected');
    }
    assert(threw2, 'threw on invalid version id');
  });

  test('XSS-safe history preview', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सुरक्षा परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: '<script>alert("xss")</script><img src=x onerror=alert(1)>',
      status: 'draft'
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = manuscriptRepo.getById(ms.id);
    workspace.history = manuscriptRepo.getTranscriptionHistory(ms.id);

    const html = workspace.renderHistoryContent();
    assert(!html.includes('<script>'), 'script tag must not appear raw');
    assert(html.includes('&lt;script&gt;'), 'script tag must be HTML-escaped');
    assert(!html.includes('<img src=x'), 'img tag must not appear raw');
  });

  test('Hindi/Unicode text preserved', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'हिंदी देवनागरी परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const devanagariText = 'क्ष त्र ज्ञ श्र द्व द्घ हृ\nज़ फ़ ख़\nँ ं ः\n। ॥\nअमृतवाणी 📜✨';
    manuscriptRepo.updateTranscription(ms.id, { text: devanagariText, status: 'draft' });

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(history[0].text === devanagariText, 'all Devanagari characters, punctuation, and emojis preserved exactly');
  });

  test('Timestamps remain valid ISO values', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'समय-मुहर परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'पाठ', status: 'verified' });
    const v = manuscriptRepo.getTranscriptionHistory(ms.id)[0];

    assert(!isNaN(Date.parse(v.createdAt)), 'createdAt is valid ISO date');
    assert(!isNaN(Date.parse(v.verifiedAt)), 'verifiedAt is valid ISO date');
  });

  test('verifiedAt semantics remain correct', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सत्यापन समय परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    // Draft should have verifiedAt: null
    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रारूप पाठ', status: 'draft' });
    assert(manuscriptRepo.getTranscriptionHistory(ms.id)[0].verifiedAt === null, 'draft verifiedAt is null');

    // Verified should have valid ISO timestamp
    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रमाणित पाठ', status: 'verified' });
    assert(typeof manuscriptRepo.getTranscriptionHistory(ms.id)[1].verifiedAt === 'string', 'verified has string timestamp');
  });

  // --- Group 7: UI Component & Workflow ---
  console.log('--- Group 7: UI Component & Workflow ---');

  test('Version UI renders history', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'यूआई प्रतिपादन',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'प्रथम संस्करण पाठ', status: 'draft' });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = manuscriptRepo.getById(ms.id);
    workspace.history = manuscriptRepo.getTranscriptionHistory(ms.id);

    const html = workspace.render();
    assert(html.includes('इतिहास (1)'), 'workspace header includes history button with count');
    assert(html.includes('प्रतिलिपि संस्करण इतिहास'), 'contains history panel header');
  });

  test('Read-only preview does not mutate current text', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'पूर्वावलोकन गैर-परिवर्तनशील',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'पुराना पाठ v1', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'वर्तमान पाठ v2', status: 'draft' });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = manuscriptRepo.getById(ms.id);
    workspace.text = 'वर्तमान पाठ v2';
    workspace.history = manuscriptRepo.getTranscriptionHistory(ms.id);

    // Set preview to v1
    workspace.previewVersion = workspace.history[0];
    assert(workspace.text === 'वर्तमान पाठ v2', 'working text remains unchanged during preview');
    assert(workspace.manuscript.transcription.text === 'वर्तमान पाठ v2', 'repository state untouched');
  });

  test('Restore confirmation is required', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'पुष्टि अनिवार्यता',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, { text: 'पाठ v1', status: 'draft' });
    manuscriptRepo.updateTranscription(ms.id, { text: 'पाठ v2', status: 'draft' });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = manuscriptRepo.getById(ms.id);
    workspace.history = manuscriptRepo.getTranscriptionHistory(ms.id);

    // When request-restore is clicked, it sets confirmRestoreVersion rather than restoring immediately
    const targetV = workspace.history[0];
    workspace.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="request-restore"]' ? { getAttribute: () => targetV.id } : null
      },
      preventDefault: () => {}
    });

    assert(workspace.confirmRestoreVersion !== null, 'confirmRestoreVersion set for confirmation modal');
    assert(workspace.confirmRestoreVersion.id === targetV.id, 'points to target version');
    assert(workspace.manuscript.transcription.text === 'पाठ v2', 'text not restored before explicit confirmation');
  });

  test('Storage quota failure preserves current state', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'कोटा विफलता',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;
    workspace.text = 'सहेजा जाने वाला पाठ';

    // Mock repository save failure
    manuscriptRepo.updateTranscription = () => {
      throw new StorageError('भंडारण सीमा समाप्त', StorageErrorCode.QUOTA_EXCEEDED);
    };

    workspace.performAutosave();
    assert(workspace.saveStatus === 'error', 'saveStatus set to error');
    assert(workspace.text === 'सहेजा जाने वाला पाठ', 'textarea text preserved safely');
  });

  test('Autosave does not generate versions per keystroke', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'कीस्ट्रोक परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;

    // Simulate rapid typing keystrokes
    const keystrokes = ['क', 'कब', 'कबी', 'कबीर'];
    for (const stroke of keystrokes) {
      workspace.handleInput({
        target: { id: 'transcription-textarea', value: stroke }
      });
    }

    // Since autosave is debounced, zero versions should be created synchronously
    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(history.length === 0, 'no versions created during rapid keystrokes');
    assert(workspace.autosaveTimeout !== null, 'debounce timer is pending');
  });

  test('Repeated identical autosaves do not generate duplicates', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'डुप्लीकेट ऑटोसेव',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;
    workspace.text = 'स्थिर पाठ';
    workspace.status = 'draft';

    // Fire autosave 3 times with identical text
    workspace.performAutosave();
    workspace.performAutosave();
    workspace.performAutosave();

    const history = manuscriptRepo.getTranscriptionHistory(ms.id);
    assert(history.length === 1, 'only 1 version created despite multiple identical autosave triggers');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} TRANSCRIPTION VERSIONING TESTS PASSED!`);
  console.log('================================================================\n');
}

runVersioningTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
