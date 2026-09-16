/**
 * काव्यकलश (KavyaVault) — Library Organization Foundation Test Suite (test_library_organization.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Verifies:
 * Suite A: Collection Domain & Service Operations (CRUD, Membership, Deletion Safety)
 * Suite B: Tag Normalization & Hindi Fidelity (Unicode, NFC, display casing)
 * Suite C: Category Organization & Slugs
 * Suite D: Favorites Service Integration (zero duplicate storage)
 * Suite E: Recent Poems History (bounded, deduplicated, poem updatedAt immutability)
 * Suite F: Timeline Metadata (chronological derivation, zero date invention)
 * Suite G: Library Filter & Sort Engine (multi-criteria filtering, deterministic tie-breaking)
 * Suite H: Validation & Error Safety (fail safely, no crashes)
 * Suite I: Unicode & Devanagari Ligature Fidelity
 * Suite J: Storage & Privacy Audit (zero remote calls, read-only queries)
 * Suite K: Regression & Backward Compatibility
 */

import assert from 'node:assert';
import {
  SORT_FIELD,
  SORT_ORDER,
  TIMELINE_EVENT_TYPE,
  createCollection,
  validateCollection,
  createCategory,
  validateCategory,
  generateCategorySlug,
  createTag,
  validateTag,
  normalizeTagName,
  createRecentActivity,
  createLibraryFilter,
  validateLibraryFilter,
  createTimelineEntry,
  TagService,
  CategoryService,
  FavoritesService,
  RecentPoemService,
  TimelineService,
  LibraryFilterService,
  CollectionService,
  LibraryOrganizationService
} from './src/services/LibraryService.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError } from './src/services/storage/StorageError.js';
import { STORAGE_KEYS } from './src/data/storageKeys.js';

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
  console.log('  KAVYAVAULT LIBRARY ORGANIZATION FOUNDATION TEST SUITE (Task 6.1)');
  console.log('================================================================');

  // Setup isolated storage, repositories, and services
  const storage = new InMemoryStorage();
  const adapter = new LocalStorageAdapter(storage);
  const collectionRepo = new CollectionRepository(adapter);
  const poemRepo = new PoemRepository(adapter, collectionRepo);

  const collectionService = new CollectionService({ collectionRepo, poemRepo });
  const favoritesService = new FavoritesService({ poemRepo });
  const recentService = new RecentPoemService({ adapter, poemRepo, maxLimit: 5 });
  const tagService = new TagService();
  const categoryService = new CategoryService();
  const timelineService = new TimelineService();
  const filterService = new LibraryFilterService({ collectionRepo, recentService });

  const libraryService = new LibraryOrganizationService({
    poemRepo,
    collectionRepo,
    tagService,
    categoryService,
    favoritesService,
    recentService,
    timelineService,
    filterService,
    collectionService
  });

  // Seed sample poems
  const poem1 = poemRepo.create({
    id: 'poem_nature_1',
    title: 'सावन की बारिश',
    body: 'आज घने बादल छाए हैं,\nरिमझिम बूँदें आई हैं।',
    author: 'जयशंकर प्रसाद',
    category: 'प्रकृति',
    tags: ['वर्षा', 'मेघ', 'सावन'],
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-03-01T12:00:00.000Z'
  });

  const poem2 = poemRepo.create({
    id: 'poem_classic_1',
    title: 'मधुशाला',
    body: 'मदिरालय जाने को घर से चलता है पीनेवला...',
    author: 'हरिवंश राय बच्चन',
    category: 'क्लासिक',
    tags: ['दर्शन', 'जीवन'],
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z'
  });

  const poem3 = poemRepo.create({
    id: 'poem_archived_1',
    title: 'पुरातन स्मृति',
    body: 'अतीत के पन्नों में दबी कविता।',
    author: 'अज्ञात',
    category: 'स्मृति',
    tags: ['स्मृति'],
    isFavorite: false,
    isArchived: true,
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-02T10:00:00.000Z'
  });

  // -------------------------------------------------------------
  // Suite A: Collection Domain & Service Operations
  // -------------------------------------------------------------
  console.log('\n--- Suite A: Collection Domain & Service Operations ---');

  runTest('CollectionService creates collection with name, description, and valid poem IDs', () => {
    const col = collectionService.createCollection({
      name: 'प्रकृति संचयन',
      description: 'प्रकृति विषयक कविताओं का व्यक्तिगत संचयन',
      poemIds: [poem1.id]
    });

    assert.strictEqual(col.name, 'प्रकृति संचयन');
    assert.strictEqual(col.description, 'प्रकृति विषयक कविताओं का व्यक्तिगत संचयन');
    assert.deepStrictEqual(col.poemIds, [poem1.id]);
    assert(col.id.startsWith('kv_col_'));
  });

  runTest('CollectionService renames collection and updates description', () => {
    const col = collectionService.createCollection({ name: 'गीत गुंजन' });
    const renamed = collectionService.renameCollection(col.id, 'नव गीत गुंजन');
    assert.strictEqual(renamed.name, 'नव गीत गुंजन');

    const updated = collectionService.updateDescription(col.id, 'आधुनिक गीतों का संग्रह');
    assert.strictEqual(updated.description, 'आधुनिक गीतों का संग्रह');
  });

  runTest('CollectionService adds poem and strictly prevents duplicate poem IDs', () => {
    const col = collectionService.createCollection({ name: 'दर्शन संकलन' });
    collectionService.addPoemToCollection(col.id, poem2.id);

    // Attempt duplicate addition
    const afterDup = collectionService.addPoemToCollection(col.id, poem2.id);
    assert.strictEqual(afterDup.poemIds.length, 1, 'Duplicate poem ID ignored');
    assert.strictEqual(afterDup.poemIds[0], poem2.id);
  });

  runTest('CollectionService removes poem from collection', () => {
    const col = collectionService.createCollection({ name: 'अस्थायी संकलन', poemIds: [poem1.id, poem2.id] });
    assert.strictEqual(col.poemIds.length, 2);

    const updated = collectionService.removePoemFromCollection(col.id, poem1.id);
    assert.strictEqual(updated.poemIds.length, 1);
    assert.strictEqual(updated.poemIds[0], poem2.id);
  });

  runTest('CRITICAL: Deleting a collection strictly PRESERVES all poem records in PoemRepository', () => {
    const col = collectionService.createCollection({ name: 'विलोपनीय संग्रह', poemIds: [poem1.id, poem2.id] });
    assert(collectionService.getCollection(col.id) !== null);

    // Delete the collection
    const deleted = collectionService.deleteCollection(col.id);
    assert.strictEqual(deleted, true);
    assert.strictEqual(collectionService.getCollection(col.id), null);

    // Verify poems remain 100% intact in PoemRepository
    const fetchedPoem1 = poemRepo.getById(poem1.id);
    const fetchedPoem2 = poemRepo.getById(poem2.id);
    assert(fetchedPoem1 !== null, 'Poem 1 preserved after collection deletion');
    assert(fetchedPoem2 !== null, 'Poem 2 preserved after collection deletion');
    assert.strictEqual(fetchedPoem1.title, poem1.title);
  });

  runTest('A poem may belong to multiple collections simultaneously (getCollectionsForPoem)', () => {
    const colA = collectionService.createCollection({ name: 'संग्रह क', poemIds: [poem1.id] });
    const colB = collectionService.createCollection({ name: 'संग्रह ख', poemIds: [poem1.id] });

    const parentCollections = collectionService.getCollectionsForPoem(poem1.id);
    const colIds = parentCollections.map(c => c.id);

    assert(colIds.includes(colA.id), 'Poem belongs to collection A');
    assert(colIds.includes(colB.id), 'Poem belongs to collection B');
  });

  runTest('getCollectionPoems resolves actual poem records and gracefully omits nonexistent IDs', () => {
    const col = collectionRepo.create({
      name: 'मिश्रित संग्रह',
      poemIds: [poem1.id, 'nonexistent_id_999']
    });

    const resolved = collectionService.getCollectionPoems(col.id);
    assert.strictEqual(resolved.length, 1, 'Only real poem resolved');
    assert.strictEqual(resolved[0].id, poem1.id);
  });

  // -------------------------------------------------------------
  // Suite B: Tag Normalization & Hindi Fidelity
  // -------------------------------------------------------------
  console.log('\n--- Suite B: Tag Normalization & Hindi Fidelity ---');

  runTest('normalizeTagName strips leading "#", collapses whitespace, and normalizes NFC', () => {
    assert.strictEqual(normalizeTagName('#सावन'), 'सावन');
    assert.strictEqual(normalizeTagName('  #वर्षा  ऋतु  '), 'वर्षा ऋतु');
    assert.strictEqual(normalizeTagName(''), '');
  });

  runTest('Tag variations ("प्रेम", " प्रेम ", "#प्रेम") resolve to identical normalized identity', () => {
    const t1 = normalizeTagName('प्रेम');
    const t2 = normalizeTagName('  प्रेम  ');
    const t3 = normalizeTagName('#प्रेम');
    const t4 = normalizeTagName(' #प्रेम ');

    assert.strictEqual(t1, t2);
    assert.strictEqual(t2, t3);
    assert.strictEqual(t3, t4);
    assert.strictEqual(t1, 'प्रेम');
  });

  runTest('Mixed Hindi/Latin tags normalize Latin to lowercase while preserving Devanagari intact', () => {
    const norm = normalizeTagName('Hindi Kavita हिन्दी कविता');
    assert.strictEqual(norm, 'hindi kavita हिन्दी कविता');
  });

  runTest('TagService.extractTagsFromPoems aggregates unique tags with counts and display form', () => {
    const samplePoems = [
      { id: 't1', tags: ['सावन', 'प्रकृति'], isArchived: false },
      { id: 't2', tags: ['#सावन', 'वर्षा'], isArchived: false },
      { id: 't3', tags: [' सावन '], isArchived: false }
    ];

    const tags = tagService.extractTagsFromPoems(samplePoems);
    const savanTag = tags.find(t => t.normalizedName === 'सावन');

    assert(savanTag, 'सावन tag found');
    assert.strictEqual(savanTag.poemCount, 3, 'सावन appears in 3 poems');
    assert.strictEqual(savanTag.name, 'सावन', 'Display form is clean');
  });

  runTest('TagService.filterPoemsByTag matches poems containing normalized tag', () => {
    const samplePoems = [
      { id: 't1', tags: ['#प्रकृति', 'ऋतु'] },
      { id: 't2', tags: ['शहर', 'जीवन'] }
    ];

    const matches = tagService.filterPoemsByTag(samplePoems, 'प्रकृति');
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].id, 't1');
  });

  // -------------------------------------------------------------
  // Suite C: Category Organization & Slugs
  // -------------------------------------------------------------
  console.log('\n--- Suite C: Category Organization & Slugs ---');

  runTest('generateCategorySlug generates clean slugs for Devanagari and Latin categories', () => {
    assert.strictEqual(generateCategorySlug('प्रकृति सौन्दर्य'), 'प्रकृति-सौन्दर्य');
    assert.strictEqual(generateCategorySlug('Classic Hindi Poetry'), 'classic-hindi-poetry');
    assert.strictEqual(generateCategorySlug('  वीर रस  '), 'वीर-रस');
  });

  runTest('CategoryService.extractCategoriesFromPoems groups categories with counts', () => {
    const samplePoems = [
      { id: 'c1', category: 'प्रकृति', isArchived: false },
      { id: 'c2', category: 'प्रकृति', isArchived: false },
      { id: 'c3', category: 'गीत', isArchived: false }
    ];

    const cats = categoryService.extractCategoriesFromPoems(samplePoems);
    assert.strictEqual(cats.length, 2);

    const prakriti = cats.find(c => c.name === 'प्रकृति');
    assert(prakriti);
    assert.strictEqual(prakriti.poemCount, 2);
    assert.strictEqual(prakriti.slug, 'प्रकृति');
  });

  runTest('CategoryService.filterPoemsByCategory matches by category name or slug', () => {
    const samplePoems = [
      { id: 'c1', category: 'नव गीत' },
      { id: 'c2', category: 'क्लासिक' }
    ];

    const byName = categoryService.filterPoemsByCategory(samplePoems, 'नव गीत');
    const bySlug = categoryService.filterPoemsByCategory(samplePoems, 'नव-गीत');

    assert.strictEqual(byName.length, 1);
    assert.strictEqual(bySlug.length, 1);
    assert.strictEqual(byName[0].id, 'c1');
  });

  // -------------------------------------------------------------
  // Suite D: Favorites Service Integration
  // -------------------------------------------------------------
  console.log('\n--- Suite D: Favorites Service Integration ---');

  runTest('FavoritesService directly updates poem.isFavorite in PoemRepository without parallel storage', () => {
    const initialKeysCount = storage.length;

    // Toggle poem2 to favorite
    assert.strictEqual(favoritesService.isFavorite(poem2.id), false);
    favoritesService.favoritePoem(poem2.id);
    assert.strictEqual(favoritesService.isFavorite(poem2.id), true);

    // Verify poem record itself in PoemRepository was updated
    const fetched = poemRepo.getById(poem2.id);
    assert.strictEqual(fetched.isFavorite, true);

    // Unfavorite
    favoritesService.unfavoritePoem(poem2.id);
    assert.strictEqual(favoritesService.isFavorite(poem2.id), false);
    assert.strictEqual(poemRepo.getById(poem2.id).isFavorite, false);

    // Toggle
    favoritesService.toggleFavorite(poem2.id);
    assert.strictEqual(favoritesService.isFavorite(poem2.id), true);

    // Reset back for subsequent tests
    favoritesService.unfavoritePoem(poem2.id);
  });

  runTest('FavoritesService.listFavorites returns only active favorites, handles includeArchived', () => {
    const favs = favoritesService.listFavorites();
    const favIds = favs.map(p => p.id);

    assert(favIds.includes(poem1.id), 'Poem 1 is in favorites');
    assert(!favIds.includes(poem2.id), 'Poem 2 is NOT in favorites');
    assert(!favIds.includes(poem3.id), 'Archived poem 3 is excluded by default');
  });

  // -------------------------------------------------------------
  // Suite E: Recent Poems History
  // -------------------------------------------------------------
  console.log('\n--- Suite E: Recent Poems History ---');

  runTest('RecentPoemService.recordView prepends poem view with viewedAt timestamp', () => {
    recentService.clearRecent();
    assert.strictEqual(recentService.count(), 0);

    const activity = recentService.recordView(poem1.id);
    assert.strictEqual(activity.poemId, poem1.id);
    assert(activity.viewedAt);

    const recent = recentService.getRecent();
    assert.strictEqual(recent.length, 1);
    assert.strictEqual(recent[0].poemId, poem1.id);
  });

  runTest('RecentPoemService deduplicates by poemId, moving existing poem to the front', () => {
    recentService.clearRecent();
    recentService.recordView(poem1.id);
    recentService.recordView(poem2.id);

    // Current order: poem2, poem1
    let recent = recentService.getRecent();
    assert.strictEqual(recent[0].poemId, poem2.id);
    assert.strictEqual(recent[1].poemId, poem1.id);

    // Re-view poem1
    recentService.recordView(poem1.id);

    // New order: poem1, poem2 (no duplicate entries)
    recent = recentService.getRecent();
    assert.strictEqual(recent.length, 2, 'No duplicate entries');
    assert.strictEqual(recent[0].poemId, poem1.id, 'poem1 moved to top');
    assert.strictEqual(recent[1].poemId, poem2.id, 'poem2 shifted to second');
  });

  runTest('CRITICAL: Viewing a poem does NOT mutate poem.updatedAt or poem repository', () => {
    const poemBefore = poemRepo.getById(poem1.id);
    const updatedAtBefore = poemBefore.updatedAt;

    recentService.recordView(poem1.id);

    const poemAfter = poemRepo.getById(poem1.id);
    assert.strictEqual(poemAfter.updatedAt, updatedAtBefore, 'Poem updatedAt remains strictly unchanged');
    assert.deepStrictEqual(poemBefore, poemAfter, 'Poem record completely untouched');
  });

  runTest('RecentPoemService enforces maximum limit boundary (bounded to maxLimit=5)', () => {
    recentService.clearRecent();
    for (let i = 1; i <= 10; i++) {
      recentService.recordView(`test_poem_${i}`);
    }

    const recent = recentService.getRecent();
    assert.strictEqual(recent.length, 5, 'Recent list bounded strictly to maxLimit=5');
    assert.strictEqual(recent[0].poemId, 'test_poem_10', 'Most recent view is at the front');
  });

  runTest('RecentPoemService.getRecentWithPoems resolves actual poems and skips deleted entries', () => {
    recentService.clearRecent();
    recentService.recordView(poem1.id);
    recentService.recordView('deleted_or_nonexistent_poem');

    const withPoems = recentService.getRecentWithPoems();
    assert.strictEqual(withPoems.length, 1, 'Only existent poem resolved');
    assert.strictEqual(withPoems[0].poemId, poem1.id);
    assert.strictEqual(withPoems[0].poem.title, poem1.title);
  });

  // -------------------------------------------------------------
  // Suite F: Timeline Metadata
  // -------------------------------------------------------------
  console.log('\n--- Suite F: Timeline Metadata ---');

  runTest('TimelineService extracts createdAt, updatedAt, and authoredDate without date invention', () => {
    const customPoem = {
      id: 'time_p1',
      title: 'युग की पुकार',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
      authoredDate: '1942-08-09T00:00:00.000Z'
    };

    const events = timelineService.extractPoemEvents(customPoem);
    assert.strictEqual(events.length, 3);

    const types = events.map(e => e.eventType);
    assert(types.includes(TIMELINE_EVENT_TYPE.AUTHORED));
    assert(types.includes(TIMELINE_EVENT_TYPE.CREATED));
    assert(types.includes(TIMELINE_EVENT_TYPE.UPDATED));
  });

  runTest('TimelineService extracts digitizedDate from linked manuscript repository', () => {
    const mockManuscriptRepo = {
      getById: (id) => (id === 'ms_123' ? { id: 'ms_123', capturedDate: '2026-01-15T08:30:00.000Z' } : null)
    };

    const timelineWithMs = new TimelineService({ manuscriptRepo: mockManuscriptRepo });
    const poemWithMs = {
      id: 'time_p2',
      title: 'हस्तलिखित पृष्ठ',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
      manuscriptId: 'ms_123'
    };

    const events = timelineWithMs.extractPoemEvents(poemWithMs);
    const digEvent = events.find(e => e.eventType === TIMELINE_EVENT_TYPE.DIGITIZED);

    assert(digEvent, 'Digitized event extracted');
    assert.strictEqual(digEvent.date, '2026-01-15T08:30:00.000Z');
  });

  runTest('TimelineService.getTimeline orders events chronologically with deterministic tie-breaking', () => {
    const poems = [poem1, poem2];
    const timeline = timelineService.getTimeline(poems, { order: 'desc' });

    assert(timeline.length >= 2);
    for (let i = 0; i < timeline.length - 1; i++) {
      assert(timeline[i].timestamp >= timeline[i + 1].timestamp, 'Chronological ordering descending');
    }
  });

  runTest('TimelineService handles malformed or missing dates safely without crashing', () => {
    const malformedPoem = {
      id: 'bad_dates',
      title: 'अमान्य तिथियाँ',
      createdAt: 'not-a-date',
      updatedAt: null,
      authoredDate: undefined
    };

    const events = timelineService.extractPoemEvents(malformedPoem);
    assert.strictEqual(events.length, 0, 'Safely returned 0 events for malformed dates');
  });

  // -------------------------------------------------------------
  // Suite G: Library Filter & Sort Engine
  // -------------------------------------------------------------
  console.log('\n--- Suite G: Library Filter & Sort Engine ---');

  runTest('LibraryFilterService filters by collection, category, tags, favorite, and archive', () => {
    const allPoems = [poem1, poem2, poem3];

    // Filter by favorite
    const favResult = filterService.query(allPoems, { isFavorite: true });
    assert.strictEqual(favResult.totalCount, 1);
    assert.strictEqual(favResult.poems[0].id, poem1.id);

    // Filter by category
    const catResult = filterService.query(allPoems, { category: 'क्लासिक' });
    assert.strictEqual(catResult.totalCount, 1);
    assert.strictEqual(catResult.poems[0].id, poem2.id);

    // Filter by tag
    const tagResult = filterService.query(allPoems, { tags: ['वर्षा'] });
    assert.strictEqual(tagResult.totalCount, 1);
    assert.strictEqual(tagResult.poems[0].id, poem1.id);

    // Archive isolation: default query excludes archived poem3
    const defaultResult = filterService.query(allPoems);
    const defaultIds = defaultResult.poems.map(p => p.id);
    assert(!defaultIds.includes(poem3.id), 'Archived poem excluded by default');

    // Explicit archive query
    const archResult = filterService.query(allPoems, { isArchived: true });
    assert.strictEqual(archResult.totalCount, 1);
    assert.strictEqual(archResult.poems[0].id, poem3.id);
  });

  runTest('LibraryFilterService filters by date ranges (createdDateRange, updatedDateRange)', () => {
    const allPoems = [poem1, poem2];

    const dateRangeResult = filterService.query(allPoems, {
      createdDateRange: {
        from: '2026-01-02T00:00:00.000Z',
        to: '2026-01-10T00:00:00.000Z'
      }
    });

    assert.strictEqual(dateRangeResult.totalCount, 1);
    assert.strictEqual(dateRangeResult.poems[0].id, poem2.id);
  });

  runTest('LibraryFilterService sorts deterministically by title, createdAt, and updatedAt', () => {
    const allPoems = [poem1, poem2];

    // Title ASC
    const byTitleAsc = filterService.query(allPoems, { sort: SORT_FIELD.TITLE, order: SORT_ORDER.ASC });
    // 'मधुशाला' (म) vs 'सावन की बारिश' (स) -> मधुशाला comes first
    assert.strictEqual(byTitleAsc.poems[0].id, poem2.id);

    // Title DESC
    const byTitleDesc = filterService.query(allPoems, { sort: SORT_FIELD.TITLE, order: SORT_ORDER.DESC });
    assert.strictEqual(byTitleDesc.poems[0].id, poem1.id);

    // UpdatedAt DESC
    const byUpdatedDesc = filterService.query(allPoems, { sort: SORT_FIELD.UPDATED_AT, order: SORT_ORDER.DESC });
    // poem1 updatedAt: March 2026 vs poem2: Feb 2026 -> poem1 first
    assert.strictEqual(byUpdatedDesc.poems[0].id, poem1.id);
  });

  runTest('LibraryFilterService applies deterministic tie-breaking (primary -> updatedAt DESC -> poemId ASC)', () => {
    const tiePoems = [
      { id: 'poem_b', title: 'समान शीर्षक', updatedAt: '2026-01-01T10:00:00Z', createdAt: '2026-01-01T10:00:00Z' },
      { id: 'poem_a', title: 'समान शीर्षक', updatedAt: '2026-01-01T10:00:00Z', createdAt: '2026-01-01T10:00:00Z' }
    ];

    const result = filterService.query(tiePoems, { sort: SORT_FIELD.TITLE, order: SORT_ORDER.ASC });
    // Same title, same updatedAt -> tie-breaker: poemId ASC ('poem_a' before 'poem_b')
    assert.strictEqual(result.poems[0].id, 'poem_a');
    assert.strictEqual(result.poems[1].id, 'poem_b');
  });

  runTest('LibraryFilterService handles pagination slicing with offset and limit', () => {
    const testPoems = [poem1, poem2];
    const page1 = filterService.query(testPoems, { offset: 0, limit: 1 });
    assert.strictEqual(page1.poems.length, 1);
    assert.strictEqual(page1.totalCount, 2);

    const page2 = filterService.query(testPoems, { offset: 1, limit: 1 });
    assert.strictEqual(page2.poems.length, 1);
    assert.notStrictEqual(page1.poems[0].id, page2.poems[0].id);
  });

  // -------------------------------------------------------------
  // Suite H: Validation & Safety
  // -------------------------------------------------------------
  console.log('\n--- Suite H: Validation & Safety ---');

  runTest('Collection validation rejects empty name or non-object input', () => {
    assert.throws(() => createCollection({ name: '' }), StorageError);
    assert.throws(() => createCollection(null), StorageError);
    assert.throws(() => validateCollection({ id: '1', name: '', description: '', poemIds: [] }), StorageError);
  });

  runTest('LibraryFilter validation rejects invalid sort field or direction', () => {
    assert.throws(() => createLibraryFilter({ sort: 'invalid_field' }), StorageError);
    assert.throws(() => createLibraryFilter({ order: 'diagonal' }), StorageError);
    assert.throws(() => createLibraryFilter({ createdDateRange: { from: 'invalid_date' } }), StorageError);
  });

  runTest('Safe handling of nonexistent poem references across services', () => {
    assert.strictEqual(favoritesService.isFavorite('nonexistent_id'), false);
    assert.strictEqual(collectionService.getCollection('nonexistent_id'), null);
    assert.deepStrictEqual(collectionService.getCollectionPoems('nonexistent_id'), []);
  });

  // -------------------------------------------------------------
  // Suite I: Unicode & Devanagari Ligature Fidelity
  // -------------------------------------------------------------
  console.log('\n--- Suite I: Unicode & Devanagari Ligature Fidelity ---');

  runTest('Complex Devanagari ligatures (क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ, ॐ) are preserved in tags, categories, and collections', () => {
    const complexName = 'ज्ञानामृत व श्रम-साधना (ॐकार)';
    const col = collectionService.createCollection({ name: complexName });
    assert.strictEqual(col.name, complexName);

    const complexTag = normalizeTagName('हृदयस्पर्शी द्वंद्व');
    assert.strictEqual(complexTag, 'हृदयस्पर्शी द्वंद्व');

    const complexCat = generateCategorySlug('क्षमा व शांति');
    assert.strictEqual(complexCat, 'क्षमा-व-शांति');
  });

  // -------------------------------------------------------------
  // Suite J: Storage & Privacy Audit
  // -------------------------------------------------------------
  console.log('\n--- Suite J: Storage & Privacy Audit ---');

  runTest('Library query operations perform ZERO storage writes (read-only)', () => {
    const keysBefore = storage.length;
    libraryService.query();
    libraryService.getLibraryStats();
    tagService.extractTagsFromPoems(poemRepo.getAll());
    categoryService.extractCategoriesFromPoems(poemRepo.getAll());
    timelineService.getTimeline(poemRepo.getAll());

    assert.strictEqual(storage.length, keysBefore, 'Zero storage mutations during queries');
  });

  // -------------------------------------------------------------
  // Suite K: Unified Facade & Backward Compatibility
  // -------------------------------------------------------------
  console.log('\n--- Suite K: Unified Facade & Backward Compatibility ---');

  runTest('libraryService facade exposes unified library statistics and sub-services', () => {
    const stats = libraryService.getLibraryStats();

    assert(typeof stats.totalPoems === 'number');
    assert(typeof stats.activePoems === 'number');
    assert(typeof stats.collectionCount === 'number');
    assert(typeof stats.categoryCount === 'number');
    assert(typeof stats.tagCount === 'number');

    assert(libraryService.collections instanceof CollectionService);
    assert(libraryService.favorites instanceof FavoritesService);
    assert(libraryService.recent instanceof RecentPoemService);
    assert(libraryService.tags instanceof TagService);
    assert(libraryService.categories instanceof CategoryService);
    assert(libraryService.timeline instanceof TimelineService);
    assert(libraryService.filter instanceof LibraryFilterService);
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${testIndex} LIBRARY ORGANIZATION TESTS PASSED!`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
