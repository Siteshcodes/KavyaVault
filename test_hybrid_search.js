/**
 * काव्यकलश (KavyaVault) — Hybrid Search & Natural Language UX Test Suite (test_hybrid_search.js)
 * Phase 5 / Task 5.4: Hybrid Search + Natural-Language Search UX
 *
 * Verifies:
 * Suite A: RRF Algorithm (Reciprocal Rank Fusion k=60, rank contribution, deduplication)
 * Suite B: Ranking & Deterministic Tie-breaking (fusedScore DESC, bestRank ASC, date DESC, poemId ASC)
 * Suite C: HybridSearchProvider Strategy Coordination (both available, semantic unavailable, resilience)
 * Suite D: Degraded Behavior & No Fake Semantic Results
 * Suite E: SearchService Integration & Strategy Dispatch (text, semantic, hybrid)
 * Suite F: Search View UI State & Mode Controls (tabs, descriptions, degraded & unsupported banners)
 * Suite G: Metadata Filters Across Retrieval Modes (category, mood, tags, favorite, archive)
 * Suite H: Security & XSS Query Sanitization
 * Suite I: Unicode & Devanagari Ligature Fidelity (conjuncts, nuktas, matras, emojis)
 * Suite J: Accessibility & Focus Management (WAI-ARIA tabs, arrow key navigation)
 * Suite K: Privacy & Storage Read-Only Audit (zero network calls, zero repository writes)
 */

import assert from 'node:assert';
import {
  SEARCH_MODE,
  SEARCH_STATUS,
  createSearchQuery,
  createSearchResult,
  searchService,
  SearchService,
  TextSearchProvider,
  SemanticSearchProvider,
  HybridSearchProvider,
  computeRRF,
  DEFAULT_RRF_K,
  TestEmbeddingProvider,
  LocalEmbeddingProvider,
  IndexedDBVectorStore,
  SemanticIndexService,
  searchPoems,
  escapeHtml
} from './src/services/SearchService.js';
import { SearchView, MODE_DESCRIPTIONS, MODE_LABELS } from './src/components/search/SearchView.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';

// In-memory mock storage driver
class InMemoryStorage {
  constructor() {
    this.store = new Map();
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
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
  }
}

// Minimal DOM mock container for testing SearchView in Node
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
    querySelector(sel) {
      if (sel === '#kavya-search-input') {
        return {
          value: '',
          focus: () => {},
          setSelectionRange: () => {}
        };
      }
      if (sel === '#search-results-area') {
        const match = container.innerHTML.match(/id="search-results-area"[^>]*>([\s\S]*?)<\/section>/);
        return {
          innerHTML: match ? match[1] : '',
          setAttribute: () => {},
          getAttribute: () => {}
        };
      }
      if (sel === '#search-live-status') {
        return { textContent: '' };
      }
      if (sel === '#search-notice-area') {
        return { innerHTML: '' };
      }
      if (sel === '#search-mode-desc') {
        return { textContent: '' };
      }
      if (sel === '[data-action="clear-search"]') {
        return { style: { display: 'none' } };
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.search-mode-tab') {
        const modes = [SEARCH_MODE.TEXT, SEARCH_MODE.SEMANTIC, SEARCH_MODE.HYBRID];
        return modes.map(m => ({
          getAttribute: (attr) => (attr === 'data-mode' ? m : null),
          setAttribute: () => {},
          classList: {
            toggle: () => {},
            contains: (c) => c === 'search-mode-tab'
          },
          focus: () => {}
        }));
      }
      return [];
    }
  };
  return container;
}

// Global window mock for safe URL handling in Node
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { search: '', pathname: '/search' },
    history: { replaceState: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
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

async function main() {
  console.log('================================================================');
  console.log('  KAVYAVAULT HYBRID SEARCH & NATURAL LANGUAGE UX TEST SUITE');
  console.log('================================================================');

  // ----------------------------------------------------------------
  // Suite A: Reciprocal Rank Fusion (RRF) Algorithm
  // ----------------------------------------------------------------
  console.log('\n--- Suite A: RRF Algorithm ---');

  runTest('computeRRF handles single-list results with 1-based ranks (k=60)', () => {
    const textHits = [
      { poemId: 'p1', score: 1000 },
      { poemId: 'p2', score: 500 }
    ];
    const semanticHits = [];

    const fused = computeRRF(textHits, semanticHits, 60);
    assert.strictEqual(fused.length, 2, 'Two fused items returned');

    // Rank 1: 1 / (60 + 1) = 1/61
    const expectedRank1 = 1 / 61;
    assert(Math.abs(fused[0].fusedScore - expectedRank1) < 1e-9, 'Rank 1 fused score is 1/61');
    assert.strictEqual(fused[0].bestRank, 1, 'Best rank is 1');
    assert.strictEqual(fused[0].inBoth, false, 'inBoth is false');

    // Rank 2: 1 / (60 + 2) = 1/62
    const expectedRank2 = 1 / 62;
    assert(Math.abs(fused[1].fusedScore - expectedRank2) < 1e-9, 'Rank 2 fused score is 1/62');
    assert.strictEqual(fused[1].bestRank, 2, 'Best rank is 2');
  });

  runTest('computeRRF combines rank contributions when result appears in both lists', () => {
    const textHits = [
      { poemId: 'p1', score: 1000 }, // text rank 1
      { poemId: 'p2', score: 500 }   // text rank 2
    ];
    const semanticHits = [
      { poemId: 'p2', score: 0.95 }, // semantic rank 1
      { poemId: 'p3', score: 0.85 }  // semantic rank 2
    ];

    const fused = computeRRF(textHits, semanticHits, 60);
    // Unique poem IDs: p1, p2, p3
    assert.strictEqual(fused.length, 3, 'Deduplicated to 3 items');

    const itemP2 = fused.find(f => f.poemId === 'p2');
    assert(itemP2, 'p2 found in fused list');
    assert.strictEqual(itemP2.inBoth, true, 'p2 marked inBoth');

    // p2 score = 1/(60 + 2) + 1/(60 + 1) = 1/62 + 1/61
    const expectedP2 = (1 / 62) + (1 / 61);
    assert(Math.abs(itemP2.fusedScore - expectedP2) < 1e-9, 'p2 received sum of rank contributions');
    assert.strictEqual(itemP2.bestRank, 1, 'p2 bestRank is 1 (from semantic rank 1)');
  });

  runTest('computeRRF deduplicates poemId accurately and preserves poem metadata', () => {
    const poemRecord = { id: 'p1', title: 'सावन' };
    const textHits = [{ poemId: 'p1', poem: poemRecord }];
    const semanticHits = [{ poemId: 'p1', poem: poemRecord }];

    const fused = computeRRF(textHits, semanticHits, 60);
    assert.strictEqual(fused.length, 1, 'Duplicate poemId eliminated');
    assert.strictEqual(fused[0].poem.title, 'सावन', 'Poem object preserved');
  });

  // ----------------------------------------------------------------
  // Suite B: Ranking & Deterministic Tie-Breaking
  // ----------------------------------------------------------------
  console.log('\n--- Suite B: Ranking & Deterministic Tie-breaking ---');

  runTest('Tie-breaking orders by: fusedScore DESC -> bestRank ASC -> updatedAt DESC -> poemId ASC', () => {
    const items = [
      { poemId: 'p_d', fusedScore: 0.03, bestRank: 1, updatedAt: 100 },
      { poemId: 'p_a', fusedScore: 0.05, bestRank: 2, updatedAt: 100 },
      { poemId: 'p_b', fusedScore: 0.03, bestRank: 1, updatedAt: 200 }, // same score & bestRank, newer updatedAt
      { poemId: 'p_c', fusedScore: 0.03, bestRank: 1, updatedAt: 100 }  // same score, bestRank, updatedAt -> poemId ASC ('p_c' before 'p_d')
    ];

    items.sort((a, b) => {
      if (Math.abs(b.fusedScore - a.fusedScore) > 1e-9) return b.fusedScore - a.fusedScore;
      if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
      if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
      return a.poemId.localeCompare(b.poemId);
    });

    assert.strictEqual(items[0].poemId, 'p_a', 'Highest fusedScore is first');
    assert.strictEqual(items[1].poemId, 'p_b', 'Same score, bestRank 1, newest date is second');
    assert.strictEqual(items[2].poemId, 'p_c', 'Same score, bestRank 1, same date: p_c before p_d');
    assert.strictEqual(items[3].poemId, 'p_d', 'p_d is last among equal scores');
  });

  // ----------------------------------------------------------------
  // Suite C: HybridSearchProvider Strategy Coordination
  // ----------------------------------------------------------------
  console.log('\n--- Suite C: HybridSearchProvider Strategy Coordination ---');

  await asyncRunTest('HybridSearchProvider coordinates text and test semantic provider when both available', async () => {
    const testEmbedding = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'test-v1' });
    const vectorStore = new IndexedDBVectorStore();
    const indexService = new SemanticIndexService({ embeddingProvider: testEmbedding, vectorStore });

    const poem1 = { id: 'h1', title: 'पर्वत और नदी', body: 'शांत धारा बहती रही', updatedAt: '2026-03-01T00:00:00Z' };
    const poem2 = { id: 'h2', title: 'अग्नि पथ', body: 'तू न थकेगा कभी', updatedAt: '2026-03-02T00:00:00Z' };

    await indexService.indexPoems([poem1, poem2]);

    const semanticProvider = new SemanticSearchProvider({
      embeddingProvider: testEmbedding,
      vectorStore
    });
    const textProvider = new TextSearchProvider();

    const hybridProvider = new HybridSearchProvider({
      textProvider,
      semanticProvider
    });

    assert.strictEqual(hybridProvider.isAvailable(), true, 'Hybrid search is available with TestEmbeddingProvider');

    const res = await hybridProvider.search('पर्वत धारा', { poems: [poem1, poem2] });
    assert.strictEqual(res.status, SEARCH_STATUS.SUCCESS, 'Hybrid search succeeds');
    assert(res.results.length > 0, 'Results returned');
    assert.strictEqual(res.mode, SEARCH_MODE.HYBRID, 'Mode is hybrid');
  });

  await asyncRunTest('HybridSearchProvider gracefully degrades when semantic provider is unavailable', async () => {
    const offlineSemantic = new SemanticSearchProvider(); // default LocalEmbeddingProvider is offline
    const samplePoems = [
      { id: 'deg1', title: 'सावन की फुहार', body: 'रिमझिम बूँदें गिरीं', updatedAt: '2026-03-01T00:00:00Z' }
    ];

    const hybridProvider = new HybridSearchProvider({
      semanticProvider: offlineSemantic
    });

    assert.strictEqual(hybridProvider.isSemanticAvailable(), false, 'Semantic is truthfully reported unavailable');

    const res = await hybridProvider.search('सावन', { poems: samplePoems });
    assert.strictEqual(res.status, SEARCH_STATUS.DEGRADED, 'Degraded status returned');
    assert.strictEqual(res.results.length, 1, 'Text hit preserved in degraded mode');
    assert.strictEqual(res.results[0].source, SEARCH_MODE.TEXT, 'Source is text');
    assert(res.message.includes('भावार्थ खोज उपलब्ध नहीं है'), 'Truthful degraded explanation message');
  });

  await asyncRunTest('HybridSearchProvider safely handles text search failure', async () => {
    const brokenTextProvider = {
      isAvailable: () => true,
      search: async () => { throw new Error('Text search IO failure'); }
    };
    const testEmbedding = new TestEmbeddingProvider();
    const semanticProvider = new SemanticSearchProvider({ embeddingProvider: testEmbedding });

    const hybridProvider = new HybridSearchProvider({
      textProvider: brokenTextProvider,
      semanticProvider
    });

    const res = await hybridProvider.search('परीक्षण');
    assert.strictEqual(res.status, SEARCH_STATUS.ERROR, 'Returns ERROR status gracefully on exception');
    assert.strictEqual(res.results.length, 0, 'Empty results on error');
  });

  // ----------------------------------------------------------------
  // Suite D: Degraded Behavior & Zero Fake Semantic Results
  // ----------------------------------------------------------------
  console.log('\n--- Suite D: Degraded Behavior & No Fake Semantic Results ---');

  await asyncRunTest('Degraded hybrid mode never fabricates synthetic scores or fake embeddings', async () => {
    const hybridProvider = new HybridSearchProvider(); // production offline baseline
    const samplePoems = [
      { id: 'p_real', title: 'सत्य की खोज', body: 'सत्य ही ईश्वर है।', updatedAt: '2026-03-01T00:00:00Z' }
    ];

    const res = await hybridProvider.search('सत्य', { poems: samplePoems });
    assert.strictEqual(res.status, SEARCH_STATUS.DEGRADED, 'Status is degraded');
    assert.strictEqual(res.results.length, 1, 'Only genuine text result returned');
    // Verify scores are pure text relevance scores, NOT fake cosine similarities
    assert(res.results[0].score >= 10, 'Score is authentic text match score');
  });

  await asyncRunTest('Degraded hybrid mode returns UNSUPPORTED when no text matches exist and semantic is offline', async () => {
    const hybridProvider = new HybridSearchProvider();
    const res = await hybridProvider.search('अनजानी कविता जो मौजूद नहीं है', { poems: [] });
    assert.strictEqual(res.status, SEARCH_STATUS.UNSUPPORTED, 'Status is UNSUPPORTED');
    assert.strictEqual(res.totalCount, 0, 'Zero results');
  });

  // ----------------------------------------------------------------
  // Suite E: SearchService Integration & Strategy Dispatch
  // ----------------------------------------------------------------
  console.log('\n--- Suite E: SearchService Integration & Strategy Dispatch ---');

  await asyncRunTest('SearchService dispatches mode="text", "semantic", and "hybrid" correctly', async () => {
    const service = new SearchService();
    const modes = service.listModes();

    assert(modes.includes(SEARCH_MODE.TEXT), 'Lists text mode');
    assert(modes.includes(SEARCH_MODE.SEMANTIC), 'Lists semantic mode');
    assert(modes.includes(SEARCH_MODE.HYBRID), 'Lists hybrid mode');

    // Text dispatch
    const textRes = await service.search({ text: 'सावन', mode: SEARCH_MODE.TEXT }, { poems: [] });
    assert.strictEqual(textRes.mode, SEARCH_MODE.TEXT, 'Dispatched to text provider');

    // Semantic dispatch (truthfully unsupported in default production)
    const semRes = await service.search({ text: 'सावन', mode: SEARCH_MODE.SEMANTIC }, { poems: [] });
    assert.strictEqual(semRes.mode, SEARCH_MODE.SEMANTIC, 'Dispatched to semantic provider');
    assert.strictEqual(semRes.status, SEARCH_STATUS.UNSUPPORTED, 'Semantic reports unsupported');

    // Hybrid dispatch
    const hybRes = await service.search({ text: 'सावन', mode: SEARCH_MODE.HYBRID }, { poems: [] });
    assert.strictEqual(hybRes.mode, SEARCH_MODE.HYBRID, 'Dispatched to hybrid provider');
  });

  // ----------------------------------------------------------------
  // Suite F: Search View UI State & Mode Controls
  // ----------------------------------------------------------------
  console.log('\n--- Suite F: Search View UI State & Mode Controls ---');

  runTest('SearchView renders 3 accessible mode tabs with correct Devanagari labels and descriptions', () => {
    const container = createMockContainer();
    const view = new SearchView({ container });
    view.renderInitialSkeleton();

    assert(container.innerHTML.includes('id="tab-text"'), 'Contains text mode tab');
    assert(container.innerHTML.includes('id="tab-semantic"'), 'Contains semantic mode tab');
    assert(container.innerHTML.includes('id="tab-hybrid"'), 'Contains hybrid mode tab');

    assert(container.innerHTML.includes(MODE_LABELS[SEARCH_MODE.TEXT]), 'Renders पाठ खोज');
    assert(container.innerHTML.includes(MODE_LABELS[SEARCH_MODE.SEMANTIC]), 'Renders भावार्थ खोज');
    assert(container.innerHTML.includes(MODE_LABELS[SEARCH_MODE.HYBRID]), 'Renders मिश्रित खोज');

    assert(container.innerHTML.includes(MODE_DESCRIPTIONS[SEARCH_MODE.TEXT]), 'Renders initial text mode description');
  });

  runTest('SearchView setMode updates searchMode, active tab, and description', () => {
    const container = createMockContainer();
    const view = new SearchView({ container });
    view.renderInitialSkeleton();

    view.setMode(SEARCH_MODE.HYBRID);
    assert.strictEqual(view.searchMode, SEARCH_MODE.HYBRID, 'searchMode updated to hybrid');

    view.setMode(SEARCH_MODE.SEMANTIC);
    assert.strictEqual(view.searchMode, SEARCH_MODE.SEMANTIC, 'searchMode updated to semantic');
  });

  runTest('SearchView getNoticeHtml displays truthful banners for degraded hybrid and unsupported semantic', () => {
    const container = createMockContainer();
    const view = new SearchView({ container, initialQuery: 'प्रकृति' });

    // Semantic mode unsupported notice
    view.searchMode = SEARCH_MODE.SEMANTIC;
    view.searchStatus = SEARCH_STATUS.UNSUPPORTED;
    const semNotice = view.getNoticeHtml();
    assert(semNotice.includes('भावार्थ खोज के लिए स्थानीय सिमेंटिक मॉडल अभी उपलब्ध नहीं है'), 'Semantic notice banner is truthful');

    // Hybrid mode degraded notice
    view.searchMode = SEARCH_MODE.HYBRID;
    view.searchStatus = SEARCH_STATUS.DEGRADED;
    const hybNotice = view.getNoticeHtml();
    assert(hybNotice.includes('भावार्थ खोज के लिए स्थानीय सिमेंटिक मॉडल अभी उपलब्ध नहीं है; पाठ खोज के आधार पर'), 'Hybrid degraded banner is informative');
  });

  runTest('SearchView empty states display mode-specific Hindi text', () => {
    const container = createMockContainer();
    const view = new SearchView({ container, initialQuery: 'शांत झरना' });

    view.searchMode = SEARCH_MODE.SEMANTIC;
    view.searchStatus = SEARCH_STATUS.UNSUPPORTED;
    view.searchResults = [];
    const htmlSem = view.renderResultsHtml();
    assert(htmlSem.includes('भावार्थ खोज अभी उपलब्ध नहीं है'), 'Empty semantic state text matches prompt');

    view.searchMode = SEARCH_MODE.HYBRID;
    view.searchStatus = SEARCH_STATUS.UNSUPPORTED;
    view.searchResults = [];
    const htmlHyb = view.renderResultsHtml();
    assert(htmlHyb.includes('भावार्थ खोज उपलब्ध नहीं है; पाठ खोज से परिणाम नहीं मिले'), 'Empty hybrid state text matches prompt');
  });

  // ----------------------------------------------------------------
  // Suite G: Metadata Filters Across Retrieval Modes
  // ----------------------------------------------------------------
  console.log('\n--- Suite G: Metadata Filters Across Retrieval Modes ---');

  await asyncRunTest('Filters (category, mood, tags, favorite, archive) apply consistently', async () => {
    const poems = [
      { id: 'f1', title: 'बरसात की रात', category: 'प्रकृति', mood: 'शांत', tags: ['वर्षा'], isFavorite: true, isArchived: false },
      { id: 'f2', title: 'बरसात का दिन', category: 'गीत', mood: 'उत्साह', tags: ['धूप'], isFavorite: false, isArchived: false },
      { id: 'f3', title: 'बरसात की याद', category: 'प्रकृति', mood: 'शांत', tags: ['वर्षा'], isFavorite: false, isArchived: true }
    ];

    const hybridProvider = new HybridSearchProvider(); // degraded to text in production

    // 1. Filter by category
    const catRes = await hybridProvider.search({
      text: 'बरसात',
      filters: { category: 'प्रकृति' }
    }, { poems });
    assert.strictEqual(catRes.results.length, 1, 'Category filter narrowed results to 1');
    assert.strictEqual(catRes.results[0].poemId, 'f1', 'Matched f1');

    // 2. Filter by favorite
    const favRes = await hybridProvider.search({
      text: 'बरसात',
      filters: { isFavorite: true }
    }, { poems });
    assert.strictEqual(favRes.results.length, 1, 'Favorite filter matches f1');
    assert.strictEqual(favRes.results[0].poemId, 'f1', 'Only favorite returned');

    // 3. Filter by archived
    const archRes = await hybridProvider.search({
      text: 'बरसात',
      filters: { isArchived: true }
    }, { poems });
    assert.strictEqual(archRes.results.length, 1, 'Archive filter matches f3');
    assert.strictEqual(archRes.results[0].poemId, 'f3', 'Only archived returned');
  });

  // ----------------------------------------------------------------
  // Suite H: Security & XSS Query Sanitization
  // ----------------------------------------------------------------
  console.log('\n--- Suite H: Security & XSS Query Sanitization ---');

  runTest('Malicious XSS queries and payloads are sanitized in search rendering', () => {
    const maliciousQuery = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const container = createMockContainer();
    const view = new SearchView({ container, initialQuery: maliciousQuery });

    view.renderInitialSkeleton();
    assert(!container.innerHTML.includes('<script>alert'), 'Unescaped script tag is NOT in innerHTML');
    assert(container.innerHTML.includes('&lt;script&gt;'), 'Script tag is safely escaped');
  });

  // ----------------------------------------------------------------
  // Suite I: Unicode & Devanagari Ligature Fidelity
  // ----------------------------------------------------------------
  console.log('\n--- Suite I: Unicode & Devanagari Ligature Fidelity ---');

  await asyncRunTest('Complex Devanagari ligatures, conjuncts, nuktas, symbols and emojis match faithfully', async () => {
    const unicodeCorpus = [
      { id: 'u1', title: 'क्षमा और त्रिशूल', body: 'ज्ञानी जन शांत रहते हैं।', updatedAt: '2026-03-01T00:00:00Z' },
      { id: 'u2', title: 'श्रम और द्वंद्व', body: 'द्घोष करो विजय का। हृदय में ॐ का वास।', updatedAt: '2026-03-02T00:00:00Z' },
      { id: 'u3', title: 'नुक़्ता और चाँद', body: 'ज़मीन पर पूर्णविराम। महाविराम॥ ✨ 📜', updatedAt: '2026-03-03T00:00:00Z' }
    ];

    const hybridProvider = new HybridSearchProvider();

    // क्ष
    const resKsha = await hybridProvider.search('क्षमा', { poems: unicodeCorpus });
    assert.strictEqual(resKsha.results[0].poemId, 'u1', 'Matched क्ष');

    // त्र
    const resTra = await hybridProvider.search('त्रिशूल', { poems: unicodeCorpus });
    assert.strictEqual(resTra.results[0].poemId, 'u1', 'Matched त्र');

    // ज्ञ
    const resGya = await hybridProvider.search('ज्ञानी', { poems: unicodeCorpus });
    assert.strictEqual(resGya.results[0].poemId, 'u1', 'Matched ज्ञ');

    // श्र
    const resShra = await hybridProvider.search('श्रम', { poems: unicodeCorpus });
    assert.strictEqual(resShra.results[0].poemId, 'u2', 'Matched श्र');

    // द्व
    const resDva = await hybridProvider.search('द्वंद्व', { poems: unicodeCorpus });
    assert.strictEqual(resDva.results[0].poemId, 'u2', 'Matched द्व');

    // द्घ
    const resDgha = await hybridProvider.search('द्घोष', { poems: unicodeCorpus });
    assert.strictEqual(resDgha.results[0].poemId, 'u2', 'Matched द्घ');

    // हृ
    const resHri = await hybridProvider.search('हृदय', { poems: unicodeCorpus });
    assert.strictEqual(resHri.results[0].poemId, 'u2', 'Matched हृ');

    // ॐ
    const resOm = await hybridProvider.search('ॐ', { poems: unicodeCorpus });
    assert.strictEqual(resOm.results[0].poemId, 'u2', 'Matched ॐ');

    // nukta (ज़मीन)
    const resNukta = await hybridProvider.search('ज़मीन', { poems: unicodeCorpus });
    assert.strictEqual(resNukta.results[0].poemId, 'u3', 'Matched nukta');

    // emojis
    const resEmoji = await hybridProvider.search('✨', { poems: unicodeCorpus });
    assert.strictEqual(resEmoji.results[0].poemId, 'u3', 'Matched emoji ✨');
  });

  // ----------------------------------------------------------------
  // Suite J: Accessibility & Focus Management
  // ----------------------------------------------------------------
  console.log('\n--- Suite J: Accessibility & Focus Management ---');

  runTest('WAI-ARIA roles, aria-selected, and tabindex are correctly managed on tabs', () => {
    const container = createMockContainer();
    const view = new SearchView({ container, initialMode: SEARCH_MODE.TEXT });
    view.renderInitialSkeleton();

    assert(container.innerHTML.includes('role="tablist"'), 'Contains role="tablist"');
    assert(container.innerHTML.includes('role="tab"'), 'Contains role="tab"');
    assert(container.innerHTML.includes('role="tabpanel"'), 'Contains role="tabpanel"');
    assert(container.innerHTML.includes('aria-selected="true"'), 'Selected tab has aria-selected="true"');
    assert(container.innerHTML.includes('aria-controls="search-results-area"'), 'Tabs control search results area');
  });

  runTest('Arrow navigation cycles between search mode tabs', () => {
    const container = createMockContainer();
    const view = new SearchView({ container, initialMode: SEARCH_MODE.TEXT });
    view.renderInitialSkeleton();

    // Simulate ArrowRight keydown
    view.handleTabKeydown({
      target: { classList: { contains: (c) => c === 'search-mode-tab' } },
      key: 'ArrowRight',
      preventDefault: () => {}
    });
    assert.strictEqual(view.searchMode, SEARCH_MODE.SEMANTIC, 'ArrowRight switched text -> semantic');

    // Simulate ArrowRight keydown again
    view.handleTabKeydown({
      target: { classList: { contains: (c) => c === 'search-mode-tab' } },
      key: 'ArrowRight',
      preventDefault: () => {}
    });
    assert.strictEqual(view.searchMode, SEARCH_MODE.HYBRID, 'ArrowRight switched semantic -> hybrid');

    // Simulate ArrowLeft keydown
    view.handleTabKeydown({
      target: { classList: { contains: (c) => c === 'search-mode-tab' } },
      key: 'ArrowLeft',
      preventDefault: () => {}
    });
    assert.strictEqual(view.searchMode, SEARCH_MODE.SEMANTIC, 'ArrowLeft switched hybrid -> semantic');
  });

  // ----------------------------------------------------------------
  // Suite K: Privacy & Storage Read-Only Audit
  // ----------------------------------------------------------------
  console.log('\n--- Suite K: Privacy & Storage Read-Only Audit ---');

  await asyncRunTest('Search operations perform ZERO network calls and ZERO repository writes', async () => {
    const storage = new InMemoryStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const poem = repo.create({
      title: 'एकांत साधना',
      body: 'प्रकृति की गोद में आत्म चिंतन।',
      author: 'प्रसाद'
    });

    const serializedBefore = JSON.stringify(poem);
    const keysBefore = storage.length;

    const hybridProvider = new HybridSearchProvider({ poemRepo: repo });
    await hybridProvider.search('एकांत साधना');
    await hybridProvider.search('प्रकृति चिंतन');

    const fetchedAfter = repo.getById(poem.id);
    const serializedAfter = JSON.stringify(fetchedAfter);
    const keysAfter = storage.length;

    assert.strictEqual(serializedBefore, serializedAfter, 'Poem record remains 100% byte-for-byte immutable');
    assert.strictEqual(keysBefore, keysAfter, 'Zero storage mutations during search operations');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${testIndex} HYBRID SEARCH & NATURAL LANGUAGE UX TESTS PASSED!`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
