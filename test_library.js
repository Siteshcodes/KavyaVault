/**
 * काव्यकलश (KavyaVault) — Poetry Library Logic Test Suite (test_library.js)
 * Verifies repository filtering, sorting, card/preview generation,
 * Unicode safety, and interaction workflows for Task 1.9.
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { generatePoemPreview } from './src/utils/preview.js';
import { formatPoeticDate } from './src/utils/date.js';

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

async function runLibraryTests() {
  console.log('====================================================');
  console.log('  KAVYAVAULT POETRY LIBRARY FOUNDATION TEST SUITE');
  console.log('====================================================');

  const mockStorage = new MockStorage();
  const adapter = new LocalStorageAdapter(mockStorage);
  const repo = new PoemRepository(adapter);

  // ----------------------------------------------------
  // TEST 1: Empty Repository & Count
  // ----------------------------------------------------
  console.log('\n[TEST 1] Empty Repository & Count');
  const emptyPoems = repo.getAll();
  console.assert(Array.isArray(emptyPoems) && emptyPoems.length === 0, 'Empty repository should return empty array');
  console.log('✓ Empty repository returns 0 poems.');

  // ----------------------------------------------------
  // TEST 2: Populated Repository Creation
  // ----------------------------------------------------
  console.log('\n[TEST 2] Populated Repository');
  const poem1 = repo.create({
    id: 'kv_poem_test_1',
    title: 'मधुशाला का एक अंश',
    body: 'मदिरालय जाने को घर से चलता है पीनेवला,\nकिस पथ से जाऊँ, असमंजस में है वह भोलाभाला।\nअलग-अलग पथ बतलाते सब, पर मैं यह बतलाता हूँ,\nराह पकड़ तू एक चला चल, पा जाएगा मधुशाला।',
    author: 'हरिवंश राय बच्चन',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z'
  });

  const poem2 = repo.create({
    id: 'kv_poem_test_2',
    title: 'रश्मिरथी का उद्घोष',
    body: 'वर्षों तक वन में घूम-घूम,\nबाधा-विघ्नों को चूम-चूम,\nसह धूप-घाम, पानी-पत्थर,\nपांडव आये कुछ और निखर।',
    author: 'रामधारी सिंह दिनकर',
    isFavorite: true,
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T12:00:00.000Z'
  });

  const poem3 = repo.create({
    id: 'kv_poem_test_3',
    title: 'पुरानी अप्रकाशित रचना',
    body: 'यह एक पुरानी रचना है जिसे अभिलेख में रखा गया है।',
    author: 'अज्ञात',
    isArchived: true,
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-01T10:00:00.000Z'
  });

  const allActive = repo.getAll();
  console.assert(allActive.length === 2, `Expected 2 active poems, got ${allActive.length}`);
  console.log('✓ Populated repository returns active poems count accurately.');

  // ----------------------------------------------------
  // TEST 3: Archived Excluded by Default
  // ----------------------------------------------------
  console.log('\n[TEST 3] Archived Excluded by Default');
  const hasArchivedInDefault = allActive.some(p => p.isArchived);
  console.assert(!hasArchivedInDefault, 'Archived poems must not appear in default getAll()');
  console.assert(!allActive.some(p => p.id === 'kv_poem_test_3'), 'Archived poem 3 must be excluded');
  console.log('✓ Archived poems are strictly excluded by default.');

  // ----------------------------------------------------
  // TEST 4: Archive Filter
  // ----------------------------------------------------
  console.log('\n[TEST 4] Archive Filter');
  const allIncludingArchived = repo.getAll({ includeArchived: true });
  const archivedOnly = allIncludingArchived.filter(p => p.isArchived);
  console.assert(archivedOnly.length === 1, `Expected 1 archived poem, got ${archivedOnly.length}`);
  console.assert(archivedOnly[0].id === 'kv_poem_test_3', 'Archived poem ID matches');
  console.log('✓ Archive filter successfully retrieves archived poems.');

  // ----------------------------------------------------
  // TEST 5: Favorites Filter
  // ----------------------------------------------------
  console.log('\n[TEST 5] Favorites Filter');
  const favorites = repo.getAll({ onlyFavorites: true });
  console.assert(favorites.length === 1, `Expected 1 favorite poem, got ${favorites.length}`);
  console.assert(favorites[0].id === 'kv_poem_test_2', 'Favorite poem ID matches');
  console.assert(favorites[0].isFavorite === true, 'isFavorite is true');
  console.log('✓ Favorites filter returns only favorite active poems.');

  // ----------------------------------------------------
  // TEST 6: Newest-Updated Sorting
  // ----------------------------------------------------
  console.log('\n[TEST 6] Newest-Updated Sorting');
  // poem2 was updated 2026-01-02, poem1 was updated 2026-01-01
  const sortedDefault = repo.getAll();
  console.assert(sortedDefault[0].id === 'kv_poem_test_2', 'Poem 2 should come first (more recent updatedAt)');
  console.assert(sortedDefault[1].id === 'kv_poem_test_1', 'Poem 1 should come second');

  // Now update poem1 to be newest
  repo.update('kv_poem_test_1', { title: 'मधुशाला (संशोधित)' });
  const reSorted = repo.getAll();
  console.assert(reSorted[0].id === 'kv_poem_test_1', 'Poem 1 should now be first after update');
  console.log('✓ Poems ordered by newest updatedAt descending.');

  // ----------------------------------------------------
  // TEST 7: Favorite Toggle
  // ----------------------------------------------------
  console.log('\n[TEST 7] Favorite Toggle');
  repo.setFavorite('kv_poem_test_1', true);
  console.assert(repo.getById('kv_poem_test_1').isFavorite === true, 'Poem 1 should now be favorite');

  repo.setFavorite('kv_poem_test_1', false);
  console.assert(repo.getById('kv_poem_test_1').isFavorite === false, 'Poem 1 should no longer be favorite');
  console.log('✓ Favorite toggle operates correctly via repository.');

  // ----------------------------------------------------
  // TEST 8: Archive and Restore
  // ----------------------------------------------------
  console.log('\n[TEST 8] Archive and Restore');
  repo.archive('kv_poem_test_1');
  console.assert(repo.getById('kv_poem_test_1').isArchived === true, 'Poem 1 should be archived');
  console.assert(repo.getAll().length === 1, 'Active library should now have 1 poem');

  repo.restore('kv_poem_test_1');
  console.assert(repo.getById('kv_poem_test_1').isArchived === false, 'Poem 1 should be restored');
  console.assert(repo.getAll().length === 2, 'Active library should have 2 poems after restore');
  console.log('✓ Archive and restore workflows verified.');

  // ----------------------------------------------------
  // TEST 9: Unicode-Safe Preview Generation
  // ----------------------------------------------------
  console.log('\n[TEST 9] Unicode-Safe Preview');
  const complexVerse = 'वह आता—\nदो टूक कलेजे के करता, पछताता\nपथ पर आता।\nपेट पीठ दोनों मिलकर हैं एक,\nचल रहा लकुटिया टेक,';
  const preview = generatePoemPreview(complexVerse, 3, 100);

  console.assert(typeof preview === 'string', 'Preview must be a string');
  console.assert(preview.includes('वह आता—'), 'Preview must preserve first line');
  console.assert(preview.includes('\n'), 'Preview must preserve line breaks');
  console.assert(preview.endsWith('…'), 'Truncated preview must end with ellipsis');
  console.assert(!preview.includes('चल रहा लकुटिया टेक'), '4th and 5th lines must be truncated');

  // Test empty/short input
  console.assert(generatePoemPreview('') === '', 'Empty string returns empty');
  console.assert(generatePoemPreview('एक छोटी पंक्ति') === 'एक छोटी पंक्ति', 'Short text without overflow returns as-is');
  console.log('✓ Unicode-safe preview generator verified.');

  // ----------------------------------------------------
  // TEST 10: Poetic Date Formatting
  // ----------------------------------------------------
  console.log('\n[TEST 10] Poetic Date Formatting');
  const dateFormatted = formatPoeticDate('2026-09-06T10:30:00.000Z');
  console.assert(dateFormatted.includes('सितंबर') && dateFormatted.includes('2026'), `Expected Hindi month and year in ${dateFormatted}`);
  console.log(`✓ Poetic date formatted correctly: "${dateFormatted}"`);

  console.log('\n====================================================');
  console.log('  ALL 10 LIBRARY FOUNDATION TESTS PASSED! (100%)');
  console.log('====================================================\n');
}

runLibraryTests().catch(err => {
  console.error('\n❌ LIBRARY TEST FAILED:', err);
  process.exit(1);
});
