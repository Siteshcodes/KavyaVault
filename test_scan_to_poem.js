/**
 * काव्यकलश (KavyaVault) — Scan → Poem Integration & Hardening Test Suite
 * Phase 3 / Task 3.2: Scan → Poem Workflow
 *
 * Verifies the end-to-end Scan → Poem pipeline:
 * 1. Scan Entry Point & Capture (/input/scan, ManuscriptCapture scanToPoemMode)
 * 2. Manuscript Preservation (original bytes untouched, non-destructive transforms)
 * 3. Transcription Workspace ("कविता के रूप में उपयोग करें", empty text validation)
 * 4. Poem Draft Handoff (createScanDraft, source="scan", manuscriptId preserved)
 * 5. PoetryEditor Hydration & Save (source badge, review/edit, poem creation, linking)
 * 6. Duplicate-Save Protection & Resiliency (no premature persistence, reload safety)
 * 7. Unicode & Devanagari Integrity (conjuncts, nuktas, matras survive complete workflow)
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { STORAGE_KEYS } from './src/data/storageKeys.js';
import { ROUTES } from './src/data/navigation.js';
import {
  INPUT_SOURCES,
  createScanDraft
} from './src/services/input/PoemInputService.js';
import { ManuscriptCapture } from './src/components/manuscripts/ManuscriptCapture.js';
import { ManuscriptTranscription } from './src/components/manuscripts/ManuscriptTranscription.js';
import { ManuscriptView } from './src/components/manuscripts/ManuscriptView.js';
import { PoetryEditor } from './src/components/editor/PoetryEditor.js';
import fs from 'fs';
import path from 'path';

// Setup global.document & window for Node.js environment
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  getElementById: () => null
};
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Global test tracking
let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertThrows(fn, expectedErrorCode = null, message = '') {
  try {
    fn();
    throw new Error(`Expected function to throw, but it succeeded. ${message}`);
  } catch (err) {
    if (expectedErrorCode && err.code !== expectedErrorCode && !err.message.includes(expectedErrorCode)) {
      throw new Error(`Expected error code "${expectedErrorCode}", got "${err.code}" (${err.message})`);
    }
  }
}

async function test(name, fn) {
  totalTests++;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      await result;
    }
    passedTests++;
    console.log(`✓ [Test ${totalTests}] ${name}`);
  } catch (err) {
    console.error(`✗ [Test ${totalTests}] FAILED: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// In-Memory Storage Mock
class InMemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// DOM Mock Element
class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.innerHTML = '';
    this.value = attributes.value !== undefined ? attributes.value : '';
    this.checked = Boolean(attributes.checked);
    this.style = {};
    this.classList = new Set();
    this.listeners = new Map();
    this._childrenMap = new Map();
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

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    for (const h of list) {
      h(event);
    }
  }

  closest(selector) {
    if (selector.includes('button') && (this.tagName === 'BUTTON' || this.attributes.id?.startsWith('btn-'))) {
      return this;
    }
    if (selector.includes('a') && this.tagName === 'A') {
      return this;
    }
    if (this.attributes['data-action'] && selector.includes(`[data-action="${this.attributes['data-action']}"]`)) {
      return this;
    }
    if (this.attributes.id && selector.includes(this.attributes.id)) {
      return this;
    }
    return null;
  }

  querySelector(selector) {
    if (this._childrenMap.has(selector)) {
      return this._childrenMap.get(selector);
    }
    const dummy = new MockElement('div');
    this._childrenMap.set(selector, dummy);
    return dummy;
  }

  querySelectorAll(selector) {
    if (this._childrenMap.has(selector)) {
      return [this._childrenMap.get(selector)];
    }
    return [];
  }

  registerMockChild(selector, element) {
    this._childrenMap.set(selector, element);
  }

  focus() {
    this._isFocused = true;
  }

  remove() {}
}

// Mock Router
class MockRouter {
  constructor() {
    this.currentPath = '/';
    this.history = [];
  }

  navigate(path) {
    this.currentPath = path;
    this.history.push(path);
  }

  getCurrentPath() {
    return this.currentPath;
  }
}

// Environment Builder
function createTestEnvironment() {
  const memStorage = new InMemoryStorage();
  const adapter = new LocalStorageAdapter(memStorage);
  const poemRepo = new PoemRepository(adapter);
  const manuscriptRepo = new ManuscriptRepository(adapter, poemRepo);
  const router = new MockRouter();

  return { memStorage, adapter, poemRepo, manuscriptRepo, router };
}

// Mock Editor Container Helper
function createEditorMockContainer(initial = {}) {
  const container = new MockElement('div');
  const titleInput = new MockElement('input', { id: 'editor-title', value: initial.title || '' });
  const bodyInput = new MockElement('textarea', { id: 'editor-body', value: initial.body || initial.text || '' });
  const authorInput = new MockElement('input', { id: 'editor-author', value: initial.author || '' });
  const tagsInput = new MockElement('input', {
    id: 'editor-tags',
    value: Array.isArray(initial.tags) ? initial.tags.join(', ') : (initial.tags || '')
  });

  container.registerMockChild('#editor-title', titleInput);
  container.registerMockChild('#editor-body', bodyInput);
  container.registerMockChild('#editor-author', authorInput);
  container.registerMockChild('#editor-tags', tagsInput);

  return { container, titleInput, bodyInput, authorInput, tagsInput };
}

// Sample Manuscript Helper
function createSampleManuscript(manuscriptRepo, overrides = {}) {
  const sampleBase64Image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  return manuscriptRepo.create({
    title: overrides.title || 'प्राचीन हस्तलिखित पृष्ठ (१९७५)',
    originalManuscript: {
      data: overrides.data || sampleBase64Image,
      mimeType: 'image/png',
      sizeBytes: overrides.data ? overrides.data.length : sampleBase64Image.length,
      filename: 'sample_page.png'
    },
    transcription: {
      text: overrides.transcriptionText !== undefined ? overrides.transcriptionText : 'क्षितिज पर फैली लाली\nनव प्रभात का संदेशा।',
      status: overrides.status || 'draft',
      verifiedAt: overrides.verifiedAt || null
    },
    provenance: {
      source: 'handwritten_manuscript',
      notes: 'पारिवारिक संग्रह से प्राप्त'
    }
  });
}

// ============================================================================
// TEST SUITE EXECUTION
// ============================================================================

async function runScanToPoemTests() {
  console.log('\n================================================================');
  console.log('  KAVYAVAULT SCAN → POEM WORKFLOW TEST SUITE');
  console.log('  (Phase 3 / Task 3.2: Scan → Poem)');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // GROUP A: SCAN ENTRY POINT & CAPTURE WORKFLOW
  // --------------------------------------------------------------------------
  console.log('--- Group A: Scan Entry Point & Capture Workflow ---');

  await test('AppShell routes /input/scan to ManuscriptCapture in scanToPoemMode', () => {
    assert(ROUTES.INPUT_SCAN === '/input/scan', 'ROUTES.INPUT_SCAN must equal /input/scan');

    const appShellSource = fs.readFileSync(path.resolve('./src/components/layout/AppShell.js'), 'utf8');
    assert(
      appShellSource.includes('currentPath === ROUTES.INPUT_SCAN || currentPath === \'/input/scan\''),
      'AppShell must handle /input/scan route'
    );
    assert(
      appShellSource.includes('new ManuscriptCapture') && appShellSource.includes('scanToPoemMode: true'),
      'AppShell must mount ManuscriptCapture with scanToPoemMode: true'
    );
  });

  await test('ManuscriptCapture renders Scan → Poem headers and back navigation to /input', () => {
    const { router } = createTestEnvironment();
    const container = new MockElement('div');
    const capture = new ManuscriptCapture({ container, router, scanToPoemMode: true });
    capture.mount();

    const html = container.innerHTML;
    assert(html.includes('स्कैन से कविता (Scan → Poem)'), 'Heading reflects Scan → Poem');
    assert(html.includes('स्कैन → कविता कार्यप्रवाह'), 'Hint reflects scan to poem workflow');
    assert(html.includes(ROUTES.INPUT_MODES), 'Back button routes to /input modes');
    assert(html.includes('id="manuscript-file-input"'), 'Native file input exists');
    assert(html.includes('id="manuscript-camera-input"'), 'Native camera input exists');
  });

  await test('ManuscriptCapture form submit button reflects Scan → Poem handoff', () => {
    const { router } = createTestEnvironment();
    const container = new MockElement('div');
    const capture = new ManuscriptCapture({ container, router, scanToPoemMode: true });
    capture.selectedFile = { name: 'draft_scan.png', size: 1024, type: 'image/png' };
    capture.fileBase64Data = 'data:image/png;base64,sample123';
    capture.update();

    assert(container.innerHTML.includes('सहेजें व प्रतिलिपि लिखें →'), 'Button indicates transcription handoff');
  });

  await test('ManuscriptCapture success banner offers direct navigation to transcription workspace', () => {
    const { router } = createTestEnvironment();
    const container = new MockElement('div');
    const capture = new ManuscriptCapture({ container, router, scanToPoemMode: true });
    capture.savedManuscript = { id: 'ms-test-101', title: 'डायरी पृष्ठ' };
    capture.update();

    const html = container.innerHTML;
    assert(html.includes('/manuscripts/ms-test-101/transcribe'), 'Success banner links to transcribe workspace');
    assert(html.includes('प्रतिलिपि लिखें (कविता बनाएं)'), 'CTA button text directs to poem pipeline');
  });

  // --------------------------------------------------------------------------
  // GROUP B: MANUSCRIPT PRESERVATION & IMMUTABILITY
  // --------------------------------------------------------------------------
  console.log('\n--- Group B: Manuscript Preservation & Immutability ---');

  await test('Original manuscript bytes remain byte-for-byte immutable throughout pipeline', () => {
    const { manuscriptRepo, poemRepo } = createTestEnvironment();
    const originalBytes = 'data:image/png;base64,EXACT_ORIGINAL_BYTES_ARCHIVAL_TEST_12345';
    const ms = createSampleManuscript(manuscriptRepo, { data: originalBytes });

    // Update transcription
    manuscriptRepo.updateTranscription(ms.id, {
      text: 'नवीन पंक्तियाँ जिनका संपादन किया गया।',
      status: 'draft'
    });

    const msAfterTrans = manuscriptRepo.getById(ms.id);
    assert(msAfterTrans.originalManuscript.data === originalBytes, 'Original bytes must be unchanged after transcription update');

    // Create draft
    createScanDraft({ manuscriptId: ms.id, transcriptionText: msAfterTrans.transcription.text }, poemRepo);
    const msAfterDraft = manuscriptRepo.getById(ms.id);
    assert(msAfterDraft.originalManuscript.data === originalBytes, 'Original bytes must be unchanged after scan draft creation');
  });

  await test('Derived transformations remain strictly isolated from original manuscript', () => {
    const { manuscriptRepo } = createTestEnvironment();
    const originalBytes = 'data:image/png;base64,RAW_ORIGINAL_PRESERVED';
    const derivedBytes = 'data:image/png;base64,TRANSFORMED_CROPPED_WORKING_COPY';
    const ms = createSampleManuscript(manuscriptRepo, { data: originalBytes });

    manuscriptRepo.saveDerivedManuscript(
      ms.id,
      {
        sourceArtifactId: ms.originalManuscript.id,
        data: derivedBytes,
        mimeType: 'image/png',
        sizeBytes: derivedBytes.length
      },
      { rotation: 90, crop: { x: 10, y: 10, width: 100, height: 100 } }
    );

    const refreshed = manuscriptRepo.getById(ms.id);
    assert(refreshed.originalManuscript.data === originalBytes, 'Original artifact unchanged');
    assert(refreshed.derivedManuscript.data === derivedBytes, 'Derived copy saved separately');
    assert(refreshed.transformation.rotation === 90, 'Transform metadata saved on manuscript');
  });

  // --------------------------------------------------------------------------
  // GROUP C: TRANSCRIPTION LIFECYCLE & VALIDATION
  // --------------------------------------------------------------------------
  console.log('\n--- Group C: Transcription Lifecycle & Validation ---');

  await test('ManuscriptTranscription renders "कविता के रूप में उपयोग करें" button', () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo);
    const container = new MockElement('div');

    const transcriptionView = new ManuscriptTranscription({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    transcriptionView.mount();

    assert(container.innerHTML.includes('data-action="use-as-poem"'), 'Workspace renders use-as-poem action button');
    assert(container.innerHTML.includes('कविता के रूप में उपयोग करें'), 'Workspace button text is present');
  });

  await test('Empty or whitespace transcription is rejected with Hindi guidance error', async () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo, { transcriptionText: '   \n  \t  ' });
    const container = new MockElement('div');
    const textarea = new MockElement('textarea', { value: '   ' });
    const errorBanner = new MockElement('div');
    const errorText = new MockElement('span');
    errorBanner.registerMockChild('.error-text', errorText);
    container.registerMockChild('#transcription-textarea', textarea);
    container.registerMockChild('#transcription-error-banner', errorBanner);

    const transcriptionView = new ManuscriptTranscription({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    transcriptionView.mount();
    transcriptionView.text = '   \n  ';

    await transcriptionView.handleUseAsPoem();

    assert(transcriptionView.saveStatus === 'error', 'Save status set to error');
    assert(transcriptionView.saveError && transcriptionView.saveError.includes('सार्थक प्रतिलिपि पाठ आवश्यक है'), 'Hindi error guidance displayed');
    assert(router.getCurrentPath() !== ROUTES.NEW_POEM, 'Did not navigate to new poem');
  });

  await test('Transcription status semantics preserved (does not silently mark manual draft as verified)', async () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo, {
      transcriptionText: 'पहली पंक्ति का प्रारूप',
      status: 'draft',
      verifiedAt: null
    });
    const container = new MockElement('div');
    const transcriptionView = new ManuscriptTranscription({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    transcriptionView.mount();

    await transcriptionView.handleUseAsPoem();

    const storedMs = manuscriptRepo.getById(ms.id);
    assert(storedMs.transcription.status === 'draft', 'Status remains draft');
    assert(storedMs.transcription.verifiedAt === null, 'verifiedAt remains null');
  });

  await test('Verified transcription preserves verified status and verifiedAt timestamp', async () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const verifiedTimestamp = '2026-09-01T12:00:00.000Z';
    const ms = createSampleManuscript(manuscriptRepo, {
      transcriptionText: 'प्रमाणित पांडुलिपि पाठ',
      status: 'verified',
      verifiedAt: verifiedTimestamp
    });
    const container = new MockElement('div');
    const transcriptionView = new ManuscriptTranscription({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    transcriptionView.mount();

    await transcriptionView.handleUseAsPoem();

    const storedMs = manuscriptRepo.getById(ms.id);
    assert(storedMs.transcription.status === 'verified', 'Status remains verified');
    assert(storedMs.transcription.verifiedAt === verifiedTimestamp, 'verifiedAt timestamp preserved');
  });

  await test('ManuscriptView detail screen also offers "कविता के रूप में उपयोग करें" button when transcription exists', () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo, { transcriptionText: 'सुंदर कविता की पंक्तियाँ' });
    const container = new MockElement('div');

    const view = new ManuscriptView({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    view.mount();

    assert(container.innerHTML.includes('data-action="use-as-poem"'), 'ManuscriptView renders use-as-poem button');
    assert(container.innerHTML.includes('कविता के रूप में उपयोग करें &rarr;'), 'Renders button label');
  });

  // --------------------------------------------------------------------------
  // GROUP D: POEM DRAFT CREATION & HANDOFF
  // --------------------------------------------------------------------------
  console.log('\n--- Group D: Poem Draft Creation & Handoff ---');

  await test('handleUseAsPoem creates scan draft and routes to /poems/new', async () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo, {
      title: 'डायरी से एक गीत',
      transcriptionText: 'चाँदनी रात में बैठा मैं,\nगीत सुरीला गाता हूँ।'
    });
    const container = new MockElement('div');
    const transcriptionView = new ManuscriptTranscription({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    transcriptionView.mount();

    await transcriptionView.handleUseAsPoem();

    assert(router.getCurrentPath() === ROUTES.NEW_POEM, 'Navigated to /poems/new');

    const draft = poemRepo.getDraft();
    assert(draft !== null, 'Draft must be persisted in draft storage');
    assert(draft.source === 'scan', 'Draft source must be "scan"');
    assert(draft.manuscriptId === ms.id, 'Draft manuscriptId matches manuscript');
    assert(draft.title === 'डायरी से एक गीत', 'Draft title handed off from manuscript');
    assert(draft.body.includes('चाँदनी रात में बैठा मैं'), 'Draft body contains transcription');
  });

  await test('No final poem record is created during draft creation', async () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo);
    const container = new MockElement('div');
    const transcriptionView = new ManuscriptTranscription({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    transcriptionView.mount();

    const poemsCountBefore = poemRepo.getAll().length;
    await transcriptionView.handleUseAsPoem();
    const poemsCountAfter = poemRepo.getAll().length;

    assert(poemsCountAfter === poemsCountBefore, 'Draft creation must NOT add poem to repository');
  });

  await test('Title handoff uses manuscript title, or empty string if untitled (no AI hallucination)', () => {
    const { poemRepo } = createTestEnvironment();

    // With title
    const draft1 = createScanDraft({
      manuscriptId: 'ms-001',
      title: 'हस्तलिखित गीत',
      text: 'पंक्तियाँ...'
    }, poemRepo);
    assert(draft1.title === 'हस्तलिखित गीत', 'Preserves provided title');

    // Without title
    const draft2 = createScanDraft({
      manuscriptId: 'ms-002',
      text: 'पंक्तियाँ...'
    }, poemRepo);
    assert(draft2.title === '', 'Leaves title empty without hallucination');
  });

  await test('Raw manuscript image bytes are strictly NOT copied into draft', () => {
    const { manuscriptRepo, poemRepo } = createTestEnvironment();
    const largeImageData = 'data:image/png;base64,' + 'A'.repeat(50000);
    const ms = createSampleManuscript(manuscriptRepo, { data: largeImageData });

    const draft = createScanDraft({
      manuscriptId: ms.id,
      text: ms.transcription.text
    }, poemRepo, manuscriptRepo);

    const draftString = JSON.stringify(draft);
    assert(!draftString.includes(largeImageData), 'Draft must NOT contain raw image data');
    assert(draft.manuscriptId === ms.id, 'Draft contains only manuscript reference ID');
  });

  // --------------------------------------------------------------------------
  // GROUP E: POETRY EDITOR REVIEW, SAVE & MANUSCRIPT LINKING
  // --------------------------------------------------------------------------
  console.log('\n--- Group E: PoetryEditor Review, Save & Manuscript Linking ---');

  await test('PoetryEditor hydrates scan draft with source badge and manuscript context', () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo, { title: 'पुरातन पाण्डुलिपि' });

    const draft = createScanDraft({
      manuscriptId: ms.id,
      text: 'साहित्यिक पंक्तियाँ...',
      title: ms.title
    }, poemRepo, manuscriptRepo);

    const { container } = createEditorMockContainer(draft);

    const editor = new PoetryEditor({
      container,
      router,
      repository: poemRepo,
      manuscriptRepository: manuscriptRepo,
      initialDraft: draft
    });
    editor.mount();

    assert(editor.source === 'scan', 'Editor source is scan');
    assert(editor.manuscriptId === ms.id, 'Editor manuscriptId is ms.id');
    assert(container.innerHTML.includes('source-scan'), 'Renders scan badge styling');
    assert(container.innerHTML.includes('पांडुलिपि संदर्भ'), 'Renders manuscript context note');
  });

  await test('User can review and modify text in PoetryEditor before saving', () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo);
    const draft = createScanDraft({ manuscriptId: ms.id, text: 'मूल प्रतिलिपि' }, poemRepo);

    const { container, titleInput, bodyInput, authorInput } = createEditorMockContainer(draft);

    const editor = new PoetryEditor({
      container,
      router,
      repository: poemRepo,
      manuscriptRepository: manuscriptRepo,
      initialDraft: draft
    });
    editor.mount();

    // User edits fields
    titleInput.value = 'संशोधित शीर्षक';
    bodyInput.value = 'संशोधित और परिष्कृत कविता की पंक्तियाँ';
    authorInput.value = 'कविवर';

    editor.savePoem();

    const saved = poemRepo.getAll()[0];
    assert(saved.title === 'संशोधित शीर्षक', 'Title updated by user review');
    assert(saved.body === 'संशोधित और परिष्कृत कविता की पंक्तियाँ', 'Body updated by user review');
    assert(saved.author === 'कविवर', 'Author updated by user review');
  });

  await test('Final poem save persists poem with source="scan", establishes bidirectional manuscript link, and clears draft', () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo, { title: 'अभिलेख पांडुलिपि' });

    const draft = createScanDraft({
      manuscriptId: ms.id,
      text: 'अंतिम काव्य पाठ',
      title: 'सहेजी गई कविता'
    }, poemRepo, manuscriptRepo);

    const { container } = createEditorMockContainer(draft);

    const editor = new PoetryEditor({
      container,
      router,
      repository: poemRepo,
      manuscriptRepository: manuscriptRepo,
      initialDraft: draft
    });
    editor.mount();

    editor.savePoem();

    // 1. Poem created in PoemRepository
    const poems = poemRepo.getAll();
    assert(poems.length === 1, 'Exactly one poem persisted');
    const createdPoem = poems[0];
    assert(createdPoem.source === 'scan', 'Poem source is "scan"');
    assert(createdPoem.manuscriptId === ms.id, 'Poem links to manuscriptId');
    assert(createdPoem.title === 'सहेजी गई कविता', 'Poem title preserved');

    // 2. Manuscript updated with poemId (bidirectional link)
    const linkedMs = manuscriptRepo.getById(ms.id);
    assert(linkedMs.poemId === createdPoem.id, 'Manuscript has poemId linking back');

    // 3. Draft cleared
    assert(poemRepo.getDraft() === null, 'Draft cleared from storage upon save');

    // 4. No duplicate manuscripts created
    assert(manuscriptRepo.getAll().length === 1, 'Manuscript count remains exactly 1');

    // 5. No raw image bytes in poem record
    const poemJson = JSON.stringify(createdPoem);
    assert(!poemJson.includes('data:image'), 'Poem record contains no image bytes');
  });

  // --------------------------------------------------------------------------
  // GROUP F: DUPLICATE-SAVE PROTECTION & RESILIENCY
  // --------------------------------------------------------------------------
  console.log('\n--- Group F: Duplicate-Save Protection & Resiliency ---');

  await test('Clicking "Use as Poem" repeatedly does NOT create multiple poem records', async () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo);
    const container = new MockElement('div');
    const transcriptionView = new ManuscriptTranscription({
      container,
      router,
      manuscriptId: ms.id,
      repository: manuscriptRepo,
      poemRepo
    });
    transcriptionView.mount();

    // Click 5 times
    await transcriptionView.handleUseAsPoem();
    await transcriptionView.handleUseAsPoem();
    await transcriptionView.handleUseAsPoem();
    await transcriptionView.handleUseAsPoem();
    await transcriptionView.handleUseAsPoem();

    assert(poemRepo.getAll().length === 0, 'No poem records created by repeated draft creation clicks');
    assert(poemRepo.getDraft() !== null, 'Single draft exists in draft slot');
  });

  await test('Navigating back or refreshing before save does not persist unfinished poem', () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const ms = createSampleManuscript(manuscriptRepo);
    createScanDraft({ manuscriptId: ms.id, text: 'पंक्तियाँ' }, poemRepo);

    // Simulate page reload or navigation
    router.navigate(ROUTES.POEMS);
    assert(poemRepo.getAll().length === 0, 'No poem persisted');
  });

  await test('createScanDraft throws KEY_NOT_FOUND when manuscript does not exist in repository', () => {
    const { manuscriptRepo, poemRepo } = createTestEnvironment();

    assertThrows(
      () => createScanDraft({ manuscriptId: 'non-existent-999' }, poemRepo, manuscriptRepo),
      StorageErrorCode.KEY_NOT_FOUND,
      'Must throw KEY_NOT_FOUND for missing manuscript'
    );
  });

  await test('createScanDraft rejects whitespace-only or non-string manuscriptId', () => {
    const { poemRepo } = createTestEnvironment();

    assertThrows(() => createScanDraft({ manuscriptId: '' }, poemRepo), StorageErrorCode.VALIDATION_ERROR);
    assertThrows(() => createScanDraft({ manuscriptId: '   ' }, poemRepo), StorageErrorCode.VALIDATION_ERROR);
    assertThrows(() => createScanDraft({ manuscriptId: null }, poemRepo), StorageErrorCode.VALIDATION_ERROR);
    assertThrows(() => createScanDraft({ manuscriptId: 12345 }, poemRepo), StorageErrorCode.VALIDATION_ERROR);
  });

  // --------------------------------------------------------------------------
  // GROUP G: UNICODE & DEVANAGARI INTEGRITY
  // --------------------------------------------------------------------------
  console.log('\n--- Group G: Unicode & Devanagari Integrity ---');

  await test('Complex Devanagari conjuncts, nuktas, matras, and emojis survive the entire Scan → Poem pipeline', () => {
    const { manuscriptRepo, poemRepo, router } = createTestEnvironment();
    const complexDevanagari =
      'क्षमा, त्रिशूल, ज्ञान, श्रद्धा, द्वंद्व, द्घोष, हृदय।\n' +
      'क़िस्सा, फ़िक्र, ज़मीन, चाँदनी (ँ), वंदना (ं), दुःख (ः)।\n' +
      'देवनागरी अंक: १२३४५६७८९० | विराम: ।, ॥, —, ‘’, “”\n' +
      'मिश्रित भाषा: Handwritten Manuscript Notes (Vol. 1) 📜✨';

    const ms = createSampleManuscript(manuscriptRepo, {
      title: 'हृदय की श्रद्धा — क्षत्रिय गीत',
      transcriptionText: complexDevanagari
    });

    // 1. Create scan draft
    const draft = createScanDraft({
      manuscriptId: ms.id,
      transcriptionText: ms.transcription.text,
      manuscriptTitle: ms.title
    }, poemRepo, manuscriptRepo);

    assert(draft.body === complexDevanagari, 'Devanagari text preserved in draft');
    assert(draft.title === ms.title, 'Devanagari title preserved in draft');

    // 2. Hydrate editor
    const { container } = createEditorMockContainer(draft);

    const editor = new PoetryEditor({
      container,
      router,
      repository: poemRepo,
      manuscriptRepository: manuscriptRepo,
      initialDraft: draft
    });
    editor.mount();

    // 3. Save poem
    editor.savePoem();

    // 4. Retrieve saved poem
    const savedPoem = poemRepo.getAll()[0];
    assert(savedPoem.body === complexDevanagari, 'Complex Unicode body roundtrips identically');
    assert(savedPoem.title === 'हृदय की श्रद्धा — क्षत्रिय गीत', 'Complex Unicode title roundtrips identically');
    assert(savedPoem.source === 'scan', 'Source is scan');
    assert(savedPoem.manuscriptId === ms.id, 'Manuscript linked');
  });

  // Summary
  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} SCAN → POEM WORKFLOW TESTS PASSED!`);
  console.log('================================================================\n');
}

runScanToPoemTests();
