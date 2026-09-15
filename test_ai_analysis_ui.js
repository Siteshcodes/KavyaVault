/**
 * काव्यकलश (KavyaVault) — AI Analysis UI Test Suite
 * Phase 4 / Task 4.2: AI Analysis UI (PoemReader Integration)
 *
 * Verifies:
 * Suite A: Entry Point Presence & Accessibility
 * Suite B: Explicit Consent Workflow (Modal, cancellation, confirmation)
 * Suite C: Lifecycle States (idle, pending, completed, failed, duplicate click protection)
 * Suite D: Result Rendering & AI Suggestion Visual Language
 * Suite E: Original Poem Immutability & Zero Repository Writes
 * Suite F: Error & Failure State Handling
 * Suite G: Security & Injection Resilience (safe text escaping)
 * Suite H: Unicode & Devanagari Integrity
 * Suite I: Accessibility Semantics & Escape Key Behavior
 */

import { PoemReader } from './src/components/reader/PoemReader.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { poemRepository } from './src/services/PoemRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemAnalysisService } from './src/services/ai/PoemAnalysisService.js';
import { MockAIAnalysisProvider } from './src/services/ai/MockAIAnalysisProvider.js';
import { ANALYSIS_STATUS } from './src/services/ai/analysisTypes.js';

// Minimal mock in-memory storage driver
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
  get length() {
    return this.store.size;
  }
}

// Minimal DOM container mock for deterministic node testing
function createMockContainer() {
  const container = {
    innerHTML: '',
    listeners: {},
    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    },
    dispatchEvent(event) {
      const handlers = this.listeners[event.type] || [];
      handlers.forEach(h => h(event));
    },
    querySelector(selector) {
      // Basic selector search for testing
      if (selector === '.btn-ai-confirm' && this.innerHTML.includes('btn-ai-confirm')) {
        return { focus: () => {} };
      }
      if (selector === '.btn-modal-cancel' && this.innerHTML.includes('btn-modal-cancel')) {
        return { focus: () => {} };
      }
      return null;
    }
  };
  return container;
}

// Helper to simulate data-action click on container
function simulateActionClick(reader, action) {
  reader.handleClick({
    target: {
      closest: (sel) => {
        if (sel === '[data-action]') {
          return { getAttribute: (attr) => (attr === 'data-action' ? action : null) };
        }
        return null;
      }
    }
  });
}

let testIndex = 0;
let passedTests = 0;

function runTest(description, fn) {
  testIndex++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error(`Test "${description}" returned a promise; use asyncRunTest instead`);
    }
    console.log(`✓ [Test ${testIndex}] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [Test ${testIndex}] ${description}`);
    console.error(`  Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function asyncRunTest(description, fn) {
  testIndex++;
  try {
    await fn();
    console.log(`✓ [Test ${testIndex}] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`✗ [Test ${testIndex}] ${description}`);
    console.error(`  Error: ${err.message}`);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('================================================================');
console.log('  KAVYAVAULT AI ANALYSIS UI TEST SUITE (Task 4.2)');
console.log('================================================================\n');

// Setup clean environment
const mockStorage = new InMemoryStorage();
const storageAdapter = new LocalStorageAdapter(mockStorage);
const testPoemRepo = new PoemRepository(storageAdapter);

const samplePoem = testPoemRepo.create({
  title: 'मधुशाला की छाँव',
  body: 'मदिरालय जाने को घर से चलता है पीनेवला,\nकिस पथ से जाऊँ, असमंजस में है वह भोलाभाला।',
  author: 'हरिवंश राय बच्चन',
  tags: ['क्लासिक', 'छायावाद']
});

async function main() {
  console.log('--- Suite A: Entry Point Presence & Accessibility ---');

  runTest('AI analysis button appears in reader toolbar for a saved poem', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = samplePoem;
    reader.update();

    assert(container.innerHTML.includes('btn-reader-ai'), 'Reader should render .btn-reader-ai button');
    assert(container.innerHTML.includes('data-action="open-ai-consent"'), 'Button should trigger open-ai-consent');
    assert(container.innerHTML.includes('AI से विश्लेषण करें'), 'Button label should be "AI से विश्लेषण करें"');
    assert(container.innerHTML.includes('aria-label="AI से विश्लेषण करें"'), 'Button should have accessible aria-label');
  });

  runTest('AI analysis button is NOT rendered for missing/invalid poem', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: 'non-existent-poem-id',
      poemRepo: testPoemRepo
    });
    reader.mount();

    assert(container.innerHTML.includes('रचना अप्राप्य'), 'Should render 404 missing poem view');
    assert(!container.innerHTML.includes('btn-reader-ai'), 'Missing poem view must not render AI analysis button');
  });

  console.log('\n--- Suite B: Explicit Consent Workflow ---');

  runTest('Clicking AI action opens explicit consent confirmation dialog', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = samplePoem;
    reader.update();

    assert(!container.innerHTML.includes('ai-consent-modal'), 'Consent modal must not be visible initially');

    simulateActionClick(reader, 'open-ai-consent');

    assert(reader.showAiConsentModal === true, 'showAiConsentModal should be true');
    assert(container.innerHTML.includes('ai-consent-modal'), 'Consent modal dialog must be rendered');
    assert(container.innerHTML.includes('क्या आप इस कविता का AI विश्लेषण करना चाहते हैं?'), 'Dialog title must match specification');
    assert(container.innerHTML.includes('सहमति देकर विश्लेषण करें'), 'Confirm button label must match specification');
    assert(container.innerHTML.includes('रद्द करें'), 'Cancel button must exist');
    assert(container.innerHTML.includes('role="dialog"'), 'Dialog must have role="dialog"');
    assert(container.innerHTML.includes('aria-modal="true"'), 'Dialog must declare aria-modal="true"');
  });

  runTest('Cancelling consent closes dialog and does not invoke analysis service', () => {
    let serviceCalled = false;
    const mockService = {
      async analyzePoem() {
        serviceCalled = true;
        return { status: ANALYSIS_STATUS.COMPLETED, result: {} };
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = samplePoem;
    reader.update();

    simulateActionClick(reader, 'open-ai-consent');
    assert(reader.showAiConsentModal === true, 'Modal should be open');

    simulateActionClick(reader, 'close-ai-consent');
    assert(reader.showAiConsentModal === false, 'Modal should close on cancel');
    assert(!container.innerHTML.includes('ai-consent-modal'), 'Modal HTML should be removed');
    assert(serviceCalled === false, 'Analysis service must NOT be called when consent cancelled');
    assert(reader.aiAnalysisState === 'idle', 'State must remain idle');
  });

  console.log('\n--- Suite C: Lifecycle States & Duplicate Request Protection ---');

  await asyncRunTest('Confirming consent invokes service with explicit consent and moves through lifecycle', async () => {
    let callPayload = null;
    const mockService = {
      async analyzePoem(payload) {
        callPayload = payload;
        return {
          status: ANALYSIS_STATUS.COMPLETED,
          result: {
            category: 'दर्शन एवं चिंतन',
            mood: 'गंभीर',
            themes: ['जीवन', 'पथ'],
            keywords: ['मदिरालय', 'असमंजस'],
            summary: 'कवि जीवन के पथ और असमंजस का सुंदर रूपक प्रस्तुत करता है।'
          }
        };
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = samplePoem;
    reader.update();

    simulateActionClick(reader, 'open-ai-consent');
    await reader.confirmAiAnalysis();

    assert(callPayload !== null, 'Service should have been called');
    assert(callPayload.poemId === samplePoem.id, 'Poem ID passed correctly');
    assert(callPayload.title === samplePoem.title, 'Poem title passed');
    assert(callPayload.body === samplePoem.body, 'Poem body passed');
    assert(callPayload.analysisConsent === true, 'Explicit consent flag must be true');

    assert(reader.aiAnalysisState === 'completed', 'Lifecycle state should be completed');
    assert(reader.isAnalyzing === false, 'isAnalyzing flag must be reset to false');
    assert(container.innerHTML.includes('कविता विश्लेषण एवं संगठन'), 'Suggestions panel should be rendered');
  });

  runTest('Duplicate analysis requests are blocked while analysis is pending', () => {
    let callCount = 0;
    const mockService = {
      async analyzePoem() {
        callCount++;
        return new Promise(() => {}); // never resolves to keep pending
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = samplePoem;
    reader.update();

    // First call starts analysis
    reader.confirmAiAnalysis();
    assert(reader.isAnalyzing === true, 'Should be analyzing');
    assert(reader.aiAnalysisState === 'pending', 'State should be pending');
    assert(container.innerHTML.includes('reader-ai-pending'), 'Pending section rendered');
    assert(container.innerHTML.includes('disabled'), 'AI button should be disabled during pending');

    // Second immediate attempt
    reader.confirmAiAnalysis();
    assert(callCount === 1, 'Duplicate service call must be prevented');
  });

  console.log('\n--- Suite D: Result Rendering & AI Suggestion Visual Language ---');

  await asyncRunTest('Completed result displays Category, Mood, Themes, Keywords, Summary with "AI सुझाव" branding', async () => {
    const analysisResult = {
      category: 'रहस्यवाद एवं दर्शन',
      mood: 'शांत',
      themes: ['आत्मा', 'ब्रह्म', 'सत्य'],
      keywords: ['शाश्वत', 'चेतना', 'अमृत'],
      summary: 'यह कविता आत्मा और परमात्मा के गूढ़ संबंधों का आख्यान करती है।'
    };

    const mockService = {
      async analyzePoem() {
        return { status: ANALYSIS_STATUS.COMPLETED, result: analysisResult };
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = samplePoem;
    reader.update();

    await reader.confirmAiAnalysis();

    // Result fields rendered
    assert(container.innerHTML.includes('रहस्यवाद एवं दर्शन'), 'Category rendered');
    assert(container.innerHTML.includes('शांत'), 'Mood rendered');
    assert(container.innerHTML.includes('#आत्मा'), 'Themes rendered as chips');
    assert(container.innerHTML.includes('शाश्वत'), 'Keywords rendered as chips');
    assert(container.innerHTML.includes('यह कविता आत्मा और परमात्मा के गूढ़ संबंधों का आख्यान करती है।'), 'Summary rendered');

    // Distinction as AI suggestions
    assert(container.innerHTML.includes('✨ AI सुझाव'), 'Panel must feature AI badge');
    assert(container.innerHTML.includes('ये सुझाव केवल अवलोकन हेतु हैं। इन्हें कविता में सहेजा नहीं गया है।'), 'Disclaimer must be present');
    assert(container.innerHTML.includes('ai-field-tag'), 'Field headers must clearly display AI suggestion tags');

    // Re-analyze option present
    assert(container.innerHTML.includes('पुनः विश्लेषण करें'), 'Re-analyze action must be present');
  });

  await asyncRunTest('Honest empty result state handled gracefully when analysis yields no suggestions', async () => {
    const emptyResult = {
      category: '',
      mood: '',
      themes: [],
      keywords: [],
      summary: ''
    };

    const mockService = {
      async analyzePoem() {
        return { status: ANALYSIS_STATUS.COMPLETED, result: emptyResult };
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = samplePoem;
    reader.update();

    await reader.confirmAiAnalysis();

    assert(container.innerHTML.includes('reader-ai-empty'), 'Should render empty state container');
    assert(container.innerHTML.includes('कोई AI सुझाव उपलब्ध नहीं हैं'), 'Honest empty title in Hindi');
    assert(container.innerHTML.includes('पुनः विश्लेषण करें'), 'Should offer retry action');
  });

  console.log('\n--- Suite E: Original Poem Immutability & Zero Repository Writes ---');

  await asyncRunTest('Poem in repository and PoemReader instance remains 100% byte-for-byte immutable', async () => {
    const originalRepoPoem = JSON.parse(JSON.stringify(testPoemRepo.getById(samplePoem.id)));
    const service = new PoemAnalysisService({ provider: new MockAIAnalysisProvider() });

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: service
    });
    reader.poem = samplePoem;
    reader.update();

    await reader.confirmAiAnalysis();

    // Verify poem object in reader
    assert(reader.poem.title === originalRepoPoem.title, 'Poem title untouched');
    assert(reader.poem.body === originalRepoPoem.body, 'Poem body untouched');
    assert(reader.poem.author === originalRepoPoem.author, 'Poem author untouched');
    assert(JSON.stringify(reader.poem.tags) === JSON.stringify(originalRepoPoem.tags), 'Poem tags untouched');
    assert(reader.poem.isFavorite === originalRepoPoem.isFavorite, 'isFavorite untouched');
    assert(reader.poem.isArchived === originalRepoPoem.isArchived, 'isArchived untouched');

    // Verify repository record
    const repoPoemAfter = testPoemRepo.getById(samplePoem.id);
    assert(JSON.stringify(repoPoemAfter) === JSON.stringify(originalRepoPoem), 'PoemRepository record must be byte-for-byte identical');
    assert(repoPoemAfter.aiAnalysis === undefined, 'No AI analysis field persisted in repository');
    assert(repoPoemAfter.suggestions === undefined, 'No suggestions persisted in repository');
  });

  console.log('\n--- Suite F: Error & Failure State Handling ---');

  await asyncRunTest('Provider failure renders clean Hindi error state with retry action', async () => {
    const mockFailingService = {
      async analyzePoem() {
        return {
          status: ANALYSIS_STATUS.FAILED,
          result: null,
          error: 'सेवा वर्तमान में अनुपलब्ध है।'
        };
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockFailingService
    });
    reader.poem = samplePoem;
    reader.update();

    await reader.confirmAiAnalysis();

    assert(reader.aiAnalysisState === 'failed', 'State should be failed');
    assert(container.innerHTML.includes('reader-ai-error'), 'Should render error section');
    assert(container.innerHTML.includes('AI विश्लेषण संपन्न नहीं हो सका'), 'Hindi error heading');
    assert(container.innerHTML.includes('सेवा वर्तमान में अनुपलब्ध है।'), 'Error detail rendered cleanly');
    assert(container.innerHTML.includes('पुनः प्रयास करें'), 'Retry button available');
    assert(!container.innerHTML.includes('stack'), 'No stack traces exposed');
  });

  await asyncRunTest('Unexpected exception in service call is safely caught and rendered as Hindi error', async () => {
    const throwingService = {
      async analyzePoem() {
        throw new Error('Network timeout simulation');
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: throwingService
    });
    reader.poem = samplePoem;
    reader.update();

    await reader.confirmAiAnalysis();

    assert(reader.aiAnalysisState === 'failed', 'State must be failed on exception');
    assert(reader.isAnalyzing === false, 'isAnalyzing reset after exception');
    assert(container.innerHTML.includes('Network timeout simulation'), 'Exception message safely captured');
  });

  console.log('\n--- Suite G: Security & Safe Text Escaping ---');

  await asyncRunTest('Untrusted script tags and HTML injection in AI response are rendered strictly as escaped text', async () => {
    const xssPayloadResult = {
      category: '<script>alert("category-xss")</script>',
      mood: '<img src=x onerror=alert("mood-xss")>',
      themes: ['<svg onload=alert(1)>', 'javascript:alert(2)'],
      keywords: ['<b>bold-injection</b>'],
      summary: '<iframe src="evil.html"></iframe><script>evil()</script>'
    };

    const mockService = {
      async analyzePoem() {
        return { status: ANALYSIS_STATUS.COMPLETED, result: xssPayloadResult };
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = samplePoem;
    reader.update();

    await reader.confirmAiAnalysis();

    const html = container.innerHTML;

    // Verify dangerous tags are properly escaped into HTML entities
    assert(!html.includes('<script>alert("category-xss")</script>'), 'Unescaped script tag must not exist in HTML');
    assert(html.includes('&lt;script&gt;alert(&quot;category-xss&quot;)&lt;/script&gt;'), 'Script tag escaped to entities');

    assert(!html.includes('<img src=x onerror=alert("mood-xss")>'), 'Unescaped img onerror must not exist');
    assert(html.includes('&lt;img src=x onerror=alert(&quot;mood-xss&quot;)&gt;'), 'Img tag escaped');

    assert(!html.includes('<svg onload=alert(1)>'), 'Unescaped svg must not exist');
    assert(html.includes('&lt;svg onload=alert(1)&gt;'), 'Svg tag escaped');

    assert(!html.includes('<iframe src="evil.html">'), 'Unescaped iframe must not exist');
    assert(html.includes('&lt;iframe src=&quot;evil.html&quot;&gt;'), 'Iframe escaped');
  });

  console.log('\n--- Suite H: Unicode & Devanagari Integrity ---');

  await asyncRunTest('Complex Devanagari conjuncts, nukta, matras and emojis in AI results render without corruption', async () => {
    const devanagariResult = {
      category: 'ज्ञान एवं प्रज्ञा (द्व, द्घ, ॐ)',
      mood: 'हृदयस्पर्शी शांत रस ।',
      themes: ['श्रद्धा', 'दृष्टिकोण', 'क्षणभंगुरता ॥'],
      keywords: ['त्रिकाल', 'ज्ञानामृत', 'हृदय'],
      summary: 'ॐ शांतिः! क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ से सुशोभित भावपूर्ण काव्य रचना। 🌺 ✨'
    };

    const mockService = {
      async analyzePoem() {
        return { status: ANALYSIS_STATUS.COMPLETED, result: devanagariResult };
      }
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = samplePoem;
    reader.update();

    await reader.confirmAiAnalysis();

    const html = container.innerHTML;

    assert(html.includes('ज्ञान एवं प्रज्ञा (द्व, द्घ, ॐ)'), 'Conjuncts and Om preserved');
    assert(html.includes('हृदयस्पर्शी शांत रस ।'), 'Purna viram and Hridaya preserved');
    assert(html.includes('#श्रद्धा'), 'Shraddha preserved');
    assert(html.includes('क्षणभंगुरता ॥'), 'Deergh viram preserved');
    assert(html.includes('ॐ शांतिः! क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ से सुशोभित भावपूर्ण काव्य रचना। 🌺 ✨'), 'Complex conjuncts and emojis preserved');
  });

  console.log('\n--- Suite I: Accessibility Semantics & Keyboard Escape Behavior ---');

  runTest('Escape key closes AI consent dialog', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = samplePoem;
    reader.update();

    // Open consent dialog
    simulateActionClick(reader, 'open-ai-consent');
    assert(reader.showAiConsentModal === true, 'Consent modal open');

    // Trigger Escape key
    let defaultPrevented = false;
    reader.handleKeyDown({
      key: 'Escape',
      preventDefault: () => { defaultPrevented = true; }
    });

    assert(defaultPrevented === true, 'Escape key default action prevented');
    assert(reader.showAiConsentModal === false, 'Consent modal closed on Escape');
    assert(!container.innerHTML.includes('ai-consent-modal'), 'Modal HTML removed');
  });

  runTest('Escape key preserves delete modal closing when delete modal is open', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: samplePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = samplePoem;
    reader.update();

    // Open delete modal
    simulateActionClick(reader, 'open-delete-modal');
    assert(reader.showDeleteModal === true, 'Delete modal open');

    // Trigger Escape key
    let defaultPrevented = false;
    reader.handleKeyDown({
      key: 'Escape',
      preventDefault: () => { defaultPrevented = true; }
    });

    assert(defaultPrevented === true, 'Escape key default prevented');
    assert(reader.showDeleteModal === false, 'Delete modal closed on Escape');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${testIndex} AI ANALYSIS UI TESTS PASSED!`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
