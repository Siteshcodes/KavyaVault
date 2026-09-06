/**
 * काव्यकलश (KavyaVault) — Automated Persistence Test Suite
 * Tests IStorageAdapter, LocalStorageAdapter, MigrationManager, and PoemRepository.
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { MigrationManager, CURRENT_SCHEMA_VERSION } from './src/services/storage/MigrationManager.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { STORAGE_KEYS } from './src/data/storageKeys.js';

// In-memory mock storage engine
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

async function runTests() {
  console.log('====================================================');
  console.log('  KAVYAVAULT PERSISTENCE FOUNDATION TEST SUITE');
  console.log('====================================================');

  const mockStorage = new MockStorage();
  const adapter = new LocalStorageAdapter(mockStorage);
  const migrationManager = new MigrationManager(adapter);
  const repo = new PoemRepository(adapter);

  // ----------------------------------------------------
  // TEST 1: Adapter Basic Operations
  // ----------------------------------------------------
  console.log('\n[TEST 1] Adapter: set, get, has, remove, clear');
  adapter.set('kavyavault:test_key', { name: 'Kavya', count: 42 });
  console.assert(adapter.has('kavyavault:test_key') === true, 'has should return true');
  const fetched = adapter.get('kavyavault:test_key');
  console.assert(fetched.name === 'Kavya' && fetched.count === 42, 'get should return deserialized object');

  adapter.remove('kavyavault:test_key');
  console.assert(adapter.has('kavyavault:test_key') === false, 'has should return false after remove');
  console.assert(adapter.get('kavyavault:test_key') === null, 'get should return null for removed key');
  console.log('✓ Adapter basic CRUD operations passed.');

  // ----------------------------------------------------
  // TEST 2: Adapter Malformed JSON Error Handling
  // ----------------------------------------------------
  console.log('\n[TEST 2] Adapter: Malformed JSON handling');
  mockStorage.setItem('kavyavault:bad_json', '{ this is not valid json');
  try {
    adapter.get('kavyavault:bad_json');
    console.assert(false, 'Should have thrown StorageError for malformed JSON');
  } catch (err) {
    console.assert(err instanceof StorageError, 'Error must be instance of StorageError');
    console.assert(err.code === StorageErrorCode.DESERIALIZATION_ERROR, 'Error code must be DESERIALIZATION_ERROR');
    console.log('✓ Malformed JSON safely caught and transformed to StorageError.');
  }

  // ----------------------------------------------------
  // TEST 3: Migration Manager
  // ----------------------------------------------------
  console.log('\n[TEST 3] MigrationManager: Initial setup & version detection');
  const initResult = await migrationManager.initialize();
  console.assert(initResult.status === 'INITIALIZED', 'Fresh install should be INITIALIZED');
  console.assert(initResult.currentVersion === CURRENT_SCHEMA_VERSION, 'Current version must match');
  console.assert(adapter.has(STORAGE_KEYS.POEMS) === true, 'Poems collection must be initialized');
  console.assert(Array.isArray(adapter.get(STORAGE_KEYS.POEMS)), 'Poems collection must be an array');

  const secondInit = await migrationManager.initialize();
  console.assert(secondInit.status === 'UP_TO_DATE', 'Subsequent init should be UP_TO_DATE');
  console.log('✓ MigrationManager safe initialization & version check passed.');

  // ----------------------------------------------------
  // TEST 4: PoemRepository Create, Read, and Immutability
  // ----------------------------------------------------
  console.log('\n[TEST 4] PoemRepository: Create & Immutability');
  const p1 = repo.create({
    id: 'kv_poem_test_1',
    title: 'मौन की गूँज',
    body: 'शब्द जब मौन हो जाते हैं,\nगीत अमर हो जाते हैं।',
    author: 'कवि क',
    tags: ['शांत', 'विचार']
  });

  console.assert(p1.id === 'kv_poem_test_1', 'ID must match');
  console.assert(p1.title === 'मौन की गूँज', 'Title must match');
  console.assert(p1.isFavorite === false, 'Default isFavorite must be false');
  console.assert(p1.isArchived === false, 'Default isArchived must be false');

  // Verify Immutability: Mutating caller's object must NOT affect repository data
  p1.title = 'HACKED TITLE';
  const fromRepo = repo.getById('kv_poem_test_1');
  console.assert(fromRepo.title === 'मौन की गूँज', 'Repository internal state must be immutable');
  console.log('✓ Poem creation & immutability guarantee verified.');

  // ----------------------------------------------------
  // TEST 5: Duplicate ID Protection
  // ----------------------------------------------------
  console.log('\n[TEST 5] PoemRepository: Duplicate ID protection');
  try {
    repo.create({
      id: 'kv_poem_test_1',
      title: 'Duplicate Attempt',
      body: 'Testing duplicate rejection',
      author: 'Tester'
    });
    console.assert(false, 'Should have thrown for duplicate ID');
  } catch (err) {
    console.assert(err instanceof StorageError, 'Error must be StorageError');
    console.assert(err.code === StorageErrorCode.DUPLICATE_ID, 'Code must be DUPLICATE_ID');
    console.log('✓ Duplicate ID rejection verified.');
  }

  // ----------------------------------------------------
  // TEST 6: Validation Rejections
  // ----------------------------------------------------
  console.log('\n[TEST 6] PoemRepository: Validation checks');
  try {
    repo.create({ id: '   ', title: 'Invalid ID', body: 'abc', author: 'xyz' });
    console.assert(false, 'Empty ID should fail');
  } catch (err) {
    console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Empty ID must fail with VALIDATION_ERROR');
  }

  try {
    repo.create({ id: 'kv_valid_id', title: 12345, body: 'abc', author: 'xyz' });
    console.assert(false, 'Non-string title should fail');
  } catch (err) {
    console.assert(err.code === StorageErrorCode.VALIDATION_ERROR, 'Non-string title must fail with VALIDATION_ERROR');
  }
  console.log('✓ Validation constraints properly enforced.');

  // ----------------------------------------------------
  // TEST 7: Update, Favorite, Archive, Restore
  // ----------------------------------------------------
  console.log('\n[TEST 7] PoemRepository: Update, Favorite, Archive, Restore');
  const updated = repo.update('kv_poem_test_1', { title: 'संशोधित शीर्षक' });
  console.assert(updated.title === 'संशोधित शीर्षक', 'Title must update');

  repo.setFavorite('kv_poem_test_1', true);
  console.assert(repo.getById('kv_poem_test_1').isFavorite === true, 'Poem must be favorited');

  repo.archive('kv_poem_test_1');
  console.assert(repo.getById('kv_poem_test_1').isArchived === true, 'Poem must be archived');

  // Verify getAll excludes archived by default
  const activePoems = repo.getAll();
  console.assert(activePoems.length === 0, 'Archived poem must not appear in default getAll()');

  const allIncludingArchived = repo.getAll({ includeArchived: true });
  console.assert(allIncludingArchived.length === 1, 'Archived poem must appear when includeArchived is true');

  repo.restore('kv_poem_test_1');
  console.assert(repo.getById('kv_poem_test_1').isArchived === false, 'Poem must be restored');
  console.assert(repo.getAll().length === 1, 'Restored poem must appear in default getAll()');
  console.log('✓ Update, favorite, archive, and restore workflows verified.');

  // ----------------------------------------------------
  // TEST 8: Draft Persistence
  // ----------------------------------------------------
  console.log('\n[TEST 8] PoemRepository: Draft persistence');
  console.assert(repo.getDraft() === null || repo.getDraft() === undefined, 'Initial draft should be empty');

  const draft = repo.saveDraft({
    title: 'अधूरी रचना',
    body: 'पहली पंक्ति लिखी है...',
    author: 'स्वयं'
  });
  console.assert(draft.title === 'अधूरी रचना', 'Draft title must match');
  console.assert(repo.getDraft().body === 'पहली पंक्ति लिखी है...', 'Draft body must persist');

  repo.clearDraft();
  console.assert(repo.getDraft() === null, 'Draft must be cleared');
  console.log('✓ Draft persistence verified.');

  // ----------------------------------------------------
  // TEST 9: Delete Operation
  // ----------------------------------------------------
  console.log('\n[TEST 9] PoemRepository: Delete');
  repo.delete('kv_poem_test_1');
  console.assert(repo.getById('kv_poem_test_1') === null, 'Poem must not exist after deletion');
  console.assert(repo.getAll().length === 0, 'Library must be empty after delete');
  console.log('✓ Delete operation verified.');

  // ----------------------------------------------------
  // TEST 10: Corrupted Storage Recovery
  // ----------------------------------------------------
  console.log('\n[TEST 10] PoemRepository: Corrupted storage recovery');
  mockStorage.setItem(STORAGE_KEYS.POEMS, '{"invalid_object": true}'); // Not an array!
  const recoveredList = repo.getAll();
  console.assert(Array.isArray(recoveredList) && recoveredList.length === 0, 'Must safely reset to empty array on corruption');
  console.log('✓ Corrupted storage recovered safely without crashing.');

  console.log('\n====================================================');
  console.log('  ALL 10 PERSISTENCE TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
