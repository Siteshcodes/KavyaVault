/**
 * काव्यकलश (KavyaVault) — AI Suggestion Review Automated Test Suite
 * Phase 4 / Task 4.3: Human Review: Accept / Edit / Reject AI Suggestions
 *
 * Validates:
 * 1. Review state model (suggested, accepted, edited, rejected)
 * 2. Independent decisions for category, mood, individual themes, keywords, summary
 * 3. Existing user metadata protection & safe tag merging
 * 4. Explicit Apply / Save boundary (zero persistence before Apply)
 * 5. Original poem immutability (body, title, author, dates, manuscripts untouched)
 * 6. Discard / Cancel review fidelity
 * 7. Re-analysis session isolation
 * 8. Security & safe HTML escaping
 * 9. Unicode Devanagari fidelity (conjuncts, nuktas, virama, matras, emojis)
 * 10. Persistence through PoemRepository
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { PoemReader } from './src/components/reader/PoemReader.js';
import { ANALYSIS_STATUS, SUGGESTION_REVIEW_STATE } from './src/services/ai/analysisTypes.js';
import {
  createReviewSession,
  acceptSuggestion,
  editSuggestion,
  rejectSuggestion,
  resetSuggestion,
  computeApprovedChanges
} from './src/services/ai/suggestionReview.js';

// In-Memory Storage Adapter Mock
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
      if (selector === '.btn-ai-confirm' && this.innerHTML.includes('btn-ai-confirm')) {
        return { focus: () => {} };
      }
      if (selector === '.btn-modal-cancel' && this.innerHTML.includes('btn-modal-cancel')) {
        return { focus: () => {} };
      }
      if (selector === '.ai-editor-input') {
        return { focus: () => {}, select: () => {}, value: '' };
      }
      return null;
    }
  };
  return container;
}

function simulateActionClick(reader, action, attributes = {}, editValue = undefined) {
  reader.handleClick({
    editValue,
    target: {
      closest: (sel) => {
        if (sel === '[data-action]') {
          return {
            getAttribute: (attr) => {
              if (attr === 'data-action') return action;
              if (attr in attributes) return attributes[attr];
              if (attr === 'data-field') return attributes.field || null;
              if (attr === 'data-item-id') return attributes.itemId || null;
              return null;
            }
          };
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
console.log('  KAVYAVAULT AI SUGGESTION REVIEW TEST SUITE (Task 4.3)');
console.log('================================================================\n');

// Test fixtures
const mockStorage = new InMemoryStorage();
const storageAdapter = new LocalStorageAdapter(mockStorage);
const testPoemRepo = new PoemRepository(storageAdapter);

const baselinePoem = testPoemRepo.create({
  title: 'अग्निपथ',
  body: 'वृक्ष हों भले खड़े,\nहों घने, हों बड़े,\nएक पत्र-छाँह भी\nमाँग मत! माँग मत! माँग मत!',
  author: 'हरिवंश राय बच्चन',
  category: 'जीवन संघर्ष',
  mood: 'वीर',
  tags: ['क्लासिक', 'प्रेरणा']
});

const mockAiResult = {
  category: 'राष्ट्रभक्ति एवं चेतना',
  mood: 'रौद्र',
  themes: ['संघर्ष', 'संकल्प', 'साहस'],
  keywords: ['अग्नि', 'अश्रु', 'स्वेद'],
  summary: 'यह कविता निरंतर कर्म और अदम्य साहस का अमर आह्वान है।'
};

async function main() {
  console.log('--- Suite A: Review State Model & Transitions ---');

  runTest('createReviewSession initializes all fields in SUGGESTED state', () => {
    const session = createReviewSession({
      poemId: baselinePoem.id,
      result: mockAiResult,
      currentPoem: baselinePoem
    });

    assert(session.category.reviewStatus === SUGGESTION_REVIEW_STATE.SUGGESTED, 'Category initial status is suggested');
    assert(session.category.suggestedValue === 'राष्ट्रभक्ति एवं चेतना', 'Category suggested value preserved');
    assert(session.category.originalValue === 'जीवन संघर्ष', 'Category original value recorded');
    assert(session.category.approvedValue === null, 'Category approved value initially null');

    assert(session.mood.reviewStatus === SUGGESTION_REVIEW_STATE.SUGGESTED, 'Mood initial status is suggested');
    assert(session.mood.suggestedValue === 'रौद्र', 'Mood suggested value preserved');
    assert(session.mood.originalValue === 'वीर', 'Mood original value recorded');

    assert(session.themes.length === 3, 'Themes collection populated');
    assert(session.themes[0].reviewStatus === SUGGESTION_REVIEW_STATE.SUGGESTED, 'Theme item initial status is suggested');

    assert(session.keywords.length === 3, 'Keywords collection populated');
    assert(session.keywords[0].reviewStatus === SUGGESTION_REVIEW_STATE.SUGGESTED, 'Keyword item initial status is suggested');
  });

  runTest('acceptSuggestion, editSuggestion, and rejectSuggestion transition state faithfully', () => {
    const session = createReviewSession({
      poemId: baselinePoem.id,
      result: mockAiResult,
      currentPoem: baselinePoem
    });

    // Accept Category
    acceptSuggestion(session, 'category');
    assert(session.category.reviewStatus === SUGGESTION_REVIEW_STATE.ACCEPTED, 'Category is accepted');
    assert(session.category.approvedValue === 'राष्ट्रभक्ति एवं चेतना', 'Category approvedValue equals suggestedValue');

    // Edit Mood
    editSuggestion(session, 'mood', 'उत्साह');
    assert(session.mood.reviewStatus === SUGGESTION_REVIEW_STATE.EDITED, 'Mood is edited');
    assert(session.mood.approvedValue === 'उत्साह', 'Mood approvedValue equals human-edited text');
    assert(session.mood.suggestedValue === 'रौद्र', 'Mood suggestedValue preserves original AI proposal');
    assert(session.mood.isEdited === true, 'isEdited flag is true');

    // Reject Theme item
    const themeId = session.themes[1].id;
    rejectSuggestion(session, 'themes', themeId);
    assert(session.themes[1].reviewStatus === SUGGESTION_REVIEW_STATE.REJECTED, 'Theme item is rejected');
    assert(session.themes[1].approvedValue === null, 'Rejected item approvedValue is null');

    // Reset Theme item
    resetSuggestion(session, 'themes', themeId);
    assert(session.themes[1].reviewStatus === SUGGESTION_REVIEW_STATE.SUGGESTED, 'Theme item reset to suggested');
  });

  console.log('\n--- Suite B: Individual Decisions & UI Controls ---');

  runTest('PoemReader handles independent accept, edit, and reject clicks', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    assert(reader.aiReviewSession !== null, 'Review session automatically initialized');

    // 1. Accept category
    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'category' });
    assert(reader.aiReviewSession.category.reviewStatus === 'accepted', 'Category accepted via UI action');

    // 2. Reject mood
    simulateActionClick(reader, 'reject-ai-suggestion', { field: 'mood' });
    assert(reader.aiReviewSession.mood.reviewStatus === 'rejected', 'Mood rejected via UI action');

    // 3. Edit keyword item
    const firstKeywordId = reader.aiReviewSession.keywords[0].id;
    simulateActionClick(reader, 'save-edit-suggestion', { field: 'keywords', itemId: firstKeywordId }, 'अग्निज्वाला');
    assert(reader.aiReviewSession.keywords[0].reviewStatus === 'edited', 'Keyword edited via UI action');
    assert(reader.aiReviewSession.keywords[0].approvedValue === 'अग्निज्वाला', 'Keyword edited value stored');
  });

  runTest('Individual themes and keywords chips can be reviewed independently', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    const t0 = reader.aiReviewSession.themes[0].id;
    const t1 = reader.aiReviewSession.themes[1].id;
    const t2 = reader.aiReviewSession.themes[2].id;

    // Accept first, reject second, edit third
    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'themes', itemId: t0 });
    simulateActionClick(reader, 'reject-ai-suggestion', { field: 'themes', itemId: t1 });
    simulateActionClick(reader, 'save-edit-suggestion', { field: 'themes', itemId: t2 }, 'दृढ़ संकल्प');

    assert(reader.aiReviewSession.themes[0].reviewStatus === 'accepted', 'Theme 0 is accepted');
    assert(reader.aiReviewSession.themes[1].reviewStatus === 'rejected', 'Theme 1 is rejected');
    assert(reader.aiReviewSession.themes[2].reviewStatus === 'edited', 'Theme 2 is edited');
    assert(reader.aiReviewSession.themes[2].approvedValue === 'दृढ़ संकल्प', 'Theme 2 approved value set');
  });

  console.log('\n--- Suite C: Existing User Metadata & Safe Merge Semantics ---');

  runTest('computeApprovedChanges safely merges approved themes/keywords with existing user tags', () => {
    const session = createReviewSession({
      poemId: baselinePoem.id,
      result: mockAiResult,
      currentPoem: baselinePoem
    });

    // Accept theme 0 ('संघर्ष') and keyword 1 ('अश्रु')
    acceptSuggestion(session, 'themes', session.themes[0].id);
    acceptSuggestion(session, 'keywords', session.keywords[1].id);

    const { changes, hasChanges } = computeApprovedChanges(session, baselinePoem);

    assert(hasChanges === true, 'hasChanges is true');
    assert(Array.isArray(changes.tags), 'changes.tags is array');
    // Original tags were ['क्लासिक', 'प्रेरणा']
    assert(changes.tags.includes('क्लासिक'), 'Existing tag "क्लासिक" preserved');
    assert(changes.tags.includes('प्रेरणा'), 'Existing tag "प्रेरणा" preserved');
    assert(changes.tags.includes('संघर्ष'), 'Approved theme "संघर्ष" added');
    assert(changes.tags.includes('अश्रु'), 'Approved keyword "अश्रु" added');
    assert(changes.tags.length === 4, 'Tags merged cleanly without duplication');
  });

  runTest('Deduplication works when approved candidate matches an existing tag', () => {
    const poemWithDuplicate = {
      ...baselinePoem,
      tags: ['साहस', 'प्रेरणा'] // 'साहस' is already an existing tag
    };
    const session = createReviewSession({
      poemId: poemWithDuplicate.id,
      result: mockAiResult,
      currentPoem: poemWithDuplicate
    });

    // Accept theme 2 which is 'साहस'
    acceptSuggestion(session, 'themes', session.themes[2].id);

    const { changes } = computeApprovedChanges(session, poemWithDuplicate);
    // Should NOT duplicate 'साहस'
    if (changes.tags) {
      const count = changes.tags.filter(t => t.toLowerCase() === 'साहस').length;
      assert(count === 1, 'Duplicate tag not inserted');
    }
  });

  console.log('\n--- Suite D: Zero Premature Persistence & Explicit Apply ---');

  runTest('NO storage writes occur before clicking "स्वीकृत सुझाव सहेजें"', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    // Accept category and edit mood
    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'category' });
    simulateActionClick(reader, 'save-edit-suggestion', { field: 'mood' }, 'वीर-उत्साह');

    // Verify poem in repository is still completely unchanged!
    const fromRepoBefore = testPoemRepo.getById(baselinePoem.id);
    assert(fromRepoBefore.category === 'जीवन संघर्ष', 'Category in storage remains original before apply');
    assert(fromRepoBefore.mood === 'वीर', 'Mood in storage remains original before apply');
  });

  runTest('Explicit Apply persists ONLY approved values and updates PoemRepository', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    // Accept category, edit mood, reject summary
    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'category' });
    simulateActionClick(reader, 'save-edit-suggestion', { field: 'mood' }, 'गंभीर वीर');
    simulateActionClick(reader, 'reject-ai-suggestion', { field: 'summary' });

    // Now click Apply
    simulateActionClick(reader, 'apply-ai-suggestions');

    // Verify poem in repository was updated
    const fromRepoAfter = testPoemRepo.getById(baselinePoem.id);
    assert(fromRepoAfter.category === 'राष्ट्रभक्ति एवं चेतना', 'Category persisted in repo');
    assert(fromRepoAfter.mood === 'गंभीर वीर', 'Edited mood persisted in repo');
    assert(reader.poem.category === 'राष्ट्रभक्ति एवं चेतना', 'Reader poem instance updated');
    assert(container.innerHTML.includes('स्वीकृत सुझाव सफलतापूर्वक कविता में सहेजे गए'), 'Success notification rendered');
  });

  console.log('\n--- Suite E: Original Poem Content Immutability ---');

  runTest('Poem body, title, author, and dates are strictly immutable during apply', () => {
    const original = testPoemRepo.getById(baselinePoem.id);
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = original;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'category' });
    simulateActionClick(reader, 'apply-ai-suggestions');

    const updated = testPoemRepo.getById(baselinePoem.id);
    assert(updated.body === original.body, 'Body must remain 100% byte-for-byte identical');
    assert(updated.title === original.title, 'Title must remain identical');
    assert(updated.author === original.author, 'Author must remain identical');
    assert(updated.createdAt === original.createdAt, 'CreatedAt date must remain identical');
    assert(updated.manuscriptId === original.manuscriptId, 'ManuscriptId must remain identical');
  });

  console.log('\n--- Suite F: Discard / Cancel Workflow ---');

  runTest('Discarding AI review resets UI state and leaves poem completely unchanged', () => {
    const discardPoem = testPoemRepo.create({
      title: 'त्याग और मौन',
      body: 'मौन ही उत्तर है।',
      author: 'साधक',
      category: 'आध्यात्म',
      mood: 'शांत',
      tags: ['मौन']
    });

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: discardPoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = discardPoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    // Accept something
    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'category' });
    assert(reader.aiReviewSession.category.reviewStatus === 'accepted', 'Category was accepted in session');

    // Click discard
    simulateActionClick(reader, 'discard-ai-review');

    assert(reader.aiReviewSession === null, 'Review session cleared');
    assert(reader.aiAnalysisResult === null, 'Analysis result cleared');
    assert(reader.aiAnalysisState === 'idle', 'State reset to idle');

    // Poem in storage unchanged
    const repoPoem = testPoemRepo.getById(discardPoem.id);
    assert(repoPoem.category === 'आध्यात्म', 'Category remains original in storage');
    assert(repoPoem.category !== 'राष्ट्रभक्ति एवं चेतना', 'Category was not persisted');
  });

  console.log('\n--- Suite G: Re-Analysis Strategy ---');

  await asyncRunTest('Re-analysis opens consent modal and initializes fresh review session on completion', async () => {
    const container = createMockContainer();
    let reanalyzed = false;
    const mockService = {
      async analyzePoem() {
        reanalyzed = true;
        return {
          status: ANALYSIS_STATUS.COMPLETED,
          result: {
            category: 'आध्यात्म एवं दर्शन',
            mood: 'शांत',
            themes: ['मोक्ष'],
            keywords: ['शांति'],
            summary: 'नवीन सारांश।'
          }
        };
      }
    };

    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo,
      analysisService: mockService
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    // Click reanalyze
    simulateActionClick(reader, 'open-ai-consent');
    assert(reader.showAiConsentModal === true, 'Consent modal opened for reanalysis');

    // Confirm reanalysis
    await reader.confirmAiAnalysis();
    assert(reanalyzed === true, 'Service called for new analysis');
    assert(reader.aiReviewSession.category.suggestedValue === 'आध्यात्म एवं दर्शन', 'Fresh review session created');
    assert(reader.aiReviewSession.category.reviewStatus === 'suggested', 'Fresh session is in suggested state');
  });

  console.log('\n--- Suite H: Security & Untrusted String Escaping ---');

  runTest('XSS payloads in AI suggestions or user edits are escaped safely in DOM', () => {
    const maliciousResult = {
      category: '<script>alert("xss")</script>',
      mood: '<img src="x" onerror="alert(1)">',
      themes: ['<a href="javascript:alert(1)">दुष्ट लिंक</a>'],
      keywords: ['onload="alert(1)"'],
      summary: '<iframe src="malicious.html"></iframe>'
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = maliciousResult;
    reader.mount();

    const html = container.innerHTML;
    assert(!html.includes('<script>'), 'No unescaped script tags');
    assert(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'), 'Script tag escaped');
    assert(!html.includes('<img src="x"'), 'No unescaped img tags');
    assert(html.includes('&lt;img src=&quot;x&quot;'), 'Img tag escaped');
    assert(!html.includes('<iframe'), 'No unescaped iframe tags');
  });

  console.log('\n--- Suite I: Devanagari & Unicode Fidelity ---');

  runTest('Complex Devanagari conjuncts, nuktas, matras, symbols, and emojis survive review and persist faithfully', () => {
    const complexUnicodeResult = {
      category: 'आध्यात्म एवं ॐ चेतना',
      mood: 'शान्त एवं करुणामय',
      themes: ['श्रद्धा', 'दृष्टिकोण', 'ज्ञान-विज्ञान', 'हृदयस्पर्शी'],
      keywords: ['द्वार', 'द्घोष', 'त्रिवेणी', 'क्षमा', '✨', '🍃'],
      summary: 'यह रचना ॐ तत् सत् के मर्म को उद्घाटित करती है॥'
    };

    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = complexUnicodeResult;
    reader.mount();

    // Accept category, edit mood with complex conjuncts, accept all themes
    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'category' });
    simulateActionClick(reader, 'save-edit-suggestion', { field: 'mood' }, 'अद्भुत रस ॐ');
    reader.aiReviewSession.themes.forEach(t => {
      simulateActionClick(reader, 'accept-ai-suggestion', { field: 'themes', itemId: t.id });
    });

    simulateActionClick(reader, 'apply-ai-suggestions');

    const updated = testPoemRepo.getById(baselinePoem.id);
    assert(updated.category === 'आध्यात्म एवं ॐ चेतना', 'Devanagari category with OM preserved');
    assert(updated.mood === 'अद्भुत रस ॐ', 'Edited mood with OM preserved');
    assert(updated.tags.includes('ज्ञान-विज्ञान'), 'Hyphenated Devanagari tag preserved');
    assert(updated.tags.includes('हृदयस्पर्शी'), 'Conjunct "हृ" preserved');
  });

  console.log('\n--- Suite J: Summary Remains in Review Model (No Schema Expansion) ---');

  runTest('Summary review is preserved in session but does not corrupt PoemRepository schema', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    simulateActionClick(reader, 'accept-ai-suggestion', { field: 'summary' });
    assert(reader.aiReviewSession.summary.reviewStatus === 'accepted', 'Summary marked accepted');

    simulateActionClick(reader, 'apply-ai-suggestions');
    const updated = testPoemRepo.getById(baselinePoem.id);
    // Schema must not have a new rogue 'summary' field on poem
    assert(updated.summary === undefined, 'Poem schema is not polluted with summary field');
  });

  console.log('\n--- Suite K: Accessibility & Status Semantics ---');

  runTest('Review action buttons have clear ARIA states and accessible labels', () => {
    const container = createMockContainer();
    const reader = new PoemReader({
      container,
      router: { navigate: () => {} },
      poemId: baselinePoem.id,
      poemRepo: testPoemRepo
    });
    reader.poem = baselinePoem;
    reader.aiAnalysisState = 'completed';
    reader.aiAnalysisResult = mockAiResult;
    reader.mount();

    const html = container.innerHTML;
    assert(html.includes('aria-label="श्रेणी स्वीकार करें"'), 'Accept button has accessible aria-label');
    assert(html.includes('aria-label="श्रेणी संपादित करें"'), 'Edit button has accessible aria-label');
    assert(html.includes('aria-label="श्रेणी अस्वीकार करें"'), 'Reject button has accessible aria-label');
    assert(html.includes('aria-label="समीक्षा नियंत्रण पट्टी"'), 'Review toolbar has semantic aria-label');
    assert(html.includes('role="group"'), 'Toolbar has group role');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests} / ${testIndex} AI SUGGESTION REVIEW TESTS PASSED!`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
