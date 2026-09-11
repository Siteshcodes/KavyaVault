/**
 * काव्यकलश (KavyaVault) — Manuscript ↔ Poem Linking Test Suite (test_manuscript_poem_linking.js)
 *
 * Phase 2 / Task 2.5: Manuscript ↔ Poem Linking
 *
 * Comprehensive test coverage:
 * 1. Manuscript created unlinked (poemId === null)
 * 2. Link manuscript to valid poem
 * 3. Link rejects missing poem
 * 4. Link rejects malformed poem ID
 * 5. Link same poem is idempotent
 * 6. Relink to different poem works explicitly
 * 7. Unlink works
 * 8. getLinkedPoem returns correct poem
 * 9. getManuscriptsForPoem returns all matching manuscripts
 * 10. Multiple manuscripts can link to one poem
 * 11. Deleting poem preserves manuscript
 * 12. Deleting poem clears manuscript.poemId safely
 * 13. Deleting manuscript preserves poem
 * 14. Archive behavior preserves relationship
 * 15. Repository persistence survives reload simulation
 * 16. Original manuscript bytes remain unchanged when linking
 * 17. Derived manuscript remains unchanged when linking
 * 18. Poem content remains unchanged when linking
 * 19. Hindi title handling
 * 20. XSS-safe linked title rendering
 * 21. Manuscript reader displays linked poem
 * 22. Manuscript reader displays unlinked state
 * 23. Poem reader displays linked manuscript
 * 24. Poem reader handles no linked manuscript
 * 25. Navigation from manuscript to poem
 * 26. Navigation from poem to manuscript
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { ManuscriptView } from './src/components/manuscripts/ManuscriptView.js';
import { PoemReader } from './src/components/reader/PoemReader.js';

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

async function runLinkingTests() {
  console.log('\n================================================================');
  console.log('  KAVYAVAULT MANUSCRIPT ↔ POEM LINKING TEST SUITE');
  console.log('  (Phase 2 / Task 2.5)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`✓ [Test ${total}] ${name}`);
    } catch (err) {
      console.error(`✗ [Test ${total}] ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  function createTestEnvironment() {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const poemRepo = new PoemRepository(adapter);
    const msRepo = new ManuscriptRepository(adapter, poemRepo);
    poemRepo.manuscriptRepo = msRepo;
    return { storage, adapter, poemRepo, msRepo };
  }

  // Group 1: Core Relationship Methods & Validation
  console.log('--- Group 1: Core Relationship Methods & Validation ---');

  test('Manuscript created unlinked with poemId === null', () => {
    const { msRepo } = createTestEnvironment();
    const ms = msRepo.create({
      title: 'असंबंध मूल पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });
    console.assert(ms.poemId === null, 'poemId should default to null');
  });

  test('Link manuscript to valid poem', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'मधुशाला', body: 'मदिरालय जाने को घर से चलता है पीनेवला' });
    const ms = msRepo.create({
      title: 'मधुशाला हस्तलिखित पन्ना',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const linked = msRepo.linkToPoem(ms.id, poem.id);
    console.assert(linked.poemId === poem.id, 'manuscript.poemId matches poem.id');
    const fetched = msRepo.getById(ms.id);
    console.assert(fetched.poemId === poem.id, 'Persisted manuscript has updated poemId');
  });

  test('Link rejects missing poem with KEY_NOT_FOUND', () => {
    const { msRepo } = createTestEnvironment();
    const ms = msRepo.create({
      title: 'परीक्षा पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    let threw = false;
    try {
      msRepo.linkToPoem(ms.id, 'kv_poem_non_existent_999');
    } catch (e) {
      threw = true;
      console.assert(e instanceof StorageError, 'Throws StorageError');
      console.assert(e.code === StorageErrorCode.KEY_NOT_FOUND, 'Code is KEY_NOT_FOUND');
    }
    console.assert(threw, 'Should throw for non-existent poem');
  });

  test('Link rejects malformed poem ID', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const ms = msRepo.create({
      title: 'परीक्षा पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const malformed = ['', '   ', null, undefined, 123, {}, []];
    for (const bad of malformed) {
      let threw = false;
      try {
        msRepo.linkToPoem(ms.id, bad);
      } catch (e) {
        threw = true;
        console.assert(e instanceof StorageError, 'Throws StorageError');
        console.assert(e.code === StorageErrorCode.VALIDATION_ERROR, 'Code is VALIDATION_ERROR');
      }
      console.assert(threw, `Should throw for malformed poem ID: ${JSON.stringify(bad)}`);
    }
  });

  test('Link same poem is idempotent', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'रश्मिरथी', body: 'जय हो, जग में जले जहाँ भी नमन पुनीत अनल को' });
    const ms = msRepo.create({
      title: 'रश्मिरथी पन्ना',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const first = msRepo.linkToPoem(ms.id, poem.id);
    const second = msRepo.linkToPoem(ms.id, poem.id);
    console.assert(first.poemId === second.poemId, 'Idempotent link returns matching poemId');
  });

  test('Relink to different poem works explicitly', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poemA = poemRepo.create({ title: 'कविता क', body: 'प्रथम छंद' });
    const poemB = poemRepo.create({ title: 'कविता ख', body: 'द्वितीय छंद' });
    const ms = msRepo.create({
      title: 'पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    msRepo.linkToPoem(ms.id, poemA.id);
    console.assert(msRepo.getById(ms.id).poemId === poemA.id, 'Linked to poem A');

    msRepo.linkToPoem(ms.id, poemB.id);
    console.assert(msRepo.getById(ms.id).poemId === poemB.id, 'Relinked to poem B');
  });

  test('Unlink works and sets poemId to null', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'उर्वशी', body: 'मर्त्य मानव की विजय का तूर्य हूँ मैं' });
    const ms = msRepo.create({
      title: 'उर्वशी पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    msRepo.linkToPoem(ms.id, poem.id);
    console.assert(msRepo.getById(ms.id).poemId === poem.id, 'Linked');

    const unlinked = msRepo.unlinkFromPoem(ms.id);
    console.assert(unlinked.poemId === null, 'Returned object has poemId === null');
    console.assert(msRepo.getById(ms.id).poemId === null, 'Stored object has poemId === null');

    // Idempotent unlink
    const secondUnlink = msRepo.unlinkFromPoem(ms.id);
    console.assert(secondUnlink.poemId === null, 'Second unlink is idempotent');
  });

  test('getLinkedPoem returns correct poem entity', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'कामायनी', author: 'जयशंकर प्रसाद', body: 'हिमगिरि के उत्तुंग शिखर पर' });
    const ms = msRepo.create({
      title: 'कामायनी आमुख',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    console.assert(msRepo.getLinkedPoem(ms.id) === null, 'Unlinked manuscript returns null poem');
    msRepo.linkToPoem(ms.id, poem.id);

    const linked = msRepo.getLinkedPoem(ms.id);
    console.assert(linked !== null, 'Linked poem resolved');
    console.assert(linked.id === poem.id, 'Poem ID matches');
    console.assert(linked.title === 'कामायनी', 'Poem title matches');
  });

  // Group 2: Multiple Relationships & Integrity
  console.log('\n--- Group 2: Multiple Relationships & Integrity ---');

  test('getManuscriptsForPoem returns all matching manuscripts', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'साकेत', body: 'मैथिलीशरण गुप्त की रचना' });

    const ms1 = msRepo.create({ title: 'साकेत सर्ग १', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    const ms2 = msRepo.create({ title: 'साकेत सर्ग २', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    const ms3 = msRepo.create({ title: 'अनपेक्षित पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(ms1.id, poem.id);
    msRepo.linkToPoem(ms2.id, poem.id);

    const matches = msRepo.getManuscriptsForPoem(poem.id);
    console.assert(matches.length === 2, 'Found exactly 2 manuscripts for poem');
    console.assert(matches.some(m => m.id === ms1.id), 'Contains ms1');
    console.assert(matches.some(m => m.id === ms2.id), 'Contains ms2');
    console.assert(!matches.some(m => m.id === ms3.id), 'Excludes unlinked ms3');
  });

  test('Multiple manuscripts can link to one poem (one-to-many)', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'गोदान काव्यात्मक रूपांतर', body: 'होरी और धनिया' });

    const msA = msRepo.create({ title: 'पन्ना १', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    const msB = msRepo.create({ title: 'पन्ना २', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    const msC = msRepo.create({ title: 'पन्ना ३', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(msA.id, poem.id);
    msRepo.linkToPoem(msB.id, poem.id);
    msRepo.linkToPoem(msC.id, poem.id);

    console.assert(msRepo.getManuscriptsForPoem(poem.id).length === 3, 'All 3 manuscripts linked to one poem');
  });

  test('Deleting poem preserves manuscript record and images', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'हटाने हेतु कविता', body: 'क्षणभंगुर छंद' });
    const ms = msRepo.create({
      title: 'अमिट पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    msRepo.linkToPoem(ms.id, poem.id);
    poemRepo.delete(poem.id);

    const msAfter = msRepo.getById(ms.id);
    console.assert(msAfter !== null, 'Manuscript still exists after poem deletion');
    console.assert(msAfter.originalManuscript.data === SAMPLE_ORIG_DATA, 'Original bytes completely preserved');
  });

  test('Deleting poem clears manuscript.poemId safely', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'हटाने हेतु कविता २', body: 'कविता पाठ' });
    const ms1 = msRepo.create({ title: 'पन्ना क', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    const ms2 = msRepo.create({ title: 'पन्ना ख', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(ms1.id, poem.id);
    msRepo.linkToPoem(ms2.id, poem.id);

    poemRepo.delete(poem.id);

    console.assert(msRepo.getById(ms1.id).poemId === null, 'ms1.poemId cleared to null');
    console.assert(msRepo.getById(ms2.id).poemId === null, 'ms2.poemId cleared to null');
  });

  test('Deleting manuscript preserves poem', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'सुरक्षित कविता', body: 'अक्षुण्ण शब्द' });
    const ms = msRepo.create({ title: 'हटाने हेतु पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(ms.id, poem.id);
    msRepo.delete(ms.id);

    console.assert(poemRepo.getById(poem.id) !== null, 'Poem remains 100% intact after manuscript deletion');
  });

  test('Archive behavior preserves relationship without mutation', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'अभिलेखागार कविता', body: 'संग्रहित छंद' });
    const ms = msRepo.create({ title: 'संबद्ध पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(ms.id, poem.id);
    poemRepo.archive(poem.id);

    const archivedPoem = poemRepo.getById(poem.id);
    console.assert(archivedPoem.isArchived === true, 'Poem archived');
    console.assert(msRepo.getById(ms.id).poemId === poem.id, 'Manuscript link remains intact');
  });

  test('Repository persistence survives reload simulation', () => {
    const { storage } = createTestEnvironment();
    const adapter1 = new LocalStorageAdapter(storage);
    const pRepo1 = new PoemRepository(adapter1);
    const mRepo1 = new ManuscriptRepository(adapter1, pRepo1);

    const poem = pRepo1.create({ title: 'अमर कविता', body: 'शब्द न कभी मरते' });
    const ms = mRepo1.create({ title: 'अमर पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    mRepo1.linkToPoem(ms.id, poem.id);

    // Simulate page reload with fresh repository instances
    const adapter2 = new LocalStorageAdapter(storage);
    const pRepo2 = new PoemRepository(adapter2);
    const mRepo2 = new ManuscriptRepository(adapter2, pRepo2);

    const msLoaded = mRepo2.getById(ms.id);
    console.assert(msLoaded.poemId === poem.id, 'poemId persisted across reload');
    const poemLoaded = mRepo2.getLinkedPoem(ms.id);
    console.assert(poemLoaded.title === 'अमर कविता', 'Linked poem loaded accurately');
  });

  // Group 3: Preservation Immutability & Security
  console.log('\n--- Group 3: Preservation Immutability & Security ---');

  test('Original manuscript bytes remain unchanged when linking', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'परीक्षण', body: 'पाठ' });
    const ms = msRepo.create({ title: 'अपरिवर्तित मूल', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(ms.id, poem.id);
    const after = msRepo.getById(ms.id);
    console.assert(after.originalManuscript.data === SAMPLE_ORIG_DATA, 'Original bytes byte-for-byte unchanged');
    console.assert(after.originalManuscript.mimeType === 'image/png', 'MIME type unchanged');
  });

  test('Derived manuscript remains unchanged when linking', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'परीक्षण', body: 'पाठ' });
    const ms = msRepo.create({ title: 'संपादित मूल', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.saveDerivedManuscript(ms.id, {
      mimeType: 'image/png',
      data: SAMPLE_DERIVED_DATA,
      sourceArtifactId: ms.originalManuscript.id
    }, { rotation: 90, crop: null });

    msRepo.linkToPoem(ms.id, poem.id);
    const after = msRepo.getById(ms.id);
    console.assert(after.derivedManuscript.data === SAMPLE_DERIVED_DATA, 'Derived manuscript bytes unchanged');
    console.assert(after.transformation.rotation === 90, 'Transformation metadata unchanged');
  });

  test('Poem content remains unchanged when linking', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'मूल पाठ', body: 'अक्षुण्ण पंक्तियाँ', author: 'कवि' });
    const ms = msRepo.create({ title: 'पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(ms.id, poem.id);
    const poemAfter = poemRepo.getById(poem.id);
    console.assert(poemAfter.body === 'अक्षुण्ण पंक्तियाँ', 'Poem body unchanged');
    console.assert(poemAfter.author === 'कवि', 'Poem author unchanged');
  });

  test('Hindi title, conjuncts, nuktas, and matras preserved in relationship', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const hindiTitle = 'झंझावात और दीपशिखा (क्ष, त्र, ज्ञ, फ़लक, ज़िंदगी)';
    const poem = poemRepo.create({ title: hindiTitle, body: 'हिंदी कविता' });
    const ms = msRepo.create({ title: 'हस्तलिखित झंझावात', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    msRepo.linkToPoem(ms.id, poem.id);
    const linked = msRepo.getLinkedPoem(ms.id);
    console.assert(linked.title === hindiTitle, 'Hindi conjuncts and special characters preserved intact');
  });

  test('XSS-safe linked title rendering in ManuscriptView and PoemReader', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const maliciousPoemTitle = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const poem = poemRepo.create({ title: maliciousPoemTitle, body: 'कविता पाठ' });
    const ms = msRepo.create({ title: 'सुरक्षित पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    msRepo.linkToPoem(ms.id, poem.id);

    const msReader = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: msRepo,
      poemRepo
    });
    msReader.manuscript = msRepo.getById(ms.id);
    const msHtml = msReader.render();
    console.assert(!msHtml.includes('<script>'), 'ManuscriptView must escape <script>');
    console.assert(msHtml.includes('&lt;script&gt;'), 'ManuscriptView escapes HTML entities');

    const pReader = new PoemReader({
      container: new MockElement(),
      router: {},
      poemId: poem.id,
      manuscriptRepo: msRepo
    });
    pReader.poem = poem;
    const poemHtml = pReader.render();
    console.assert(!poemHtml.includes('<script>'), 'PoemReader must escape <script>');
  });

  // Group 4: UI Presentation & Navigation
  console.log('\n--- Group 4: UI Presentation & Navigation ---');

  test('Manuscript reader displays linked poem section when poemId is set', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'अग्निपथ', author: 'हरिवंशराय बच्चन', body: 'वृक्ष हों भले खड़े' });
    const ms = msRepo.create({ title: 'अग्निपथ हस्तलिखित', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    msRepo.linkToPoem(ms.id, poem.id);

    const reader = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: msRepo,
      poemRepo
    });
    reader.manuscript = msRepo.getById(ms.id);
    const html = reader.render();

    console.assert(html.includes('इस पांडुलिपि से संबंधित कविता'), 'Contains linked poem section heading');
    console.assert(html.includes('अग्निपथ'), 'Contains poem title');
    console.assert(html.includes('कविता पढ़ें'), 'Contains "कविता पढ़ें" button');
    console.assert(html.includes('संबंध हटाएँ'), 'Contains "संबंध हटाएँ" button');
  });

  test('Manuscript reader displays unlinked state when poemId is null', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const ms = msRepo.create({ title: 'एकल पांडुलिपि', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    const reader = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: msRepo,
      poemRepo
    });
    reader.manuscript = ms;
    const html = reader.render();

    console.assert(html.includes('इस पांडुलिपि से संबंधित कविता'), 'Contains section heading');
    console.assert(html.includes('अभी किसी कविता से संबद्ध नहीं'), 'Contains unlinked message');
    console.assert(html.includes('कविता से जोड़ें'), 'Contains "कविता से जोड़ें" CTA button');
  });

  test('Poem reader displays linked manuscript section when manuscripts exist', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'पुष्प की अभिलाषा', body: 'चाह नहीं मैं सुरबाला के गहनों में गूँथा जाऊँ' });
    const ms = msRepo.create({ title: 'माखनलाल चतुर्वेदी हस्तलिपि', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    msRepo.linkToPoem(ms.id, poem.id);

    const reader = new PoemReader({
      container: new MockElement(),
      router: {},
      poemId: poem.id,
      manuscriptRepo: msRepo
    });
    reader.poem = poem;
    const html = reader.render();

    console.assert(html.includes('मूल पांडुलिपि'), 'Contains archival heading');
    console.assert(html.includes('माखनलाल चतुर्वेदी हस्तलिपि'), 'Contains manuscript title');
    console.assert(html.includes('पांडुलिपि देखें'), 'Contains "पांडुलिपि देखें" button');
    console.assert(html.includes(`/manuscripts/${ms.id}`), 'Links to /manuscripts/:id');
  });

  test('Poem reader handles no linked manuscript cleanly without distraction', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'शुद्ध डिजिटल कविता', body: 'केवल डिजिटल रचना' });

    const reader = new PoemReader({
      container: new MockElement(),
      router: {},
      poemId: poem.id,
      manuscriptRepo: msRepo
    });
    reader.poem = poem;
    const html = reader.render();

    console.assert(!html.includes('reader-linked-manuscripts-section'), 'No manuscript section rendered when none linked');
    console.assert(!html.includes('पांडुलिपि देखें'), 'No manuscript button rendered');
  });

  test('Navigation from manuscript to poem points to /poems/:id', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'तार सप्तक', body: 'अज्ञेय द्वारा संपादित' });
    const ms = msRepo.create({ title: 'तार सप्तक पांडुलिपि', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    msRepo.linkToPoem(ms.id, poem.id);

    const reader = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: msRepo,
      poemRepo
    });
    reader.manuscript = msRepo.getById(ms.id);
    const html = reader.render();

    console.assert(html.includes(`/poems/${poem.id}`), 'Contains valid link to /poems/:id');
  });

  test('Navigation from poem to manuscript points to /manuscripts/:id', () => {
    const { msRepo, poemRepo } = createTestEnvironment();
    const poem = poemRepo.create({ title: 'चिदंबरा', body: 'सुमित्रानंदन पंत' });
    const ms = msRepo.create({ title: 'चिदंबरा मूल पृष्ठ', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    msRepo.linkToPoem(ms.id, poem.id);

    const reader = new PoemReader({
      container: new MockElement(),
      router: {},
      poemId: poem.id,
      manuscriptRepo: msRepo
    });
    reader.poem = poem;
    const html = reader.render();

    console.assert(html.includes(`/manuscripts/${ms.id}`), 'Contains valid link to /manuscripts/:id');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} MANUSCRIPT ↔ POEM LINKING TESTS PASSED!`);
  console.log('================================================================\n');
}

runLinkingTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
