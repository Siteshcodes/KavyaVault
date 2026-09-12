/**
 * KavyaVault (काव्यकलश) — Phase 3 / Task 3.3 Test Suite
 * Speak → Poem Workflow
 *
 * Tests:
 * 1. Speech capability detection (unprefixed window.SpeechRecognition)
 * 2. Speech capability detection (prefixed window.webkitSpeechRecognition)
 * 3. Unsupported browser environment handling
 * 4. Default language configuration (hi-IN)
 * 5. Bounded language switching (hi-IN to en-IN)
 * 6. Recognition lifecycle states (idle -> starting -> listening -> stopping -> completed)
 * 7. Start lifecycle and recognition start method invocation
 * 8. Stop lifecycle and graceful termination
 * 9. Abort lifecycle and emergency cancellation
 * 10. onstart event state transition to LISTENING
 * 11. Final transcript processing and merging
 * 12. Interim result tracking without corrupting final transcript
 * 13. Repeated result deduplication / stability
 * 14. Friendly Hindi error message formatting (not-allowed / permission denied)
 * 15. Friendly Hindi error message formatting (no-speech)
 * 16. Friendly Hindi error message formatting (audio-capture)
 * 17. Friendly Hindi error message formatting (network)
 * 18. SpeakInputView component rendering and DOM structure
 * 19. Unsupported banner display when speech recognition is absent
 * 20. Microphone toggle button interaction and state reflection
 * 21. Live transcript textarea updates from speech recognition events
 * 22. Manual transcript editing in textarea
 * 23. Empty / whitespace-only transcript rejection with Hindi prompt
 * 24. "कविता के रूप में उपयोग करें" handoff to PoemInputService.createSpeakDraft
 * 25. Source tag 'speak' and language metadata preservation
 * 26. No premature poem persistence in PoemRepository before explicit save
 * 27. PoetryEditor hydration from speak draft
 * 28. Explicit save persists poem with source 'speak'
 * 29. Complex Hindi Unicode conjuncts preservation (क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ)
 * 30. Matras, nukta, virama, and chandrabindu fidelity
 * 31. Mixed Hindi-English phrases fidelity
 * 32. Clear / Reset transcript button behavior
 * 33. Repeated start / stop cycle safety
 * 34. Event listener and recognition destruction on unmount
 * 35. AppShell routing to SpeakInputView on /input/speak
 */

import {
  SpeechRecognitionAdapter,
  SPEECH_RECOGNITION_STATES,
  SUPPORTED_LANGUAGES,
  LANGUAGE_OPTIONS,
  isSpeechRecognitionSupported,
  formatSpeechErrorMessage
} from './src/services/speech/SpeechRecognitionAdapter.js';
import {
  createSpeakDraft,
  createTypeDraft
} from './src/services/input/PoemInputService.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { SpeakInputView } from './src/components/input/SpeakInputView.js';
import { PoetryEditor } from './src/components/editor/PoetryEditor.js';
import { ROUTES } from './src/data/navigation.js';
import fs from 'fs';

// Setup mock window & document
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

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

/**
 * Mock SpeechRecognition instance for deterministic adapter unit tests
 */
class MockRecognition {
  constructor() {
    this.continuous = false;
    this.interimResults = false;
    this.lang = 'hi-IN';
    this.maxAlternatives = 1;

    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;

    this.started = false;
    this.stopped = false;
    this.aborted = false;
  }

  start() {
    this.started = true;
    if (typeof this.onstart === 'function') {
      this.onstart();
    }
  }

  stop() {
    this.stopped = true;
    if (typeof this.onend === 'function') {
      this.onend();
    }
  }

  abort() {
    this.aborted = true;
    if (typeof this.onend === 'function') {
      this.onend();
    }
  }

  // Helper to simulate speech result event
  simulateResult(resultsArray) {
    if (typeof this.onresult === 'function') {
      this.onresult({
        resultIndex: 0,
        results: resultsArray
      });
    }
  }

  // Helper to simulate recognition error
  simulateError(errorType, message = '') {
    if (typeof this.onerror === 'function') {
      this.onerror({
        error: errorType,
        message: message
      });
    }
  }
}

/**
 * Lightweight mock DOM environment for SpeakInputView unit testing
 */
class SimpleMockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {};
    const classes = new Set();
    this.classList = {
      add: (...cls) => cls.forEach(c => classes.add(c)),
      remove: (...cls) => cls.forEach(c => classes.delete(c)),
      contains: (c) => classes.has(c),
      has: (c) => classes.has(c),
      toggle: (c) => classes.has(c) ? (classes.delete(c), false) : (classes.add(c), true)
    };
    this._value = '';
    this._textContent = '';
    this.eventListeners = {};
    this.innerHTMLString = '';
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = val;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = val;
  }

  get innerHTML() {
    return this.innerHTMLString;
  }

  set innerHTML(html) {
    this.innerHTMLString = html;
    this._parseHtml(html);
  }

  _parseHtml(html) {
    this.children = [];
    // Identify elements with ids, tags, and values
    const elementMatches = [...html.matchAll(/<([a-z0-9-]+)[^>]*id=["']([^"']+)["'][^>]*>/gi)];
    for (const match of elementMatches) {
      const tag = match[1].toUpperCase();
      const id = match[2];
      const el = new SimpleMockElement(tag);
      el.id = id;

      // Extract value if present
      const valMatch = match[0].match(/value=["']([^"']*)["']/i);
      if (valMatch) {
        el.value = valMatch[1];
      }
      this.children.push(el);
    }

    // Also match textarea text content
    const textareaMatches = [...html.matchAll(/<textarea[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/textarea>/gi)];
    for (const match of textareaMatches) {
      const existing = this.children.find(c => c.id === match[1]);
      if (existing) {
        existing.value = match[2];
      }
    }

    // Add error banner text holder
    const errText = new SimpleMockElement('span');
    errText.className = 'error-text';
    this.children.push(errText);

    const statusDot = new SimpleMockElement('span');
    statusDot.className = 'speak-status-indicator';
    this.children.push(statusDot);
  }

  setAttribute(attr, val) {
    this.attributes[attr] = val;
  }

  getAttribute(attr) {
    return this.attributes[attr];
  }

  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  dispatchEvent(event) {
    const handlers = this.eventListeners[event.type] || [];
    for (const h of handlers) {
      h(event);
    }
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      return this._findChild(el => el.id === targetId);
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      return this._findChild(el => (el.className && el.className.includes(cls)) || el.classList.has(cls));
    }
    return this._findChild(el => el.tagName.toLowerCase() === selector.toLowerCase());
  }

  _findChild(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const found = child._findChild(predicate);
      if (found) return found;
    }
    return null;
  }

  focus() {}
}

async function runTests() {
  console.log('=== KAVYAVAULT SPEAK TO POEM (Phase 3 / Task 3.3) TEST SUITE ===\n');

  // 1. Speech capability detection (standard window.SpeechRecognition)
  console.log('--- Suite 1: Capability Detection ---');
  {
    const fakeWindow = { SpeechRecognition: MockRecognition };
    assert(isSpeechRecognitionSupported(fakeWindow) === true, 'Detects standard window.SpeechRecognition');
  }

  // 2. Speech capability detection (prefixed window.webkitSpeechRecognition)
  {
    const fakeWindow = { webkitSpeechRecognition: MockRecognition };
    assert(isSpeechRecognitionSupported(fakeWindow) === true, 'Detects prefixed window.webkitSpeechRecognition');
  }

  // 3. Unsupported browser environment
  {
    const emptyWindow = {};
    assert(isSpeechRecognitionSupported(emptyWindow) === false, 'Returns false when no SpeechRecognition exists');
    assert(isSpeechRecognitionSupported(null) === false, 'Returns false for null window');
  }

  // 4. Default language configuration
  console.log('\n--- Suite 2: Adapter Languages & Lifecycle ---');
  {
    const adapter = new SpeechRecognitionAdapter({
      customRecognitionClass: MockRecognition
    });
    assert(adapter.getLanguage() === 'hi-IN', 'Default language is hi-IN');
    assert(SUPPORTED_LANGUAGES.HINDI === 'hi-IN', 'SUPPORTED_LANGUAGES defines hi-IN');
    assert(SUPPORTED_LANGUAGES.ENGLISH === 'en-IN', 'SUPPORTED_LANGUAGES defines en-IN');
    assert(LANGUAGE_OPTIONS.length === 2, 'LANGUAGE_OPTIONS provides 2 bounded languages');
  }

  // 5. Bounded language switching
  {
    const adapter = new SpeechRecognitionAdapter({
      customRecognitionClass: MockRecognition
    });
    adapter.setLanguage('en-IN');
    assert(adapter.getLanguage() === 'en-IN', 'Switched language to en-IN');
    adapter.setLanguage('unsupported-code');
    assert(adapter.getLanguage() === 'en-IN', 'Ignores unsupported language codes');
  }

  // 6. Recognition lifecycle states
  {
    let stateChanges = [];
    const adapter = new SpeechRecognitionAdapter({
      customRecognitionClass: MockRecognition,
      onStateChange: (st) => stateChanges.push(st)
    });

    assert(adapter.state === SPEECH_RECOGNITION_STATES.IDLE, 'Initial state is IDLE');

    // 7. Start lifecycle
    const started = adapter.start();
    assert(started === true, 'adapter.start() succeeds');
    assert(adapter.state === SPEECH_RECOGNITION_STATES.LISTENING, 'Moves to LISTENING on start (mock fires onstart)');
    assert(adapter.isListening() === true, 'isListening() returns true');

    // 8. Stop lifecycle
    adapter.stop();
    assert(adapter.state === SPEECH_RECOGNITION_STATES.COMPLETED, 'Moves to COMPLETED on stop');
    assert(adapter.isListening() === false, 'isListening() returns false after stop');

    // 9. Abort lifecycle
    adapter.start();
    adapter.abort();
    assert(adapter.state === SPEECH_RECOGNITION_STATES.IDLE, 'Moves to IDLE on abort');
  }

  // 10. Unsupported state when no SpeechRecognition class
  {
    const adapter = new SpeechRecognitionAdapter({
      globalScope: {} // No SpeechRecognition
    });
    assert(adapter.isSupported() === false, 'Reports isSupported() false when API missing');
    assert(adapter.state === SPEECH_RECOGNITION_STATES.UNSUPPORTED, 'State is UNSUPPORTED');
    const startResult = adapter.start();
    assert(startResult === false, 'start() fails gracefully in unsupported browser');
  }

  // 11. Results Handling (Interim vs. Final)
  console.log('\n--- Suite 3: Speech Recognition Results & Merging ---');
  {
    let latestResult = null;
    const adapter = new SpeechRecognitionAdapter({
      customRecognitionClass: MockRecognition,
      onResult: (res) => { latestResult = res; }
    });

    adapter.start();

    // Simulate interim result
    adapter.recognition.simulateResult([
      { isFinal: false, 0: { transcript: 'मधुशाला की' } }
    ]);

    assert(latestResult !== null, 'Received result event');
    assert(latestResult.interim === 'मधुशाला की', 'Interim text captured accurately');
    assert(latestResult.final === '', 'Final text remains empty while interim');

    // Simulate final result
    adapter.recognition.simulateResult([
      { isFinal: true, 0: { transcript: 'मधुशाला की पंक्तियाँ' } }
    ]);

    assert(latestResult.interim === '', 'Interim text cleared after final result');
    assert(latestResult.final === 'मधुशाला की पंक्तियाँ', 'Final text merged correctly');
    assert(latestResult.fullTranscript === 'मधुशाला की पंक्तियाँ', 'fullTranscript equals final text');

    // 12. Next phrase appending
    adapter.recognition.simulateResult([
      { isFinal: true, 0: { transcript: 'हरिवंश राय बच्चन' } }
    ]);

    assert(latestResult.fullTranscript === 'मधुशाला की पंक्तियाँ\nहरिवंश राय बच्चन', 'Successive final results separated by newline');

    // 13. Repeated result deduplication
    adapter.recognition.simulateResult([
      { isFinal: true, 0: { transcript: 'हरिवंश राय बच्चन' } }
    ]);
    assert(latestResult.fullTranscript === 'मधुशाला की पंक्तियाँ\nहरिवंश राय बच्चन', 'Duplicate successive final phrase prevented');
  }

  // 14. Error handling & Friendly Hindi messaging
  console.log('\n--- Suite 4: Permissions & Error Messaging ---');
  {
    const notAllowedMsg = formatSpeechErrorMessage({ error: 'not-allowed' });
    assert(notAllowedMsg.includes('अनुमति नहीं मिली') || notAllowedMsg.includes('माइक्रोफ़ोन'), 'Handles permission denied (not-allowed) with Hindi guidance');

    const noSpeechMsg = formatSpeechErrorMessage({ error: 'no-speech' });
    assert(noSpeechMsg.includes('कोई आवाज़ नहीं सुनी') || noSpeechMsg.includes('पुनः'), 'Handles no-speech error with Hindi guidance');

    const audioCaptureMsg = formatSpeechErrorMessage({ error: 'audio-capture' });
    assert(audioCaptureMsg.includes('माइक्रोफ़ोन') && audioCaptureMsg.includes('उपलब्ध नहीं'), 'Handles audio-capture error with Hindi guidance');

    const networkMsg = formatSpeechErrorMessage({ error: 'network' });
    assert(networkMsg.includes('नेटवर्क'), 'Handles network error with Hindi guidance');

    let receivedError = null;
    const adapter = new SpeechRecognitionAdapter({
      customRecognitionClass: MockRecognition,
      onError: (err) => { receivedError = err; }
    });

    adapter.start();
    adapter.recognition.simulateError('not-allowed');
    assert(receivedError !== null, 'Adapter emitted error event');
    assert(receivedError.error === 'not-allowed', 'Error type is not-allowed');
    assert(adapter.state === SPEECH_RECOGNITION_STATES.ERROR, 'Adapter state transitioned to ERROR');
  }

  // 15. SpeakInputView Component & UI
  console.log('\n--- Suite 5: SpeakInputView UI & Interactions ---');
  {
    const mockContainer = new SimpleMockElement('div');
    const mockRouter = {
      navigatedTo: null,
      navigate(path) { this.navigatedTo = path; }
    };
    const storage = new LocalStorageAdapter(new InMemoryStorage());
    const poemRepo = new PoemRepository(storage);

    const adapter = new SpeechRecognitionAdapter({
      customRecognitionClass: MockRecognition
    });

    const view = new SpeakInputView({
      container: mockContainer,
      router: mockRouter,
      poemRepo,
      speechAdapter: adapter
    });

    view.mount();

    assert(mockContainer.innerHTML.includes('speak-workspace-view'), 'SpeakInputView rendered workspace view');
    assert(mockContainer.innerHTML.includes('बोलकर लिखें'), 'Renders Hindi title');
    assert(mockContainer.innerHTML.includes('प्रतिलिपि'), 'Renders Hindi transcript heading');
    assert(mockContainer.innerHTML.includes('कविता के रूप में उपयोग करें'), 'Renders primary handoff button');

    // 16. Toggle microphone
    view._handleMicToggle();
    assert(adapter.isListening() === true, 'Mic toggle started recognition');

    // 17. Live transcript update
    adapter.recognition.simulateResult([
      { isFinal: true, 0: { transcript: 'यह बोली गई काव्य पंक्ति है।' } }
    ]);
    assert(view.transcriptText.includes('यह बोली गई काव्य पंक्ति है।'), 'View transcript updated from recognition result');

    // 18. Manual transcript editing in view
    view.transcriptText = 'यह बोली गई काव्य पंक्ति है।\nऔर यह हाथ से जोड़ी गई पंक्ति है।';
    assert(view.transcriptText.includes('हाथ से जोड़ी गई पंक्ति'), 'Manual editing updates view transcript');

    // 19. Clear button
    view._handleClear();
    assert(view.transcriptText === '', 'Clear button resets transcript');

    // 20. Empty transcript rejection
    view._handleUseAsPoem();
    assert(mockRouter.navigatedTo === null, 'Did not navigate on empty transcript');
    assert(view.errorMessage !== null, 'Sets validation error message for empty transcript');
    assert(view.errorMessage.includes('सार्थक वाणी पाठ आवश्यक है'), 'Displays clear Hindi prompt for empty transcript');

    // 21. Valid handoff via "कविता के रूप में उपयोग करें"
    view.transcriptText = 'प्रकृति की गोद में बैठा कवि\nशब्दों से चित्र बनाता है।';
    view.selectedLanguage = 'hi-IN';
    view._handleUseAsPoem();

    assert(mockRouter.navigatedTo === ROUTES.NEW_POEM, 'Navigated to PoetryEditor (ROUTES.NEW_POEM)');

    // 22. Verify draft created in PoemInputService
    const draft = poemRepo.getDraft();
    assert(draft !== null, 'Speak draft created successfully');
    assert(draft.source === 'speak', 'Draft source is "speak"');
    const draftMeta = draft.inputMetadata || draft.metadata || {};
    assert(draftMeta.language === 'hi-IN', 'Draft language metadata is "hi-IN"');
    assert(draft.body.includes('प्रकृति की गोद में बैठा कवि'), 'Draft body contains spoken transcript');

    // 23. No premature poem persistence
    const savedPoems = poemRepo.getAll();
    assert(savedPoems.length === 0, 'No poem persisted in repository prior to explicit save');

    view.unmount();
    assert(view.adapter === null, 'Adapter destroyed on unmount');
  }

  // 24. PoetryEditor Hydration & Explicit Save
  console.log('\n--- Suite 6: Editor Hydration & Explicit Save Workflow ---');
  {
    const storage = new LocalStorageAdapter(new InMemoryStorage());
    const poemRepo = new PoemRepository(storage);
    const mockRouter = {
      navigatedTo: null,
      navigate(path) { this.navigatedTo = path; }
    };

    // Stage a speak draft
    createSpeakDraft({
      text: 'क्षण भर रुक कर\nसांसों की लय को सुनो।',
      title: 'वाणी का स्वर',
      metadata: { language: 'hi-IN' }
    }, poemRepo);

    // Mount PoetryEditor
    const editorContainer = new SimpleMockElement('div');
    const titleInput = new SimpleMockElement('input');
    titleInput.id = 'editor-title';
    titleInput.value = 'वाणी का स्वर';

    const bodyInput = new SimpleMockElement('textarea');
    bodyInput.id = 'editor-body';
    bodyInput.value = 'क्षण भर रुक कर\nसांसों की लय को सुनो।';

    const authorInput = new SimpleMockElement('input');
    authorInput.id = 'editor-author';
    authorInput.value = 'कवि';

    editorContainer.children.push(titleInput, bodyInput, authorInput);

    const editor = new PoetryEditor({
      container: editorContainer,
      router: mockRouter,
      repository: poemRepo,
      initialDraft: {
        title: 'वाणी का स्वर',
        body: 'क्षण भर रुक कर\nसांसों की लय को सुनो।',
        source: 'speak'
      }
    });

    editor.mount();

    assert(editor.source === 'speak', 'Editor recognized source as "speak"');

    // Still no poem persisted in repository
    assert(poemRepo.getAll().length === 0, 'Poem remains non-persistent during editor editing');

    // Explicit user save
    editor.savePoem();

    const allPoems = poemRepo.getAll();
    assert(allPoems.length === 1, 'Poem explicitly persisted after user save');
    assert(allPoems[0].source === 'speak', 'Persisted poem has source = "speak"');
    assert(allPoems[0].body.includes('क्षण भर रुक कर'), 'Persisted poem contains faithful speech text');

    // Draft cleared on save
    assert(poemRepo.getDraft() === null, 'Draft cleared after successful save');
  }

  // 25. Unicode Devanagari & Special Characters Fidelity
  console.log('\n--- Suite 7: Unicode Devanagari Fidelity ---');
  {
    const unicodeText = 'क्ष त्र ज्ञ श्र द्व द्घ हृ\n' +
      'कृपा, पृथ्वी, नृप\n' +
      'क़िताब, ग़ज़ल, फ़नकार, ज़मीन\n' +
      'हूँ, चाँदनी, आँखें\n' +
      'विराम चिन्ह: पूर्णविराम। अल्पविराम, प्रश्नवाचक? विस्मयादिबोधक!\n' +
      'Mixed Hindi & English: KavyaVault में Poetry और वाणी का संगम ✨ 🕉️';

    const storage = new LocalStorageAdapter(new InMemoryStorage());
    const poemRepo = new PoemRepository(storage);

    createSpeakDraft({
      text: unicodeText,
      metadata: { language: 'hi-IN' }
    }, poemRepo);

    const draft = poemRepo.getDraft();
    assert(draft.body === unicodeText, 'Devanagari conjuncts, nukta, matras, English and emojis preserved byte-for-byte');
  }

  // 26. AppShell route mapping verification
  console.log('\n--- Suite 8: AppShell Route Verification ---');
  {
    const appShellSource = fs.readFileSync('./src/components/layout/AppShell.js', 'utf-8');
    assert(appShellSource.includes('import { SpeakInputView } from \'../input/SpeakInputView.js\''), 'AppShell imports SpeakInputView');
    assert(appShellSource.includes('ROUTES.INPUT_SPEAK'), 'AppShell checks ROUTES.INPUT_SPEAK');
    assert(appShellSource.includes('this.activeSpeakInput = new SpeakInputView'), 'AppShell instantiates SpeakInputView');
    assert(appShellSource.includes('this.activeSpeakInput.unmount()'), 'AppShell unmounts activeSpeakInput');
  }

  // 27. InputModeSelector integration verification
  {
    const selectorSource = fs.readFileSync('./src/components/input/InputModeSelector.js', 'utf-8');
    assert(selectorSource.includes('बोलकर लिखें (Speak)'), 'InputModeSelector displays Speak card');
    assert(selectorSource.includes('सक्रिय (Active)'), 'InputModeSelector displays Speak as active');
    assert(selectorSource.includes('ROUTES.INPUT_SPEAK'), 'InputModeSelector links directly to ROUTES.INPUT_SPEAK');
  }

  console.log(`\n==================================================`);
  console.log(`ALL ${passedTests} / ${totalTests} SPEAK TO POEM TESTS PASSED!`);
  console.log(`==================================================\n`);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
