/**
 * काव्यकलश (KavyaVault) — AI Analysis Foundation Test Suite
 * Phase 4 / Task 4.1: Architecture, Contracts, Safety, Privacy, Unicode & Security
 *
 * Verifies:
 * Suite A: Domain Model & Schema Validation
 * Suite B: Provider Contract & Mock Provider
 * Suite C: PoemAnalysisService Workflows & Resilience
 * Suite D: Original Poem Immutability & Zero Storage Writes
 * Suite E: Explicit Consent Boundary
 * Suite F: Unicode Devanagari Integrity
 * Suite G: Security & Injection Resilience
 * Suite H: Zero Network Operation Audit
 */

import {
  ANALYSIS_STATUS,
  VALID_ANALYSIS_STATUSES,
  SUGGESTION_REVIEW_STATE,
  VALID_SUGGESTION_REVIEW_STATES,
  ANALYSIS_CONSTRAINTS,
  validateAnalysisRequest,
  validateAndNormalizeAnalysisResult
} from './src/services/ai/analysisTypes.js';
import { IAIAnalysisProvider } from './src/services/ai/IAIAnalysisProvider.js';
import { MockAIAnalysisProvider } from './src/services/ai/MockAIAnalysisProvider.js';
import {
  getAIAnalysisProvider,
  registerAIAnalysisProvider,
  listAIAnalysisProviders
} from './src/services/ai/providerRegistry.js';
import {
  PoemAnalysisService,
  poemAnalysisService
} from './src/services/ai/PoemAnalysisService.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import fs from 'fs';
import path from 'path';

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
console.log('  KAVYAVAULT AI ANALYSIS FOUNDATION TEST SUITE (Task 4.1)');
console.log('================================================================\n');

// -------------------------------------------------------------
// Suite A: Domain Model & Schema Validation
// -------------------------------------------------------------
console.log('--- Suite A: Domain Model & Schema Validation ---');

runTest('ANALYSIS_STATUS exports frozen status enums', () => {
  assert(Object.isFrozen(ANALYSIS_STATUS), 'ANALYSIS_STATUS must be frozen');
  assert(ANALYSIS_STATUS.IDLE === 'idle', 'Has IDLE');
  assert(ANALYSIS_STATUS.PENDING === 'pending', 'Has PENDING');
  assert(ANALYSIS_STATUS.COMPLETED === 'completed', 'Has COMPLETED');
  assert(ANALYSIS_STATUS.FAILED === 'failed', 'Has FAILED');
  assert(VALID_ANALYSIS_STATUSES.length === 4, 'Contains exactly 4 controlled statuses');
});

runTest('SUGGESTION_REVIEW_STATE exports frozen review state enums', () => {
  assert(Object.isFrozen(SUGGESTION_REVIEW_STATE), 'SUGGESTION_REVIEW_STATE must be frozen');
  assert(SUGGESTION_REVIEW_STATE.SUGGESTED === 'suggested', 'Has SUGGESTED');
  assert(SUGGESTION_REVIEW_STATE.ACCEPTED === 'accepted', 'Has ACCEPTED');
  assert(SUGGESTION_REVIEW_STATE.EDITED === 'edited', 'Has EDITED');
  assert(SUGGESTION_REVIEW_STATE.REJECTED === 'rejected', 'Has REJECTED');
});

runTest('validateAnalysisRequest rejects missing poemId or invalid types', () => {
  let threw = false;
  try {
    validateAnalysisRequest(null);
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Rejects null request');

  threw = false;
  try {
    validateAnalysisRequest({ poemId: '', analysisConsent: true, title: 'T', body: 'B' });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Rejects empty poemId');

  threw = false;
  try {
    validateAnalysisRequest({ poemId: 'p1', analysisConsent: true, title: 123, body: 'B' });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Rejects non-string title');

  threw = false;
  try {
    validateAnalysisRequest({ poemId: 'p1', analysisConsent: true, title: 'T', body: '' });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Rejects empty body');
});

runTest('validateAndNormalizeAnalysisResult validates and deduplicates keywords/themes', () => {
  const raw = {
    category: '  प्रकृति एवं सौन्दर्य  ',
    mood: '  शांत  ',
    themes: ['प्रकृति', 'एकांत', 'प्रकृति', 'मौन'],
    keywords: ['पर्वत', 'नदी', 'पर्वत', 'हिम'],
    summary: '  प्रकृति का सुंदर वर्णन।  '
  };
  const normalized = validateAndNormalizeAnalysisResult(raw);
  assert(normalized.category === 'प्रकृति एवं सौन्दर्य', 'Trims category');
  assert(normalized.mood === 'शांत', 'Trims mood');
  assert(normalized.themes.length === 3, 'Deduplicates themes');
  assert(normalized.themes.includes('प्रकृति') && normalized.themes.includes('एकांत'), 'Retains unique themes');
  assert(normalized.keywords.length === 3, 'Deduplicates keywords');
  assert(normalized.summary === 'प्रकृति का सुंदर वर्णन।', 'Trims summary');
});

runTest('validateAndNormalizeAnalysisResult rejects oversized strings and malformed types', () => {
  let threw = false;
  try {
    validateAndNormalizeAnalysisResult({
      category: 'x'.repeat(ANALYSIS_CONSTRAINTS.MAX_CATEGORY_LENGTH + 1),
      mood: 'शांत',
      themes: ['T'],
      keywords: ['K'],
      summary: 'S'
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Rejects oversized category');

  threw = false;
  try {
    validateAndNormalizeAnalysisResult({
      category: 'C',
      mood: 'M',
      themes: 'not-an-array',
      keywords: ['K'],
      summary: 'S'
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Rejects non-array themes');

  threw = false;
  try {
    validateAndNormalizeAnalysisResult({
      category: 'C',
      mood: 'M',
      themes: ['T'],
      keywords: ['K'],
      summary: 's'.repeat(ANALYSIS_CONSTRAINTS.MAX_SUMMARY_LENGTH + 1)
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Rejects oversized summary');
});

// -------------------------------------------------------------
// Suite B: Provider Contract & Mock Provider
// -------------------------------------------------------------
console.log('\n--- Suite B: Provider Contract & Mock Provider ---');

runTest('IAIAnalysisProvider abstract class enforces interface methods', () => {
  const base = new IAIAnalysisProvider();
  let threw = 0;
  try { base.getId(); } catch (e) { threw++; }
  try { base.getName(); } catch (e) { threw++; }
  try { base.getModel(); } catch (e) { threw++; }
  assert(threw === 3, 'Enforces getId, getName, getModel implementations');
});

await asyncRunTest('MockAIAnalysisProvider returns deterministic output without external network', async () => {
  const provider = new MockAIAnalysisProvider();
  assert(provider.getId() === 'mock', 'Provider id is mock');
  assert(provider.getModel() === 'kavyavault-mock-analyzer-v1', 'Model identified');

  const res1 = await provider.analyzePoem({
    poemId: 'p_nature',
    title: 'पर्वत और नदी',
    body: 'शांत पर्वत की गोद से बहती पावन नदी।'
  });

  assert(res1.result.category === 'प्रकृति एवं सौन्दर्य', 'Categorized as nature');
  assert(res1.result.mood === 'शांत', 'Mood is shanta');
  assert(Array.isArray(res1.result.themes), 'Themes is array');
  assert(Array.isArray(res1.result.keywords), 'Keywords is array');
  assert(res1.rawResponseMetadata.mock === true, 'Metadata marks mock');

  const res2 = await provider.analyzePoem({
    poemId: 'p_heroic',
    title: 'रणभेरी',
    body: 'मातृभूमि की रक्षा में वीरों ने तलवार उठाई, शौर्य से विजय पाई।'
  });

  assert(res2.result.category === 'राष्ट्रभक्ति एवं चेतना', 'Categorized as patriotic');
  assert(res2.result.mood === 'वीर', 'Mood is vira');
});

await asyncRunTest('MockAIAnalysisProvider supports failure simulation', async () => {
  const failingProvider = new MockAIAnalysisProvider({ simulateFailure: true });
  let threw = false;
  try {
    await failingProvider.analyzePoem({
      poemId: 'p1',
      title: 'T',
      body: 'B'
    });
  } catch (e) {
    threw = true;
  }
  assert(threw, 'Simulated failure throws properly');
});

runTest('providerRegistry allows registration and resolution', () => {
  const mock = getAIAnalysisProvider('mock');
  assert(mock instanceof MockAIAnalysisProvider, 'Resolves default mock provider');

  const custom = new MockAIAnalysisProvider();
  registerAIAnalysisProvider('test-custom', custom);
  assert(getAIAnalysisProvider('test-custom') === custom, 'Resolves registered custom provider');
  assert(listAIAnalysisProviders().includes('test-custom'), 'Lists registered providers');
});

// -------------------------------------------------------------
// Suite C: PoemAnalysisService Workflows & Resilience
// -------------------------------------------------------------
console.log('\n--- Suite C: PoemAnalysisService Workflows & Resilience ---');

await asyncRunTest('PoemAnalysisService successfully coordinates analysis with consent', async () => {
  const service = new PoemAnalysisService();

  const response = await service.analyzePoem({
    poemId: 'poem_101',
    title: 'संध्या दीप',
    body: 'मंदिर में जलता पावन दीप, प्रभु के चरणों में मौन प्रार्थना।',
    analysisConsent: true
  });

  assert(response.status === ANALYSIS_STATUS.COMPLETED, 'Status is completed');
  assert(response.consentGranted === true, 'Consent granted recorded');
  assert(response.poemId === 'poem_101', 'Poem ID preserved');
  assert(response.provider === 'mock', 'Provider is mock');
  assert(response.result !== null, 'Has normalized result');
  assert(response.result.mood === 'भक्ति', 'Identified bhakti mood');
  assert(response.error === undefined, 'No error on success');
});

await asyncRunTest('PoemAnalysisService handles provider failure safely without crashing', async () => {
  const failingProvider = new MockAIAnalysisProvider({ simulateFailure: true });
  const service = new PoemAnalysisService({ provider: failingProvider });

  const response = await service.analyzePoem({
    poemId: 'poem_fail',
    title: 'कठिन डगर',
    body: 'मार्ग में अंधकार और बाधाएं।',
    analysisConsent: true
  });

  assert(response.status === ANALYSIS_STATUS.FAILED, 'Status is failed');
  assert(response.result === null, 'Result is null on failure');
  assert(typeof response.error === 'string', 'Contains error message');
  assert(response.error.includes('अनुपलब्ध') || response.error.includes('विफल'), 'Friendly error description');
});

await asyncRunTest('PoemAnalysisService handles malformed provider output safely', async () => {
  // Provider returns corrupt result missing required summary
  const corruptProvider = new MockAIAnalysisProvider({
    customResult: {
      category: 'काव्य',
      mood: 'शांत',
      themes: ['ज्ञान'],
      keywords: ['शब्द']
      // missing summary
    }
  });
  const service = new PoemAnalysisService({ provider: corruptProvider });

  const response = await service.analyzePoem({
    poemId: 'poem_corrupt',
    title: 'शीर्षक',
    body: 'कुछ पंक्तियाँ।',
    analysisConsent: true
  });

  assert(response.status === ANALYSIS_STATUS.FAILED, 'Status is failed on malformed output');
  assert(response.result === null, 'Result is null');
  assert(response.error.includes('सत्यापन त्रुटि'), 'Reports validation error safely');
});

// -------------------------------------------------------------
// Suite D: Original Poem Immutability & Zero Storage Writes
// -------------------------------------------------------------
console.log('\n--- Suite D: Original Poem Immutability & Zero Storage Writes ---');

await asyncRunTest('Original poem record remains 100% byte-for-byte immutable during analysis', async () => {
  const storage = new LocalStorageAdapter(new InMemoryStorage());
  const repo = new PoemRepository(storage);

  const originalPoem = repo.create({
    title: 'हिमालय की पुकार',
    body: 'उन्नत भाल लिए खड़ा हिमालय, युगों-युगों की अमर गाथा।',
    author: 'राष्ट्रकवि दिनकर',
    tags: ['प्रेरणा', 'राष्ट्र']
  });

  const snapshotBefore = JSON.stringify(originalPoem);

  // Invoke AI analysis service
  const service = new PoemAnalysisService();
  const analysisResponse = await service.analyzePoem({
    poemId: originalPoem.id,
    title: originalPoem.title,
    body: originalPoem.body,
    author: originalPoem.author,
    tags: originalPoem.tags,
    analysisConsent: true
  });

  assert(analysisResponse.status === ANALYSIS_STATUS.COMPLETED, 'Analysis succeeded');

  // Verify poem in repository is completely unchanged
  const fetchedAfter = repo.getById(originalPoem.id);
  const snapshotAfter = JSON.stringify(fetchedAfter);

  assert(snapshotBefore === snapshotAfter, 'Poem record remains byte-for-byte identical');
  assert(fetchedAfter.title === 'हिमालय की पुकार', 'Title untouched');
  assert(fetchedAfter.body === originalPoem.body, 'Body untouched');
  assert(fetchedAfter.author === 'राष्ट्रकवि दिनकर', 'Author untouched');
  assert(fetchedAfter.updatedAt === originalPoem.updatedAt, 'updatedAt unchanged');
  assert(fetchedAfter.aiAnalysis === undefined, 'No premature metadata attached to poem record');
});

await asyncRunTest('PoemAnalysisService performs ZERO storage writes during analysis', async () => {
  const rawStorage = new InMemoryStorage();
  const storage = new LocalStorageAdapter(rawStorage);
  const repo = new PoemRepository(storage);

  repo.create({ title: 'एक कविता', body: 'सुंदर पंक्तियाँ।' });
  const initialKeys = Array.from(rawStorage.store.keys());
  const initialLength = rawStorage.length;

  const service = new PoemAnalysisService();
  await service.analyzePoem({
    poemId: 'any_id',
    title: 'एक कविता',
    body: 'सुंदर पंक्तियाँ।',
    analysisConsent: true
  });

  assert(rawStorage.length === initialLength, 'Storage length unchanged after analysis');
  assert(JSON.stringify(Array.from(rawStorage.store.keys())) === JSON.stringify(initialKeys), 'Storage keys unchanged');
});

// -------------------------------------------------------------
// Suite E: Explicit Consent Boundary
// -------------------------------------------------------------
console.log('\n--- Suite E: Explicit Consent Boundary ---');

await asyncRunTest('Analysis is rejected if analysisConsent is missing or false', async () => {
  const service = new PoemAnalysisService();

  // Missing consent
  const res1 = await service.analyzePoem({
    poemId: 'p1',
    title: 'शीर्षक',
    body: 'पंक्तियाँ'
  });
  assert(res1.status === ANALYSIS_STATUS.FAILED, 'Fails when consent omitted');
  assert(res1.consentGranted === false, 'consentGranted is false');
  assert(res1.error.includes('सहमति'), 'Mentions consent in Hindi error');

  // Explicit false consent
  const res2 = await service.analyzePoem({
    poemId: 'p1',
    title: 'शीर्षक',
    body: 'पंक्तियाँ',
    analysisConsent: false
  });
  assert(res2.status === ANALYSIS_STATUS.FAILED, 'Fails when consent is false');
  assert(res2.consentGranted === false, 'consentGranted is false');
});

// -------------------------------------------------------------
// Suite F: Unicode & Devanagari Integrity
// -------------------------------------------------------------
console.log('\n--- Suite F: Unicode & Devanagari Integrity ---');

await asyncRunTest('Complex Devanagari ligatures, conjuncts, nuktas and emojis survive analysis pipeline', async () => {
  const complexText = 'क्षमा, त्रिशूल, ज्ञानी, श्रद्धा, द्वंद्व, अद्भूत, हृदय, ॐ, गजल़, चाँदनी, विराम। ✨📜';
  const service = new PoemAnalysisService();

  const res = await service.analyzePoem({
    poemId: 'unicode_p1',
    title: 'संयुक्त वर्ण काव्य 🌸',
    body: complexText,
    analysisConsent: true
  });

  assert(res.status === ANALYSIS_STATUS.COMPLETED, 'Completed analysis with complex Hindi');
  assert(res.result.category.length > 0, 'Returned valid category');
  assert(res.result.mood.length > 0, 'Returned valid mood');
  assert(res.result.summary.length > 0, 'Returned valid summary in Hindi');
});

// -------------------------------------------------------------
// Suite G: Security & Injection Resilience
// -------------------------------------------------------------
console.log('\n--- Suite G: Security & Injection Resilience ---');

await asyncRunTest('HTML, script tags and injection vectors in poem text are treated as pure string data', async () => {
  const maliciousInput = '<script>alert("xss")</script><img src="x" onerror="steal()"/>';
  const service = new PoemAnalysisService();

  const res = await service.analyzePoem({
    poemId: 'xss_poem',
    title: '<b>शीर्षक</b>',
    body: maliciousInput,
    analysisConsent: true
  });

  assert(res.status === ANALYSIS_STATUS.COMPLETED, 'Executes safely');
  assert(typeof res.result.summary === 'string', 'Summary is string');
  assert(typeof res.result.category === 'string', 'Category is string');
});

// -------------------------------------------------------------
// Suite H: Zero Network Operation Audit
// -------------------------------------------------------------
console.log('\n--- Suite H: Zero Network Operation Audit ---');

runTest('Source code of AI analysis foundation contains ZERO network or external API calls', () => {
  const aiDir = path.resolve('src/services/ai');
  const files = fs.readdirSync(aiDir);

  const forbiddenPatterns = [
    /\bfetch\s*\(/i,
    /\bXMLHttpRequest\b/i,
    /\bWebSocket\b/i,
    /https?:\/\/api\.openai/i,
    /https?:\/\/api\.anthropic/i,
    /https?:\/\/generativelanguage\.googleapis/i,
    /OPENAI_API_KEY/i,
    /GEMINI_API_KEY/i,
    /ANTHROPIC_API_KEY/i
  ];

  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const content = fs.readFileSync(path.join(aiDir, file), 'utf-8');
    for (const pattern of forbiddenPatterns) {
      assert(!pattern.test(content), `Forbidden network/API pattern ${pattern} detected in ${file}`);
    }
  }
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${testIndex} AI ANALYSIS FOUNDATION TESTS PASSED!`);
console.log('================================================================\n');
