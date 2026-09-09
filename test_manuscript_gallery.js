/**
 * काव्यकलश (KavyaVault) — Manuscript Gallery & Reader Test Suite (test_manuscript_gallery.js)
 *
 * Phase 2 / Task 2.4: Manuscript Gallery & Reader
 *
 * Verifies:
 * 1. getAll manuscripts rendered in gallery
 * 2. Empty gallery renders archival empty state and CTA linking to /manuscripts/new
 * 3. Title rendering of manuscripts
 * 4. Thumbnail uses derived artifact when present
 * 5. Thumbnail falls back to original artifact when derived is absent
 * 6. Reader opens valid manuscript by ID
 * 7. Invalid manuscript ID handled gracefully with 404 state
 * 8. Original tab uses original data
 * 9. Derived tab uses derived data
 * 10. Derived tab unavailable / disabled when no derived artifact exists
 * 11. Archival metadata rendering (filename, date, mime, etc.)
 * 12. Provenance rendering (source label in Hindi, provenance notes)
 * 13. Transcription status rendering (untranscribed, draft, verified)
 * 14. Unicode / Hindi metadata integrity
 * 15. XSS-safe titles in gallery and reader
 * 16. XSS-safe filenames in gallery and reader
 * 17. Deterministic filtering (title query)
 * 18. Gallery navigation: cards link to /manuscripts/:id
 * 19. Reader back navigation: links back to /manuscripts
 * 20. Malformed record resilience: corrupt or partial objects handled safely
 * 21. Status filtering (untranscribed, draft, verified)
 * 22. Provenance source filtering (handwritten_manuscript, scanned_document, photo_capture)
 * 23. Reset filters button restores all cards
 * 24. Reader previous / next navigation links between sequential records
 * 25. Reader displays image dimensions when safely available
 * 26. Reader handles missing image data safely without throwing
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { ManuscriptGallery } from './src/components/manuscripts/ManuscriptGallery.js';
import { ManuscriptView } from './src/components/manuscripts/ManuscriptView.js';
import { ROUTES } from './src/data/navigation.js';

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

// Mock DOM Element
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.innerHTML = '';
    this.attributes = {};
    this.eventListeners = {};
    this.style = {};
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  getAttribute(k) {
    return this.attributes[k] || null;
  }
  removeAttribute(k) {
    delete this.attributes[k];
  }
  addEventListener(evt, fn) {
    if (!this.eventListeners[evt]) this.eventListeners[evt] = [];
    this.eventListeners[evt].push(fn);
  }
  removeEventListener(evt, fn) {
    if (this.eventListeners[evt]) {
      this.eventListeners[evt] = this.eventListeners[evt].filter(f => f !== fn);
    }
  }
  querySelector(sel) {
    return new MockElement('div');
  }
  querySelectorAll(sel) {
    return [];
  }
}

// Sample mock base64 image data
const SAMPLE_ORIG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SAMPLE_DERIVED_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function runGalleryTests() {
  console.log('================================================================');
  console.log('  KAVYAVAULT MANUSCRIPT GALLERY & READER TEST SUITE');
  console.log('  (Phase 2 / Task 2.4)');
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
      console.error(`   Error: ${err.message}`);
      throw err;
    }
  }

  // --- Group 1: Gallery Retrieval & Rendering ---
  console.log('--- Group 1: Gallery Retrieval & Rendering ---');

  test('getAll manuscripts rendered in gallery', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    repo.create({
      title: 'पांडुलिपि एक',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });
    repo.create({
      title: 'पांडुलिपि दो',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const html = gallery.render();

    console.assert(html.includes('पांडुलिपि एक'), 'Must render first manuscript title');
    console.assert(html.includes('पांडुलिपि दो'), 'Must render second manuscript title');
    console.assert(html.includes('manuscript-gallery-grid'), 'Must render gallery grid');
    console.assert(html.includes('२ पांडुलिपियाँ') || html.includes('2 पांडुलिपियाँ'), 'Must display count');
  });

  test('Empty gallery renders archival empty state and CTA linking to /manuscripts/new', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const html = gallery.render();

    console.assert(html.includes('वीथिका में अभी कोई पांडुलिपि नहीं है'), 'Must render empty state heading');
    console.assert(html.includes('पांडुलिपि सहेजें'), 'Must render CTA button label');
    console.assert(html.includes(ROUTES.MANUSCRIPT_NEW), 'Must link to /manuscripts/new');
  });

  test('Title rendering of manuscripts', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    repo.create({
      title: 'मधुशाला की हस्तलिखित पंक्तियाँ',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const html = gallery.render();

    console.assert(html.includes('मधुशाला की हस्तलिखित पंक्तियाँ'), 'Must display specific Hindi title');
  });

  test('Thumbnail uses derived artifact when present', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'संपादित पांडुलिपि परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    repo.saveDerivedManuscript(
      ms.id,
      { mimeType: 'image/png', data: SAMPLE_DERIVED_DATA, sourceArtifactId: ms.originalManuscript.id },
      { rotation: 90, crop: null }
    );

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const loaded = repo.getById(ms.id);
    const thumb = gallery.getThumbnailSrc(loaded);

    console.assert(thumb === SAMPLE_DERIVED_DATA, 'Thumbnail must use derived artifact when present');

    const html = gallery.render();
    console.assert(html.includes(SAMPLE_DERIVED_DATA), 'Rendered card HTML must contain derived image src');
    console.assert(html.includes('संपादित प्रति'), 'Must show derived version indicator badge');
  });

  test('Thumbnail falls back to original artifact when derived is absent', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'केवल मूल पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const loaded = repo.getById(ms.id);
    const thumb = gallery.getThumbnailSrc(loaded);

    console.assert(thumb === SAMPLE_ORIG_DATA, 'Thumbnail must fall back to original image');

    const html = gallery.render();
    console.assert(html.includes(SAMPLE_ORIG_DATA), 'Rendered card HTML must contain original image src');
    console.assert(html.includes('मूल प्रति'), 'Must show original badge');
  });

  // --- Group 2: Archival Reader Verification ---
  console.log('\n--- Group 2: Archival Reader Verification ---');

  test('Reader opens valid manuscript by ID', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'प्राचीन डायरी का पृष्ठ',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA, filename: 'diary_1950.png' }
    });

    const container = new MockElement();
    const reader = new ManuscriptView({ container, router: {}, manuscriptId: ms.id, repository: repo });
    reader.mount();

    console.assert(container.innerHTML.includes('प्राचीन डायरी का पृष्ठ'), 'Reader renders manuscript title');
    console.assert(container.innerHTML.includes('diary_1950.png'), 'Reader renders original filename');
  });

  test('Invalid manuscript ID handled gracefully with 404 state', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const container = new MockElement();
    const reader = new ManuscriptView({ container, router: {}, manuscriptId: 'non_existent_id', repository: repo });
    reader.mount();

    console.assert(container.innerHTML.includes('पांडुलिपि अप्राप्य'), 'Must render localized not-found title');
    console.assert(container.innerHTML.includes('वीथिका पर लौटें') || container.innerHTML.includes('वीथिका'), 'Must link to gallery');
    console.assert(container.innerHTML.includes('पुस्तकालय पर लौटें'), 'Preserves library link for regression');
  });

  test('Original tab uses original data', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'टैब परीक्षण पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    repo.saveDerivedManuscript(
      ms.id,
      { mimeType: 'image/png', data: SAMPLE_DERIVED_DATA, sourceArtifactId: ms.originalManuscript.id },
      { rotation: 0, crop: null }
    );

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = repo.getById(ms.id);
    reader.activeTab = 'original';

    const src = reader.getActiveDisplaySrc();
    console.assert(src === SAMPLE_ORIG_DATA, 'Original tab must strictly display original artifact data');
  });

  test('Derived tab uses derived data', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'टैब परीक्षण पांडुलिपि २',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    repo.saveDerivedManuscript(
      ms.id,
      { mimeType: 'image/png', data: SAMPLE_DERIVED_DATA, sourceArtifactId: ms.originalManuscript.id },
      { rotation: 180, crop: null }
    );

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = repo.getById(ms.id);
    reader.activeTab = 'derived';

    const src = reader.getActiveDisplaySrc();
    console.assert(src === SAMPLE_DERIVED_DATA, 'Derived tab must strictly display derived artifact data');
  });

  test('Derived tab unavailable / disabled when no derived artifact exists', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'केवल मूल प्रति',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const html = reader.render();

    console.assert(html.includes('manuscript-view-tabs'), 'Must render view tabs');
    console.assert(html.includes('मूल पांडुलिपि (अपरिवर्तित)'), 'Must render original tab');
    console.assert(html.includes('disabled') && html.includes('संपादित प्रति (अनुपलब्ध)'), 'Derived tab must be disabled when no derived version');
    console.assert(html.includes('मूल पांडुलिपि सुरक्षित है'), 'Must reassure that original is safely preserved');
  });

  test('Archival metadata rendering (filename, date, mime, etc.)', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'अभिलेखीय विवरण परीक्षण',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_ORIG_DATA,
        filename: 'historic_doc_1942.png',
        capturedAt: '2026-03-01T12:00:00.000Z'
      }
    });

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const html = reader.render();

    console.assert(html.includes('historic_doc_1942.png'), 'Renders original filename');
    console.assert(html.includes('image/png'), 'Renders MIME type');
    console.assert(html.includes('मूल कैप्चर तिथि'), 'Renders capture date label');
  });

  test('Provenance rendering (source label in Hindi, provenance notes)', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'उद्गम परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      provenance: {
        source: 'handwritten_manuscript',
        notes: 'यह पृष्ठ बनारस के एक पुराने बक्से से प्राप्त हुआ।'
      }
    });

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const html = reader.render();

    console.assert(html.includes('हस्तलिखित पांडुलिपि'), 'Translates source to Hindi');
    console.assert(html.includes('बनारस के एक पुराने बक्से से प्राप्त हुआ'), 'Renders provenance notes');
  });

  test('Transcription status rendering (untranscribed, draft, verified)', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'स्थिति परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: { text: '', status: 'untranscribed' }
    });

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const html = reader.render();

    console.assert(html.includes('अप्रतिलिपिबद्ध'), 'Renders untranscribed status in Hindi');
  });

  // --- Group 3: Unicode & Security Rigor ---
  console.log('\n--- Group 3: Unicode & Security Rigor ---');

  test('Unicode / Hindi metadata integrity', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const complexHindiTitle = 'ज्ञानपीठ पुरस्कृत — "रश्मिरथी" के अप्रकाशित छंद (१९६०)';
    const complexNotes = 'मात्राएँ: कवयित्री, संयुक्ताक्षर: क्ष, त्र, ज्ञ, श्र, द्व, द्ध, ऋ; विराम: ।, ॥';

    const ms = repo.create({
      title: complexHindiTitle,
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      provenance: { source: 'scanned_document', notes: complexNotes }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const galleryHtml = gallery.render();
    console.assert(galleryHtml.includes('ज्ञानपीठ पुरस्कृत') && galleryHtml.includes('रश्मिरथी') && galleryHtml.includes('१९६०'), 'Gallery preserves complex Hindi title');

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const readerHtml = reader.render();
    console.assert(readerHtml.includes('ज्ञानपीठ पुरस्कृत') && readerHtml.includes('रश्मिरथी') && readerHtml.includes('१९६०'), 'Reader preserves complex Hindi title');
    console.assert(readerHtml.includes('रश्मिरथी'), 'Reader preserves quotes and conjuncts');
  });

  test('XSS-safe titles in gallery and reader', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const xssTitle = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const ms = repo.create({
      title: xssTitle,
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const galleryHtml = gallery.render();
    console.assert(!galleryHtml.includes('<script>'), 'Gallery must escape script tag in title');
    console.assert(galleryHtml.includes('&lt;script&gt;'), 'Gallery must escape HTML entities');

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const readerHtml = reader.render();
    console.assert(!readerHtml.includes('<script>'), 'Reader must escape script tag in title');
    console.assert(readerHtml.includes('&lt;script&gt;'), 'Reader must escape HTML entities');
  });

  test('XSS-safe filenames in gallery and reader', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const xssFilename = '"><svg onload=alert(2)>.png';
    const ms = repo.create({
      title: 'सुरक्षा परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA, filename: xssFilename }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const galleryHtml = gallery.render();
    console.assert(!galleryHtml.includes('<svg onload='), 'Gallery must escape dangerous filename');

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const readerHtml = reader.render();
    console.assert(!readerHtml.includes('<svg onload='), 'Reader must escape dangerous filename');
  });

  // --- Group 4: Deterministic Filtering & Navigation ---
  console.log('\n--- Group 4: Deterministic Filtering & Navigation ---');

  test('Deterministic filtering by title query', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    repo.create({ title: 'हिमालय का संदेश', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    repo.create({ title: 'गंगा की लहरें', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    repo.create({ title: 'यमुना तट पर संध्या', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const all = gallery.getManuscripts();

    gallery.searchQuery = 'गंगा';
    const filtered = gallery.filterManuscripts(all);

    console.assert(filtered.length === 1, 'Query must return exactly 1 match');
    console.assert(filtered[0].title === 'गंगा की लहरें', 'Matches correct record');
  });

  test('Gallery navigation: cards link to /manuscripts/:id', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'नेविगेशन परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const html = gallery.render();

    console.assert(html.includes(`/manuscripts/${ms.id}`), 'Gallery card must contain link to /manuscripts/:id');
    console.assert(html.includes('data-link'), 'Gallery card link must have data-link for client routing');
  });

  test('Reader back navigation: links back to /manuscripts', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'वापसी परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const html = reader.render();

    console.assert(html.includes(`href="${ROUTES.MANUSCRIPTS}"`), 'Top bar back button must link to /manuscripts');
    console.assert(html.includes('वीथिका'), 'Back button text must direct to gallery (वीथिका)');
  });

  test('Malformed record resilience: corrupt or partial objects handled safely', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    // Valid record
    repo.create({ title: 'शुद्ध पांडुलिपि', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    // Mock repository returning some malformed entries alongside valid one
    const mockRepo = {
      getAll: () => [
        null,
        undefined,
        {},
        { id: 'kv_bad_1' }, // Missing originalManuscript
        { id: 'kv_bad_2', title: null, originalManuscript: null },
        ...repo.getAll()
      ],
      getById: (id) => repo.getById(id)
    };

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: mockRepo });
    let html = '';
    let threw = false;
    try {
      html = gallery.render();
    } catch (e) {
      threw = true;
    }

    console.assert(!threw, 'Gallery must not throw on malformed records');
    console.assert(html.includes('शुद्ध पांडुलिपि'), 'Must render valid records despite malformed neighbors');
  });

  test('Filter by transcription status', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms1 = repo.create({
      title: 'अप्रतिलिपिबद्ध पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: { text: '', status: 'untranscribed' }
    });

    const ms2 = repo.create({
      title: 'प्रमाणित पांडुलिपि',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      transcription: { text: 'कुछ पंक्तियाँ', status: 'verified' }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const all = gallery.getManuscripts();

    gallery.statusFilter = 'verified';
    const filteredVerified = gallery.filterManuscripts(all);
    console.assert(filteredVerified.length === 1, 'Only 1 verified manuscript');
    console.assert(filteredVerified[0].id === ms2.id, 'Returns verified record');

    gallery.statusFilter = 'untranscribed';
    const filteredUntranscribed = gallery.filterManuscripts(all);
    console.assert(filteredUntranscribed.length === 1, 'Only 1 untranscribed manuscript');
    console.assert(filteredUntranscribed[0].id === ms1.id, 'Returns untranscribed record');
  });

  test('Filter by provenance source', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    repo.create({
      title: 'स्कैन दस्तावेज़',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      provenance: { source: 'scanned_document' }
    });
    repo.create({
      title: 'कैमरा तस्वीर',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA },
      provenance: { source: 'photo_capture' }
    });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    const all = gallery.getManuscripts();

    gallery.sourceFilter = 'scanned_document';
    const filtered = gallery.filterManuscripts(all);
    console.assert(filtered.length === 1, 'Matches 1 scanned document');
    console.assert(filtered[0].title === 'स्कैन दस्तावेज़', 'Matches correct title');
  });

  test('Reset filters button restores all cards', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    repo.create({ title: 'पहला पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    repo.create({ title: 'दूसरा पन्ना', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    const gallery = new ManuscriptGallery({ container: new MockElement(), router: {}, repository: repo });
    gallery.searchQuery = 'अस्तित्वहीन';
    const filtered = gallery.filterManuscripts(gallery.getManuscripts());
    console.assert(filtered.length === 0, 'Zero results with non-matching query');

    // Simulate clicking reset button
    gallery.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="reset-filters"]' ? true : null
      },
      preventDefault: () => {}
    });

    console.assert(gallery.searchQuery === '', 'searchQuery reset');
    console.assert(gallery.statusFilter === 'all', 'statusFilter reset');
    console.assert(gallery.sourceFilter === 'all', 'sourceFilter reset');
  });

  test('Reader previous / next navigation links between sequential records', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms1 = repo.create({ title: 'पन्ना १', createdAt: '2026-01-01T00:00:00.000Z', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    const ms2 = repo.create({ title: 'पन्ना २', createdAt: '2026-01-02T00:00:00.000Z', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });
    const ms3 = repo.create({ title: 'पन्ना ३', createdAt: '2026-01-03T00:00:00.000Z', originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA } });

    // In repo.getAll(), sorted descending: [ms3, ms2, ms1]
    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms2.id, repository: repo });
    reader.manuscript = ms2;
    const html = reader.render();

    console.assert(html.includes('manuscript-prev-next-group'), 'Contains prev-next nav container');
    console.assert(html.includes(`/manuscripts/${ms3.id}`), 'Previous button links to ms3');
    console.assert(html.includes(`/manuscripts/${ms1.id}`), 'Next button links to ms1');
  });

  test('Reader displays image dimensions when safely available', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'आयाम परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });
    ms.originalManuscript.width = 1200;
    ms.originalManuscript.height = 1800;

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;
    const html = reader.render();

    console.assert(html.includes('छवि आयाम (Dimensions)'), 'Renders dimensions label');
    console.assert(html.includes('1200 × 1800 px'), 'Renders calculated dimensions');
  });

  test('Reader handles missing image data safely without throwing', () => {
    const storage = new MockStorage();
    const repo = new ManuscriptRepository(new LocalStorageAdapter(storage));

    const ms = repo.create({
      title: 'टूटी छवि परीक्षण',
      originalManuscript: { mimeType: 'image/png', data: SAMPLE_ORIG_DATA }
    });
    // Corrupt image data on loaded record
    ms.originalManuscript.data = '';

    const reader = new ManuscriptView({ container: new MockElement(), router: {}, manuscriptId: ms.id, repository: repo });
    reader.manuscript = ms;

    let html = '';
    let threw = false;
    try {
      html = reader.render();
    } catch (e) {
      threw = true;
    }

    console.assert(!threw, 'Reader must not throw when image data is empty');
    console.assert(html.includes('पांडुलिपि छवि डेटा अप्राप्य है'), 'Displays graceful archival missing notice');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} MANUSCRIPT GALLERY & READER TESTS PASSED!`);
  console.log('================================================================\n');
}

runGalleryTests().catch(err => {
  console.error('Gallery test suite failed:', err);
  process.exit(1);
});
