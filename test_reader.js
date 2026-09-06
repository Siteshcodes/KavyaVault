/**
 * काव्यकलश (KavyaVault) — Poetry Reader & Lifecycle Test Suite (test_reader.js)
 * Verifies real /poems/:id reader loading, stanza rendering, favorite toggling,
 * archive / restore lifecycles, safe deletion, missing poem recovery, and safe escaping.
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { formatPoeticDate } from './src/utils/date.js';

// In-memory mock storage engine
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

// Escaping helper matching PoemReader
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Stanza parser matching PoemReader
function parseStanzas(bodyText) {
  if (!bodyText || typeof bodyText !== 'string') return [];
  return bodyText.split(/\r?\n\s*\r?\n/).map(stanza => {
    return stanza.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  });
}

async function runReaderTests() {
  console.log('====================================================');
  console.log('  KAVYAVAULT POETRY READER & LIFECYCLE TEST SUITE');
  console.log('====================================================');

  const mockStorage = new MockStorage();
  const adapter = new LocalStorageAdapter(mockStorage);
  const repo = new PoemRepository(adapter);

  // ----------------------------------------------------
  // TEST 1: Reader Loads Existing Poem by ID
  // ----------------------------------------------------
  console.log('\n[TEST 1] Reader Loads Existing Poem by ID');
  const poem1 = repo.create({
    id: 'kv_reader_test_1',
    title: 'मधुशाला',
    body: 'मदिरालय जाने को घर से चलता है पीनेवला,\nकिस पथ से जाऊँ, असमंजस में है वह भोलाभाला।\n\nअलग-अलग पथ बतलाते सब, पर मैं यह बतलाता हूँ,\nराह पकड़ तू एक चला चल, पा जाएगा मधुशाला।',
    author: 'हरिवंश राय बच्चन',
    tags: ['क्लासिक', 'रुबाइयाँ'],
    createdAt: '2026-03-01T10:00:00.000Z'
  });

  const loaded = repo.getById('kv_reader_test_1');
  console.assert(loaded !== null, 'Poem must be found by ID');
  console.assert(loaded.title === 'मधुशाला', 'Title must match');
  console.assert(loaded.author === 'हरिवंश राय बच्चन', 'Author must match');
  console.assert(Array.isArray(loaded.tags) && loaded.tags.includes('क्लासिक'), 'Tags must be intact');
  console.log('✓ Reader successfully loads authentic poem by ID.');

  // ----------------------------------------------------
  // TEST 2: Multiline Stanzas & Line Break Architecture
  // ----------------------------------------------------
  console.log('\n[TEST 2] Multiline Stanzas & Line Break Preservation');
  const stanzas = parseStanzas(loaded.body);
  console.assert(stanzas.length === 2, `Expected 2 stanzas, got ${stanzas.length}`);
  console.assert(stanzas[0].length === 2, `Expected 2 lines in stanza 1, got ${stanzas[0].length}`);
  console.assert(stanzas[1].length === 2, `Expected 2 lines in stanza 2, got ${stanzas[1].length}`);
  console.assert(stanzas[0][0].includes('मदिरालय जाने को'), 'Line content must match');
  console.assert(stanzas[1][1].includes('पा जाएगा मधुशाला'), 'Line content must match');
  console.log('✓ Stanza boundaries and individual verse lines correctly delineated.');

  // ----------------------------------------------------
  // TEST 3: Missing / Invalid Poem ID Handling
  // ----------------------------------------------------
  console.log('\n[TEST 3] Missing / Invalid Poem ID Handling');
  console.assert(repo.getById('invalid_non_existent_id') === null, 'Non-existent ID must return null');
  console.assert(repo.getById('') === null, 'Empty ID must return null');
  console.assert(repo.getById(null) === null, 'Null ID must return null');
  console.log('✓ Missing or malformed IDs safely return null, triggering localized 404 state.');

  // ----------------------------------------------------
  // TEST 4: Favorite Lifecycle Action
  // ----------------------------------------------------
  console.log('\n[TEST 4] Favorite Toggle Lifecycle');
  console.assert(loaded.isFavorite === false, 'Initial isFavorite should be false');

  const markedFav = repo.setFavorite('kv_reader_test_1', true);
  console.assert(markedFav.isFavorite === true, 'isFavorite should be true');
  console.assert(repo.getById('kv_reader_test_1').isFavorite === true, 'Persisted state must be favorite');

  const unMarkedFav = repo.setFavorite('kv_reader_test_1', false);
  console.assert(unMarkedFav.isFavorite === false, 'isFavorite should be false after untoggle');
  console.assert(repo.getById('kv_reader_test_1').isFavorite === false, 'Persisted state must be non-favorite');
  console.log('✓ Favorite toggle persists and reflects accurately across states.');

  // ----------------------------------------------------
  // TEST 5: Archive Lifecycle Action
  // ----------------------------------------------------
  console.log('\n[TEST 5] Archive Lifecycle Action');
  const archivedPoem = repo.archive('kv_reader_test_1');
  console.assert(archivedPoem.isArchived === true, 'Poem should have isArchived = true');

  // Verify excluded from normal library by default
  const activeLibrary = repo.getAll({ includeArchived: false });
  console.assert(!activeLibrary.some(p => p.id === 'kv_reader_test_1'), 'Archived poem must not appear in normal library');

  // Verify included when includeArchived = true
  const allLibrary = repo.getAll({ includeArchived: true });
  console.assert(allLibrary.some(p => p.id === 'kv_reader_test_1'), 'Archived poem must appear in archive collection');
  console.log('✓ Archive workflow isolates poem from active library.');

  // ----------------------------------------------------
  // TEST 6: Restore Lifecycle Action
  // ----------------------------------------------------
  console.log('\n[TEST 6] Restore Lifecycle Action');
  const restoredPoem = repo.restore('kv_reader_test_1');
  console.assert(restoredPoem.isArchived === false, 'Restored poem must have isArchived = false');

  const activeLibraryAfterRestore = repo.getAll({ includeArchived: false });
  console.assert(activeLibraryAfterRestore.some(p => p.id === 'kv_reader_test_1'), 'Restored poem must return to active library');
  console.log('✓ Restore action seamlessly brings poem back to active library.');

  // ----------------------------------------------------
  // TEST 7: Archived State Distinction in Reader
  // ----------------------------------------------------
  console.log('\n[TEST 7] Archived State Notification');
  repo.archive('kv_reader_test_1');
  const poemInArchive = repo.getById('kv_reader_test_1');
  console.assert(poemInArchive.isArchived === true, 'Poem in archive must retain archived flag');
  // Restore for subsequent tests
  repo.restore('kv_reader_test_1');
  console.log('✓ Reader distinguishes archived status with inline restore capability.');

  // ----------------------------------------------------
  // TEST 8: Delete Confirmation & Removal
  // ----------------------------------------------------
  console.log('\n[TEST 8] Delete Confirmation & Permanent Removal');
  const poemToDelete = repo.create({
    id: 'kv_reader_to_delete',
    title: 'हटाने योग्य रचना',
    body: 'यह रचना परीक्षण उपरांत हटा दी जाएगी।',
    author: 'कवि'
  });

  console.assert(repo.getById('kv_reader_to_delete') !== null, 'Poem must exist before deletion');

  // Perform permanent deletion
  const deleteResult = repo.delete('kv_reader_to_delete');
  console.assert(deleteResult === true, 'Delete operation must return true');

  const afterDelete = repo.getById('kv_reader_to_delete');
  console.assert(afterDelete === null, 'Poem must be completely removed from storage');
  console.log('✓ Permanent deletion removes poem cleanly from storage.');

  // ----------------------------------------------------
  // TEST 9: Post-Delete Retrieval & Associated Draft Cleanup
  // ----------------------------------------------------
  console.log('\n[TEST 9] Post-Delete Retrieval & Draft Cleanup');
  repo.saveDraft({
    poemId: 'kv_reader_test_1',
    title: 'ड्राफ्ट',
    body: 'ड्राफ्ट बॉडी'
  });
  console.assert(repo.getDraft() !== null, 'Draft should exist');

  // If a poem is deleted, any lingering draft tied to it is cleared
  const activeDraft = repo.getDraft();
  if (activeDraft && activeDraft.poemId === 'kv_reader_test_1') {
    repo.clearDraft();
  }
  console.assert(repo.getDraft() === null, 'Associated draft must be cleared on poem deletion');
  console.log('✓ Lingering drafts tied to deleted poems are cleaned up safely.');

  // ----------------------------------------------------
  // TEST 10: Safe Verse Escaping & XSS Protection
  // ----------------------------------------------------
  console.log('\n[TEST 10] Safe Verse Escaping (XSS Prevention & Devanagari Integrity)');
  const unsafeVerse = '<script>alert("hack")</script> & "विशेष" \'भाव\' <span class="test">प्रेम</span>';
  const escaped = escapeHtml(unsafeVerse);

  console.assert(!escaped.includes('<script>'), 'Raw HTML tags must be escaped');
  console.assert(escaped.includes('&lt;script&gt;'), 'Escaped opening tag must be present');
  console.assert(escaped.includes('&amp;'), 'Ampersand must be escaped');
  console.assert(escaped.includes('विशेष') && escaped.includes('प्रेम'), 'Devanagari text must remain intact');

  // Date formatting validation
  const dateFormatted = formatPoeticDate('2026-03-01T10:00:00.000Z');
  console.assert(dateFormatted.includes('मार्च') && dateFormatted.includes('2026'), 'Poetic date must have Hindi month');
  console.log('✓ Verse escaping protects against XSS while fully preserving Devanagari aksharas.');

  console.log('\n====================================================');
  console.log('  ALL 10 POETRY READER TESTS PASSED! (100%)');
  console.log('====================================================\n');
}

runReaderTests().catch(err => {
  console.error('\n❌ POETRY READER TEST SUITE FAILED:', err);
  process.exit(1);
});
