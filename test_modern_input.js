/**
 * KavyaVault (काव्यकलश) — Phase 3 / Task 3.1 Test Suite
 * Modern Input Foundation (Type, Scan, Speak)
 *
 * Covers all architectural requirements:
 * 1. INPUT_SOURCES and VALID_INPUT_SOURCES enum safety
 * 2. Intent validation (types, required fields, rejection of invalid sources)
 * 3. Type input handoff into draft
 * 4. Scan contract validation (manuscriptId, text, provenance metadata, no raw bytes duplicated)
 * 5. Speak contract validation (voice text, metadata, honest placeholders)
 * 6. No automatic persistence (drafts are isolated, poem count unchanged until user save)
 * 7. Editor handoff: initial draft loading, autosave, source badges, manuscript linking on save
 * 8. Unicode Devanagari Hindi & mixed-content preservation
 * 9. InputModeSelector component rendering, honest states, privacy reassurance, accessibility
 * 10. Existing poem creation regression resistance
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import {
  INPUT_SOURCES,
  VALID_INPUT_SOURCES,
  validateInputIntent,
  createPoemDraft,
  createTypeDraft,
  createScanDraft,
  createSpeakDraft,
  formatInputSourceLabel
} from './src/services/input/PoemInputService.js';
import { PoetryEditor } from './src/components/editor/PoetryEditor.js';
import { InputModeSelector } from './src/components/input/InputModeSelector.js';
import { ROUTES } from './src/data/navigation.js';

// Setup global.document for Node.js environment
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

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

// Mock DOM Element for component tests
class MockElement {
  constructor(tag = 'div', attributes = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attributes };
    this._innerHTML = '';
    this.listeners = new Map();
    this.style = {};
    this.value = attributes.value !== undefined ? attributes.value : '';
    this.textContent = '';
    this.className = attributes.class || '';
    this.children = [];
    this._childrenMap = new Map();
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

  focus() {}

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

const SAMPLE_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function runModernInputTests() {
  console.log('\n================================================================');
  console.log('  KAVYAVAULT MODERN INPUT FOUNDATION TEST SUITE');
  console.log('  (Phase 3 / Task 3.1: Type, Scan, Speak Foundation)');
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
      throw new Error(message || 'Assertion failed');
    }
  }

  function assertThrows(fn, expectedCode, msg) {
    let threw = false;
    try {
      fn();
    } catch (err) {
      threw = true;
      if (expectedCode && err.code !== expectedCode) {
        throw new Error(`${msg || 'Wrong error code'}: Expected ${expectedCode}, got ${err.code} (${err.message})`);
      }
    }
    if (!threw) {
      throw new Error(msg || 'Expected function to throw, but it succeeded');
    }
  }

  function createTestEnvironment() {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const poemRepo = new PoemRepository(adapter);
    const manuscriptRepo = new ManuscriptRepository(adapter, poemRepo);
    const router = new MockRouter();
    return { mockStorage, adapter, poemRepo, manuscriptRepo, router };
  }

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

  // ============================================================================
  // GROUP 1: INPUT DOMAIN MODEL & ENUMS
  // ============================================================================
  console.log('--- Group 1: Input Domain Model & Enums ---');

  test('INPUT_SOURCES exports TYPE, SCAN, SPEAK as frozen object', () => {
    assert(INPUT_SOURCES.TYPE === 'type', 'TYPE must be "type"');
    assert(INPUT_SOURCES.SCAN === 'scan', 'SCAN must be "scan"');
    assert(INPUT_SOURCES.SPEAK === 'speak', 'SPEAK must be "speak"');
    assert(Object.isFrozen(INPUT_SOURCES), 'INPUT_SOURCES must be frozen');
  });

  test('VALID_INPUT_SOURCES contains all three input sources and is frozen', () => {
    assert(VALID_INPUT_SOURCES.length === 3, 'Must contain exactly 3 sources');
    assert(VALID_INPUT_SOURCES.includes('type'), 'Must include type');
    assert(VALID_INPUT_SOURCES.includes('scan'), 'Must include scan');
    assert(VALID_INPUT_SOURCES.includes('speak'), 'Must include speak');
    assert(Object.isFrozen(VALID_INPUT_SOURCES), 'VALID_INPUT_SOURCES must be frozen');
  });

  test('formatInputSourceLabel formats valid sources into dignified Hindi labels', () => {
    assert(formatInputSourceLabel(INPUT_SOURCES.TYPE).includes('टाइप'), 'Type label must contain टाइप');
    assert(formatInputSourceLabel(INPUT_SOURCES.SCAN).includes('स्कैन'), 'Scan label must contain स्कैन');
    assert(formatInputSourceLabel(INPUT_SOURCES.SPEAK).includes('वाणी'), 'Speak label must contain वाणी');
    assert(formatInputSourceLabel('custom') === 'custom', 'Fallback should return original');
    assert(formatInputSourceLabel(null) === 'सामान्य', 'Null fallback should return default');
  });

  // ============================================================================
  // GROUP 2: INPUT INTENT VALIDATION
  // ============================================================================
  console.log('--- Group 2: Input Intent Validation ---');

  test('Reject null, undefined, and non-object intent', () => {
    assertThrows(() => validateInputIntent(null), StorageErrorCode.VALIDATION_ERROR, 'null intent');
    assertThrows(() => validateInputIntent(undefined), StorageErrorCode.VALIDATION_ERROR, 'undefined intent');
    assertThrows(() => validateInputIntent('invalid'), StorageErrorCode.VALIDATION_ERROR, 'string intent');
    assertThrows(() => validateInputIntent(123), StorageErrorCode.VALIDATION_ERROR, 'number intent');
  });

  test('Reject missing or non-string source', () => {
    assertThrows(() => validateInputIntent({}), StorageErrorCode.VALIDATION_ERROR, 'missing source');
    assertThrows(() => validateInputIntent({ source: 123 }), StorageErrorCode.VALIDATION_ERROR, 'numeric source');
    assertThrows(() => validateInputIntent({ source: '' }), StorageErrorCode.VALIDATION_ERROR, 'empty source');
  });

  test('Reject invalid / unrecognized source (prevent unauthorized modes)', () => {
    assertThrows(() => validateInputIntent({ source: 'ai' }), StorageErrorCode.VALIDATION_ERROR, 'ai source');
    assertThrows(() => validateInputIntent({ source: 'ocr' }), StorageErrorCode.VALIDATION_ERROR, 'ocr source');
    assertThrows(() => validateInputIntent({ source: 'cloud' }), StorageErrorCode.VALIDATION_ERROR, 'cloud source');
  });

  test('Validate optional title type (must be string if present)', () => {
    validateInputIntent({ source: 'type', title: 'रश्मिरथी' });
    assertThrows(() => validateInputIntent({ source: 'type', title: 123 }), StorageErrorCode.VALIDATION_ERROR, 'number title');
  });

  test('Validate optional text/body type (must be string if present)', () => {
    validateInputIntent({ source: 'type', text: 'हो गया पूर्ण अज्ञातवास' });
    validateInputIntent({ source: 'type', body: 'पाण्डव आये कुछ और निखर' });
    assertThrows(() => validateInputIntent({ source: 'type', text: {} }), StorageErrorCode.VALIDATION_ERROR, 'object text');
  });

  test('Validate optional author type (must be string if present)', () => {
    validateInputIntent({ source: 'type', author: 'रामधारी सिंह दिनकर' });
    assertThrows(() => validateInputIntent({ source: 'type', author: ['दिनकर'] }), StorageErrorCode.VALIDATION_ERROR, 'array author');
  });

  test('Validate optional tags type (must be array if present)', () => {
    validateInputIntent({ source: 'type', tags: ['वीर रस', 'महाकाव्य'] });
    assertThrows(() => validateInputIntent({ source: 'type', tags: 'वीर रस' }), StorageErrorCode.VALIDATION_ERROR, 'string tags');
  });

  test('Validate optional manuscriptId type (must be non-empty string if present)', () => {
    validateInputIntent({ source: 'scan', manuscriptId: 'ms-123' });
    assertThrows(() => validateInputIntent({ source: 'scan', manuscriptId: '' }), StorageErrorCode.VALIDATION_ERROR, 'empty manuscriptId');
    assertThrows(() => validateInputIntent({ source: 'scan', manuscriptId: 456 }), StorageErrorCode.VALIDATION_ERROR, 'numeric manuscriptId');
  });

  test('Validate optional metadata type (must be object if present)', () => {
    validateInputIntent({ source: 'speak', metadata: { confidence: 0.95 } });
    assertThrows(() => validateInputIntent({ source: 'speak', metadata: 'invalid' }), StorageErrorCode.VALIDATION_ERROR, 'string metadata');
    assertThrows(() => validateInputIntent({ source: 'speak', metadata: [1, 2] }), StorageErrorCode.VALIDATION_ERROR, 'array metadata');
  });

  // ============================================================================
  // GROUP 3: TYPE INPUT CONTRACT & HANDOFF
  // ============================================================================
  console.log('--- Group 3: Type Input Contract & Handoff ---');

  test('createTypeDraft creates draft with source="type" and default empty fields', () => {
    const { poemRepo } = createTestEnvironment();
    const draft = createTypeDraft({}, poemRepo);
    assert(draft.source === 'type', 'Draft source must be type');
    assert(draft.title === '', 'Draft title default empty');
    assert(draft.body === '', 'Draft body default empty');
    assert(draft.poemId === null, 'Draft poemId must be null for new poem');
    assert(draft.manuscriptId === null, 'Draft manuscriptId must be null for type');
    assert(draft.inputMetadata === null, 'Draft inputMetadata must be null');
  });

  test('createTypeDraft persists draft in poem repository', () => {
    const { poemRepo } = createTestEnvironment();
    createTypeDraft({ title: 'सांध्यगीत', body: 'प्रिय, सांध्य गगन में' }, poemRepo);
    const saved = poemRepo.getDraft();
    assert(saved !== null, 'Draft must be saved in repository');
    assert(saved.title === 'सांध्यगीत', 'Title must match');
    assert(saved.body === 'प्रिय, सांध्य गगन में', 'Body must match');
    assert(saved.source === 'type', 'Source must be type');
  });

  test('createTypeDraft preserves Devanagari Hindi text and emojis', () => {
    const { poemRepo } = createTestEnvironment();
    const hindiTitle = 'अग्निपथ 🌟 🔥';
    const hindiBody = 'वृक्ष हों भले खड़े,\nहों घने हों बड़े,\nएक पत्र छाँह भी,\nमाँग मत, माँग मत, माँग मत,\nअग्निपथ! अग्निपथ! अग्निपथ!';
    createTypeDraft({ title: hindiTitle, body: hindiBody, author: 'हरिवंश राय बच्चन' }, poemRepo);
    const saved = poemRepo.getDraft();
    assert(saved.title === hindiTitle, 'Unicode title must be exact');
    assert(saved.body === hindiBody, 'Unicode body must be exact');
    assert(saved.author === 'हरिवंश राय बच्चन', 'Unicode author must be exact');
  });

  // ============================================================================
  // GROUP 4: SCAN INPUT CONTRACT & ARCHIVAL PRESERVATION
  // ============================================================================
  console.log('--- Group 4: Scan Input Contract & Archival Preservation ---');

  test('createScanDraft requires non-empty manuscriptId', () => {
    const { poemRepo } = createTestEnvironment();
    assertThrows(() => createScanDraft({}, poemRepo), StorageErrorCode.VALIDATION_ERROR, 'missing manuscriptId');
    assertThrows(() => createScanDraft({ manuscriptId: '   ' }, poemRepo), StorageErrorCode.VALIDATION_ERROR, 'whitespace manuscriptId');
  });

  test('createScanDraft creates draft with source="scan" and manuscriptId', () => {
    const { poemRepo } = createTestEnvironment();
    const draft = createScanDraft({
      manuscriptId: 'ms-kavya-001',
      title: 'पुरातन हस्तलिखित पृष्ठ',
      text: 'यह पृष्ठ १८५० का है।'
    }, poemRepo);
    assert(draft.source === 'scan', 'Draft source must be scan');
    assert(draft.manuscriptId === 'ms-kavya-001', 'Manuscript ID must match');
    assert(draft.title === 'पुरातन हस्तलिखित पृष्ठ', 'Title must match');
    assert(draft.body === 'यह पृष्ठ १८५० का है।', 'Body must match');
  });

  test('createScanDraft with manuscriptRepo resolves title and transcription from manuscript', () => {
    const { poemRepo, manuscriptRepo } = createTestEnvironment();
    const ms = manuscriptRepo.create({
      title: 'निराला जी की हस्तलिखित पांडुलिपि',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_IMAGE_BASE64
      },
      author: 'सूर्यकांत त्रिपाठी निराला'
    });
    manuscriptRepo.updateTranscription(ms.id, { text: 'वह तोड़ती पत्थर,\nदेखा मैंने उसे इलाहाबाद के पथ पर।' });

    const draft = createScanDraft({ manuscriptId: ms.id }, poemRepo, manuscriptRepo);
    assert(draft.source === 'scan', 'Draft source must be scan');
    assert(draft.manuscriptId === ms.id, 'Manuscript ID must match');
    assert(draft.title === 'निराला जी की हस्तलिखित पांडुलिपि', 'Draft title resolved from manuscript');
    assert(draft.body.includes('वह तोड़ती पत्थर'), 'Draft body resolved from transcription');
  });

  test('createScanDraft does NOT duplicate manuscript image bytes into draft or poem storage', () => {
    const { poemRepo, manuscriptRepo, mockStorage } = createTestEnvironment();
    const ms = manuscriptRepo.create({
      title: 'चित्रयुक्त पांडुलिपि',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_IMAGE_BASE64
      }
    });

    const draft = createScanDraft({ manuscriptId: ms.id }, poemRepo, manuscriptRepo);
    assert(draft.manuscriptId === ms.id, 'Has manuscript reference ID');
    assert(!draft.imageData, 'Draft must NOT contain imageData');
    assert(!draft.originalManuscript, 'Draft must NOT contain originalManuscript object');
    assert(!draft.derivedManuscript, 'Draft must NOT contain derivedManuscript object');

    // Verify storage serialization does not contain image bytes in drafts key
    const rawDraftJson = mockStorage.getItem('kavyavault:drafts');
    assert(rawDraftJson !== null, 'Draft must be saved in storage');
    assert(!rawDraftJson.includes(SAMPLE_IMAGE_BASE64), 'Draft JSON must NOT contain raw image base64 bytes');
  });

  test('createScanDraft throws KEY_NOT_FOUND when non-existent manuscriptId is provided with repo', () => {
    const { poemRepo, manuscriptRepo } = createTestEnvironment();
    assertThrows(
      () => createScanDraft({ manuscriptId: 'non-existent-id' }, poemRepo, manuscriptRepo),
      StorageErrorCode.KEY_NOT_FOUND,
      'non-existent manuscriptId'
    );
  });

  test('Archival manuscript immutability: manuscript remains byte-for-byte identical after scan draft creation', () => {
    const { poemRepo, manuscriptRepo } = createTestEnvironment();
    const createdMs = manuscriptRepo.create({
      title: 'अपरिवर्तनीय मूल पांडुलिपि',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_IMAGE_BASE64
      },
      author: 'सुमित्रानंदन पंत'
    });
    const msBefore = manuscriptRepo.getById(createdMs.id);
    const bytesBefore = msBefore.originalManuscript.data;
    const jsonBefore = JSON.stringify(msBefore);

    createScanDraft({ manuscriptId: msBefore.id, text: 'अहह! विस्मय से भरे नयन' }, poemRepo, manuscriptRepo);

    const msAfter = manuscriptRepo.getById(msBefore.id);
    assert(msAfter.originalManuscript.data === bytesBefore, 'Original bytes must remain strictly identical');
    assert(JSON.stringify(msAfter) === jsonBefore, 'Full manuscript record must remain completely identical');
  });

  // ============================================================================
  // GROUP 5: SPEAK (VOICE) INPUT CONTRACT
  // ============================================================================
  console.log('--- Group 5: Speak (Voice) Input Contract ---');

  test('createSpeakDraft requires non-null object and string text', () => {
    const { poemRepo } = createTestEnvironment();
    assertThrows(() => createSpeakDraft(null, poemRepo), StorageErrorCode.VALIDATION_ERROR, 'null speak data');
    assertThrows(() => createSpeakDraft({}, poemRepo), StorageErrorCode.VALIDATION_ERROR, 'missing text');
    assertThrows(() => createSpeakDraft({ text: 999 }, poemRepo), StorageErrorCode.VALIDATION_ERROR, 'numeric text');
  });

  test('createSpeakDraft creates draft with source="speak" and default metadata', () => {
    const { poemRepo } = createTestEnvironment();
    const draft = createSpeakDraft({
      text: 'वाणी से उच्चारित पहली पंक्ति',
      title: 'वाणी रचना'
    }, poemRepo);

    assert(draft.source === 'speak', 'Source must be speak');
    assert(draft.title === 'वाणी रचना', 'Title must match');
    assert(draft.body === 'वाणी से उच्चारित पहली पंक्ति', 'Body must match');
    assert(draft.inputMetadata !== null, 'Metadata must exist');
    assert(draft.inputMetadata.language === 'hi-IN', 'Default language hi-IN');
  });

  test('createSpeakDraft preserves mixed Hindi/English transcription text', () => {
    const { poemRepo } = createTestEnvironment();
    const mixedText = 'जीवन एक Journey है, जहाँ हर मोड़ पर नई Poetry जन्म लेती है।';
    const draft = createSpeakDraft({
      text: mixedText,
      title: 'द्विभाषी कविता (Bilingual Poem)',
      metadata: { language: 'hi-IN', confidence: 0.98, engine: 'local-voice' }
    }, poemRepo);

    assert(draft.body === mixedText, 'Mixed text must be preserved exactly');
    assert(draft.inputMetadata.confidence === 0.98, 'Confidence metadata preserved');
  });

  // ============================================================================
  // GROUP 6: DRAFT ISOLATION & NO PREMATURE PERSISTENCE
  // ============================================================================
  console.log('--- Group 6: Draft Isolation & No Premature Persistence ---');

  test('Creating Type draft does NOT create a final poem record', () => {
    const { poemRepo } = createTestEnvironment();
    assert(poemRepo.getAll().length === 0, 'Initially 0 poems');
    createTypeDraft({ title: 'अपूर्ण कविता', body: 'कुछ शब्द...' }, poemRepo);
    assert(poemRepo.getAll().length === 0, 'Draft creation must NOT add poem to repository');
  });

  test('Creating Scan draft does NOT create a final poem record', () => {
    const { poemRepo } = createTestEnvironment();
    assert(poemRepo.getAll().length === 0, 'Initially 0 poems');
    createScanDraft({ manuscriptId: 'ms-test', title: 'स्कैन कविता', text: 'पाठ' }, poemRepo);
    assert(poemRepo.getAll().length === 0, 'Scan draft creation must NOT add poem to repository');
  });

  test('Creating Speak draft does NOT create a final poem record', () => {
    const { poemRepo } = createTestEnvironment();
    assert(poemRepo.getAll().length === 0, 'Initially 0 poems');
    createSpeakDraft({ text: 'बोले गए शब्द' }, poemRepo);
    assert(poemRepo.getAll().length === 0, 'Speak draft creation must NOT add poem to repository');
  });

  test('Draft can be retrieved via poemRepo.getDraft() and cleared via poemRepo.clearDraft()', () => {
    const { poemRepo } = createTestEnvironment();
    createSpeakDraft({ text: 'परीक्षण पाठ' }, poemRepo);
    assert(poemRepo.getDraft() !== null, 'Draft should exist');
    poemRepo.clearDraft();
    assert(poemRepo.getDraft() === null, 'Draft should be cleared');
  });

  // ============================================================================
  // GROUP 7: POETRYEDITOR HANDOFF & SAVE LIFECYCLE
  // ============================================================================
  console.log('--- Group 7: PoetryEditor Handoff & Save Lifecycle ---');

  test('PoetryEditor mounts with initialDraft and populates form fields', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const initialDraft = {
      source: 'scan',
      manuscriptId: 'ms-test-123',
      title: 'हस्तलिखित गीत',
      text: 'पंक्ति १\nपंक्ति २',
      author: 'महादेवी वर्मा',
      tags: ['छायावाद']
    };
    const { container } = createEditorMockContainer(initialDraft);

    const editor = new PoetryEditor({
      container,
      router,
      initialDraft,
      repository: poemRepo,
      manuscriptRepo
    });

    editor.mount();

    assert(editor.source === 'scan', 'Editor source must be scan');
    assert(editor.manuscriptId === 'ms-test-123', 'Editor manuscriptId must match');
    assert(editor.title === 'हस्तलिखित गीत', 'Editor title initialized');
    assert(editor.body.includes('पंक्ति १'), 'Editor body initialized');
    assert(editor.author === 'महादेवी वर्मा', 'Editor author initialized');
    assert(editor.tags === 'छायावाद', 'Editor tags initialized');
    assert(container.innerHTML.includes('editor-source-indicator'), 'Source indicator badge rendered');
  });

  test('PoetryEditor renders input source badge for scan and speak', () => {
    const { poemRepo, router } = createTestEnvironment();
    const { container: containerScan } = createEditorMockContainer({ title: 'स्कैन', text: 'पाठ' });

    const editorScan = new PoetryEditor({
      container: containerScan,
      router,
      initialDraft: { source: 'scan', manuscriptId: 'ms-1', title: 'स्कैन', text: 'पाठ' },
      repository: poemRepo
    });
    editorScan.mount();
    assert(containerScan.innerHTML.includes('source-scan'), 'Must render source-scan class');
    assert(containerScan.innerHTML.includes('📜'), 'Must render scroll emoji');

    const { container: containerSpeak } = createEditorMockContainer({ title: 'ध्वनि', text: 'पाठ' });
    const editorSpeak = new PoetryEditor({
      container: containerSpeak,
      router,
      initialDraft: { source: 'speak', title: 'ध्वनि', text: 'पाठ' },
      repository: poemRepo
    });
    editorSpeak.mount();
    assert(containerSpeak.innerHTML.includes('source-speak'), 'Must render source-speak class');
    assert(containerSpeak.innerHTML.includes('🎙️'), 'Must render microphone emoji');
  });

  test('PoetryEditor keeps advanced input modes out of the writing canvas', () => {
    const { poemRepo, router } = createTestEnvironment();
    const { container } = createEditorMockContainer();
    const editor = new PoetryEditor({ container, router, repository: poemRepo });
    editor.mount();
    assert(!container.innerHTML.includes('href="/input"'), 'Input modes should be secondary');
  });

  test('PoetryEditor autosave preserves source, manuscriptId, and inputMetadata', () => {
    const { poemRepo, router } = createTestEnvironment();
    const initialDraft = {
      source: 'speak',
      title: 'ध्वनि कविता',
      text: 'बोली गई पंक्तियाँ',
      metadata: { engine: 'local' }
    };
    const { container } = createEditorMockContainer(initialDraft);
    const editor = new PoetryEditor({
      container,
      router,
      initialDraft,
      repository: poemRepo
    });
    editor.mount();

    // Trigger autosave in editor
    editor.performAutosave();

    const savedDraft = poemRepo.getDraft();
    assert(savedDraft !== null, 'Draft must be autosaved');
    assert(savedDraft.source === 'speak', 'Draft source must be speak');
    assert(savedDraft.inputMetadata?.engine === 'local', 'Input metadata must be preserved');
  });

  test('PoetryEditor final save creates poem, clears draft, and navigates', () => {
    const { poemRepo, router } = createTestEnvironment();
    const initialDraft = {
      source: 'type',
      title: 'सफलता की ओर',
      text: 'परिश्रम ही जीवन का सार है।',
      author: 'विद्यार्थी'
    };
    const { container } = createEditorMockContainer(initialDraft);
    const editor = new PoetryEditor({
      container,
      router,
      initialDraft,
      repository: poemRepo
    });
    editor.mount();

    assert(poemRepo.getAll().length === 0, 'Initially 0 poems');
    editor.savePoem();

    assert(poemRepo.getAll().length === 1, 'Exactly 1 poem created on explicit save');
    const createdPoem = poemRepo.getAll()[0];
    assert(createdPoem.title === 'सफलता की ओर', 'Poem title preserved');
    assert(createdPoem.body === 'परिश्रम ही जीवन का सार है।', 'Poem body preserved');
    assert(poemRepo.getDraft() === null, 'Draft must be cleared after save');
    assert(router.getCurrentPath() === ROUTES.POEMS, 'Must navigate to poems library');
  });

  test('PoetryEditor final save links manuscript if source is scan and manuscriptId is present', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const ms = manuscriptRepo.create({
      title: 'हस्तलिखित पांडुलिपि',
      originalManuscript: {
        mimeType: 'image/png',
        data: SAMPLE_IMAGE_BASE64
      }
    });

    const initialDraft = {
      source: 'scan',
      manuscriptId: ms.id,
      title: 'पांडुलिपि से बनी कविता',
      text: 'अनुदित पंक्तियाँ'
    };
    const { container } = createEditorMockContainer(initialDraft);
    const editor = new PoetryEditor({
      container,
      router,
      initialDraft,
      repository: poemRepo,
      manuscriptRepo
    });
    editor.mount();

    editor.savePoem();

    const poems = poemRepo.getAll();
    assert(poems.length === 1, 'Poem created');
    const updatedMs = manuscriptRepo.getById(ms.id);
    assert(updatedMs.poemId === poems[0].id, 'Manuscript must be automatically linked to created poem');
  });

  test('Discarding recovered draft resets source to type and clears manuscriptId', () => {
    const { poemRepo, router } = createTestEnvironment();
    const { container } = createEditorMockContainer();
    poemRepo.saveDraft({
      title: 'छोड़ा गया प्रारूप',
      body: 'पाठ',
      source: 'scan',
      manuscriptId: 'ms-discard-1'
    });

    const editor = new PoetryEditor({ container, router, repository: poemRepo });
    editor.mount();
    assert(editor.showRecoveryPrompt === true, 'Recovery prompt should show');

    editor.discardDraft();
    assert(editor.showRecoveryPrompt === false, 'Recovery prompt hidden');
    assert(editor.source === 'type', 'Source reset to type');
    assert(editor.manuscriptId === null, 'Manuscript ID reset to null');
    assert(poemRepo.getDraft() === null, 'Repository draft cleared');
  });

  test('Standard typing flow regression: PoetryEditor without draft creates new poem as normal', () => {
    const { poemRepo, router } = createTestEnvironment();
    const { container, titleInput, bodyInput, authorInput } = createEditorMockContainer();
    const editor = new PoetryEditor({ container, router, repository: poemRepo });
    editor.mount();

    assert(editor.source === 'type', 'Default source must be type');
    titleInput.value = 'पारंपरिक कविता';
    bodyInput.value = 'हाथों से रची गई सुंदर कविता।';
    authorInput.value = 'कवि';
    editor.savePoem();

    assert(poemRepo.getAll().length === 1, 'Poem created via standard flow');
    assert(poemRepo.getAll()[0].title === 'पारंपरिक कविता', 'Poem title matches');
    assert(router.getCurrentPath() === ROUTES.POEMS, 'Navigated to library');
  });

  // ============================================================================
  // GROUP 8: INPUTMODESELECTOR UI & ACCESSIBILITY
  // ============================================================================
  console.log('--- Group 8: InputModeSelector UI & Accessibility ---');

  test('InputModeSelector renders all 3 modes (Type, Scan, Speak)', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const container = new MockElement('div');
    const selector = new InputModeSelector({
      container,
      router,
      poemRepo,
      manuscriptRepo
    });
    selector.mount();

    const html = container.innerHTML;
    assert(html.includes('टाइप करें (Type)'), 'Renders Type card');
    assert(html.includes('स्कैन करें (Scan)'), 'Renders Scan card');
    assert(html.includes('बोलकर लिखें (Speak)'), 'Renders Speak card');
    assert(html.includes('id="btn-mode-type"'), 'Renders Type button');
    assert(html.includes('id="btn-mode-scan"'), 'Renders Scan button');
    assert(html.includes('id="btn-mode-speak"'), 'Renders Speak button');
  });

  test('InputModeSelector renders privacy reassurance banner', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const container = new MockElement('div');
    const selector = new InputModeSelector({ container, router, poemRepo, manuscriptRepo });
    selector.mount();

    const html = container.innerHTML;
    assert(html.includes('स्थानीय लेखन और संग्रह'), 'Describes local storage');
    assert(html.includes('ऑडियो ऑनलाइन भेज सकता है'), 'Discloses browser speech transmission');
    assert(!html.includes('100% Local Privacy'), 'Does not promise offline speech privacy');
  });

  test('InputModeSelector shows honest placeholder status for Scan and Speak', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const container = new MockElement('div');
    const selector = new InputModeSelector({ container, router, poemRepo, manuscriptRepo });
    selector.mount();

    assert(container.innerHTML.includes('अनुबंध तैयार (Next)'), 'Shows honest status badge');

    selector.setMode('scan');
    assert(container.innerHTML.includes('स्कैन इनपुट शीघ्र आ रहा है (Phase 3.2)'), 'Scan honest placeholder text');

    selector.setMode('speak');
    assert(container.innerHTML.includes('वाणी इनपुट शीघ्र आ रहा है (Phase 3.3)'), 'Speak honest placeholder text');
  });

  test('InputModeSelector toggles mode details on button click', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const container = new MockElement('div');
    const selector = new InputModeSelector({ container, router, poemRepo, manuscriptRepo });
    selector.mount();

    // Click scan button
    selector.handleClick({
      target: {
        id: 'btn-mode-scan',
        closest: () => ({ id: 'btn-mode-scan' })
      },
      preventDefault: () => {}
    });
    assert(selector.currentMode === 'scan', 'Submode transitioned to scan');
    assert(container.innerHTML.includes('scan-contract-title'), 'Scan contract title displayed');

    // Click close details
    selector.handleClick({
      target: {
        id: 'btn-close-details',
        closest: () => ({ id: 'btn-close-details' })
      },
      preventDefault: () => {}
    });
    assert(selector.currentMode === 'overview', 'Returned to overview mode');
  });

  test('InputModeSelector test buttons create drafts and navigate to /poems/new', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const container = new MockElement('div');
    const selector = new InputModeSelector({ container, router, poemRepo, manuscriptRepo });
    selector.mount();

    // 1. Test Type Mode button
    selector.handleClick({
      target: {
        id: 'btn-mode-type',
        closest: () => ({ id: 'btn-mode-type' })
      },
      preventDefault: () => {}
    });
    assert(router.getCurrentPath() === ROUTES.NEW_POEM, 'Type button navigates to /poems/new');

    // 2. Test Speak draft creation button
    selector.handleClick({
      target: {
        id: 'btn-test-speak-draft',
        closest: () => ({ id: 'btn-test-speak-draft' })
      },
      preventDefault: () => {}
    });
    assert(poemRepo.getDraft()?.source === 'speak', 'Speak draft created');
    assert(router.getCurrentPath() === ROUTES.NEW_POEM, 'Speak draft navigated to /poems/new');

    // 3. Test Scan draft creation button with sample
    selector.handleClick({
      target: {
        id: 'btn-test-scan-sample',
        closest: () => ({ id: 'btn-test-scan-sample' })
      },
      preventDefault: () => {}
    });
    assert(poemRepo.getDraft()?.source === 'scan', 'Scan draft created');
    assert(router.getCurrentPath() === ROUTES.NEW_POEM, 'Scan draft navigated to /poems/new');
  });

  test('InputModeSelector unmount cleans up listeners and DOM', () => {
    const { poemRepo, manuscriptRepo, router } = createTestEnvironment();
    const container = new MockElement('div');
    const selector = new InputModeSelector({ container, router, poemRepo, manuscriptRepo });
    selector.mount();
    assert(container.innerHTML.length > 0, 'Has content when mounted');

    selector.unmount();
    assert(container.innerHTML === '', 'DOM emptied on unmount');
    assert(container.listeners.get('click').length === 0, 'Click listeners removed');
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} MODERN INPUT TESTS PASSED!`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runModernInputTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exitCode = 1;
});
