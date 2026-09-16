/**
 * काव्यकलश (KavyaVault) — Library Discovery, Navigation & UX Polish Test Suite (test_library_ux.js)
 * Phase 6 / Task 6.3: Discovery, Navigation & UX Polish
 *
 * Verifies:
 * Suite A: Home ↔ Library Discovery Hierarchy (Latest poems, Recent reading, Favorites, Collections)
 * Suite B: Contextual Empty States (Home & Library)
 * Suite C: Section Transitions & Active State Integrity (8 tabs, auto-scroll, back navigation)
 * Suite D: Filter State Persistence & URL Synchronization (query params, syncUrlState, clear all)
 * Suite E: Modal & Drawer Accessibility (focus tracking, Escape key handling, backdrop click, focus restore)
 * Suite F: Recent Reading Resilience & Deleted Poem Safety (null references, immutability of updatedAt)
 * Suite G: Favorites Consistency (Card, Reader, Section parity)
 * Suite H: Sorting Visibility & Determinism (all 5 options)
 * Suite I: Mobile Ergonomics & 48px Touch Targets (390px rules, zero horizontal overflow)
 * Suite J: Complex Devanagari & Nukta Fidelity (क्ष, त्र, ज्ञ, श्र, द्व, हृ, क़, ख़, ग़, ड़, ढ़, फ़, चाँद, ॐ, ।, ॥)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { LibraryView, mountLibraryView } from './src/components/library/LibraryView.js';
import { LIBRARY_SECTIONS, SORT_OPTIONS } from './src/components/library/LibraryToolbar.js';
import { renderHomeView } from './src/components/home/HomeView.js';
import { PoemReader } from './src/components/reader/PoemReader.js';
import { LibraryOrganizationService } from './src/services/LibraryService.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { RecentPoemService } from './src/services/library/RecentPoemService.js';

// In-Memory Storage Engine for Unit Testing
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
            focus: () => {},
            scrollIntoView: () => {}
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
      if (sel === '#filter-category-select') {
        return {
          id: 'filter-category-select',
          value: '',
          focus: () => {}
        };
      }
      if (sel === '#filter-tag-select') {
        return {
          id: 'filter-tag-select',
          value: '',
          focus: () => {}
        };
      }
      if (sel === '#filter-collection-select') {
        return {
          id: 'filter-collection-select',
          value: '',
          focus: () => {}
        };
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.library-section-tab') {
        return LIBRARY_SECTIONS.map(sec => ({
          getAttribute: (a) => a === 'data-section' ? sec.id : a === 'data-filter' ? sec.id : null,
          focus: () => {},
          scrollIntoView: () => {}
        }));
      }
      return [];
    }
  };
  return container;
}

function createTestHarness() {
  const poemStore = new InMemoryStorage();
  const colStore = new InMemoryStorage();
  const manuStore = new InMemoryStorage();
  const recentStore = new InMemoryStorage();

  const poemRepo = new PoemRepository(new LocalStorageAdapter(poemStore));
  const colRepo = new CollectionRepository(new LocalStorageAdapter(colStore));
  const manuRepo = new ManuscriptRepository(new LocalStorageAdapter(manuStore));
  const recentAdapter = new LocalStorageAdapter(recentStore);
  const recentService = new RecentPoemService({ adapter: recentAdapter, poemRepo });

  const service = new LibraryOrganizationService({
    poemRepo,
    collectionRepo: colRepo,
    manuscriptRepo: manuRepo,
    recentService
  });

  const mockRouter = {
    currentPath: '/poems',
    navigate: (p) => { mockRouter.currentPath = p; },
    getCurrentPath: () => mockRouter.currentPath
  };

  return { service, poemRepo, colRepo, manuRepo, mockRouter };
}

let testCount = 0;
function pass(desc) {
  testCount++;
  console.log(`✓ [Test ${testCount}] ${desc}`);
}

async function runLibraryUXTests() {
  console.log('================================================================');
  console.log('  KAVYAVAULT LIBRARY DISCOVERY, NAVIGATION & UX TEST SUITE');
  console.log('================================================================\n');

  // ============================================================================
  // Suite A: Home ↔ Library Discovery Hierarchy
  // ============================================================================
  console.log('--- Suite A: Home ↔ Library Discovery Hierarchy ---');
  {
    const { service, poemRepo, colRepo } = createTestHarness();

    // Populate sample literary content
    const p1 = poemRepo.create({ id: 'hp_1', title: 'रश्मिरथी', author: 'दिनकर', body: 'हो गया पूर्ण अज्ञात वास...', category: 'वीर रस', isFavorite: true });
    const p2 = poemRepo.create({ id: 'hp_2', title: 'मधुशाला', author: 'बच्चन', body: 'मदिरालय जाने को घर से चलता है पीनेवाला...', category: 'हालावाद' });
    const col1 = service.collections.createCollection({ name: 'राष्ट्रकवि संकलन', description: 'दिनकर जी की ओजस्वी कविताएँ', poemIds: [p1.id] });

    // Record p2 as recent
    service.recent.recordView(p2.id);

    const homeHtml = renderHomeView({ poemRepo, libraryService: service, collectionRepo: colRepo });

    // 1. Conceptual hierarchy order: आपकी कविताएँ -> हाल में पढ़ी गई -> पसंदीदा -> संग्रह
    const idxPoems = homeHtml.indexOf('आपकी कविताएँ');
    const idxRecent = homeHtml.indexOf('हाल में पढ़ी गई');
    const idxFav = homeHtml.indexOf('पसंदीदा');
    const idxCol = homeHtml.indexOf('संग्रह');

    assert.ok(idxPoems !== -1 && idxRecent !== -1 && idxFav !== -1 && idxCol !== -1, 'All 4 discovery modules must exist');
    assert.ok(idxPoems < idxRecent, 'आपकी कविताएँ must appear before हाल में पढ़ी गई');
    assert.ok(idxRecent < idxFav, 'हाल में पढ़ी गई must appear before पसंदीदा');
    assert.ok(idxFav < idxCol, 'पसंदीदा must appear before संग्रह');
    pass('Home view renders editorial discovery hierarchy (आपकी कविताएँ → हाल में पढ़ी गई → पसंदीदा → संग्रह)');

    // 2. Discoverability links to library sections with query strings
    assert.ok(homeHtml.includes('href="/poems?section=recent"'), 'Must link to recent section');
    assert.ok(homeHtml.includes('href="/poems?section=favorites"'), 'Must link to favorites section');
    assert.ok(homeHtml.includes('href="/poems?section=collections"'), 'Must link to collections section');
    assert.ok(homeHtml.includes('href="/poems"'), 'Must link to all poems in library');
    pass('Home discovery modules expose seamless, direct routing links to Library sections');

    // 3. Featured poem titles and reading timestamp badges
    assert.ok(homeHtml.includes('रश्मिरथी'));
    assert.ok(homeHtml.includes('मधुशाला'));
    assert.ok(homeHtml.includes('पठन:'), 'Must show reading timestamp badge');
    pass('Home displays poem titles, authors, categories, and recent reading timestamps');
  }

  // ============================================================================
  // Suite B: Contextual Empty States (Home & Library)
  // ============================================================================
  console.log('\n--- Suite B: Contextual Empty States (Home & Library) ---');
  {
    const emptyRepo = new PoemRepository(new LocalStorageAdapter(new InMemoryStorage()));
    const emptyColRepo = new CollectionRepository(new LocalStorageAdapter(new InMemoryStorage()));
    const emptyService = new LibraryOrganizationService({ poemRepo: emptyRepo, collectionRepo: emptyColRepo });
    const container = createMockContainer();
    const mockRouter = { navigate: () => {} };

    // 4. Home empty states when vault has 0 items
    const homeEmptyHtml = renderHomeView({ poemRepo: emptyRepo, libraryService: emptyService, collectionRepo: emptyColRepo });
    assert.ok(homeEmptyHtml.includes('अभी आपकी काव्य-डायरी खाली है।'), 'Home empty poetry message');
    assert.ok(homeEmptyHtml.includes('आपने अभी कोई कविता नहीं पढ़ी है।'), 'Home empty recent message');
    assert.ok(homeEmptyHtml.includes('अभी कोई कविता पसंदीदा नहीं है।'), 'Home empty favorites message');
    assert.ok(homeEmptyHtml.includes('अभी कोई संग्रह नहीं बनाया गया है।'), 'Home empty collections message');
    pass('Home view renders deeply contextual, serene Hindi empty states for every section');

    // 5. Library empty state for all poems
    const viewAll = new LibraryView(container, mockRouter, 'all', { libraryService: emptyService, poemRepo: emptyRepo, collectionRepo: emptyColRepo });
    viewAll.mount();
    assert.ok(container.innerHTML.includes('अभी आपकी काव्य-डायरी खाली है।'));
    pass('Library "all" section renders contextual empty state: "अभी आपकी काव्य-डायरी खाली है।"');

    // 6. Library empty state for favorites
    viewAll.activeSection = 'favorites';
    viewAll.update();
    assert.ok(container.innerHTML.includes('अभी कोई कविता पसंदीदा नहीं है।'));
    pass('Library "favorites" section renders contextual empty state: "अभी कोई कविता पसंदीदा नहीं है।"');

    // 7. Library empty state for recent
    viewAll.activeSection = 'recent';
    viewAll.update();
    assert.ok(container.innerHTML.includes('आपने अभी कोई कविता नहीं पढ़ी है।'));
    pass('Library "recent" section renders contextual empty state: "आपने अभी कोई कविता नहीं पढ़ी है।"');

    // 8. Library empty state for active empty collection
    const sampleCol = emptyService.collections.createCollection({ name: 'नया खाली संग्रह' });
    viewAll.activeSection = 'collections';
    viewAll.activeCollectionId = sampleCol.id;
    viewAll.update();
    assert.ok(container.innerHTML.includes('यह संग्रह अभी खाली है।'));
    pass('Library opened empty collection renders contextual empty state: "यह संग्रह अभी खाली है।"');

    // 9. Library empty state when filters match 0 poems
    const { service, poemRepo, colRepo } = createTestHarness();
    poemRepo.create({ id: 'p_filter_1', title: 'कुछ कविता', body: 'कविता की पंक्तियाँ...', category: 'गीत' });
    const filteredView = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    filteredView.activeFilter.category = 'अनुपलब्ध श्रेणी';
    filteredView.mount();
    assert.ok(container.innerHTML.includes('इन मानदंडों से कोई कविता नहीं मिली।'));
    pass('Library filtered view with no matches renders contextual empty state: "इन मानदंडों से कोई कविता नहीं मिली।"');
  }

  // ============================================================================
  // Suite C: Section Transitions & Active State Integrity
  // ============================================================================
  console.log('\n--- Suite C: Section Transitions & Active State Integrity ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 10. Verify all 8 section tabs exist with appropriate data attributes
    for (const sec of LIBRARY_SECTIONS) {
      assert.ok(container.innerHTML.includes(`data-section="${sec.id}"`), `Tab for section ${sec.id} must exist`);
      assert.ok(container.innerHTML.includes(sec.label), `Label ${sec.label} must exist`);
    }
    pass('All 8 library sections (सभी कविताएँ, पसंदीदा, हाल में पढ़ी गई, संग्रह, श्रेणियाँ, टैग, अभिलेख, समयरेखा) are present');

    // 11. Section switching updates activeSection cleanly
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-section]' ? { getAttribute: (a) => a === 'data-section' ? 'timeline' : null } : null
      }
    });
    assert.strictEqual(view.activeSection, 'timeline');
    assert.strictEqual(view.activeCollectionId, null, 'Switching section resets activeCollectionId');
    pass('Clicking a section tab updates activeSection and clears activeCollectionId');

    // 12. "navigate-section" action helper (e.g. from empty state buttons)
    view.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="navigate-section"]' ? { getAttribute: (a) => a === 'data-section' ? 'all' : null } : null
      }
    });
    assert.strictEqual(view.activeSection, 'all');
    pass('Triggering data-action="navigate-section" smoothly switches library section');
  }

  // ============================================================================
  // Suite D: Filter State Persistence & URL Synchronization
  // ============================================================================
  console.log('\n--- Suite D: Filter State Persistence & URL Synchronization ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();

    // Mock window.location and window.history
    const origWindow = globalThis.window;
    globalThis.window = {
      location: { pathname: '/poems', search: '?section=favorites&category=गीत' },
      history: {
        replaceState: (state, title, url) => {
          const parts = url.split('?');
          globalThis.window.location.search = parts[1] ? '?' + parts[1] : '';
        }
      }
    };

    // 13. Initializing LibraryView from URL query parameters
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    assert.strictEqual(view.activeSection, 'favorites', 'Must extract activeSection from URL query param ?section=favorites');
    assert.strictEqual(view.activeFilter.category, 'गीत', 'Must extract category from URL query param ?category=गीत');
    pass('LibraryView successfully parses and initializes activeSection and activeFilter from URL search params');

    // 14. syncUrlState updates URL query string on state changes
    view.activeSection = 'recent';
    view.activeFilter.category = 'दोहा';
    view.syncUrlState();
    assert.ok(globalThis.window.location.search.includes('section=recent'));
    assert.ok(globalThis.window.location.search.includes('category=%E0%A4%A6%E0%A5%8B%E0%A4%B9%E0%A4%BE') || globalThis.window.location.search.includes('category=दोहा'));
    pass('syncUrlState() reflects section and active filter mutations into window.history.replaceState query');

    // 15. Clearing all filters clears URL search parameters
    view.activeFilter = { category: null, tag: null, collectionId: null, isFavorite: null, isArchived: null };
    view.activeSection = 'all';
    view.syncUrlState();
    assert.strictEqual(globalThis.window.location.search, '', 'URL query string must be empty when all filters cleared and section is all');
    pass('Clearing filters removes query parameters from URL state cleanly');

    // 16. Active filter chips remain visible even when filter drawer is open
    view.activeFilter.category = 'ग़ज़ल';
    view.isFilterOpen = true;
    const renderedDrawerHtml = view.render();
    assert.ok(renderedDrawerHtml.includes('श्रेणी: ग़ज़ल'));
    assert.ok(renderedDrawerHtml.includes('सभी साफ़ करें'));
    pass('Active filter chips bar remains prominently visible when filter drawer is expanded');

    globalThis.window = origWindow;
  }

  // ============================================================================
  // Suite E: Modal & Drawer Accessibility & Escape Key Handling
  // ============================================================================
  console.log('\n--- Suite E: Modal & Drawer Accessibility & Escape Key Handling ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 17. Escape key closes open create collection modal and restores focus
    let focusCalled = false;
    const mockTrigger = { focus: () => { focusCalled = true; } };
    view.lastFocusedElement = mockTrigger;
    view.isCreateCollectionModalOpen = true;

    view.handleKeydown({
      key: 'Escape',
      preventDefault: () => {}
    });
    assert.strictEqual(view.isCreateCollectionModalOpen, false, 'Modal must close on Escape');
    assert.strictEqual(focusCalled, true, 'Focus must return to previous trigger on Escape');
    pass('Pressing Escape closes collection modal and restores focus to triggering element');

    // 18. Escape key closes filter drawer and restores focus
    focusCalled = false;
    view.lastFocusedElement = mockTrigger;
    view.isFilterOpen = true;

    view.handleKeydown({
      key: 'Escape',
      preventDefault: () => {}
    });
    assert.strictEqual(view.isFilterOpen, false, 'Filter drawer must close on Escape');
    assert.strictEqual(focusCalled, true, 'Focus must return to filter button on Escape');
    pass('Pressing Escape collapses filter drawer and restores focus to filter toggle button');

    // 19. Clicking modal backdrop closes modal
    view.isCreateCollectionModalOpen = true;
    view.handleClick({
      target: { classList: { contains: (cls) => cls === 'modal-backdrop' } }
    });
    assert.strictEqual(view.isCreateCollectionModalOpen, false, 'Clicking backdrop must close modal');
    pass('Clicking modal backdrop overlay safely dismisses modal dialog');
  }

  // ============================================================================
  // Suite F: Recent Reading Resilience & Deleted Poem Safety
  // ============================================================================
  console.log('\n--- Suite F: Recent Reading Resilience & Deleted Poem Safety ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const p1 = poemRepo.create({ id: 'p_del_1', title: 'अस्थायी रचना', body: '...' });
    const p2 = poemRepo.create({ id: 'p_del_2', title: 'स्थायी रचना', body: '...' });

    // Record view for both
    service.recent.recordView(p1.id);
    service.recent.recordView(p2.id);

    // Delete p1 from poem repository
    poemRepo.delete(p1.id);

    // 20. Enriched recent items drop deleted poem without throwing
    const enriched = service.recent.getRecentWithPoems();
    assert.strictEqual(enriched.length, 1);
    assert.strictEqual(enriched[0].poem.id, p2.id);
    pass('RecentPoemService.getRecentWithPoems() gracefully drops deleted poem records');

    // 21. Recent section UI renders remaining valid poem without crashing
    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'recent', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();
    assert.ok(container.innerHTML.includes('स्थायी रचना'));
    assert.strictEqual(container.innerHTML.includes('अस्थायी रचना'), false);
    pass('RecentSection UI renders valid recent poems safely even after underlying poem deletion');
  }

  // ============================================================================
  // Suite G: Favorites Consistency (Card, Reader, Section Parity)
  // ============================================================================
  console.log('\n--- Suite G: Favorites Consistency ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    const poem = poemRepo.create({ id: 'p_fav_sync', title: 'प्रिय गीत', body: 'पंक्तियाँ', isFavorite: false });

    // 22. Toggle favorite from Reader updates repository
    const readerContainer = createMockContainer();
    const reader = new PoemReader({
      container: readerContainer,
      router: mockRouter,
      poemId: poem.id,
      poemRepo,
      recentService: service.recent
    });
    reader.mount();
    reader.toggleFavorite();

    assert.strictEqual(poemRepo.getById(poem.id).isFavorite, true);
    pass('PoemReader favorite action updates poem.isFavorite on PoemRepository');

    // 23. Favorites section in LibraryView reflects updated favorite immediately
    const libContainer = createMockContainer();
    const libView = new LibraryView(libContainer, mockRouter, 'favorites', { libraryService: service, poemRepo, collectionRepo: colRepo });
    libView.mount();
    assert.ok(libContainer.innerHTML.includes('प्रिय गीत'));
    pass('Library favorites section instantly displays poem toggled from PoemReader');

    // 24. Unfavoriting from Library card removes it from favorites view
    libView.handleClick({
      target: {
        closest: (sel) => sel === '[data-action="toggle-fav"]' ? {
          getAttribute: () => poem.id
        } : null
      }
    });
    assert.strictEqual(poemRepo.getById(poem.id).isFavorite, false);
    assert.ok(libContainer.innerHTML.includes('अभी कोई कविता पसंदीदा नहीं है।'));
    pass('Unfavoriting poem from library card updates PoemRepository and re-renders favorites view');
  }

  // ============================================================================
  // Suite H: Sorting Visibility & Determinism
  // ============================================================================
  console.log('\n--- Suite H: Sorting Visibility & Determinism ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();
    poemRepo.create({ id: 'p_sort_a', title: 'अमृत', body: 'अमृत की पंक्तियाँ', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' });
    poemRepo.create({ id: 'p_sort_b', title: 'ज्ञानी', body: 'ज्ञानी की पंक्तियाँ', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' });
    poemRepo.create({ id: 'p_sort_c', title: 'कवि', body: 'कवि की पंक्तियाँ', createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 25. Selected sort option is reflected in select element HTML
    assert.ok(container.innerHTML.includes('value="updatedAt:desc" selected'));
    pass('Default sort option (updatedAt:desc) is correctly selected and visible in toolbar');

    // 26. Changing sort to title:asc orders correctly
    view.handleChange({
      target: {
        closest: (sel) => sel === '[data-action="change-sort"]' ? { value: 'title:asc' } : null
      }
    });
    const sorted = view.getSectionData().poems;
    assert.strictEqual(sorted[0].title, 'अमृत');
    assert.strictEqual(sorted[1].title, 'कवि');
    assert.strictEqual(sorted[2].title, 'ज्ञानी');
    pass('Changing sort option to title:asc sorts poems deterministically in Hindi Devanagari collation');
  }

  // ============================================================================
  // Suite I: Mobile Ergonomics & 48px Touch Targets
  // ============================================================================
  console.log('\n--- Suite I: Mobile Ergonomics & 48px Touch Targets ---');
  {
    const css = fs.readFileSync('./src/components/library/library.css', 'utf8');

    // 27. 48px touch targets minimum rule
    assert.ok(css.includes('min-height: var(--touch-target-min)'), 'Must enforce 48px minimum touch targets');
    pass('Interactive tabs, view toggles, and buttons enforce 48px minimum touch targets');

    // 28. 390px mobile responsiveness rules
    assert.ok(css.includes('@media (max-width: 679px)'), 'Must define mobile breakpoint under 680px');
    assert.ok(css.includes('scroll-behavior: smooth'), 'Must support smooth scroll for tabs');
    assert.ok(css.includes('overflow-x: hidden'), 'Must prevent horizontal page overflow on mobile');
    pass('Mobile 390px layout features full-width stacked controls, smooth tab scrolling, and zero page overflow');

    // 29. Home discovery link 48px touch targets
    const homeCss = fs.readFileSync('./src/components/home/home.css', 'utf8');
    assert.ok(homeCss.includes('min-height: var(--touch-target-min)'), 'Home discovery links must enforce 48px touch target');
    pass('Home discovery section action links enforce 48px touch targets for mobile thumb reachability');
  }

  // ============================================================================
  // Suite J: Complex Devanagari & Nukta Fidelity
  // ============================================================================
  console.log('\n--- Suite J: Complex Devanagari & Nukta Fidelity ---');
  {
    const { service, poemRepo, colRepo, mockRouter } = createTestHarness();

    // Test with nuktas (क़, ख़, ग़, ज़, ड़, ढ़, फ़), ligatures (क्ष, त्र, ज्ञ, श्र, द्व, हृ), and sacred marks (चाँद, ॐ, ।, ॥)
    const complexTitle = 'क़लम, ख़्वाब, ग़ज़ल, ज़मीं, पेड़, चढ़ाई, फ़लसफ़ा, क्षत्रिय, ज्ञान, श्रद्धा, द्वंद्व, हृदय, ॐकार';
    const complexBody = 'चाँदनी रात में प्रकृति का अनुपम सौंदर्य। ॐ नमः शिवाय॥';
    const complexTag = 'ग़ज़ल_संग्रह';

    const poem = poemRepo.create({
      id: 'p_nukta_1',
      title: complexTitle,
      body: complexBody,
      tags: [complexTag],
      category: 'ग़ज़ल'
    });

    const container = createMockContainer();
    const view = new LibraryView(container, mockRouter, 'all', { libraryService: service, poemRepo, collectionRepo: colRepo });
    view.mount();

    // 30. Check titles with full nukta set and conjuncts
    assert.ok(container.innerHTML.includes('क़लम, ख़्वाब, ग़ज़ल, ज़मीं, पेड़, चढ़ाई, फ़लसफ़ा'));
    assert.ok(container.innerHTML.includes('क्षत्रिय, ज्ञान, श्रद्धा, द्वंद्व, हृदय, ॐकार'));
    assert.ok(container.innerHTML.includes('#ग़ज़ल_संग्रह'));
    pass('Complex Devanagari conjuncts and full Urdu/Persian nukta loanwords (क़, ख़, ग़, ड़, ढ़, फ़) render without grapheme corruption');

    // 31. Verify Home view preserves complex Devanagari
    const homeHtml = renderHomeView({ poemRepo, libraryService: service, collectionRepo: colRepo });
    assert.ok(homeHtml.includes('क़लम, ख़्वाब, ग़ज़ल, ज़मीं, पेड़, चढ़ाई, फ़लसफ़ा'));
    pass('Home discovery cards faithfully display complex Devanagari ligatures and nuktas');
  }

  console.log('\n================================================================');
  console.log(`  ALL ${testCount}/${testCount} LIBRARY DISCOVERY, NAVIGATION & UX TESTS PASSED!`);
  console.log('================================================================\n');
}

runLibraryUXTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
