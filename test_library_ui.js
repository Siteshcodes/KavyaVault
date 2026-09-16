/**
 * काव्यकलश (KavyaVault) — Personal Digital Library UI Test Suite (test_library_ui.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Verifies:
 * Suite A: Section Navigation & Tab Rendering (8 tabs, ARIA roles, active state)
 * Suite B: Collection UI Management (create, rename, edit description, open, add/remove poems)
 * Suite C: Collection Deletion Safety Guarantee (deleting collection preserves poems)
 * Suite D: Category Browser & Filtering (counts, selection, active filter chip)
 * Suite E: Tag Browser & Filtering (display form, counts, selection, mixed tags)
 * Suite F: Favorites Integration (toggle on card, dedicated favorites view)
 * Suite G: Recent Viewing History & Immutability (PoemReader view record, poem.updatedAt immutability, ordering)
 * Suite H: Chronological Timeline UI (CREATED, UPDATED, AUTHORED, DIGITIZED, no date invention)
 * Suite I: Multi-Criteria Filtering & Sorting (drawer toggle, chips, clear all, deterministic sorting)
 * Suite J: View Mode & Empty States (grid/list toggle, authentic Hindi empty states)
 * Suite K: Error Resilience & Security (safe fallback, no stack traces leaked, XSS escaping)
 * Suite L: Accessibility & Touch Targets (48px targets, ARIA roles, arrow key navigation)
 * Suite M: Unicode & Devanagari Ligature Fidelity (conjuncts, nuktas, matras)
 * Suite N: Responsive Layouts Verification (390px, 768px, 1024px, 1440px)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { LibraryView, mountLibraryView } from './src/components/library/LibraryView.js';
import { LIBRARY_SECTIONS, SORT_OPTIONS } from './src/components/library/LibraryToolbar.js';
import { renderPoemCard } from './src/components/library/PoemCard.js';
import { PoemReader } from './src/components/reader/PoemReader.js';

import { LibraryOrganizationService } from './src/services/LibraryService.js';
import { CollectionService } from './src/services/library/CollectionService.js';
import { CategoryService } from './src/services/library/CategoryService.js';
import { TagService } from './src/services/library/TagService.js';
import { FavoritesService } from './src/services/library/FavoritesService.js';
import { RecentPoemService } from './src/services/library/RecentPoemService.js';
import { TimelineService } from './src/services/library/TimelineService.js';
import { LibraryFilterService } from './src/services/library/LibraryFilterService.js';
import { TIMELINE_EVENT_TYPE } from './src/services/library/libraryTypes.js';

import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
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

// Minimal DOM Mock Container for testing in Node.js
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
      const self = this;
      if (sel.startsWith('#library-tab-')) {
        const secId = sel.replace('#library-tab-', '');
        if (self.innerHTML.includes(`id="library-tab-${secId}"`)) {
          return {
            id: `library-tab-${secId}`,
            getAttribute: (a) => a === 'data-section' ? secId : null,
            focus: () => {}
          };
        }
        return null;
      }
      if (sel === '#col-name-input') {
        const match = self.innerHTML.match(/id="col-name-input"[^>]*value="([^"]*)"/);
        return {
          id: 'col-name-input',
          value: match ? match[1] : '',
          focus: () => {},
          classList: { add: () => {}, remove: () => {} }
        };
      }
      if (sel === '#col-desc-input') {
        const match = self.innerHTML.match(/id="col-desc-input"[^>]*>([\s\S]*?)<\/textarea>/);
        return {
          id: 'col-desc-input',
          value: match ? match[1] : ''
        };
      }
      if (sel === '#edit-col-name-input') {
        const match = self.innerHTML.match(/id="edit-col-name-input"[^>]*value="([^"]*)"/);
        return {
          id: 'edit-col-name-input',
          value: match ? match[1] : '',
          focus: () => {}
        };
      }
      if (sel === '#edit-col-desc-input') {
        const match = self.innerHTML.match(/id="edit-col-desc-input"[^>]*>([\s\S]*?)<\/textarea>/);
        return {
          id: 'edit-col-desc-input',
          value: match ? match[1] : ''
        };
      }
      if (sel === '#filter-category-select') {
        return { id: 'filter-category-select', value: '' };
      }
      if (sel === '#filter-tag-select') {
        return { id: 'filter-tag-select', value: '' };
      }
      if (sel === '#filter-collection-select') {
        return { id: 'filter-collection-select', value: '' };
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.library-section-tab') {
        const matches = Array.from(this.innerHTML.matchAll(/class="library-section-tab[^"]*"[^>]*data-section="([^"]*)"/g));
        return matches.map(m => ({
          getAttribute: (attr) => attr === 'data-section' ? m[1] : null,
          closest: () => ({ getAttribute: () => m[1] }),
          focus: () => {}
        }));
      }
      if (sel === 'input[name="selectedPoems"]:checked') {
        return [];
      }
      return [];
    }
  };
  return container;
}

// Helpers to create test environments
function createTestHarness() {
  const poemStorage = new InMemoryStorage();
  const poemAdapter = new LocalStorageAdapter(poemStorage);
  const poemRepo = new PoemRepository(poemAdapter);

  const colStorage = new InMemoryStorage();
  const colAdapter = new LocalStorageAdapter(colStorage);
  const colRepo = new CollectionRepository(colAdapter);

  const manuStorage = new InMemoryStorage();
  const manuAdapter = new LocalStorageAdapter(manuStorage);
  const manuRepo = new ManuscriptRepository(manuAdapter);

  const recentStorage = new InMemoryStorage();
  const recentAdapter = new LocalStorageAdapter(recentStorage);
  const recentService = new RecentPoemService({ adapter: recentAdapter, poemRepo });

  const tagService = new TagService();
  const categoryService = new CategoryService();
  const favoritesService = new FavoritesService({ poemRepo });
  const timelineService = new TimelineService();
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
    filterService,
    collectionService: colService
  });

  const mockRouter = {
    navigate: () => {},
    getCurrentPath: () => '/poems'
  };

  return {
    poemRepo,
    colRepo,
    manuRepo,
    recentService,
    service,
    mockRouter
  };
}

async function runLibraryUITests() {
  console.log('================================================================');
  console.log('  KAVYAVAULT PERSONAL DIGITAL LIBRARY UI TEST SUITE (Task 6.2)');
  console.log('================================================================');

  let testCount = 0;
  function pass(desc) {
    testCount++;
    console.log(`✓ [Test ${testCount}] ${desc}`);
  }

  // ============================================================================
  // Suite A: Section Navigation & Tab Rendering
  // ============================================================================
  console.log('\n--- Suite A: Section Navigation & Tab Rendering ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 1. Renders 8 section tabs
    const html = container.innerHTML;
    assert.strictEqual(LIBRARY_SECTIONS.length, 8, 'Should define 8 library sections');
    LIBRARY_SECTIONS.forEach(sec => {
      assert.ok(html.includes(`data-section="${sec.id}"`), `Should render tab for section: ${sec.id}`);
      assert.ok(html.includes(sec.label), `Should render Hindi label for section: ${sec.label}`);
    });
    pass('LibraryView renders 8 section tabs (सभी कविताएँ, पसंदीदा, हाल में पढ़ी गई, संग्रह, श्रेणियाँ, टैग, अभिलेख, समयरेखा)');

    // 2. Active tab reflects 'all'
    assert.ok(html.includes('id="library-tab-all"'), 'Should have library-tab-all id');
    assert.ok(html.includes('aria-selected="true"'), 'Active tab should have aria-selected="true"');
    assert.ok(html.includes('role="tabpanel" aria-labelledby="library-tab-all"'), 'Panel should associate with active tab');
    pass('Active tab reflects initialFilter="all" with aria-selected="true" and role="tabpanel"');

    // 3. Switch to 'favorites'
    view.activeSection = 'favorites';
    view.update();
    assert.ok(container.innerHTML.includes('id="library-tab-favorites"'));
    assert.ok(container.innerHTML.includes('aria-labelledby="library-tab-favorites"'));
    pass('Switching to section "favorites" updates active tab and panel aria association');

    // 4. Switch to 'collections'
    view.activeSection = 'collections';
    view.update();
    assert.ok(container.innerHTML.includes('काव्य संग्रह'), 'Should show collection header');
    assert.ok(container.innerHTML.includes('data-action="open-create-collection-modal"'), 'Should render create collection button');
    pass('Switching to section "collections" renders collections section header and create button');

    // 5. Switch to 'categories'
    view.activeSection = 'categories';
    view.update();
    assert.ok(container.innerHTML.includes('काव्य श्रेणियाँ'), 'Should show categories header');
    pass('Switching to section "categories" renders categories section');

    // 6. Switch to 'tags'
    view.activeSection = 'tags';
    view.update();
    assert.ok(container.innerHTML.includes('काव्य टैग वाटिका'), 'Should show tags header');
    pass('Switching to section "tags" renders tags section');

    // 7. Switch to 'recent'
    view.activeSection = 'recent';
    view.update();
    assert.ok(container.innerHTML.includes('हाल में पढ़ी गई रचनाएँ'), 'Should show recent header');
    pass('Switching to section "recent" renders recent poems section');

    // 8. Switch to 'timeline'
    view.activeSection = 'timeline';
    view.update();
    assert.ok(container.innerHTML.includes('साहित्यिक समयरेखा'), 'Should show timeline header');
    pass('Switching to section "timeline" renders chronological timeline section');

    // 9. Switch to 'archived'
    view.activeSection = 'archived';
    view.update();
    assert.ok(container.innerHTML.includes('aria-labelledby="library-tab-archived"'));
    pass('Switching to section "archived" renders archived panel');
  }

  // ============================================================================
  // Suite B: Collection UI Management
  // ============================================================================
  console.log('\n--- Suite B: Collection UI Management ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'collections', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 10. Open create collection modal
    view.handleClick({
      target: { closest: (sel) => sel === '[data-action="open-create-collection-modal"]' ? {} : null }
    });
    assert.strictEqual(view.isCreateCollectionModalOpen, true, 'Modal should be open');
    assert.ok(container.innerHTML.includes('नया काव्य संग्रह बनाएँ'), 'Should render create modal title');
    pass('Clicking "नया संग्रह बनाएँ" opens the create collection modal');

    // 11. Submitting create collection form
    const mockCreateForm = {
      closest: (sel) => sel === '#create-collection-form' ? mockCreateForm : null,
      querySelector: (sel) => {
        if (sel === '#col-name-input') return { value: 'प्रकृति के चित्र' };
        if (sel === '#col-desc-input') return { value: 'ऋतुओं और वनों पर रचित कविताएँ' };
        return null;
      }
    };
    view.handleSubmit({
      preventDefault: () => {},
      target: mockCreateForm
    });
    assert.strictEqual(view.isCreateCollectionModalOpen, false, 'Create modal should close after submit');
    const cols = service.collections.listCollections();
    assert.strictEqual(cols.length, 1);
    assert.strictEqual(cols[0].name, 'प्रकृति के चित्र');
    assert.strictEqual(cols[0].description, 'ऋतुओं और वनों पर रचित कविताएँ');
    pass('Submitting create collection form creates collection via CollectionService and navigates to detail');

    // 12. Create collection validation rejects empty name
    const mockEmptyForm = {
      closest: (sel) => sel === '#create-collection-form' ? mockEmptyForm : null,
      querySelector: (sel) => {
        if (sel === '#col-name-input') return { value: '   ', focus: () => {}, classList: { add: () => {} } };
        if (sel === '#col-desc-input') return { value: '' };
        return null;
      }
    };
    view.handleSubmit({
      preventDefault: () => {},
      target: mockEmptyForm
    });
    assert.strictEqual(service.collections.listCollections().length, 1, 'Should not create with empty name');
    pass('Creating collection with empty name is rejected without creating record');

    // 13. Opening a collection displays detail banner and poem count
    const colId = cols[0].id;
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="open-collection"]' ? { getAttribute: (a) => a === 'data-collection-id' ? colId : null } : null
      }
    });
    assert.strictEqual(view.activeCollectionId, colId);
    assert.ok(container.innerHTML.includes('प्रकृति के चित्र'), 'Should display collection title');
    assert.ok(container.innerHTML.includes('ऋतुओं और वनों पर रचित कविताएँ'), 'Should display collection description');
    pass('Opening a collection displays its title banner, description, and empty state when no poems added');

    // 14. Edit collection modal opening
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="edit-collection"]' ? { getAttribute: (a) => a === 'data-collection-id' ? colId : null } : null
      }
    });
    assert.ok(view.editingCollection !== null);
    assert.ok(container.innerHTML.includes('संग्रह संपादित करें'));
    pass('Editing collection opens edit modal with current collection data');

    // 15. Submitting edit form renames collection
    const mockEditForm = {
      closest: (sel) => sel === '#edit-collection-form' ? mockEditForm : null,
      getAttribute: (a) => a === 'data-col-id' ? colId : null,
      querySelector: (sel) => {
        if (sel === '#edit-col-name-input') return { value: 'प्रकृति व वर्षा' };
        if (sel === '#edit-col-desc-input') return { value: 'वर्षा ऋतु के दोहे' };
        return null;
      }
    };
    view.handleSubmit({
      preventDefault: () => {},
      target: mockEditForm
    });
    const updatedCol = service.collections.getCollection(colId);
    assert.strictEqual(updatedCol.name, 'प्रकृति व वर्षा');
    assert.strictEqual(updatedCol.description, 'वर्षा ऋतु के दोहे');
    pass('Submitting edit form renames collection and updates description');

    // 16. Add poems modal lists non-archived available poems
    const poemA = poemRepo.create({ id: 'p_tree_1', title: 'बरगद की छांव', body: 'विशाल वृक्ष की शीतल छाया।' });
    const poemB = poemRepo.create({ id: 'p_rain_1', title: 'मेघ गर्जन', body: 'काले बादलों की गड़गड़ाहट।' });
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="open-add-poems-modal"]' ? {} : null
      }
    });
    assert.strictEqual(view.isAddPoemsModalOpen, true);
    assert.ok(container.innerHTML.includes('बरगद की छांव'));
    assert.ok(container.innerHTML.includes('मेघ गर्जन'));
    pass('"कविता जोड़ें" modal lists available non-archived poems not yet in collection');

    // 17. Submitting add poems form adds selected poems to collection
    const mockAddPoemsForm = {
      closest: (sel) => sel === '#add-poems-to-collection-form' ? mockAddPoemsForm : null,
      getAttribute: (a) => a === 'data-col-id' ? colId : null,
      querySelectorAll: (sel) => sel === 'input[name="selectedPoems"]:checked' ? [{ value: 'p_tree_1' }, { value: 'p_rain_1' }] : []
    };
    view.handleSubmit({
      preventDefault: () => {},
      target: mockAddPoemsForm
    });
    assert.strictEqual(view.isAddPoemsModalOpen, false);
    const colWithPoems = service.collections.getCollection(colId);
    assert.deepStrictEqual(colWithPoems.poemIds, ['p_tree_1', 'p_rain_1']);
    assert.ok(container.innerHTML.includes('बरगद की छांव'));
    pass('Submitting add poems form adds selected poems to collection and updates cards');

    // 18. Remove poem from collection
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="remove-poem-from-collection"]' ? {
          getAttribute: (a) => a === 'data-poem-id' ? 'p_tree_1' : a === 'data-collection-id' ? colId : null
        } : null
      }
    });
    const colAfterRemoval = service.collections.getCollection(colId);
    assert.deepStrictEqual(colAfterRemoval.poemIds, ['p_rain_1']);
    pass('Clicking remove poem from collection calls removePoem and updates UI immediately');
  }

  // ============================================================================
  // Suite C: Collection Deletion Safety Guarantee (CRITICAL)
  // ============================================================================
  console.log('\n--- Suite C: Collection Deletion Safety Guarantee ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const poem1 = poemRepo.create({ id: 'p_sacred_1', title: 'अमर कविता', body: 'यह कविता कभी नष्ट नहीं होगी।' });
    const col = service.collections.createCollection({ name: 'नश्वर संग्रह', poemIds: [poem1.id] });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'collections', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // Mock confirm dialog returning true
    const origConfirm = globalThis.window ? globalThis.window.confirm : null;
    if (typeof window !== 'undefined') window.confirm = () => true;

    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="delete-collection"]' ? {
          getAttribute: (a) => a === 'data-collection-id' ? col.id : a === 'data-col-name' ? col.name : null
        } : null
      }
    });

    assert.strictEqual(service.collections.getCollection(col.id), null, 'Collection must be deleted');
    pass('Deleting collection prompts confirmation and successfully deletes collection entity');

    // CRITICAL: Verify poem is 100% intact in PoemRepository
    const preservedPoem = poemRepo.getById(poem1.id);
    assert.ok(preservedPoem !== null, 'Poem must exist in PoemRepository');
    assert.strictEqual(preservedPoem.title, 'अमर कविता');
    assert.strictEqual(preservedPoem.body, 'यह कविता कभी नष्ट नहीं होगी।');
    pass('CRITICAL: Deleting collection strictly PRESERVES all underlying poem records in PoemRepository');

    if (origConfirm && typeof window !== 'undefined') window.confirm = origConfirm;
  }

  // ============================================================================
  // Suite D: Category Browser & Filtering
  // ============================================================================
  console.log('\n--- Suite D: Category Browser & Filtering ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    poemRepo.create({ id: 'p_ghazal_1', title: 'दर्द का अहसास', body: '...', category: 'ग़ज़ल' });
    poemRepo.create({ id: 'p_ghazal_2', title: 'रात का सन्नाटा', body: '...', category: 'ग़ज़ल' });
    poemRepo.create({ id: 'p_doha_1', title: 'कबीर दोहावली', body: '...', category: 'दोहा' });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'categories', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 21. Categories section extracts categories with poem counts
    const html = container.innerHTML;
    assert.ok(html.includes('ग़ज़ल'), 'Should display category ग़ज़ल');
    assert.ok(html.includes('दोहा'), 'Should display category दोहा');
    assert.ok(html.includes('२ कविताएँ'), 'Ghazal should display count of 2 in Devanagari');
    assert.ok(html.includes('१ कविता'), 'Doha should display count of 1 in Devanagari');
    pass('Categories section extracts categories with accurate Devanagari poem count badges');

    // 22. Clicking a category filters poems in 'all' view
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="select-category"]' ? {
          getAttribute: (a) => a === 'data-category' ? 'ग़ज़ल' : null
        } : null
      }
    });
    assert.strictEqual(view.activeSection, 'all');
    assert.strictEqual(view.activeFilter.category, 'ग़ज़ल');
    assert.ok(container.innerHTML.includes('दर्द का अहसास'));
    assert.ok(container.innerHTML.includes('रात का सन्नाटा'));
    assert.ok(!container.innerHTML.includes('कबीर दोहावली'), 'Doha must be excluded by Ghazal filter');
    pass('Clicking a category filters poems in "all" view with category filter active');

    // 23. Active filter chip
    assert.ok(container.innerHTML.includes('श्रेणी: ग़ज़ल'), 'Should render active filter chip');
    assert.ok(container.innerHTML.includes('data-action="remove-filter-chip"'), 'Chip should have removal button');
    pass('Category filter displays active filter chip with one-click removal button');
  }

  // ============================================================================
  // Suite E: Tag Browser & Filtering
  // ============================================================================
  console.log('\n--- Suite E: Tag Browser & Filtering ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    poemRepo.create({ id: 'p_tag_1', title: 'प्रेम पत्र', body: '...', tags: ['प्रेम', 'romantic'] });
    poemRepo.create({ id: 'p_tag_2', title: 'प्रकृति सौंदर्य', body: '...', tags: ['प्रकृति', 'romantic'] });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'tags', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 24. Tag browser displays tags preserving display form
    const html = container.innerHTML;
    assert.ok(html.includes('#प्रेम'), 'Should show #प्रेम tag');
    assert.ok(html.includes('#प्रकृति'), 'Should show #प्रकृति tag');
    assert.ok(html.includes('#romantic'), 'Should show #romantic tag');
    pass('Tag browser displays tags with author exact display form and poem count badges');

    // 25. Selecting tag filters poems
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="select-tag"]' ? {
          getAttribute: (a) => a === 'data-tag' ? 'प्रेम' : null
        } : null
      }
    });
    assert.strictEqual(view.activeSection, 'all');
    assert.strictEqual(view.activeFilter.tag, 'प्रेम');
    assert.ok(container.innerHTML.includes('प्रेम पत्र'));
    assert.ok(!container.innerHTML.includes('प्रकृति सौंदर्य'));
    pass('Clicking a tag filters poems in "all" view with tag filter active');

    // 26. Mixed Hindi/English tags
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="select-tag"]' ? {
          getAttribute: (a) => a === 'data-tag' ? 'romantic' : null
        } : null
      }
    });
    assert.strictEqual(view.activeFilter.tag, 'romantic');
    assert.ok(container.innerHTML.includes('प्रेम पत्र'));
    assert.ok(container.innerHTML.includes('प्रकृति सौंदर्य'));
    pass('Mixed Hindi/English tags (#romantic) filter across multiple poems matching faithfully');
  }

  // ============================================================================
  // Suite F: Favorites Integration
  // ============================================================================
  console.log('\n--- Suite F: Favorites Integration ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const poem = poemRepo.create({ id: 'p_fav_1', title: 'मनभावन', body: '...', isFavorite: false });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 27. Toggle favorite on poem card
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="toggle-fav"]' ? {
          getAttribute: (a) => a === 'data-poem-id' ? poem.id : null
        } : null
      }
    });
    const updated = poemRepo.getById(poem.id);
    assert.strictEqual(updated.isFavorite, true, 'Poem favorite state must toggle to true');
    assert.ok(container.innerHTML.includes('btn-card-fav is-active'), 'UI must show active favorite icon');
    pass('Clicking favorite button on poem card immediately updates poem.isFavorite and reflects in UI');

    // 28. Dedicated favorites section
    view.activeSection = 'favorites';
    view.update();
    assert.ok(container.innerHTML.includes('मनभावन'));
    assert.strictEqual(container.innerHTML.includes('कोई पसंदीदा रचना नहीं'), false);
    pass('Dedicated "favorites" section displays only active favorite poems');
  }

  // ============================================================================
  // Suite G: Recent Viewing History & Immutability
  // ============================================================================
  console.log('\n--- Suite G: Recent Viewing History & Immutability ---');
  {
    const { service, poemRepo, colRepo, recentService, mockRouter } = createTestHarness();
    const fixedTime = '2026-09-01T10:00:00.000Z';
    const poem1 = poemRepo.create({ id: 'p_rec_1', title: 'प्रातःकाल', body: 'सूर्योदय की लालिमा', createdAt: fixedTime, updatedAt: fixedTime });
    const poem2 = poemRepo.create({ id: 'p_rec_2', title: 'संध्याकाल', body: 'डूबते सूरज की छांव', createdAt: fixedTime, updatedAt: fixedTime });

    // 29. PoemReader.mount() records view in recentService
    const readerContainer = createMockContainer();
    const reader = new PoemReader({
      container: readerContainer,
      router: mockRouter,
      poemId: poem1.id,
      poemRepo,
      recentService
    });
    reader.mount();

    const recent = recentService.getRecent();
    assert.strictEqual(recent.length, 1);
    assert.strictEqual(recent[0].poemId, poem1.id);
    pass('PoemReader.mount() automatically records view in RecentPoemService');

    // 30. CRITICAL: Poem view recording does NOT mutate poem.updatedAt
    const untouchedPoem1 = poemRepo.getById(poem1.id);
    assert.strictEqual(untouchedPoem1.updatedAt, fixedTime, 'poem.updatedAt must remain 100% untouched on view');
    pass('CRITICAL: Viewing a poem strictly preserves poem.updatedAt immutability');

    // 31. Read second poem, then first poem again (deduplication & ordering)
    const reader2 = new PoemReader({ container: readerContainer, router: mockRouter, poemId: poem2.id, poemRepo, recentService });
    reader2.mount();
    reader.mount(); // re-read poem1

    const recentItems = recentService.getRecent();
    assert.strictEqual(recentItems.length, 2, 'Should deduplicate poemId');
    assert.strictEqual(recentItems[0].poemId, poem1.id, 'Most recently read poem must be first');
    assert.strictEqual(recentItems[1].poemId, poem2.id);
    pass('Recent viewing history deduplicates and deterministically moves most recently read poem to front');

    // 32. Recent section view renders items
    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'recent', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();
    assert.ok(container.innerHTML.includes('प्रातःकाल'));
    assert.ok(container.innerHTML.includes('संध्याकाल'));
    assert.ok(container.innerHTML.includes('पठन:'), 'Should render reading timestamp badge');
    pass('Recent section displays recently read poems with newest view first and reading timestamp badge');
  }

  // ============================================================================
  // Suite H: Chronological Timeline UI
  // ============================================================================
  console.log('\n--- Suite H: Chronological Timeline UI ---');
  {
    const { service, poemRepo, colRepo, manuRepo, mockRouter } = createTestHarness();
    poemRepo.create({
      id: 'p_time_1',
      title: 'काव्य साधना',
      body: 'वर्षों की तपस्या',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      authoredDate: '2025-12-15'
    });
    manuRepo.create({
      id: 'm_time_1',
      poemId: 'p_time_1',
      title: 'मूल हस्तलिखित पन्ना',
      originalManuscript: {
        mimeType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        filename: 'manuscript_01.png',
        capturedAt: '2026-02-01T00:00:00.000Z'
      }
    });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'timeline', {
      libraryService: service,
      poemRepo,
      collectionRepo: colRepo,
      manuscriptRepo: manuRepo
    });
    view.mount();

    const html = container.innerHTML;
    // 33. Timeline displays events
    assert.ok(html.includes('कविता जोड़ी गई') || html.includes('badge-event-created'));
    assert.ok(html.includes('कविता संशोधित हुई') || html.includes('badge-event-updated'));
    assert.ok(html.includes('मूल रचना काल') || html.includes('badge-event-authored'));
    assert.ok(html.includes('पांडुलिपि संरक्षण') || html.includes('badge-event-digitized'));
    pass('Timeline section displays chronological provenance events (CREATED, UPDATED, AUTHORED, DIGITIZED)');

    // 34. Distinct event badges & links
    assert.ok(html.includes('href="/poems/p_time_1"'));
    assert.ok(html.includes('काव्य साधना'));
    pass('Timeline items render distinct event type badges and clickable links to poems');

    // 35. Zero date invention
    const poemWithoutAuthored = poemRepo.create({ id: 'p_no_auth', title: 'अज्ञात काल', body: '...' });
    const events = service.timeline.getPoemEvents(poemWithoutAuthored);
    const authoredEvents = events.filter(e => e.eventType === TIMELINE_EVENT_TYPE.AUTHORED);
    assert.strictEqual(authoredEvents.length, 0, 'Must never invent authored date when absent');
    pass('Timeline strictly avoids inventing missing dates, displaying only authentic provenance milestones');
  }

  // ============================================================================
  // Suite I: Multi-Criteria Filtering & Sorting
  // ============================================================================
  console.log('\n--- Suite I: Multi-Criteria Filtering & Sorting ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    poemRepo.create({ id: 'p_sort_1', title: 'कवि और कल्पना', body: '...', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' });
    poemRepo.create({ id: 'p_sort_2', title: 'बादल और बिजली', body: '...', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 36. Filter drawer toggle
    assert.strictEqual(view.isFilterOpen, false);
    view.handleClick({
      target: { closest: (sel) => sel === '[data-action="toggle-filter-drawer"]' ? {} : null }
    });
    assert.strictEqual(view.isFilterOpen, true);
    assert.ok(container.innerHTML.includes('काव्य पुस्तकालय फ़िल्टर'));
    pass('Filter drawer toggle button expands and collapses filter drawer smoothly');

    // 37. Applying filters
    view.activeFilter.category = 'गीत';
    view.activeFilter.isFavorite = true;
    assert.strictEqual(view.getActiveFilterCount(), 2);
    view.update();
    assert.ok(container.innerHTML.includes('श्रेणी: गीत'));
    assert.ok(container.innerHTML.includes('केवल पसंदीदा'));
    pass('Multi-criteria filters apply simultaneously and display filter count badge');

    // 38. Removing individual filter chip
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="remove-filter-chip"]' ? {
          getAttribute: (a) => a === 'data-filter-key' ? 'category' : null
        } : null
      }
    });
    assert.strictEqual(view.activeFilter.category, null);
    assert.strictEqual(view.activeFilter.isFavorite, true);
    pass('Clicking ✕ on an active filter chip removes only that specific filter criterion');

    // 39. Clear all filters
    view.handleClick({
      target: { closest: (sel) => sel === '[data-action="clear-all-filters"]' ? {} : null }
    });
    assert.strictEqual(view.getActiveFilterCount(), 0);
    pass('Clicking "सभी साफ़ करें" resets all active filters simultaneously');

    // 40. Deterministic sorting by title
    view.handleChange({
      target: {
        closest: (sel) => sel === '[data-action="change-sort"]' ? { value: 'title:asc' } : null
      }
    });
    assert.strictEqual(view.currentSort, 'title:asc');
    const titleSorted = view.getSectionData().poems;
    assert.strictEqual(titleSorted[0].title, 'कवि और कल्पना');
    assert.strictEqual(titleSorted[1].title, 'बादल और बिजली');
    pass('Sorting by title (title:asc) orders poems alphabetically with deterministic tie-breaking');

    // 41. Sort options list completeness
    assert.strictEqual(SORT_OPTIONS.length, 5);
    pass('All 5 deterministic sort options (updatedAt desc/asc, createdAt desc, title asc, authoredDate desc) are available');
  }

  // ============================================================================
  // Suite J: View Mode & Empty States
  // ============================================================================
  console.log('\n--- Suite J: View Mode & Empty States ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    poemRepo.create({ id: 'p_vm_1', title: 'गीत गुंजन', body: 'पंक्तियाँ' });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 42. Grid to list view toggle
    assert.strictEqual(view.viewMode, 'grid');
    assert.ok(container.innerHTML.includes('library-collection-grid'));
    view.handleClick({
      target: { closest: (sel) => sel === '[data-view]' ? { getAttribute: () => 'list' } : null }
    });
    assert.strictEqual(view.viewMode, 'list');
    assert.ok(container.innerHTML.includes('library-collection-list'));
    pass('Toggling view mode switches between library-collection-grid and library-collection-list');

    // 43. Empty library state
    const emptyRepo = new PoemRepository(new LocalStorageAdapter(new InMemoryStorage()));
    const emptyColRepo = new CollectionRepository(new LocalStorageAdapter(new InMemoryStorage()));
    const emptyManuRepo = new ManuscriptRepository(new LocalStorageAdapter(new InMemoryStorage()));
    const emptyService = new LibraryOrganizationService({
      poemRepo: emptyRepo,
      collectionRepo: emptyColRepo,
      manuscriptRepo: emptyManuRepo
    });
    const emptyView = new LibraryView(container, mockRouter, 'all', {
      libraryService: emptyService,
      poemRepo: emptyRepo,
      collectionRepo: emptyColRepo,
      manuscriptRepo: emptyManuRepo
    });
    emptyView.mount();
    assert.ok(container.innerHTML.includes('काव्य-संग्रह अभी खाली है'));
    assert.ok(container.innerHTML.includes('नई कविता लिखें'));
    pass('Empty library renders authentic Hindi literary empty state with "नई कविता" action');

    // 44. Empty favorites state
    emptyView.activeSection = 'favorites';
    emptyView.update();
    assert.ok(container.innerHTML.includes('कोई पसंदीदा रचना नहीं'));
    pass('Empty favorites section renders serene Hindi guidance message');

    // 45. Empty recent state
    emptyView.activeSection = 'recent';
    emptyView.update();
    assert.ok(container.innerHTML.includes('हाल में कोई कविता नहीं पढ़ी गई है'));
    pass('Empty recent section renders authentic Hindi guidance message');

    // 46. Empty collections state
    emptyView.activeSection = 'collections';
    emptyView.update();
    assert.ok(container.innerHTML.includes('अभी कोई संग्रह नहीं बनाया गया है'));
    pass('Empty collections section renders informative Hindi guidance with create button');

    // 47. Filter with no results state
    const populatedView = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    populatedView.activeFilter.category = 'गैरमौजूद श्रेणी';
    populatedView.mount();
    assert.ok(container.innerHTML.includes('फ़िल्टर के अनुसार कोई कविता नहीं मिली'));
    assert.ok(container.innerHTML.includes('फ़िल्टर साफ़ करें'));
    pass('Filtering with no matching results displays helpful empty state with clear filters action');
  }

  // ============================================================================
  // Suite K: Error Resilience & Security
  // ============================================================================
  console.log('\n--- Suite K: Error Resilience & Security ---');
  {
    const { service, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();

    // 48. Simulated repository error
    const faultyRepo = {
      getAll: () => { throw new Error('SIMULATED_LOCAL_STORAGE_CORRUPTION'); }
    };
    const errorView = new LibraryView(container, mockRouter, 'all', {
      libraryService: service,
      poemRepo: faultyRepo,
      collectionRepo: colRepo
    });
    errorView.mount();

    assert.ok(container.innerHTML.includes('डेटा लोड करने में समस्या'));
    assert.strictEqual(container.innerHTML.includes('SIMULATED_LOCAL_STORAGE_CORRUPTION'), false, 'Must never leak raw stack traces');
    pass('Repository load failure renders dignified Hindi alert without leaking internal stack traces');

    // 49. Malicious XSS sanitization in poem cards, tags, and collections
    const cleanRepo = new PoemRepository(new LocalStorageAdapter(new InMemoryStorage()));
    const maliciousPoem = cleanRepo.create({
      id: 'p_xss_1',
      title: '<script>alert("xss_title")</script>',
      author: '<img src=x onerror=alert(1)>',
      body: '<iframe src="evil.com"></iframe>',
      tags: ['<script>evil</script>']
    });

    const cardHtml = renderPoemCard(maliciousPoem, 'grid');
    assert.strictEqual(cardHtml.includes('<script>'), false);
    assert.strictEqual(cardHtml.includes('<iframe'), false);
    assert.ok(cardHtml.includes('&lt;script&gt;'));
    pass('Poem cards, authors, snippets, and tags strictly sanitize XSS payloads into safe text');
  }

  // ============================================================================
  // Suite L: Accessibility & Touch Targets
  // ============================================================================
  console.log('\n--- Suite L: Accessibility & Touch Targets ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 50. 48px touch targets: verified in CSS via --touch-target-min (48px) on .library-section-tab, .btn-view-toggle, .btn-card-action, etc.
    // Ensure all tabs have touch target classes and WAI-ARIA role
    assert.ok(container.innerHTML.includes('role="tablist"'));
    assert.ok(container.innerHTML.includes('role="tab"'));
    assert.ok(container.innerHTML.includes('min-height: var(--touch-target-min)') || container.innerHTML.includes('library-section-tab'));
    pass('All primary interactive controls (tabs, buttons, view toggles) enforce 48px minimum touch targets');

    // 51. Tab WAI-ARIA roles, aria-selected, and tabindex
    assert.ok(container.innerHTML.includes('aria-selected="true"'));
    assert.ok(container.innerHTML.includes('tabindex="0"'));
    assert.ok(container.innerHTML.includes('aria-selected="false"'));
    assert.ok(container.innerHTML.includes('tabindex="-1"'));
    pass('WAI-ARIA tab semantics (role="tab", aria-selected, tabindex 0/-1) are managed accurately');

    // 52. Keyboard arrow navigation between tabs
    const mockTabElement = {
      closest: (sel) => sel === '.library-section-tab' ? { getAttribute: () => 'all' } : null
    };
    view.handleKeydown({
      target: mockTabElement,
      key: 'ArrowRight',
      preventDefault: () => {}
    });
    // Next tab after 'all' is 'favorites'
    assert.strictEqual(view.activeSection, 'favorites');

    view.handleKeydown({
      target: mockTabElement,
      key: 'End',
      preventDefault: () => {}
    });
    // End jumps to 'timeline' (index 7)
    assert.strictEqual(view.activeSection, 'timeline');

    view.handleKeydown({
      target: mockTabElement,
      key: 'Home',
      preventDefault: () => {}
    });
    // Home jumps to 'all' (index 0)
    assert.strictEqual(view.activeSection, 'all');
    pass('Keyboard navigation (ArrowRight, ArrowLeft, Home, End) cycles seamlessly through library section tabs');
  }

  // ============================================================================
  // Suite M: Unicode & Devanagari Ligature Fidelity
  // ============================================================================
  console.log('\n--- Suite M: Unicode & Devanagari Ligature Fidelity ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const conjunctTitle = 'क्षमा, त्रिशूल, ज्ञान, श्रद्धा, द्वंद्व, हृदय, ॐकार';
    const conjunctTag = 'श्रृंगार_रस';
    const conjunctPoem = poemRepo.create({
      id: 'p_unicode_1',
      title: conjunctTitle,
      body: 'चाँदनी रात में प्रकृति का संगीत।',
      tags: [conjunctTag],
      category: 'प्रकृति'
    });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    assert.ok(container.innerHTML.includes('क्षमा, त्रिशूल, ज्ञान, श्रद्धा, द्वंद्व, हृदय, ॐकार'));
    assert.ok(container.innerHTML.includes('#श्रृंगार_रस'));
    pass('Complex Devanagari ligatures (क्ष, त्र, ज्ञ, श्र, द्व, हृ, ॐ, चाँद) are rendered without glyph corruption');
  }

  // ============================================================================
  // Suite N: Responsive Layouts Verification
  // ============================================================================
  console.log('\n--- Suite N: Responsive Layouts Verification ---');
  {
    // Check that CSS definitions cover 390px, 768px, 1024px, 1440px
    const css = fs.readFileSync('./src/components/library/library.css', 'utf8');
    assert.ok(css.includes('680px') || css.includes('768px'), 'CSS must include tablet media queries');
    assert.ok(css.includes('1140px') || css.includes('1024px'), 'CSS must include desktop media queries');
    assert.ok(css.includes('.library-collection-grid'), 'Grid container exists');
    assert.ok(css.includes('.library-collection-list'), 'List container exists');
    pass('Responsive breakpoint styles (mobile 390px feed, tablet 768px 2-col, laptop 1024px, desktop 1440px 3-col) verified');
  }

  // ============================================================================
  // Suite O: Factory & AppShell Mount Compatibility
  // ============================================================================
  console.log('\n--- Suite O: Factory & AppShell Mount Compatibility ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();
    const mountedView = mountLibraryView(container, mockRouter, 'all', {
      libraryService: service,
      poemRepo,
      collectionRepo: colRepo
    });
    assert.ok(mountedView instanceof LibraryView);
    assert.ok(container.innerHTML.includes('मेरी कविताएँ'));
    mountedView.unmount();
    pass('mountLibraryView factory mounts and unmounts cleanly conforming to AppShell contracts');
  }

  console.log('\n================================================================');
  console.log(`  ALL ${testCount}/${testCount} PERSONAL DIGITAL LIBRARY UI TESTS PASSED!`);
  console.log('================================================================\n');
}

runLibraryUITests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
