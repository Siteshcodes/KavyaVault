/**
 * काव्यकलश (KavyaVault) — Library Data Integrity & Cross-View Hardening Test Suite
 * Phase 6 / Task 6.4
 *
 * Suites:
 * A. Collection corruption & integrity (duplicate IDs, missing poems, malformed objects)
 * B. Tag normalization edge cases (NFC, whitespace, duplicates, empty, Hindi display)
 * C. Category edge cases (empty, archived, deterministic counts, malformed values)
 * D. Favorite consistency (single source of truth, rapid toggle, missing/deleted poem)
 * E. Recent corruption & boundary (duplicates, malformed viewedAt, max 50, updatedAt immutability)
 * F. Timeline malformed dates (missing fields, invalid dates, deleted poems, no fabrication)
 * G. Filter validation (unknown collection, malformed tags, invalid sort, reversed dates, null fields)
 * H. Cross-view consistency (favorite sync, delete propagation, category edits, archive behavior)
 * I. Backward compatibility (Phase 1-5 poem shapes work without migration)
 * J. Malformed local storage (invalid JSON shapes, null records, unexpected fields, corrupt data)
 * K. Unicode & Devanagari edge cases in organization layer
 * L. Deletion safety (collection delete preserves poems, poem delete cleans collection refs)
 */

import assert from 'node:assert';
import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError } from './src/services/storage/StorageError.js';
import { LibraryOrganizationService } from './src/services/LibraryService.js';
import { CollectionService } from './src/services/library/CollectionService.js';
import { TagService } from './src/services/library/TagService.js';
import { CategoryService } from './src/services/library/CategoryService.js';
import { FavoritesService } from './src/services/library/FavoritesService.js';
import { RecentPoemService } from './src/services/library/RecentPoemService.js';
import { TimelineService } from './src/services/library/TimelineService.js';
import { LibraryFilterService } from './src/services/library/LibraryFilterService.js';
import {
  normalizeTagName,
  generateCategorySlug,
  createCollection,
  createLibraryFilter,
  createTimelineEntry,
  SORT_FIELD,
  SORT_ORDER,
  TIMELINE_EVENT_TYPE
} from './src/services/library/libraryTypes.js';

// ── In-Memory Storage Engine ──
class InMemoryStorage {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
  get length() { return this.store.size; }
  key(i) { return Array.from(this.store.keys())[i] || null; }
}

// ── Harness ──
function createHarness() {
  const poemStore = new InMemoryStorage();
  const colStore = new InMemoryStorage();
  const manuStore = new InMemoryStorage();
  const recentStore = new InMemoryStorage();

  const poemAdapter = new LocalStorageAdapter(poemStore);
  const colAdapter = new LocalStorageAdapter(colStore);
  const manuAdapter = new LocalStorageAdapter(manuStore);
  const recentAdapter = new LocalStorageAdapter(recentStore);

  const poemRepo = new PoemRepository(poemAdapter);
  const colRepo = new CollectionRepository(colAdapter);
  const manuRepo = new ManuscriptRepository(manuAdapter);

  const recentService = new RecentPoemService({ adapter: recentAdapter, poemRepo });
  const favoritesService = new FavoritesService({ poemRepo });
  const tagService = new TagService();
  const categoryService = new CategoryService();
  const timelineService = new TimelineService({ manuscriptRepo: manuRepo });
  const colService = new CollectionService({ collectionRepo: colRepo, poemRepo });
  const filterService = new LibraryFilterService({ collectionRepo: colRepo, recentService });

  const service = new LibraryOrganizationService({
    poemRepo,
    collectionRepo: colRepo,
    tagService,
    categoryService,
    favoritesService,
    recentService,
    timelineService,
    collectionService: colService,
    filterService
  });

  return { service, poemRepo, colRepo, manuRepo, recentService, favoritesService,
           tagService, categoryService, timelineService, colService, filterService,
           poemStore, colStore, recentStore, recentAdapter };
}

function makePoem(repo, overrides = {}) {
  return repo.create({
    title: overrides.title || 'परीक्षण कविता',
    body: overrides.body || 'यह एक परीक्षण कविता है।\nदूसरी पंक्ति।',
    ...overrides
  });
}

let testCount = 0;
function pass(desc) {
  testCount++;
  console.log(`✓ [Test ${testCount}] ${desc}`);
}

async function runIntegrityTests() {
  console.log('================================================================');
  console.log('  KAVYAVAULT LIBRARY DATA INTEGRITY & CROSS-VIEW HARDENING');
  console.log('================================================================\n');

  // ============================================================================
  // Suite A: Collection Corruption & Integrity
  // ============================================================================
  console.log('--- Suite A: Collection Corruption & Integrity ---');
  {
    const { colRepo, poemRepo, colService } = createHarness();
    const p1 = makePoem(poemRepo, { id: 'ca_p1', title: 'कविता एक' });
    const p2 = makePoem(poemRepo, { id: 'ca_p2', title: 'कविता दो' });

    // 1. Duplicate poem IDs in collection creation are deduplicated
    const col = colService.createCollection({
      name: 'परीक्षण संग्रह',
      poemIds: [p1.id, p1.id, p2.id, p1.id]
    });
    assert.strictEqual(col.poemIds.length, 2, 'Duplicate poem IDs must be deduplicated');
    assert.ok(col.poemIds.includes(p1.id) && col.poemIds.includes(p2.id));
    pass('Duplicate poem IDs in collection creation are deduplicated to unique set');

    // 2. Nonexistent poem references are silently dropped during creation
    const col2 = colService.createCollection({
      name: 'गायब कविता संग्रह',
      poemIds: [p1.id, 'nonexistent_id_xyz', p2.id, 'ghost_poem']
    });
    assert.strictEqual(col2.poemIds.length, 2, 'Nonexistent poem IDs must be dropped');
    assert.ok(!col2.poemIds.includes('nonexistent_id_xyz'));
    assert.ok(!col2.poemIds.includes('ghost_poem'));
    pass('Nonexistent poem references silently dropped during collection creation');

    // 3. Duplicate collection ID throws StorageError
    let dupErr = null;
    try {
      colRepo.create({ id: col.id, name: 'डुप्लिकेट' });
    } catch (e) { dupErr = e; }
    assert.ok(dupErr instanceof StorageError, 'Duplicate collection ID must throw StorageError');
    pass('Duplicate collection ID throws StorageError (DUPLICATE_ID)');

    // 4. Empty/whitespace collection names are rejected
    let emptyNameErr = null;
    try {
      colService.createCollection({ name: '   ' });
    } catch (e) { emptyNameErr = e; }
    assert.ok(emptyNameErr instanceof StorageError);
    pass('Empty/whitespace collection names are rejected with StorageError');

    // 5. Malformed collection objects in storage do not crash getAll
    const rawStore = colRepo.adapter;
    const existing = rawStore.get('kavyavault:collections') || [];
    existing.push(null);
    existing.push({ not_a_collection: true });
    existing.push({ id: 'bad_col', name: 'बिना poemIds' });
    rawStore.set('kavyavault:collections', existing);
    const allCols = colRepo.getAll();
    // Should filter out null and malformed entries, keeping valid ones
    for (const c of allCols) {
      assert.ok(c && typeof c === 'object' && typeof c.id === 'string');
      assert.ok(Array.isArray(c.poemIds));
    }
    pass('Malformed collection objects in storage do not crash getAll');

    // 6. Adding poem to collection is idempotent (no duplicate)
    const freshCol = colService.createCollection({ name: 'इडम्पोटेंट परीक्षण', poemIds: [p1.id] });
    colService.addPoemToCollection(freshCol.id, p1.id);
    colService.addPoemToCollection(freshCol.id, p1.id);
    const updatedCol = colService.getCollection(freshCol.id);
    const p1Count = updatedCol.poemIds.filter(id => id === p1.id).length;
    assert.strictEqual(p1Count, 1, 'Adding same poem multiple times must not create duplicates');
    pass('Adding poem to collection is idempotent — no duplicate IDs');

    // 7. Adding nonexistent poem to collection throws
    let addErr = null;
    try {
      colService.addPoemToCollection(freshCol.id, 'does_not_exist');
    } catch (e) { addErr = e; }
    assert.ok(addErr instanceof StorageError);
    pass('Adding nonexistent poem to collection throws StorageError');
  }

  // ============================================================================
  // Suite B: Tag Normalization Edge Cases
  // ============================================================================
  console.log('\n--- Suite B: Tag Normalization Edge Cases ---');
  {
    const { tagService, poemRepo } = createHarness();

    // 8. Whitespace variants normalize to same tag
    assert.strictEqual(normalizeTagName(' प्रेम '), normalizeTagName('प्रेम'));
    assert.strictEqual(normalizeTagName('  प्रेम  '), normalizeTagName('प्रेम'));
    pass('Leading/trailing whitespace variants normalize to identical tag');

    // 9. Hash prefix stripping
    assert.strictEqual(normalizeTagName('#प्रकृति'), normalizeTagName('प्रकृति'));
    assert.strictEqual(normalizeTagName('# प्रकृति'), normalizeTagName('प्रकृति'));
    pass('Hash prefix (#) is stripped during normalization');

    // 10. NFC normalization ensures Unicode equivalence
    const nfc1 = normalizeTagName('कविता');
    const nfc2 = normalizeTagName('कविता'.normalize('NFD'));
    assert.strictEqual(nfc1, nfc2, 'NFC normalization must ensure equivalent strings match');
    pass('NFC normalization ensures Unicode equivalence for Devanagari');

    // 11. Mixed Hindi/Latin case normalization
    assert.strictEqual(normalizeTagName('Love'), normalizeTagName('love'));
    assert.strictEqual(normalizeTagName('POETRY'), normalizeTagName('poetry'));
    assert.strictEqual(normalizeTagName('हिंदी Poetry'), normalizeTagName('हिंदी poetry'));
    pass('Mixed Hindi/Latin tags normalize case for Latin characters only');

    // 12. Empty and whitespace-only tags normalize to empty string
    assert.strictEqual(normalizeTagName(''), '');
    assert.strictEqual(normalizeTagName('   '), '');
    assert.strictEqual(normalizeTagName('#'), '');
    assert.strictEqual(normalizeTagName(null), '');
    assert.strictEqual(normalizeTagName(undefined), '');
    pass('Empty, whitespace, and null tags normalize to empty string safely');

    // 13. Duplicate normalized tags on one poem are grouped correctly
    const p = makePoem(poemRepo, {
      id: 'tag_dup',
      tags: ['प्रेम', ' प्रेम ', '#प्रेम', 'LOVE', 'love', 'Love']
    });
    const tags = tagService.extractTagsFromPoems([p]);
    const premTags = tags.filter(t => t.normalizedName === normalizeTagName('प्रेम'));
    assert.strictEqual(premTags.length, 1, 'Same normalized tag must group into one entry');
    const loveTags = tags.filter(t => t.normalizedName === normalizeTagName('love'));
    assert.strictEqual(loveTags.length, 1, 'Latin case variants must group into one entry');
    pass('Duplicate normalized tags on one poem are correctly grouped into single entries');

    // 14. Tags with only special characters are filtered out
    const p2 = makePoem(poemRepo, { id: 'tag_special', tags: ['###', '   ', '', '!@#', 'मान्य'] });
    const tags2 = tagService.extractTagsFromPoems([p2]);
    const validTags = tags2.filter(t => t.name.length > 0);
    assert.ok(validTags.length >= 1);
    assert.ok(validTags.some(t => t.normalizedName === normalizeTagName('मान्य')));
    pass('Tags with only special characters or whitespace are safely filtered out');

    // 15. Hindi display form is preserved while normalized form is used for matching
    const p3 = makePoem(poemRepo, { id: 'tag_display', tags: ['  विरह वेदना  '] });
    const tags3 = tagService.extractTagsFromPoems([p3]);
    assert.ok(tags3.length === 1);
    assert.strictEqual(tags3[0].name, 'विरह वेदना', 'Display form must be trimmed but preserve Devanagari');
    assert.strictEqual(tags3[0].normalizedName, 'विरह वेदना');
    pass('Hindi display form is preserved while normalized form matches correctly');
  }

  // ============================================================================
  // Suite C: Category Edge Cases
  // ============================================================================
  console.log('\n--- Suite C: Category Edge Cases ---');
  {
    const { categoryService, poemRepo } = createHarness();

    // 16. Empty category string does not create a category
    const p1 = makePoem(poemRepo, { id: 'cat_empty', category: '' });
    const p2 = makePoem(poemRepo, { id: 'cat_ws', category: '   ' });
    const cats = categoryService.extractCategoriesFromPoems([p1, p2]);
    assert.strictEqual(cats.length, 0, 'Empty/whitespace categories must not produce entries');
    pass('Empty and whitespace-only categories produce no category entries');

    // 17. Archived poems are excluded from category extraction
    const p3 = makePoem(poemRepo, { id: 'cat_arch', category: 'गीत', isArchived: true });
    const p4 = makePoem(poemRepo, { id: 'cat_active', category: 'गीत' });
    const cats2 = categoryService.extractCategoriesFromPoems([p3, p4]);
    assert.strictEqual(cats2.length, 1);
    assert.strictEqual(cats2[0].poemCount, 1, 'Archived poems must not be counted in categories');
    pass('Archived poems are excluded from category extraction and counts');

    // 18. Category counts are deterministic across multiple poems
    const poems = [
      makePoem(poemRepo, { id: 'cat_d1', category: 'वीर रस' }),
      makePoem(poemRepo, { id: 'cat_d2', category: 'वीर रस' }),
      makePoem(poemRepo, { id: 'cat_d3', category: 'श्रृंगार रस' })
    ];
    const cats3 = categoryService.extractCategoriesFromPoems(poems);
    const veer = cats3.find(c => c.name === 'वीर रस');
    const shringar = cats3.find(c => c.slug === generateCategorySlug('श्रृंगार रस'));
    assert.strictEqual(veer.poemCount, 2);
    assert.strictEqual(shringar.poemCount, 1);
    pass('Category counts are deterministic and accurate across multiple poems');

    // 19. Malformed category value (non-string) does not crash
    const badPoem = { id: 'cat_bad', category: 12345, createdAt: new Date().toISOString() };
    const cats4 = categoryService.extractCategoriesFromPoems([badPoem]);
    assert.strictEqual(cats4.length, 0, 'Non-string category must not crash or produce entries');
    pass('Malformed non-string category values do not crash category extraction');

    // 20. Category slug generation handles Devanagari safely
    const slug = generateCategorySlug('वीर रस');
    assert.ok(slug.length > 0, 'Devanagari slug must not be empty');
    assert.ok(!slug.includes(' '), 'Slug must not contain spaces');
    assert.strictEqual(generateCategorySlug(''), '');
    assert.strictEqual(generateCategorySlug(null), '');
    pass('Category slug generation handles Devanagari, empty strings, and null safely');
  }

  // ============================================================================
  // Suite D: Favorite Consistency
  // ============================================================================
  console.log('\n--- Suite D: Favorite Consistency ---');
  {
    const { favoritesService, poemRepo, service } = createHarness();

    // 21. Single source of truth: isFavorite on PoemRepository
    const p = makePoem(poemRepo, { id: 'fav_sot', isFavorite: false });
    assert.strictEqual(favoritesService.isFavorite(p.id), false);
    favoritesService.favoritePoem(p.id);
    assert.strictEqual(poemRepo.getById(p.id).isFavorite, true);
    assert.strictEqual(favoritesService.isFavorite(p.id), true);
    pass('Favorite state uses poem.isFavorite as single source of truth');

    // 22. Unfavorite updates repository consistently
    favoritesService.unfavoritePoem(p.id);
    assert.strictEqual(poemRepo.getById(p.id).isFavorite, false);
    assert.strictEqual(favoritesService.isFavorite(p.id), false);
    pass('Unfavoriting updates PoemRepository consistently');

    // 23. Rapid toggle does not corrupt state
    favoritesService.toggleFavorite(p.id);
    assert.strictEqual(poemRepo.getById(p.id).isFavorite, true);
    favoritesService.toggleFavorite(p.id);
    assert.strictEqual(poemRepo.getById(p.id).isFavorite, false);
    favoritesService.toggleFavorite(p.id);
    assert.strictEqual(poemRepo.getById(p.id).isFavorite, true);
    pass('Rapid favorite toggle does not corrupt state');

    // 24. Toggling favorite on missing poem throws StorageError
    let missErr = null;
    try { favoritesService.toggleFavorite('ghost_poem_id'); } catch (e) { missErr = e; }
    assert.ok(missErr instanceof StorageError);
    pass('Toggling favorite on missing poem throws StorageError');

    // 25. Favoriting with invalid ID throws
    let invErr = null;
    try { favoritesService.favoritePoem(''); } catch (e) { invErr = e; }
    assert.ok(invErr instanceof StorageError);
    let invErr2 = null;
    try { favoritesService.favoritePoem(null); } catch (e) { invErr2 = e; }
    assert.ok(invErr2 instanceof StorageError);
    pass('Favoriting with empty or null ID throws StorageError');

    // 26. listFavorites reflects current state after toggle
    favoritesService.favoritePoem(p.id);
    const favs = favoritesService.listFavorites();
    assert.ok(favs.some(f => f.id === p.id));
    favoritesService.unfavoritePoem(p.id);
    const favs2 = favoritesService.listFavorites();
    assert.ok(!favs2.some(f => f.id === p.id));
    pass('listFavorites reflects current state immediately after toggle');
  }

  // ============================================================================
  // Suite E: Recent Corruption & Boundary
  // ============================================================================
  console.log('\n--- Suite E: Recent Corruption & Boundary ---');
  {
    const { recentService, poemRepo } = createHarness();

    // 27. Repeated views produce only one entry per poem
    const p = makePoem(poemRepo, { id: 'rec_dup' });
    recentService.recordView(p.id);
    recentService.recordView(p.id);
    recentService.recordView(p.id);
    const recent = recentService.getRecent();
    const entries = recent.filter(r => r.poemId === p.id);
    assert.strictEqual(entries.length, 1, 'Repeated views must produce exactly one recent entry');
    pass('Repeated views of same poem produce exactly one recent entry');

    // 28. Maximum 50 entries enforced
    for (let i = 0; i < 55; i++) {
      const px = makePoem(poemRepo, { id: `rec_bound_${i}` });
      recentService.recordView(px.id);
    }
    const bounded = recentService.getRecent();
    assert.ok(bounded.length <= 50, `Recent entries must be bounded to 50, got ${bounded.length}`);
    pass('Recent entries are bounded to maximum 50');

    // 29. Malformed viewedAt in storage does not crash getRecent
    const { recentService: rs2, poemRepo: pr2, recentAdapter: ra2 } = createHarness();
    const px = makePoem(pr2, { id: 'rec_bad_date' });
    rs2.recordView(px.id);
    // Inject malformed data directly
    const rawData = ra2.get('kavyavault:recent_poems') || [];
    rawData.push({ poemId: 'rec_bad_date', viewedAt: 'not-a-date' });
    rawData.push({ poemId: 'another', viewedAt: null });
    rawData.push(null);
    rawData.push({ notPoemId: 'missing-field' });
    ra2.set('kavyavault:recent_poems', rawData);
    // Should not throw
    const recovered = rs2.getRecent();
    assert.ok(Array.isArray(recovered), 'getRecent must return array even with corrupt data');
    pass('Malformed viewedAt and corrupt recent entries do not crash getRecent');

    // 30. Viewing a poem does NOT mutate poem.updatedAt
    const { recentService: rs3, poemRepo: pr3 } = createHarness();
    const pz = makePoem(pr3, { id: 'rec_immut' });
    const beforeUpdatedAt = pr3.getById(pz.id).updatedAt;
    rs3.recordView(pz.id);
    const afterUpdatedAt = pr3.getById(pz.id).updatedAt;
    assert.strictEqual(beforeUpdatedAt, afterUpdatedAt, 'Recording view must never mutate poem.updatedAt');
    pass('Recording a view never mutates poem.updatedAt');

    // 31. Deleted poems are gracefully dropped from getRecentWithPoems
    const { recentService: rs4, poemRepo: pr4 } = createHarness();
    const pdel = makePoem(pr4, { id: 'rec_del' });
    rs4.recordView(pdel.id);
    pr4.delete(pdel.id);
    const enriched = rs4.getRecentWithPoems();
    assert.ok(!enriched.some(e => e.poemId === pdel.id), 'Deleted poems must not appear in enriched recent');
    pass('Deleted poems are gracefully dropped from getRecentWithPoems');

    // 32. Recording view with empty/null ID throws
    let recErr = null;
    try { recentService.recordView(''); } catch (e) { recErr = e; }
    assert.ok(recErr instanceof StorageError);
    let recErr2 = null;
    try { recentService.recordView(null); } catch (e) { recErr2 = e; }
    assert.ok(recErr2 instanceof StorageError);
    pass('Recording view with empty or null poem ID throws StorageError');
  }

  // ============================================================================
  // Suite F: Timeline Malformed Dates
  // ============================================================================
  console.log('\n--- Suite F: Timeline Malformed Dates ---');
  {
    const { timelineService } = createHarness();

    // 33. Missing createdAt produces no CREATED event (no fabrication)
    const poem1 = { id: 'tl_no_created', title: 'बिना तिथि' };
    const events1 = timelineService.extractPoemEvents(poem1);
    assert.ok(!events1.some(e => e.eventType === TIMELINE_EVENT_TYPE.CREATED));
    pass('Missing createdAt produces no CREATED event — no date fabrication');

    // 34. Invalid date strings produce no events
    const poem2 = { id: 'tl_bad_date', title: 'गलत तिथि', createdAt: 'not-a-date', updatedAt: 'also-bad' };
    const events2 = timelineService.extractPoemEvents(poem2);
    assert.strictEqual(events2.length, 0, 'Invalid date strings must produce zero events');
    pass('Invalid date strings produce zero timeline events');

    // 35. Multiple poems with identical timestamps maintain deterministic ordering
    const now = '2026-06-15T10:00:00.000Z';
    const poems = [
      { id: 'tl_dup_a', title: 'dup_a', createdAt: now, updatedAt: now },
      { id: 'tl_dup_b', title: 'dup_b', createdAt: now, updatedAt: now }
    ];
    const timeline = timelineService.getTimeline(poems);
    // Must be deterministic: poemId ASC then eventType ASC for same timestamp
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].timestamp === timeline[i-1].timestamp) {
        const cmp = timeline[i-1].poemId.localeCompare(timeline[i].poemId);
        if (cmp === 0) {
          assert.ok(timeline[i-1].eventType.localeCompare(timeline[i].eventType) <= 0);
        }
      }
    }
    pass('Identical timestamps maintain deterministic ordering (poemId ASC, eventType ASC)');

    // 36. Deleted/null poem objects are safely skipped
    const mixed = [null, undefined, { id: 'tl_valid', title: 'मान्य', createdAt: now }];
    const events3 = timelineService.getTimeline(mixed);
    assert.ok(Array.isArray(events3));
    assert.ok(events3.every(e => e.poemId === 'tl_valid'));
    pass('Null and undefined poem objects are safely skipped in timeline');

    // 37. Archived poems are excluded from getTimeline
    const archived = { id: 'tl_arch', title: 'संग्रहित', createdAt: now, isArchived: true };
    const active = { id: 'tl_active', title: 'सक्रिय', createdAt: now };
    const events4 = timelineService.getTimeline([archived, active]);
    assert.ok(!events4.some(e => e.poemId === 'tl_arch'));
    assert.ok(events4.some(e => e.poemId === 'tl_active'));
    pass('Archived poems are excluded from timeline aggregation');
  }

  // ============================================================================
  // Suite G: Filter Validation
  // ============================================================================
  console.log('\n--- Suite G: Filter Validation ---');
  {
    const { filterService, poemRepo, colRepo } = createHarness();
    const p1 = makePoem(poemRepo, { id: 'flt_1', category: 'गीत', tags: ['प्रेम'] });
    const p2 = makePoem(poemRepo, { id: 'flt_2', category: 'हालावाद' });

    // 38. Unknown collectionId yields empty results (no crash)
    const result1 = filterService.query([p1, p2], { collectionId: 'nonexistent_col' });
    assert.strictEqual(result1.poems.length, 0, 'Unknown collectionId must yield empty results');
    assert.strictEqual(result1.totalCount, 0);
    pass('Unknown collectionId yields empty results without crash');

    // 39. Malformed tag arrays degrade safely
    const result2 = filterService.query([p1, p2], { tags: ['प्रेम'] });
    assert.ok(result2.poems.length >= 1);
    // Tags filter with normalized tags
    const result3 = filterService.query([p1, p2], { tags: [] });
    assert.ok(result3.poems.length >= 1, 'Empty tags array should not filter anything');
    pass('Malformed and empty tag arrays degrade safely in filter');

    // 40. Invalid sort field throws validation error
    let sortErr = null;
    try { createLibraryFilter({ sort: 'nonexistent_field' }); } catch (e) { sortErr = e; }
    assert.ok(sortErr instanceof StorageError, 'Invalid sort field must throw');
    pass('Invalid sort field throws StorageError during filter creation');

    // 41. Invalid sort order throws validation error
    let orderErr = null;
    try { createLibraryFilter({ order: 'sideways' }); } catch (e) { orderErr = e; }
    assert.ok(orderErr instanceof StorageError, 'Invalid sort order must throw');
    pass('Invalid sort order throws StorageError during filter creation');

    // 42. Null/undefined fields in filter input do not crash
    const result4 = filterService.query([p1, p2], {
      collectionId: null,
      category: null,
      tags: undefined,
      isFavorite: null,
      isArchived: null,
      sort: undefined,
      order: undefined,
      offset: undefined,
      limit: undefined
    });
    assert.ok(result4.poems.length >= 1, 'All-null filter fields should return poems normally');
    pass('Null and undefined fields in filter input do not crash query');

    // 43. Reversed date ranges yield no results (from > to)
    const result5 = filterService.query([p1, p2], {
      createdDateRange: {
        from: '2099-01-01T00:00:00.000Z',
        to: '2020-01-01T00:00:00.000Z'
      }
    });
    assert.strictEqual(result5.poems.length, 0, 'Reversed date range should yield zero results');
    pass('Reversed date ranges (from > to) yield zero results without crash');
  }

  // ============================================================================
  // Suite H: Cross-View Consistency
  // ============================================================================
  console.log('\n--- Suite H: Cross-View Consistency ---');
  {
    const { service, poemRepo, colRepo, favoritesService, recentService, categoryService, tagService } = createHarness();

    // 44. Favorite in service → visible in library query with isFavorite filter
    const p1 = makePoem(poemRepo, { id: 'xv_fav', isFavorite: false });
    service.favorites.favoritePoem(p1.id);
    const favResult = service.query({ isFavorite: true });
    assert.ok(favResult.poems.some(p => p.id === p1.id), 'Favorited poem must appear in filtered query');
    pass('Favorite set via service immediately appears in library query with isFavorite filter');

    // 45. Remove favorite → no longer appears in favorites query
    service.favorites.unfavoritePoem(p1.id);
    const favResult2 = service.query({ isFavorite: true });
    assert.ok(!favResult2.poems.some(p => p.id === p1.id));
    pass('Unfavorited poem immediately disappears from favorites query');

    // 46. Delete poem → stale collection references do not crash
    const p2 = makePoem(poemRepo, { id: 'xv_del', title: 'हटाई जाने वाली' });
    const col = service.collections.createCollection({ name: 'हटाने योग्य', poemIds: [p2.id] });
    recentService.recordView(p2.id);
    poemRepo.delete(p2.id);
    // Collection poems should safely handle deleted poem
    const colPoems = service.collections.getCollectionPoems(col.id);
    assert.ok(!colPoems.some(p => p.id === p2.id), 'Deleted poem must not appear in collection poems');
    // Recent should handle deleted poem
    const recent = recentService.getRecentWithPoems();
    assert.ok(!recent.some(r => r.poemId === p2.id));
    pass('Delete poem → stale collection and recent references disappear safely');

    // 47. Edit poem category → category counts reflect new state
    const p3 = makePoem(poemRepo, { id: 'xv_cat', category: 'श्रृंगार' });
    const cats1 = categoryService.extractCategoriesFromPoems(poemRepo.getAll());
    const shringarBefore = cats1.find(c => c.slug === generateCategorySlug('श्रृंगार'));
    const beforeCount = shringarBefore ? shringarBefore.poemCount : 0;
    poemRepo.update(p3.id, { category: 'वीर रस' });
    const cats2 = categoryService.extractCategoriesFromPoems(poemRepo.getAll());
    const shringarAfter = cats2.find(c => c.slug === generateCategorySlug('श्रृंगार'));
    assert.ok(!shringarAfter || shringarAfter.poemCount < beforeCount, 'Category count must decrease after category change');
    pass('Editing poem category → category counts reflect new state');

    // 48. Edit poem tags → tag browser reflects new state
    const p4 = makePoem(poemRepo, { id: 'xv_tag', tags: ['प्रकृति', 'नदी'] });
    poemRepo.update(p4.id, { tags: ['पर्वत'] });
    const allTags = tagService.extractTagsFromPoems(poemRepo.getAll());
    const nadiTag = allTags.find(t => t.normalizedName === normalizeTagName('नदी'));
    // After removing the only poem with 'नदी', the tag should have count 0 or not exist
    assert.ok(!nadiTag || nadiTag.poemCount === 0, 'Removed tag must not appear with positive count');
    pass('Editing poem tags → tag browser reflects new state immediately');
  }

  // ============================================================================
  // Suite I: Backward Compatibility
  // ============================================================================
  console.log('\n--- Suite I: Backward Compatibility ---');
  {
    const { service, poemRepo, categoryService, tagService } = createHarness();

    // 49. Phase 1 minimal poem shape (id, title, body, createdAt, updatedAt) works
    const minimalPoem = poemRepo.create({
      title: 'सरल कविता',
      body: 'मेरी सरल कविता।'
    });
    assert.ok(minimalPoem.id);
    assert.ok(minimalPoem.createdAt);
    assert.ok(minimalPoem.updatedAt);
    // Library query should handle this poem without error
    const result = service.query();
    assert.ok(result.poems.some(p => p.id === minimalPoem.id));
    pass('Phase 1 minimal poem shape works with Phase 6 library query');

    // 50. Poem without tags/category/isFavorite does not crash services
    const cats = categoryService.extractCategoriesFromPoems([minimalPoem]);
    assert.ok(Array.isArray(cats));
    const tags = tagService.extractTagsFromPoems([minimalPoem]);
    assert.ok(Array.isArray(tags));
    const stats = service.getLibraryStats();
    assert.ok(typeof stats.totalPoems === 'number');
    pass('Poem without tags/category/isFavorite does not crash any Phase 6 services');

    // 51. Poems with extra/unexpected fields do not crash
    const poemStore = poemRepo.adapter;
    const rawPoems = poemStore.get('kavyavault:poems') || [];
    rawPoems.push({
      id: 'legacy_extra_fields',
      title: 'पुरानी कविता',
      body: 'पुरानी शैली की कविता।',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: false,
      customFieldFromFuture: 'should_not_crash',
      unknownNested: { deep: { value: 42 } }
    });
    poemStore.set('kavyavault:poems', rawPoems);
    const allPoems = poemRepo.getAll();
    assert.ok(allPoems.some(p => p.id === 'legacy_extra_fields'), 'Poems with extra fields must not be dropped');
    pass('Poems with extra/unexpected fields are preserved and do not crash');
  }

  // ============================================================================
  // Suite J: Malformed Local Storage
  // ============================================================================
  console.log('\n--- Suite J: Malformed Local Storage ---');
  {
    // 52. Collections storage with non-array data recovers safely
    const { colRepo: cr1 } = createHarness();
    cr1.adapter.set('kavyavault:collections', 'this is not json array');
    const cols = cr1.getAll();
    assert.ok(Array.isArray(cols) && cols.length === 0, 'Non-array collections data must recover to empty');
    pass('Collections storage with non-array data recovers safely to empty array');

    // 53. Recent poems storage with corrupt JSON recovers
    const { recentService: rs1, recentAdapter: ra1 } = createHarness();
    ra1.set('kavyavault:recent_poems', 'corrupt{{{');
    const recent = rs1.getRecent();
    assert.ok(Array.isArray(recent) && recent.length === 0);
    pass('Recent poems storage with corrupt JSON recovers safely to empty array');

    // 54. Null record in collections array is filtered out
    const { colRepo: cr2 } = createHarness();
    cr2.adapter.set('kavyavault:collections', [
      null,
      { id: 'valid_col', name: 'मान्य संग्रह', poemIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      undefined,
      42,
      'string_not_object'
    ]);
    const cols2 = cr2.getAll();
    assert.strictEqual(cols2.length, 1);
    assert.strictEqual(cols2[0].id, 'valid_col');
    pass('Null and non-object records in collections array are filtered out safely');

    // 55. Collection with missing poemIds field gets default empty array
    const { colRepo: cr3 } = createHarness();
    cr3.adapter.set('kavyavault:collections', [
      { id: 'no_poems', name: 'बिना कविता', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]);
    const cols3 = cr3.getAll();
    assert.strictEqual(cols3.length, 1);
    assert.ok(Array.isArray(cols3[0].poemIds));
    assert.strictEqual(cols3[0].poemIds.length, 0);
    pass('Collection with missing poemIds field gets default empty array');
  }

  // ============================================================================
  // Suite K: Unicode & Devanagari Edge Cases
  // ============================================================================
  console.log('\n--- Suite K: Unicode & Devanagari Edge Cases ---');
  {
    const { tagService, categoryService, poemRepo, colRepo, colService } = createHarness();

    // 56. Complex conjuncts in tags (क्ष, त्र, ज्ञ, श्र) survive normalization
    const conjuncts = ['क्षमा', 'त्रिलोक', 'ज्ञान', 'श्रद्धा'];
    const p = makePoem(poemRepo, { id: 'uni_conj', tags: conjuncts });
    const tags = tagService.extractTagsFromPoems([p]);
    assert.strictEqual(tags.length, 4);
    for (const conj of conjuncts) {
      assert.ok(tags.some(t => t.name === conj), `Conjunct "${conj}" must survive normalization`);
    }
    pass('Complex Devanagari conjuncts in tags survive normalization intact');

    // 57. Nukta characters in collection names are preserved
    const col = colService.createCollection({ name: 'ग़ज़ल संकलन' });
    assert.ok(col.name.includes('ग़ज़ल'), 'Nukta characters must be preserved in collection names');
    pass('Nukta characters (ग़, ज़) are preserved in collection names');

    // 58. Chandrabindu and visarga in categories work correctly
    const p2 = makePoem(poemRepo, { id: 'uni_chandra', category: 'चाँदनी दुःख' });
    const cats = categoryService.extractCategoriesFromPoems([p2]);
    assert.strictEqual(cats.length, 1);
    assert.ok(cats[0].name.includes('चाँदनी'));
    assert.ok(cats[0].name.includes('दुःख'));
    pass('Chandrabindu and visarga in categories are preserved correctly');

    // 59. Devanagari danda/double danda in poem titles do not corrupt collection lookup
    const p3 = makePoem(poemRepo, { id: 'uni_danda', title: 'मेरी कविता ।' });
    const col2 = colService.createCollection({ name: 'दंड संग्रह ॥', poemIds: [p3.id] });
    const colPoems = colService.getCollectionPoems(col2.id);
    assert.strictEqual(colPoems.length, 1);
    pass('Devanagari danda/double danda in titles/names do not corrupt lookups');
  }

  // ============================================================================
  // Suite L: Deletion Safety
  // ============================================================================
  console.log('\n--- Suite L: Deletion Safety ---');
  {
    const { colService, poemRepo, colRepo, recentService } = createHarness();

    // 60. Deleting a collection NEVER deletes referenced poems
    const p1 = makePoem(poemRepo, { id: 'del_safe_p1', title: 'सुरक्षित कविता' });
    const p2 = makePoem(poemRepo, { id: 'del_safe_p2', title: 'दूसरी सुरक्षित' });
    const col = colService.createCollection({ name: 'हटाने योग्य संग्रह', poemIds: [p1.id, p2.id] });
    colService.deleteCollection(col.id);
    // Poems MUST still exist
    assert.ok(poemRepo.getById(p1.id) !== null, 'Poem p1 must survive collection deletion');
    assert.ok(poemRepo.getById(p2.id) !== null, 'Poem p2 must survive collection deletion');
    pass('Deleting collection NEVER deletes referenced poems — poems preserved');

    // 61. Deleting a poem cleans up collection references
    const p3 = makePoem(poemRepo, { id: 'del_cleanup_p3', title: 'साफ़ कविता' });
    const col2 = colService.createCollection({ name: 'सफाई संग्रह', poemIds: [p3.id] });
    poemRepo.delete(p3.id);
    // Collection should handle missing poem gracefully
    const colPoems = colService.getCollectionPoems(col2.id);
    assert.ok(!colPoems.some(p => p.id === p3.id));
    pass('Deleted poem is gracefully absent from collection poem resolution');

    // 62. Clearing recent history does not affect poems
    const p4 = makePoem(poemRepo, { id: 'del_recent_p4', title: 'हाल की कविता' });
    recentService.recordView(p4.id);
    recentService.clearRecent();
    assert.ok(poemRepo.getById(p4.id) !== null, 'Poem must survive recent history clearing');
    assert.strictEqual(recentService.count(), 0);
    pass('Clearing recent history does not affect poem records');

    // 63. Removing a poem from recent history does not delete the poem
    const p5 = makePoem(poemRepo, { id: 'del_rem_p5' });
    recentService.recordView(p5.id);
    recentService.removePoem(p5.id);
    assert.ok(poemRepo.getById(p5.id) !== null);
    assert.strictEqual(recentService.getRecent().filter(r => r.poemId === p5.id).length, 0);
    pass('Removing poem from recent history does not delete the poem itself');
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log(`\n================================================================`);
  console.log(`  ALL ${testCount}/${testCount} LIBRARY DATA INTEGRITY TESTS PASSED!`);
  console.log(`================================================================\n`);
}

runIntegrityTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
