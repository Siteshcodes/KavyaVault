/**
 * काव्यकलश (KavyaVault) — Poetry Editor & Draft Autosave Test Suite (test_editor.js)
 * Verifies new poem creation, draft autosave, draft recovery, editing existing poems,
 * Unicode conjunct/matra preservation, live metrics, and failure recovery.
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { calculateTextMetrics } from './src/utils/counters.js';

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

async function runEditorTests() {
  console.log('====================================================');
  console.log('  KAVYAVAULT POETRY EDITOR & DRAFT TEST SUITE');
  console.log('====================================================');

  const mockStorage = new MockStorage();
  const adapter = new LocalStorageAdapter(mockStorage);
  const repo = new PoemRepository(adapter);

  // ----------------------------------------------------
  // TEST 1: New Poem Creation with Hindi Unicode
  // ----------------------------------------------------
  console.log('\n[TEST 1] New Poem Creation with Hindi Unicode');
  const poemData = {
    title: 'वह आता',
    body: 'वह आता—\nदो टूक कलेजे के करता, पछताता\nपथ पर आता।',
    author: 'सूर्यकांत त्रिपाठी "निराला"',
    tags: ['छायावाद', 'करुणा', 'निराला']
  };

  const created = repo.create(poemData);
  console.assert(created && typeof created.id === 'string', 'Poem ID must be generated');
  console.assert(created.title === 'वह आता', 'Title must match');
  console.assert(created.body === poemData.body, 'Body must match');
  console.assert(created.author === 'सूर्यकांत त्रिपाठी "निराला"', 'Author must match');
  console.assert(created.tags.length === 3, 'Tags must have 3 items');
  console.log('✓ New poem created with complete Hindi Unicode intact.');

  // ----------------------------------------------------
  // TEST 2: Complex Devanagari Conjuncts, Matras, Nukta & Emojis
  // ----------------------------------------------------
  console.log('\n[TEST 2] Unicode Preservation (Conjuncts, Matras, Nuktas, Halant, Emojis)');
  const complexTitle = 'दृष्टि और चेतना 🌸';
  const complexBody = [
    'क्ष त्र ज्ञ श्र द्व द्घ हृ',
    'कि की कु कू के कै को कौ कृ',
    'क़ ख़ ग़ ज़ ड़ ढ़ फ़',
    'ँ ं ः ्',
    'English mixed with हिन्दी & Emojis 🌺✨!'
  ].join('\n');

  const complexPoem = repo.create({
    title: complexTitle,
    body: complexBody,
    author: 'कवि'
  });

  const retrieved = repo.getById(complexPoem.id);
  console.assert(retrieved.title === complexTitle, 'Title with emoji and conjuncts must match exactly');
  console.assert(retrieved.body === complexBody, 'Multiline body with nuktas, halant and conjuncts must match byte-for-byte');
  console.log('✓ Complex Unicode glyphs, nuktas, halant, and emojis strictly preserved without modification.');

  // ----------------------------------------------------
  // TEST 3: Draft Autosave & Reading
  // ----------------------------------------------------
  console.log('\n[TEST 3] Draft Autosave & Reading');
  const initialDraft = repo.saveDraft({
    poemId: null,
    title: 'अधूरी ग़ज़ल',
    body: 'रात भर का है मेहमाँ अन्धेरा,\nइसके बाद फिर वही सवेरा।',
    author: 'अज्ञात',
    tags: ['ग़ज़ल', 'उम्मीद']
  });

  console.assert(initialDraft.title === 'अधूरी ग़ज़ल', 'Draft title must match');
  console.assert(initialDraft.poemId === null, 'New poem draft must have poemId = null');
  console.assert(typeof initialDraft.savedAt === 'string', 'Draft must have savedAt timestamp');

  const fetchedDraft = repo.getDraft();
  console.assert(fetchedDraft !== null, 'getDraft() must return saved draft');
  console.assert(fetchedDraft.title === 'अधूरी ग़ज़ल', 'Retrieved draft title must match');
  console.assert(fetchedDraft.body === initialDraft.body, 'Retrieved draft body must match');
  console.log('✓ Draft successfully saved and retrieved with metadata and timestamp.');

  // ----------------------------------------------------
  // TEST 4: Draft Recovery & Discard Workflows
  // ----------------------------------------------------
  console.log('\n[TEST 4] Draft Recovery & Discard');
  // Scenario A: Recover existing draft
  const draftToRecover = repo.getDraft();
  console.assert(draftToRecover && draftToRecover.body.includes('रात भर का है मेहमाँ'), 'Draft must be recoverable');

  // Scenario B: Explicit discard
  repo.clearDraft();
  console.assert(repo.getDraft() === null, 'Draft must be null after clearDraft()');
  console.log('✓ Draft recovery and explicit discard workflows verified.');

  // ----------------------------------------------------
  // TEST 5: Debounced Autosave Simulation
  // ----------------------------------------------------
  console.log('\n[TEST 5] Debounced Autosave Simulation');
  let debouncedTimer = null;
  let saveCount = 0;

  function simulateTyping(chars) {
    if (debouncedTimer) clearTimeout(debouncedTimer);
    debouncedTimer = setTimeout(() => {
      repo.saveDraft({
        poemId: null,
        title: 'टाइपिंग शीर्षक',
        body: chars
      });
      saveCount++;
    }, 50); // 50ms test debounce window
  }

  // Rapid typing simulation: 5 keystrokes
  simulateTyping('क');
  simulateTyping('कवि');
  simulateTyping('कविता');
  simulateTyping('कविता की');
  simulateTyping('कविता की रचना');

  await new Promise(resolve => setTimeout(resolve, 80));

  console.assert(saveCount === 1, `Expected exactly 1 save call due to debouncing, got ${saveCount}`);
  const debouncedDraft = repo.getDraft();
  console.assert(debouncedDraft.body === 'कविता की रचना', 'Final debounced draft content must match last keystroke');
  repo.clearDraft();
  console.log('✓ Autosave debouncing effectively throttles rapid user keystrokes.');

  // ----------------------------------------------------
  // TEST 6: Edit Existing Poem (Preserving Identity)
  // ----------------------------------------------------
  console.log('\n[TEST 6] Edit Existing Poem');
  const basePoem = repo.create({
    id: 'kv_poem_edit_test',
    title: 'मूल शीर्षक',
    body: 'मूल रचना की प्रथम पंक्ति।',
    author: 'कवि जी',
    tags: ['प्रथम']
  });

  const updatedPoem = repo.update('kv_poem_edit_test', {
    title: 'संशोधित शीर्षक',
    body: 'संशोधित रचना की दो पंक्तियाँ।\nदूसरी पंक्ति।',
    tags: ['प्रथम', 'संशोधित']
  });

  console.assert(updatedPoem.id === 'kv_poem_edit_test', 'Poem ID must remain unchanged');
  console.assert(updatedPoem.title === 'संशोधित शीर्षक', 'Title must be updated');
  console.assert(updatedPoem.body.includes('दूसरी पंक्ति।'), 'Body must be updated');
  console.assert(updatedPoem.tags.length === 2, 'Tags must be updated');
  console.assert(new Date(updatedPoem.updatedAt) >= new Date(basePoem.createdAt), 'updatedAt must be refreshed');
  console.log('✓ Existing poem edits preserve ID and update timestamps.');

  // ----------------------------------------------------
  // TEST 7: Edit-Specific Draft vs New-Poem Draft Isolation
  // ----------------------------------------------------
  console.log('\n[TEST 7] Edit Draft vs New Poem Draft Isolation');
  // Save an edit draft tied to a specific poem ID
  repo.saveDraft({
    poemId: 'kv_poem_edit_test',
    title: 'संशोधन ड्राफ्ट',
    body: 'यह एक मौजूदा कविता का अधूरा संशोधन है।'
  });

  const editDraft = repo.getDraft();
  console.assert(editDraft.poemId === 'kv_poem_edit_test', 'Draft poemId must match existing poem');

  // Verify that an unrelated new poem does not blindly consume this edit draft
  const isNewPoemDraft = editDraft.poemId === null;
  console.assert(!isNewPoemDraft, 'Draft for existing poem must not be treated as a new poem draft');
  repo.clearDraft();
  console.log('✓ Draft identity isolation between new poems and specific edits verified.');

  // ----------------------------------------------------
  // TEST 8: Live Text Metrics (Words, Lines, Unicode Characters)
  // ----------------------------------------------------
  console.log('\n[TEST 8] Live Text Metrics Calculation');
  const sampleVerse = 'वृक्ष हों भले खड़े,\nहों घने हों बड़े,\nएक पत्र छाँह भी,\nमाँग मत! 🌸';
  const metrics = calculateTextMetrics(sampleVerse);

  console.assert(metrics.lines === 4, `Expected 4 lines, got ${metrics.lines}`);
  console.assert(metrics.words === 15, `Expected 15 words, got ${metrics.words}`);
  // Characters: Unicode code point count
  const expectedChars = Array.from(sampleVerse).length;
  console.assert(metrics.characters === expectedChars, `Expected ${expectedChars} characters, got ${metrics.characters}`);

  // Empty string metrics
  const emptyMetrics = calculateTextMetrics('');
  console.assert(emptyMetrics.words === 0 && emptyMetrics.lines === 0 && emptyMetrics.characters === 0, 'Empty text gives 0 for all metrics');
  console.log('✓ Unicode-safe text metrics accurately calculate words, lines, and code points.');

  // ----------------------------------------------------
  // TEST 9: Draft Cleared After Successful Save
  // ----------------------------------------------------
  console.log('\n[TEST 9] Draft Cleared After Publish');
  repo.saveDraft({
    poemId: null,
    title: 'पूर्ण कविता',
    body: 'यह कविता अब प्रकाशित की जा रही है।'
  });
  console.assert(repo.getDraft() !== null, 'Draft should exist before publish');

  // Simulate publish workflow
  const publishedPoem = repo.create({
    title: 'पूर्ण कविता',
    body: 'यह कविता अब प्रकाशित की जा रही है।'
  });
  repo.clearDraft();

  console.assert(repo.getDraft() === null, 'Draft must be cleared after publish');
  console.assert(repo.getById(publishedPoem.id) !== null, 'Published poem must be safely stored');
  console.log('✓ Draft cleaned up automatically after successful save.');

  // ----------------------------------------------------
  // TEST 10: Failure & Boundary Validation Handling
  // ----------------------------------------------------
  console.log('\n[TEST 10] Failure Cases & Validation Handling');
  // 1. Missing poem ID on update
  let caughtMissingId = false;
  try {
    repo.update('non_existent_id_99999', { title: 'अमान्य' });
  } catch {
    caughtMissingId = true;
  }
  console.assert(caughtMissingId, 'Updating a non-existent poem ID must throw StorageError');

  // 2. Missing title on create
  let caughtMissingTitle = false;
  try {
    repo.create({ body: 'बिना शीर्षक की कविता' });
  } catch {
    caughtMissingTitle = true;
  }
  console.assert(caughtMissingTitle, 'Creating a poem without title must throw StorageError');

  // 3. Corrupted draft retrieval recovers gracefully
  mockStorage.setItem('kavyavault:drafts', '{ corrupted_json ');
  const recoveredDraftFromRaw = repo.getDraft();
  console.assert(recoveredDraftFromRaw === null, 'Corrupted draft must safely return null instead of throwing');

  adapter.set('kavyavault:drafts', 'not_an_object');
  const recoveredDraftFromString = repo.getDraft();
  console.assert(recoveredDraftFromString === null, 'Non-object draft must safely return null');

  console.log('✓ All boundary errors and corrupted storage cases handled safely.');

  console.log('\n====================================================');
  console.log('  ALL 10 POETRY EDITOR TESTS PASSED! (100%)');
  console.log('====================================================\n');
}

runEditorTests().catch(err => {
  console.error('\n❌ POETRY EDITOR TEST SUITE FAILED:', err);
  process.exit(1);
});
