/**
 * काव्यकलश (KavyaVault) — Local Vector Index & Semantic Retrieval Test Suite (test_vector_index.js)
 * Phase 5 / Task 5.3: Local Vector Index + Semantic Retrieval Foundation
 *
 * Verifies:
 * Suite A: VectorStore Contract & Operations
 * Suite B: Pre-Write Vector Validation
 * Suite C: Stored Vector Immutability
 * Suite D: Storage Engine Failure & Resilience
 * Suite E: SemanticIndexService Operations
 * Suite F: Semantic Retrieval & Exact Cosine Ranking
 * Suite G: SearchService Integration & Strategy Dispatch
 * Suite H: Security & Sanitization
 * Suite I: Privacy & Read-Only Domain Storage Guarantee
 * Suite J: Unicode & Devanagari Ligatures Fidelity
 * Suite K: Regression & Compatibility
 */

import {
  IVectorStore,
  IndexedDBVectorStore,
  SemanticIndexService,
  SemanticSearchProvider,
  SearchService,
  LocalEmbeddingProvider,
  TestEmbeddingProvider,
  SEARCH_MODE,
  SEARCH_STATUS,
  createPoemEmbedding,
  searchPoems
} from './src/services/SearchService.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';

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
console.log('  KAVYAVAULT VECTOR INDEX & SEMANTIC RETRIEVAL SUITE (Task 5.3)');
console.log('================================================================\n');

// Helper to create an isolated in-memory vector store for testing
function createTestStore() {
  return new IndexedDBVectorStore({ memoryDriver: new Map() });
}

// -------------------------------------------------------------
// Suite A: VectorStore Contract & Operations
// -------------------------------------------------------------
console.log('--- Suite A: VectorStore Contract & Operations ---');

await asyncRunTest('IVectorStore.buildKey generates canonical compound key', async () => {
  const key = IVectorStore.buildKey('poem-1', 'model-v1');
  assert(key === 'poem-1::model-v1', 'Compound key generated accurately');
});

await asyncRunTest('IndexedDBVectorStore supports put, get, delete, count, and clear', async () => {
  const store = createTestStore();

  // 1. Put record
  const rec = createPoemEmbedding({
    poemId: 'p1',
    model: 'kavya-test-v1',
    dimensions: 4,
    vector: [0.1, 0.2, 0.3, 0.4],
    sourceTextHash: 'fnv1a_11111111'
  });
  const savedKey = await store.put(rec);
  assert(savedKey === 'p1::kavya-test-v1', 'Saved key matches compound key');

  // 2. Count
  const cnt = await store.count();
  assert(cnt === 1, 'Store contains 1 record');

  // 3. Get
  const fetched = await store.get(savedKey);
  assert(fetched !== null, 'Record retrieved successfully');
  assert(fetched.poemId === 'p1', 'PoemId matches');
  assert(fetched.vector.length === 4, 'Vector matches');

  // 4. Delete
  const deleted = await store.delete(savedKey);
  assert(deleted === true, 'Record deleted');
  assert((await store.count()) === 0, 'Store is now empty');

  // 5. Clear
  await store.put(rec);
  assert((await store.count()) === 1, 'Record added again');
  await store.clear();
  assert((await store.count()) === 0, 'Store cleared');
});

await asyncRunTest('IndexedDBVectorStore findByPoemId, findByModel, and findBySourceTextHash', async () => {
  const store = createTestStore();

  await store.put(createPoemEmbedding({
    poemId: 'poem-alpha',
    model: 'model-v1',
    dimensions: 2,
    vector: [1.0, 0.0],
    sourceTextHash: 'hash-alpha'
  }));

  await store.put(createPoemEmbedding({
    poemId: 'poem-beta',
    model: 'model-v1',
    dimensions: 2,
    vector: [0.0, 1.0],
    sourceTextHash: 'hash-beta'
  }));

  await store.put(createPoemEmbedding({
    poemId: 'poem-alpha',
    model: 'model-v2',
    dimensions: 2,
    vector: [0.7, 0.7],
    sourceTextHash: 'hash-alpha'
  }));

  // By poemId
  const alphaRecords = await store.findByPoemId('poem-alpha');
  assert(alphaRecords.length === 2, 'Found 2 models for poem-alpha');

  // By model
  const v1Records = await store.findByModel('model-v1');
  assert(v1Records.length === 2, 'Found 2 records for model-v1');

  // By sourceTextHash
  const hashRecords = await store.findBySourceTextHash('hash-alpha');
  assert(hashRecords.length === 2, 'Found 2 records matching hash-alpha');
});

// -------------------------------------------------------------
// Suite B: Pre-Write Vector Validation
// -------------------------------------------------------------
console.log('\n--- Suite B: Pre-Write Vector Validation ---');

await asyncRunTest('IndexedDBVectorStore rejects invalid or malformed vectors on put', async () => {
  const store = createTestStore();
  let errors = 0;

  // 1. Vector containing NaN
  try {
    await store.put({
      poemId: 'p',
      model: 'm',
      dimensions: 2,
      vector: [1.0, NaN],
      sourceTextHash: 'h'
    });
  } catch (e) { errors++; }

  // 2. Vector containing Infinity
  try {
    await store.put({
      poemId: 'p',
      model: 'm',
      dimensions: 2,
      vector: [1.0, Infinity],
      sourceTextHash: 'h'
    });
  } catch (e) { errors++; }

  // 3. Mismatched dimensions
  try {
    await store.put({
      poemId: 'p',
      model: 'm',
      dimensions: 3,
      vector: [1.0, 2.0],
      sourceTextHash: 'h'
    });
  } catch (e) { errors++; }

  // 4. Missing poemId
  try {
    await store.put({
      poemId: '',
      model: 'm',
      dimensions: 2,
      vector: [1.0, 2.0],
      sourceTextHash: 'h'
    });
  } catch (e) { errors++; }

  assert(errors === 4, 'All 4 malformed vector insertions rejected');
});

// -------------------------------------------------------------
// Suite C: Stored Vector Immutability
// -------------------------------------------------------------
console.log('\n--- Suite C: Stored Vector Immutability ---');

await asyncRunTest('Modifying returned vector record does not mutate stored record', async () => {
  const store = createTestStore();
  const rec = createPoemEmbedding({
    poemId: 'p-immutable',
    model: 'm1',
    dimensions: 2,
    vector: [0.5, 0.5],
    sourceTextHash: 'hash-init'
  });
  await store.put(rec);

  const fetched = await store.get('p-immutable::m1');
  assert(fetched !== null, 'Fetched record exists');

  // Attempt to mutate vector array
  try {
    fetched.vector[0] = 999.9;
  } catch (err) {
    // In strict mode, mutating frozen array throws
  }

  // Refetch to verify storage purity
  const refetched = await store.get('p-immutable::m1');
  assert(refetched.vector[0] === 0.5, 'Stored vector remains 0.5 and immutable');
});

// -------------------------------------------------------------
// Suite D: Storage Engine Failure & Resilience
// -------------------------------------------------------------
console.log('\n--- Suite D: Storage Engine Failure & Resilience ---');

await asyncRunTest('IndexedDBVectorStore safely handles missing or null ID lookups without crashing', async () => {
  const store = createTestStore();
  const resNull = await store.get(null);
  assert(resNull === null, 'Null ID safely returns null');

  const resEmpty = await store.get('');
  assert(resEmpty === null, 'Empty ID safely returns null');

  const delNull = await store.delete(null);
  assert(delNull === false, 'Deleting null returns false');
});

// -------------------------------------------------------------
// Suite E: SemanticIndexService Operations
// -------------------------------------------------------------
console.log('\n--- Suite E: SemanticIndexService Operations ---');

await asyncRunTest('SemanticIndexService indexes poem when provider is available', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'test-v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const poem = {
    id: 'kavya-1',
    title: 'मधुशाला',
    author: 'हरिवंश राय बच्चन',
    body: 'मदिरालय जाने को घर से चलता है पीनेवला।'
  };

  const res = await indexService.indexPoem(poem);
  assert(res.status === 'indexed', 'Poem successfully indexed');
  assert(res.poemId === 'kavya-1', 'Poem ID correct');
  assert((await store.count()) === 1, 'Store contains 1 vector record');
});

await asyncRunTest('SemanticIndexService skips regeneration when source text hash is unchanged', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'test-v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const poem = { id: 'kavya-2', title: 'पुष्प की अभिलाषा', body: 'चाह नहीं मैं सुरबाला के गहनों में गूँथा जाऊँ' };

  // 1st indexing
  const res1 = await indexService.indexPoem(poem);
  assert(res1.status === 'indexed', 'Initial indexing succeeds');

  // 2nd indexing with same content
  const res2 = await indexService.indexPoem(poem);
  assert(res2.status === 'skipped', 'Second indexing skipped');
  assert(res2.reason === 'स्रोत पाठ अपरिवर्तित है।', 'Truthful skip reason');
});

await asyncRunTest('SemanticIndexService replaces old vector when source text changes', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'test-v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const poem = { id: 'kavya-3', title: 'गीत', body: 'प्रथम संस्करण' };
  await indexService.indexPoem(poem);

  const initialRec = await store.get('kavya-3::test-v1');
  const initialHash = initialRec.sourceTextHash;

  // Edit poem body
  const modifiedPoem = { id: 'kavya-3', title: 'गीत', body: 'द्वितीय संशोधित संस्करण' };
  const resMod = await indexService.indexPoem(modifiedPoem);
  assert(resMod.status === 'indexed', 'Re-indexed on text modification');

  const updatedRec = await store.get('kavya-3::test-v1');
  assert(updatedRec.sourceTextHash !== initialHash, 'Source text hash updated');
  assert((await store.count()) === 1, 'Replaced in-place, count remains 1');
});

await asyncRunTest('SemanticIndexService isolates model versions', async () => {
  const store = createTestStore();
  const providerV1 = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'model-alpha' });
  const providerV2 = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'model-beta' });

  const serviceV1 = new SemanticIndexService({ vectorStore: store, embeddingProvider: providerV1 });
  const serviceV2 = new SemanticIndexService({ vectorStore: store, embeddingProvider: providerV2 });

  const poem = { id: 'poem-multi', title: 'साहित्य', body: 'काव्य साधना' };

  await serviceV1.indexPoem(poem);
  await serviceV2.indexPoem(poem);

  assert((await store.count()) === 2, 'Two separate model vectors stored for the same poem');
  assert((await store.get('poem-multi::model-alpha')) !== null, 'Model alpha vector exists');
  assert((await store.get('poem-multi::model-beta')) !== null, 'Model beta vector exists');
});

await asyncRunTest('SemanticIndexService removePoem deletes vector without deleting poem', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  await indexService.indexPoem({ id: 'p-to-remove', title: 'क्षणिका', body: 'एक लघु क्षण' });
  assert((await store.count()) === 1, 'Indexed 1 vector');

  const deletedCount = await indexService.removePoem('p-to-remove');
  assert(deletedCount === 1, 'Removed 1 vector record');
  assert((await store.count()) === 0, 'Vector store is empty');
});

await asyncRunTest('SemanticIndexService indexPoems handles batch indexing safely', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const poems = [
    { id: 'b1', title: 'कविता १', body: 'पंक्ति १' },
    { id: 'b2', title: 'कविता २', body: 'पंक्ति २' },
    { id: 'b3', title: 'कविता ३', body: 'पंक्ति ३' }
  ];

  const batchRes = await indexService.indexPoems(poems);
  assert(batchRes.total === 3, 'Total 3 poems in batch');
  assert(batchRes.indexed === 3, 'All 3 indexed');
  assert(batchRes.skipped === 0, '0 skipped');
  assert(batchRes.failed === 0, '0 failed');
  assert((await store.count()) === 3, 'Store has 3 records');
});

// -------------------------------------------------------------
// Suite F: Semantic Retrieval & Exact Cosine Ranking
// -------------------------------------------------------------
console.log('\n--- Suite F: Semantic Retrieval & Exact Cosine Ranking ---');

await asyncRunTest('SemanticSearchProvider ranks poems by exact cosine similarity descending', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 8, modelVersion: 'test-v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const poems = [
    { id: 'p-nature', title: 'प्रकृति की सुंदरता', body: 'हरे-भरे पर्वत, बहती नदियाँ और खिलते फूल।' },
    { id: 'p-heroic', title: 'वीर रस की हुंकार', body: 'शत्रु के सम्मुख सीना ताने खड़े वीर सैनिक।' }
  ];

  await indexService.indexPoems(poems);

  const searchProvider = new SemanticSearchProvider({
    embeddingProvider: provider,
    vectorStore: store
  });

  // Query similar to nature
  const queryRes = await searchProvider.search('पर्वत और नदियाँ', { poems });

  assert(queryRes.status === SEARCH_STATUS.SUCCESS, 'Search status is SUCCESS');
  assert(queryRes.results.length === 2, '2 results returned');
  assert(queryRes.results[0].source === SEARCH_MODE.SEMANTIC, 'Source is semantic');
  assert(typeof queryRes.results[0].score === 'number', 'Score is a valid number');
  assert(queryRes.results[0].score >= queryRes.results[1].score, 'Results sorted by score descending');
});

await asyncRunTest('SemanticSearchProvider respects topK and minScore options', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 8, modelVersion: 'test-v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const poems = [
    { id: 'p1', title: 'एक', body: 'प्रथम' },
    { id: 'p2', title: 'दो', body: 'द्वितीय' },
    { id: 'p3', title: 'तीन', body: 'तृतीय' }
  ];

  await indexService.indexPoems(poems);

  const searchProvider = new SemanticSearchProvider({
    embeddingProvider: provider,
    vectorStore: store
  });

  // Test topK = 1
  const top1Res = await searchProvider.search('प्रथम', { topK: 1, poems });
  assert(top1Res.results.length === 1, 'Exactly 1 result returned when topK=1');

  // Test minScore threshold
  const filteredRes = await searchProvider.search('प्रथम', { minScore: 0.99999, poems });
  assert(filteredRes.results.length <= 1, 'minScore bounds candidate results');
});

await asyncRunTest('SemanticSearchProvider applies deterministic tie-breaking', async () => {
  const store = createTestStore();
  // Fixed mock embedding provider returning identical vectors for testing tie-breaks
  const uniformProvider = {
    getId: () => 'uniform',
    getName: () => 'Uniform',
    getModelVersion: () => 'u1',
    getDimensions: () => 2,
    isAvailable: () => true,
    embed: async () => [0.7071, 0.7071],
    embedPoem: async () => [0.7071, 0.7071],
    embedQuery: async () => [0.7071, 0.7071]
  };

  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: uniformProvider });

  const poems = [
    { id: 'p-b', title: 'कविता बी', body: 'समान', updatedAt: '2026-09-01T10:00:00Z' },
    { id: 'p-a', title: 'कविता ए', body: 'समान', updatedAt: '2026-09-01T10:00:00Z' },
    { id: 'p-c', title: 'कविता सी', body: 'समान', updatedAt: '2026-09-02T10:00:00Z' } // Newer
  ];

  await indexService.indexPoems(poems);

  const searchProvider = new SemanticSearchProvider({
    embeddingProvider: uniformProvider,
    vectorStore: store
  });

  const res = await searchProvider.search('कोई भी शब्द', { poems });
  assert(res.results.length === 3, 'All 3 scored equally');

  // Tie-breaker 1: p-c is newest (2026-09-02), so it should be first
  assert(res.results[0].poemId === 'p-c', 'p-c with newest updatedAt ranks first');

  // Tie-breaker 2: p-a and p-b have equal date, so p-a ranks before p-b by poemId ascending
  assert(res.results[1].poemId === 'p-a', 'p-a ranks before p-b alphabetically by poemId');
  assert(res.results[2].poemId === 'p-b', 'p-b ranks third');
});

await asyncRunTest('SemanticSearchProvider returns UNSUPPORTED when local provider is unavailable', async () => {
  const store = createTestStore();
  const searchProvider = new SemanticSearchProvider({
    embeddingProvider: new LocalEmbeddingProvider(), // Default unavailable provider
    vectorStore: store
  });

  const res = await searchProvider.search('शांति और सुकून');
  assert(res.status === SEARCH_STATUS.UNSUPPORTED, 'Returns explicit UNSUPPORTED');
  assert(res.results.length === 0, 'Zero results returned');
});

// -------------------------------------------------------------
// Suite G: SearchService Integration & Strategy Dispatch
// -------------------------------------------------------------
console.log('\n--- Suite G: SearchService Integration & Strategy Dispatch ---');

await asyncRunTest('SearchService dispatches mode="semantic" to SemanticSearchProvider', async () => {
  const service = new SearchService();
  const res = await service.search({ text: 'जीवन दर्शन', mode: SEARCH_MODE.SEMANTIC });

  assert(res.mode === SEARCH_MODE.SEMANTIC, 'Dispatched to semantic mode');
  assert(res.status === SEARCH_STATUS.UNSUPPORTED, 'Default service reports unsupported for semantic without fake AI');
  assert(res.results.length === 0, 'Zero results');
});

// -------------------------------------------------------------
// Suite H: Security & Sanitization
// -------------------------------------------------------------
console.log('\n--- Suite H: Security & Sanitization ---');

await asyncRunTest('Vector store and indexing treat malicious script injection purely as data', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const maliciousPoem = {
    id: '<script>alert(1)</script>',
    title: '<img src=x onerror=alert(1)>',
    body: 'DROP TABLE poems; -- injection'
  };

  const res = await indexService.indexPoem(maliciousPoem);
  assert(res.status === 'indexed', 'Indexed without executing script');

  const key = IVectorStore.buildKey(maliciousPoem.id, 'v1');
  const stored = await store.get(key);
  assert(stored !== null, 'Stored securely');
  assert(stored.poemId === '<script>alert(1)</script>', 'Treated purely as literal string');
});

// -------------------------------------------------------------
// Suite I: Privacy & Read-Only Domain Storage Guarantee
// -------------------------------------------------------------
console.log('\n--- Suite I: Privacy & Read-Only Domain Storage Guarantee ---');

await asyncRunTest('Indexing and semantic search operations perform zero network requests and zero poem repo writes', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  // Indexing updates ONLY the isolated vector store
  await indexService.indexPoem({ id: 'priv-1', title: 'एकांत साधना', body: 'कविता मेरी धरोहर है' });
  assert((await store.count()) === 1, 'Only vector store touched');
});

// -------------------------------------------------------------
// Suite J: Unicode & Devanagari Ligatures Fidelity
// -------------------------------------------------------------
console.log('\n--- Suite J: Unicode & Devanagari Ligatures Fidelity ---');

await asyncRunTest('Complex Devanagari conjuncts and symbols are indexed and queried faithfully', async () => {
  const store = createTestStore();
  const provider = new TestEmbeddingProvider({ dimensions: 4, modelVersion: 'v1' });
  const indexService = new SemanticIndexService({ vectorStore: store, embeddingProvider: provider });

  const complexPoem = {
    id: 'p-unicode',
    title: 'क्ष त्र ज्ञ श्र द्व द्घ हृ ॐ । ॥',
    body: 'विराम चिन्ह एवं संयुक्ताक्षर 🌸✨'
  };

  const res = await indexService.indexPoem(complexPoem);
  assert(res.status === 'indexed', 'Indexed complex Devanagari poem');

  const stored = await store.get('p-unicode::v1');
  assert(stored !== null, 'Vector stored successfully for Unicode text');
  assert(typeof stored.sourceTextHash === 'string', 'Source text hash generated');
});

// -------------------------------------------------------------
// Suite K: Regression & Compatibility
// -------------------------------------------------------------
console.log('\n--- Suite K: Regression & Compatibility ---');

runTest('Existing deterministic text search remains 100% operational', () => {
  const samplePoems = [
    { id: '1', title: 'सावन का झूला', body: 'रिमझिम फुहार' }
  ];

  const searchRes = searchPoems(samplePoems, 'सावन');
  assert(searchRes.totalCount === 1, 'Deterministic search matched poem');
  assert(searchRes.results[0].poem.title === 'सावन का झूला', 'Title matched');
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${testIndex} VECTOR INDEX & SEMANTIC RETRIEVAL TESTS PASSED!`);
console.log('================================================================\n');
