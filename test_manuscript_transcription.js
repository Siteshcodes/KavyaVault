/**
 * काव्यकलश (KavyaVault) — Manuscript Transcription Workspace Test Suite (test_manuscript_transcription.js)
 *
 * Phase 2 / Task 2.6: Manuscript Transcription Workspace
 *
 * Comprehensive test coverage:
 * 1. new manuscript starts untranscribed
 * 2. empty transcription text supported safely
 * 3. save draft transcription
 * 4. update existing transcription
 * 5. verified transcription sets verifiedAt
 * 6. editing verified transcription returns status to draft
 * 7. verifiedAt clears after editing
 * 8. invalid status rejected
 * 9. invalid text type rejected
 * 10. invalid verifiedAt rejected
 * 11. missing manuscript ID handled
 * 12. original manuscript bytes remain unchanged
 * 13. original manuscript metadata remains unchanged
 * 14. derived manuscript remains unchanged
 * 15. poem relationship remains unchanged
 * 16. repository persistence survives reload
 * 17. Unicode Devanagari preservation
 * 18. Hindi punctuation preservation
 * 19. mixed Hindi/English preservation
 * 20. emoji preservation
 * 21. Unicode-safe word count
 * 22. Unicode-safe character count
 * 23. XSS-safe transcription preview
 * 24. reader shows transcription status
 * 25. reader links to transcription workspace
 * 26. transcription workspace loads existing text
 * 27. transcription workspace save flow
 * 28. draft status UI
 * 29. verified status UI
 * 30. storage quota failure preserves current text
 * 31. malformed transcription record recovery
 * 32. linked poem remains untouched when transcription changes
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { ManuscriptView } from './src/components/manuscripts/ManuscriptView.js';
import { ManuscriptTranscription } from './src/components/manuscripts/ManuscriptTranscription.js';
import { calculateTextMetrics } from './src/utils/counters.js';

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

// Minimal Mock Element for UI Component Tests
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

async function runTranscriptionTests() {
  console.log('\n================================================================');
  console.log('  KAVYAVAULT MANUSCRIPT TRANSCRIPTION WORKSPACE TEST SUITE');
  console.log('  (Phase 2 / Task 2.6)');
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
      console.error('   ', err.message);
      throw err;
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  function setupRepositories() {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const poemRepo = new PoemRepository(adapter);
    const manuscriptRepo = new ManuscriptRepository(adapter, poemRepo);
    poemRepo.manuscriptRepo = manuscriptRepo;
    return { storage, adapter, poemRepo, manuscriptRepo };
  }

  console.log('--- Group 1: Repository Transcription Lifecycle & Validation ---');

  test('New manuscript starts untranscribed with empty text and null verifiedAt', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'प्राचीन दोहावली',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    assert(ms.transcription !== null, 'transcription should be an object');
    assert(ms.transcription.text === '', 'text should be empty string');
    assert(ms.transcription.status === 'untranscribed', 'status should be untranscribed');
    assert(ms.transcription.verifiedAt === null, 'verifiedAt should be null');
  });

  test('Empty transcription text supported safely', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'रिक्त पांडुलिपि',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    const updated = manuscriptRepo.updateTranscription(ms.id, {
      text: '',
      status: 'untranscribed'
    });

    assert(updated.transcription.text === '', 'text should be empty');
    assert(updated.transcription.status === 'untranscribed', 'status should be untranscribed');
  });

  test('Save draft transcription updates text and status to draft', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'कबीर दोहावली',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    const draftText = 'गुरु गोविंद दोऊ खड़े, काके लागूं पाँय।\nबलिहारी गुरु आपने, गोविंद दियो बताय॥';
    const updated = manuscriptRepo.updateTranscription(ms.id, {
      text: draftText,
      status: 'draft'
    });

    assert(updated.transcription.text === draftText, 'transcription text should match draft');
    assert(updated.transcription.status === 'draft', 'status should be draft');
    assert(updated.transcription.verifiedAt === null, 'verifiedAt should be null for draft');
  });

  test('Update existing transcription retains text and updates content', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'मीराबाई पद',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'पायो जी मैंने राम रतन धन पायो',
      status: 'draft'
    });

    const updated = manuscriptRepo.updateTranscription(ms.id, {
      text: 'पायो जी मैंने राम रतन धन पायो।\nवस्तु अमोलक दी म्हारे सतगुरु, किरपा कर अपनायो॥'
    });

    assert(updated.transcription.text.includes('वस्तु अमोलक'), 'text should be updated');
    assert(updated.transcription.status === 'draft', 'status should remain draft');
  });

  test('Verified transcription sets verifiedAt ISO timestamp', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सूरदास पद',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    const text = 'मैया मोहि दाऊ बहुत खिझायौ।\nमोसों कहत मोल को लीन्हौ, तू जसुमति कब जायौ॥';
    const updated = manuscriptRepo.updateTranscription(ms.id, {
      text,
      status: 'verified'
    });

    assert(updated.transcription.status === 'verified', 'status should be verified');
    assert(typeof updated.transcription.verifiedAt === 'string', 'verifiedAt should be a string');
    assert(!isNaN(Date.parse(updated.transcription.verifiedAt)), 'verifiedAt should be valid ISO date');
  });

  test('Editing verified transcription returns status to draft automatically', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'रहीम दोहावली',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'रहिमन धागा प्रेम का, मत तोड़ो चटकाय।',
      status: 'verified'
    });

    // Edit text without passing status
    const edited = manuscriptRepo.updateTranscription(ms.id, {
      text: 'रहिमन धागा प्रेम का, मत तोरौ चटकाय। टूटे पे फिर ना जुरे...'
    });

    assert(edited.transcription.status === 'draft', 'status should automatically return to draft');
  });

  test('verifiedAt clears after editing verified text', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'तुलसीदास चौपाई',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    const verified = manuscriptRepo.updateTranscription(ms.id, {
      text: 'मंगल भवन अमंगल हारी। द्रवहु सुदसरथ अcharacter बिहारी॥',
      status: 'verified'
    });
    assert(verified.transcription.verifiedAt !== null, 'should have verifiedAt');

    const edited = manuscriptRepo.updateTranscription(ms.id, {
      text: 'मंगल भवन अमंगल हारी। द्रवहु सुदसरथ अजिर बिहारी॥'
    });

    assert(edited.transcription.verifiedAt === null, 'verifiedAt should be cleared to null upon edit');
    assert(edited.transcription.status === 'draft', 'status should be draft');
  });

  test('Invalid status rejected with VALIDATION_ERROR', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    let threw = false;
    try {
      manuscriptRepo.updateTranscription(ms.id, {
        status: 'published' // Invalid status
      });
    } catch (err) {
      threw = true;
      assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'should throw VALIDATION_ERROR');
    }
    assert(threw, 'should throw for invalid status');
  });

  test('Invalid text type rejected with VALIDATION_ERROR', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    let threw = false;
    try {
      manuscriptRepo.updateTranscription(ms.id, {
        text: 12345 // Not a string
      });
    } catch (err) {
      threw = true;
      assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'should throw VALIDATION_ERROR');
    }
    assert(threw, 'should throw for non-string text');
  });

  test('Invalid verifiedAt format rejected with VALIDATION_ERROR', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    let threw = false;
    try {
      manuscriptRepo.updateTranscription(ms.id, {
        verifiedAt: 'not-a-date'
      });
    } catch (err) {
      threw = true;
      assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'should throw VALIDATION_ERROR');
    }
    assert(threw, 'should throw for invalid date');
  });

  test('Missing or non-existent manuscript ID handled safely', () => {
    const { manuscriptRepo } = setupRepositories();

    // 1. Missing ID
    let threwValidation = false;
    try {
      manuscriptRepo.updateTranscription('', { text: 'परीक्षण' });
    } catch (err) {
      threwValidation = true;
      assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'should throw VALIDATION_ERROR for empty ID');
    }
    assert(threwValidation, 'should fail on empty string ID');

    // 2. Non-existent ID
    let threwNotFound = false;
    try {
      manuscriptRepo.updateTranscription('kv_ms_nonexistent', { text: 'परीक्षण' });
    } catch (err) {
      threwNotFound = true;
      assert(err.code === StorageErrorCode.KEY_NOT_FOUND, 'should throw KEY_NOT_FOUND');
    }
    assert(threwNotFound, 'should fail on non-existent manuscript ID');
  });

  console.log('--- Group 2: Preservation Immutability & Persistence ---');

  test('Original manuscript bytes remain 100% unchanged after transcription', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'अपरिवर्तनीय मूल',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA
      }
    });

    const origBytesBefore = ms.originalManuscript.data;

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'पहला संपादन...',
      status: 'draft'
    });

    const afterDraft = manuscriptRepo.getById(ms.id);
    assert(afterDraft.originalManuscript.data === origBytesBefore, 'original data must not change in draft');

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'प्रमाणित प्रतिलिपि पाठ',
      status: 'verified'
    });

    const afterVerify = manuscriptRepo.getById(ms.id);
    assert(afterVerify.originalManuscript.data === origBytesBefore, 'original data must not change on verify');
  });

  test('Original manuscript metadata remains completely unchanged', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'मूल पाण्डुलिपि अभिलेख',
      originalManuscript: {
        filename: 'diary_entry_1947.png',
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA,
        capturedAt: '2026-09-01T10:00:00.000Z'
      }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'स्वतंत्रता दिवस का प्रथम प्रभात...',
      status: 'draft'
    });

    const retrieved = manuscriptRepo.getById(ms.id);
    assert(retrieved.originalManuscript.filename === 'diary_entry_1947.png', 'filename intact');
    assert(retrieved.originalManuscript.capturedAt === '2026-09-01T10:00:00.000Z', 'capturedAt intact');
    assert(retrieved.originalManuscript.mimeType === 'image/png', 'mimeType intact');
  });

  test('Derived manuscript remains completely unchanged when transcription updates', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'संपादित प्रति परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      derivedManuscript: {
        id: 'kv_art_derived_1',
        sourceArtifactId: 'kv_art_orig_1',
        data: SAMPLE_DERIVED_DATA,
        mimeType: 'image/png'
      },
      transformation: {
        rotation: 90,
        crop: null,
        transformVersion: 1
      }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'प्रतिलिपि कार्य जारी...',
      status: 'draft'
    });

    const retrieved = manuscriptRepo.getById(ms.id);
    assert(retrieved.derivedManuscript.data === SAMPLE_DERIVED_DATA, 'derived image unchanged');
    assert(retrieved.transformation.rotation === 90, 'rotation unchanged');
  });

  test('Poem relationship remains unchanged when transcription changes', () => {
    const { manuscriptRepo, poemRepo } = setupRepositories();
    const poem = poemRepo.create({
      title: 'डिजिटल कविता',
      body: 'पंक्तियाँ यहाँ हैं...'
    });

    const ms = manuscriptRepo.create({
      title: 'संबद्ध पांडुलिपि',
      poemId: poem.id,
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    manuscriptRepo.updateTranscription(ms.id, {
      text: 'हस्तलिखित पांडुलिपि की भिन्न प्रतिलिपि',
      status: 'draft'
    });

    const retrieved = manuscriptRepo.getById(ms.id);
    assert(retrieved.poemId === poem.id, 'poemId remains linked');
  });

  test('Repository persistence survives reload simulation', () => {
    const storage = new MockStorage();
    const adapter1 = new LocalStorageAdapter(storage);
    const repo1 = new ManuscriptRepository(adapter1);

    const ms = repo1.create({
      title: 'पुनर्भारण पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    repo1.updateTranscription(ms.id, {
      text: 'स्थायी देवनागरी प्रतिलिपि...',
      status: 'verified'
    });

    // Simulate page reload / fresh repo
    const adapter2 = new LocalStorageAdapter(storage);
    const repo2 = new ManuscriptRepository(adapter2);
    const retrieved = repo2.getById(ms.id);

    assert(retrieved.transcription.text === 'स्थायी देवनागरी प्रतिलिपि...', 'text persists after reload');
    assert(retrieved.transcription.status === 'verified', 'status persists after reload');
    assert(retrieved.transcription.verifiedAt !== null, 'verifiedAt persists after reload');
  });

  console.log('--- Group 3: Unicode & Literary Preservation ---');

  test('Unicode Devanagari conjuncts, matras, nuktas, and chandrabindu preserved exactly', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'देवनागरी संयुक्ताक्षर परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const complexDevanagari = 'क्ष त्र ज्ञ श्र द्ध द्व द्घ हृ ज़ फ़ ख़ अँ अँधियारा चाँद बिंदुः';
    manuscriptRepo.updateTranscription(ms.id, {
      text: complexDevanagari,
      status: 'draft'
    });

    const retrieved = manuscriptRepo.getById(ms.id);
    assert(retrieved.transcription.text === complexDevanagari, 'all complex Devanagari characters preserved');
  });

  test('Hindi punctuation (danda, double danda) preserved accurately', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'विराम चिह्न',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const punctuatedText = 'प्रथम चरण का अंत। द्वितीय चरण का विराम॥';
    manuscriptRepo.updateTranscription(ms.id, {
      text: punctuatedText,
      status: 'draft'
    });

    const retrieved = manuscriptRepo.getById(ms.id);
    assert(retrieved.transcription.text === punctuatedText, 'danda and double danda preserved');
  });

  test('Mixed Hindi and English preserved cleanly', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'द्विभाषी अभिलेख',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const mixedText = 'Verse 1: जल ही जीवन है। Note: Written in 1942 at Sevagram.';
    manuscriptRepo.updateTranscription(ms.id, {
      text: mixedText,
      status: 'draft'
    });

    const retrieved = manuscriptRepo.getById(ms.id);
    assert(retrieved.transcription.text === mixedText, 'mixed Hindi/English preserved');
  });

  test('Emoji characters preserved without UTF-16 corruption', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'इमोजी परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const emojiText = 'साहित्य 📜 की अमर ज्योति ✍️ और काव्य पुष्प 🌸';
    manuscriptRepo.updateTranscription(ms.id, {
      text: emojiText,
      status: 'draft'
    });

    const retrieved = manuscriptRepo.getById(ms.id);
    assert(retrieved.transcription.text === emojiText, 'emojis preserved intact');
  });

  test('Unicode-safe word count produces expected token count', () => {
    const sample = 'कबीर दास जी के अनमोल दोहे';
    const metrics = calculateTextMetrics(sample);
    assert(metrics.words === 6, `expected 6 words, got ${metrics.words}`);
  });

  test('Unicode-safe character count accurately counts code points with emojis and matras', () => {
    const sample = 'काव्य ✍️';
    const metrics = calculateTextMetrics(sample);
    // Array.from('काव्य ✍️').length accounts for code points safely
    assert(metrics.characters === Array.from(sample).length, 'character count matches code points');
  });

  console.log('--- Group 4: UI & Reader Integration ---');

  test('XSS-safe transcription preview escapes malicious script tags', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सुरक्षा परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: {
        text: '<script>alert("xss")</script><img src="x" onerror="alert(1)">',
        status: 'draft'
      }
    });

    const view = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    view.manuscript = ms;

    const html = view.renderTranscriptionSection();
    assert(!html.includes('<script>'), 'script tag must not appear raw in output');
    assert(html.includes('&lt;script&gt;'), 'script tag must be HTML-escaped');
  });

  test('Reader displays transcription status and preview', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'पाठक दृश्य परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: {
        text: 'पोथी पढ़ि पढ़ि जग मुआ, पंडित भया न कोय।\nढाई आखर प्रेम का, पढ़े सो पंडित होय॥',
        status: 'verified',
        verifiedAt: '2026-09-10T12:00:00.000Z'
      }
    });

    const view = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    view.manuscript = ms;

    const html = view.render();
    assert(html.includes('प्रमाणित'), 'header and section should show verified label');
    assert(html.includes('पोथी पढ़ि पढ़ि जग मुआ'), 'preview should show poem lines');
    assert(html.includes('शब्द:'), 'should show word count metric');
  });

  test('Reader provides direct link to transcription workspace', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'लिंक परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const view = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    view.manuscript = ms;

    const html = view.render();
    const expectedRoute = `/manuscripts/${encodeURIComponent(ms.id)}/transcribe`;
    assert(html.includes(expectedRoute), `html must contain link to ${expectedRoute}`);
  });

  console.log('--- Group 5: Workspace Component & Workflow ---');

  test('Transcription workspace loads existing transcription text', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'कक्ष लोड परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: {
        text: 'मौजूदा प्रतिलिपि पाठ यहाँ उपस्थित है',
        status: 'draft'
      }
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;
    workspace.text = ms.transcription.text;
    workspace.status = ms.transcription.status;

    const html = workspace.render();
    assert(html.includes('मौजूदा प्रतिलिपि पाठ यहाँ उपस्थित है'), 'rendered textarea must contain existing text');
  });

  test('Transcription workspace save flow saves text through repository', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'सहेजें प्रवाह',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;
    workspace.text = 'नवीन प्रतिलिपि पाठ';
    workspace.status = 'draft';

    workspace.performAutosave();

    assert(workspace.saveStatus === 'saved', 'saveStatus should be saved');
    const persisted = manuscriptRepo.getById(ms.id);
    assert(persisted.transcription.text === 'नवीन प्रतिलिपि पाठ', 'text must be persisted in repository');
  });

  test('Draft status UI reflects draft state accurately', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'प्रारूप स्थिति',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: { text: 'अपूर्ण रचना...', status: 'draft' }
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;
    workspace.text = ms.transcription.text;
    workspace.status = ms.transcription.status;

    const html = workspace.render();
    assert(html.includes('status-draft'), 'should have status-draft class');
    assert(html.includes('प्रारूप'), 'should have Hindi draft label');
  });

  test('Verified status UI and handleVerify workflow', () => {
    const { manuscriptRepo } = setupRepositories();
    const ms = manuscriptRepo.create({
      title: 'प्रमाणीकरण प्रवाह',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: { text: 'सत्यापन योग्य संपूर्ण दोहा', status: 'draft' }
    });

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;
    workspace.text = ms.transcription.text;
    workspace.status = ms.transcription.status;

    workspace.handleVerify();

    assert(workspace.status === 'verified', 'status should be verified');
    const persisted = manuscriptRepo.getById(ms.id);
    assert(persisted.transcription.status === 'verified', 'persisted record should be verified');
    assert(persisted.transcription.verifiedAt !== null, 'verifiedAt should be set');
  });

  test('Storage quota failure preserves current textarea text and signals error', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const manuscriptRepo = new ManuscriptRepository(adapter);

    const ms = manuscriptRepo.create({
      title: 'कोटा विफलता परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    // Mock adapter set to throw QuotaExceededError
    adapter.set = () => {
      throw new StorageError('भंडारण सीमा समाप्त (Quota Exceeded)', StorageErrorCode.QUOTA_EXCEEDED);
    };

    const workspace = new ManuscriptTranscription({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: manuscriptRepo
    });
    workspace.manuscript = ms;
    workspace.text = 'अति मूल्यवान प्रतिलिपि जो खोनी नहीं चाहिए';

    workspace.performAutosave();

    // Verify text is NOT wiped
    assert(workspace.text === 'अति मूल्यवान प्रतिलिपि जो खोनी नहीं चाहिए', 'text in memory must remain preserved');
    assert(workspace.saveStatus === 'error', 'saveStatus should be error');
    assert(workspace.saveError !== null, 'saveError should capture quota failure message');
  });

  test('Malformed transcription record recovery handles missing transcription fields', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const manuscriptRepo = new ManuscriptRepository(adapter);

    // Force corrupted manuscript into storage with null transcription
    const raw = [{
      id: 'kv_ms_corrupt',
      title: 'विकृत अभिलेख',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: null // Corrupted field
    }];
    adapter.set('kavyavault:manuscripts', raw);

    const updated = manuscriptRepo.updateTranscription('kv_ms_corrupt', {
      text: 'पुनर्प्राप्त प्रतिलिपि',
      status: 'draft'
    });

    assert(updated.transcription.text === 'पुनर्प्राप्त प्रतिलिपि', 'should successfully recover and update text');
    assert(updated.transcription.status === 'draft', 'should recover status');
  });

  test('Linked poem remains untouched when transcription changes', () => {
    const { manuscriptRepo, poemRepo } = setupRepositories();
    const originalPoemBody = 'मूल कविता की पंक्तियाँ\nजो किसी भी हाल में बदलनी नहीं चाहिए।';
    const poem = poemRepo.create({
      title: 'अपरिवर्तनीय कविता',
      body: originalPoemBody
    });

    const ms = manuscriptRepo.create({
      title: 'संबद्ध पांडुलिपि',
      poemId: poem.id,
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    // Update and verify transcription
    manuscriptRepo.updateTranscription(ms.id, {
      text: 'हस्तलिखित पांडुलिपि से भिन्न पाठ',
      status: 'verified'
    });

    // Verify poem is 100% untouched
    const retrievedPoem = poemRepo.getById(poem.id);
    assert(retrievedPoem.body === originalPoemBody, 'poem body must not be touched by manuscript transcription');
    assert(retrievedPoem.title === 'अपरिवर्तनीय कविता', 'poem title must not be touched');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} TRANSCRIPTION WORKSPACE TESTS PASSED!`);
  console.log('================================================================\n');
}

runTranscriptionTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
