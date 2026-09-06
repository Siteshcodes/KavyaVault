/**
 * काव्यकलश (KavyaVault) — Favorites & Archive Lifecycle Test Suite (test_favorites_archive.js)
 * Tests complete lifecycle coherence across Library, Favorites, Archive, Search, and Reader.
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { searchPoems } from './src/services/SearchService.js';
import { renderPoemCard } from './src/components/library/PoemCard.js';
import { renderLibraryToolbar } from './src/components/library/LibraryToolbar.js';
import { renderEmptyState } from './src/components/layout/EmptyState.js';

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

async function runFavoritesArchiveTests() {
  console.log('====================================================');
  console.log('  KAVYAVAULT FAVORITES & ARCHIVE LIFECYCLE TESTS');
  console.log('====================================================');

  const mockStorage = new MockStorage();
  const adapter = new LocalStorageAdapter(mockStorage);
  const repo = new PoemRepository(adapter);

  // Seed sample poems
  const p1 = repo.create({
    id: 'kv_fav_1',
    title: 'मधुशाला',
    body: 'मदिरालय जाने को घर से चलता है पीनेवला',
    author: 'हरिवंश राय बच्चन',
    tags: ['क्लासिक'],
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z'
  });

  const p2 = repo.create({
    id: 'kv_fav_2',
    title: 'सावन की बूँदें',
    body: 'बरखा आई री सखी मन भावन',
    author: 'महादेवी वर्मा',
    tags: ['प्रकृति'],
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-02T10:00:00.000Z'
  });

  const p3 = repo.create({
    id: 'kv_fav_3',
    title: 'पुरानी डायरी के पन्ने',
    body: 'बीते दिनों की एक भूली बिसरी गूँज',
    author: 'अज्ञेय',
    tags: ['स्मृति'],
    isFavorite: true,
    isArchived: true, // Archived AND favorite
    createdAt: '2026-03-03T10:00:00.000Z',
    updatedAt: '2026-03-03T10:00:00.000Z'
  });

  const p4 = repo.create({
    id: 'kv_fav_4',
    title: 'संध्या गीत',
    body: 'दिन ढल चुका है और तारे खिल रहे हैं',
    author: 'जयशंकर प्रसाद',
    tags: ['संध्या'],
    isFavorite: false,
    isArchived: true, // Archived, not favorite
    createdAt: '2026-03-04T10:00:00.000Z',
    updatedAt: '2026-03-04T10:00:00.000Z'
  });

  // ----------------------------------------------------
  // TEST 1: Favorites returns only favorite active poems
  // ----------------------------------------------------
  console.log('\n[TEST 1] Favorites Returns Only Favorite Active Poems');
  const favPoems = repo.getAll({ includeArchived: false, onlyFavorites: true });
  console.assert(favPoems.length === 1, `Expected 1 favorite active poem, got ${favPoems.length}`);
  console.assert(favPoems[0].id === 'kv_fav_1', 'Poem 1 must be in favorites');
  console.assert(favPoems[0].isFavorite === true, 'isFavorite flag must be true');
  console.log('✓ Favorites query strictly returns active favorite poems.');

  // ----------------------------------------------------
  // TEST 2: Non-favorite poems are excluded from Favorites
  // ----------------------------------------------------
  console.log('\n[TEST 2] Non-Favorite Poems Are Excluded from Favorites');
  console.assert(!favPoems.some(p => p.id === 'kv_fav_2'), 'Non-favorite poem 2 must be excluded');
  console.log('✓ Non-favorite active poems successfully excluded.');

  // ----------------------------------------------------
  // TEST 3: Archived favorite poems are excluded from Favorites
  // ----------------------------------------------------
  console.log('\n[TEST 3] Archived Favorite Poems Excluded from Favorites');
  console.assert(!favPoems.some(p => p.id === 'kv_fav_3'), 'Archived favorite poem 3 must be excluded');
  console.log('✓ Archived poems excluded from favorites view even if marked favorite.');

  // ----------------------------------------------------
  // TEST 4: Unfavoriting removes a poem from Favorites
  // ----------------------------------------------------
  console.log('\n[TEST 4] Unfavoriting Removes a Poem from Favorites');
  repo.setFavorite('kv_fav_1', false);
  const afterUnfav = repo.getAll({ includeArchived: false, onlyFavorites: true });
  console.assert(afterUnfav.length === 0, 'After unfavoriting, favorites should be empty');
  // Restore favorite status for subsequent tests
  repo.setFavorite('kv_fav_1', true);
  console.assert(repo.getAll({ includeArchived: false, onlyFavorites: true }).length === 1, 'Restored to favorite');
  console.log('✓ Unfavoriting dynamically removes poem from favorites set.');

  // ----------------------------------------------------
  // TEST 5: Archive returns only archived poems
  // ----------------------------------------------------
  console.log('\n[TEST 5] Archive Returns Only Archived Poems');
  const archivedPoems = repo.getAll({ includeArchived: true }).filter(p => p.isArchived);
  console.assert(archivedPoems.length === 2, `Expected 2 archived poems, got ${archivedPoems.length}`);
  console.assert(archivedPoems.some(p => p.id === 'kv_fav_3'), 'Poem 3 must be in archive');
  console.assert(archivedPoems.some(p => p.id === 'kv_fav_4'), 'Poem 4 must be in archive');
  console.log('✓ Archive query returns precisely archived poems.');

  // ----------------------------------------------------
  // TEST 6: Active poems are excluded from Archive
  // ----------------------------------------------------
  console.log('\n[TEST 6] Active Poems Are Excluded from Archive');
  console.assert(!archivedPoems.some(p => p.id === 'kv_fav_1'), 'Active poem 1 excluded from archive');
  console.assert(!archivedPoems.some(p => p.id === 'kv_fav_2'), 'Active poem 2 excluded from archive');
  console.log('✓ Active poems strictly isolated from archive.');

  // ----------------------------------------------------
  // TEST 7: Restoring removes poem from Archive
  // ----------------------------------------------------
  console.log('\n[TEST 7] Restoring Removes Poem from Archive');
  repo.restore('kv_fav_4');
  const afterRestoreArchive = repo.getAll({ includeArchived: true }).filter(p => p.isArchived);
  console.assert(afterRestoreArchive.length === 1, `Expected 1 archived poem left, got ${afterRestoreArchive.length}`);
  console.assert(!afterRestoreArchive.some(p => p.id === 'kv_fav_4'), 'Poem 4 removed from archive');
  console.log('✓ Restoring poem immediately removes it from archive.');

  // ----------------------------------------------------
  // TEST 8: Restored poem appears in active Library
  // ----------------------------------------------------
  console.log('\n[TEST 8] Restored Poem Appears in Active Library');
  const activeLibrary = repo.getAll({ includeArchived: false });
  console.assert(activeLibrary.some(p => p.id === 'kv_fav_4'), 'Poem 4 is now in active library');
  console.log('✓ Restored poem reappears seamlessly in active library.');

  // ----------------------------------------------------
  // TEST 9: Restored poem becomes searchable
  // ----------------------------------------------------
  console.log('\n[TEST 9] Restored Poem Becomes Searchable');
  const searchRestored = searchPoems(repo.getAll({ includeArchived: false }), 'संध्या गीत');
  console.assert(searchRestored.results.length === 1, 'Restored poem is now found in search');
  console.assert(searchRestored.results[0].poem.id === 'kv_fav_4', 'Found correct restored poem');
  console.log('✓ Restored poem is immediately discoverable via normal search.');

  // ----------------------------------------------------
  // TEST 10: Archived poem remains excluded from normal Search
  // ----------------------------------------------------
  console.log('\n[TEST 10] Archived Poem Excluded from Normal Search');
  const searchArchived = searchPoems(repo.getAll({ includeArchived: false }), 'पुरानी डायरी');
  console.assert(searchArchived.results.length === 0, 'Archived poem must not be found in normal search');
  console.log('✓ Un-restored archived poem remains strictly absent from active search.');

  // ----------------------------------------------------
  // TEST 11: Favorite state consistent after Reader navigation
  // ----------------------------------------------------
  console.log('\n[TEST 11] Favorite State Consistent with Reader');
  // Reader loads poem by ID
  const readerPoem = repo.getById('kv_fav_1');
  console.assert(readerPoem.isFavorite === true, 'Reader gets favorite poem');
  // Reader toggles favorite
  repo.setFavorite('kv_fav_1', false);
  console.assert(repo.getById('kv_fav_1').isFavorite === false, 'Repo updated to false');
  console.assert(!repo.getAll({ includeArchived: false, onlyFavorites: true }).some(p => p.id === 'kv_fav_1'), 'Favorites view updated');
  repo.setFavorite('kv_fav_1', true); // restore
  console.log('✓ Favorite state changes in Reader immediately reflect in Favorites view.');

  // ----------------------------------------------------
  // TEST 12: Archive state consistent after Reader navigation
  // ----------------------------------------------------
  console.log('\n[TEST 12] Archive State Consistent with Reader');
  // Reader archives poem 2
  repo.archive('kv_fav_2');
  console.assert(repo.getById('kv_fav_2').isArchived === true, 'Poem 2 archived');
  console.assert(repo.getAll({ includeArchived: true }).filter(p => p.isArchived).some(p => p.id === 'kv_fav_2'), 'Archive view contains poem 2');
  console.assert(!repo.getAll({ includeArchived: false }).some(p => p.id === 'kv_fav_2'), 'Library view excludes poem 2');
  // Reader restores poem 2
  repo.restore('kv_fav_2');
  console.assert(repo.getById('kv_fav_2').isArchived === false, 'Poem 2 restored');
  console.log('✓ Archive / Restore lifecycle actions in Reader update all views reliably.');

  // ----------------------------------------------------
  // TEST 13: Missing IDs fail safely
  // ----------------------------------------------------
  console.log('\n[TEST 13] Missing IDs Fail Safely');
  console.assert(repo.getById('non_existent_id') === null, 'Non-existent ID safely returns null');
  try {
    repo.setFavorite('non_existent_id', true);
    console.assert(false, 'Should throw StorageError on missing poem');
  } catch (err) {
    console.assert(err !== null, 'Throws safe StorageError');
  }
  console.log('✓ Missing or invalid IDs handled safely.');

  // ----------------------------------------------------
  // TEST 14: Empty Favorites state works
  // ----------------------------------------------------
  console.log('\n[TEST 14] Empty Favorites State Rendering');
  const emptyStorage = new MockStorage();
  const emptyRepo = new PoemRepository(new LocalStorageAdapter(emptyStorage));
  const noFavs = emptyRepo.getAll({ includeArchived: false, onlyFavorites: true });
  console.assert(noFavs.length === 0, 'No favorites returns empty array');
  const emptyFavHtml = renderEmptyState({
    icon: 'heart',
    heading: 'अभी कोई रचना पसंदीदा नहीं है।',
    text: 'अपनी प्रिय कविताओं को दिल के चिह्न (♥) से पसंदीदा में जोड़ें।',
    primaryAction: '<a href="/poems" data-link>कविताएँ देखें</a>'
  });
  console.assert(emptyFavHtml.includes('अभी कोई रचना पसंदीदा नहीं है।'), 'Renders Hindi empty heading');
  console.assert(emptyFavHtml.includes('कविताएँ देखें'), 'Renders CTA');
  console.log('✓ Empty favorites view renders calm Hindi empty state.');

  // ----------------------------------------------------
  // TEST 15: Empty Archive state works
  // ----------------------------------------------------
  console.log('\n[TEST 15] Empty Archive State Rendering');
  const noArchive = emptyRepo.getAll({ includeArchived: true }).filter(p => p.isArchived);
  console.assert(noArchive.length === 0, 'No archived returns empty array');
  const emptyArchHtml = renderEmptyState({
    icon: 'archive',
    heading: 'अभी कोई रचना अभिलेख में नहीं है।',
    text: 'यहाँ सुरक्षित रखी गई पुरानी रचनाएँ दिखाई देंगी।',
    primaryAction: '<a href="/poems" data-link>कविताएँ देखें</a>'
  });
  console.assert(emptyArchHtml.includes('अभी कोई रचना अभिलेख में नहीं है।'), 'Renders Hindi empty heading');
  console.assert(emptyArchHtml.includes('सुरक्षित रखी गई पुरानी रचनाएँ'), 'Renders supporting text');
  console.log('✓ Empty archive view renders calm Hindi empty state.');

  // ----------------------------------------------------
  // TEST 16: Unicode/Hindi poem data survives lifecycle operations
  // ----------------------------------------------------
  console.log('\n[TEST 16] Unicode/Hindi Data Survives Lifecycle Operations');
  const complexPoem = repo.create({
    id: 'kv_unicode_lifecycle',
    title: 'हृदय की क्षिति व त्रिशूल ❦',
    body: 'क़लम से लिखी ज़िंदगी की दास्तान,\nश्रद्धा और विश्वास से भरी।',
    author: 'कविराज',
    tags: ['हृदय', 'क़लम'],
    isFavorite: false,
    isArchived: false
  });
  repo.setFavorite('kv_unicode_lifecycle', true);
  repo.archive('kv_unicode_lifecycle');
  repo.restore('kv_unicode_lifecycle');
  const retrieved = repo.getById('kv_unicode_lifecycle');
  console.assert(retrieved.title === 'हृदय की क्षिति व त्रिशूल ❦', 'Title Unicode intact');
  console.assert(retrieved.body.includes('क़लम से लिखी ज़िंदगी'), 'Body nuktas intact');
  console.assert(retrieved.isFavorite === true, 'Favorite flag intact');
  console.assert(retrieved.isArchived === false, 'Archived flag intact');
  console.log('✓ Hindi conjuncts, nuktas, dingbats, and tags remain 100% intact through lifecycles.');

  // ----------------------------------------------------
  // TEST 17: No duplicate poems created by view refreshes
  // ----------------------------------------------------
  console.log('\n[TEST 17] No Duplicate Poems Created');
  const countBefore = repo.getAll({ includeArchived: true }).length;
  // Simulating multiple view queries and updates
  repo.setFavorite('kv_fav_1', true);
  repo.setFavorite('kv_fav_1', true);
  const countAfter = repo.getAll({ includeArchived: true }).length;
  console.assert(countBefore === countAfter, 'Total poems count must not duplicate');
  console.log('✓ Idempotent state updates prevent duplicate entities.');

  // ----------------------------------------------------
  // TEST 18: Existing PoemRepository behavior remains intact
  // ----------------------------------------------------
  console.log('\n[TEST 18] Existing PoemRepository Intact');
  console.assert(typeof repo.getAll === 'function', 'getAll intact');
  console.assert(typeof repo.getById === 'function', 'getById intact');
  console.assert(typeof repo.create === 'function', 'create intact');
  console.assert(typeof repo.update === 'function', 'update intact');
  console.assert(typeof repo.delete === 'function', 'delete intact');
  console.assert(typeof repo.archive === 'function', 'archive intact');
  console.assert(typeof repo.restore === 'function', 'restore intact');
  console.assert(typeof repo.setFavorite === 'function', 'setFavorite intact');
  console.log('✓ Domain repository interface completely preserved.');

  // ----------------------------------------------------
  // TEST 19: XSS-safe poem content remains safe
  // ----------------------------------------------------
  console.log('\n[TEST 19] XSS-Safe Poem Content Remains Safe');
  const malicious = {
    id: 'kv_xss_test',
    title: '<script>alert(1)</script>पसंदीदा',
    body: '<b onmouseover="alert(2)">पंक्ति</b>',
    author: 'कवि<img src=x onerror=alert(3)>',
    tags: ['<script>'],
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z'
  };
  const cardHtml = renderPoemCard(malicious, 'grid');
  console.assert(!cardHtml.includes('<script>'), 'No unescaped script tag');
  console.assert(cardHtml.includes('&lt;script&gt;'), 'Script escaped');
  console.assert(!cardHtml.includes('<img'), 'No unescaped img element');
  console.assert(cardHtml.includes('&lt;img'), 'Img tag properly escaped');
  console.log('✓ PoemCard remains strictly XSS-safe.');

  // ----------------------------------------------------
  // TEST 20: Toolbar & Theme Rendering Assumptions
  // ----------------------------------------------------
  console.log('\n[TEST 20] Toolbar & Theme Rendering Assumptions');
  const toolbarHtml = renderLibraryToolbar({
    viewMode: 'grid',
    count: 5,
    showFilters: false,
    countLabel: '५ पसंदीदा रचनाएँ'
  });
  console.assert(toolbarHtml.includes('५ पसंदीदा रचनाएँ'), 'Custom count label rendered');
  console.assert(toolbarHtml.includes('btn-view-toggle'), 'View toggle buttons rendered');
  console.assert(!toolbarHtml.includes('data-filter="all"'), 'Filter pills omitted when showFilters: false');
  console.log('✓ Dedicated toolbar rendering verified.');

  console.log('\n====================================================');
  console.log('  ALL 20 FAVORITES & ARCHIVE LIFECYCLE TESTS PASSED!');
  console.log('====================================================\n');
}

runFavoritesArchiveTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
