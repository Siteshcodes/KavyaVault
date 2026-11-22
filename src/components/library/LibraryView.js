/**
 * काव्यकलश (KavyaVault) — Personal Digital Library View Component (LibraryView.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Full-featured archival sanctuary orchestrating 8 library sections:
 * 1. सभी कविताएँ (All Poems)
 * 2. पसंदीदा (Favorites)
 * 3. हाल में पढ़ी गई (Recently Viewed)
 * 4. संग्रह (Collections)
 * 5. श्रेणियाँ (Categories)
 * 6. टैग (Tags)
 * 7. अभिलेख (Archived)
 * 8. समयरेखा (Chronological Timeline)
 *
 * Adheres strictly to local-first, privacy-first, and decoupled architecture.
 */

import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { renderLibraryToolbar, LIBRARY_SECTIONS } from './LibraryToolbar.js';
import { renderPoemCard } from './PoemCard.js';
import { renderCollectionsSection } from './CollectionsSection.js';
import { renderCategoriesSection } from './CategoriesSection.js';
import { renderTagsSection } from './TagsSection.js';
import { renderRecentSection } from './RecentSection.js';
import { renderTimelineSection } from './TimelineSection.js';
import { renderLibraryFilterDrawer } from './LibraryFilterDrawer.js';

import { libraryService } from '../../services/LibraryService.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { collectionRepository } from '../../services/CollectionRepository.js';
import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';
import { SORT_FIELD, SORT_ORDER } from '../../services/library/libraryTypes.js';

export class LibraryView {
  /**
   * @param {HTMLElement} container
   * @param {Object} router
   * @param {string} [initialFilter='all']
   * @param {Object} [options={}]
   * @param {Object} [options.libraryService=libraryService]
   * @param {Object} [options.poemRepo=poemRepository]
   * @param {Object} [options.collectionRepo=collectionRepository]
   * @param {Object} [options.manuscriptRepo=manuscriptRepository]
   */
  constructor(container, router, initialFilter = 'all', options = {}) {
    this.container = container;
    this.router = router;
    this.service = options.libraryService || libraryService;
    this.poemRepo = options.poemRepo || poemRepository;
    this.collectionRepo = options.collectionRepo || collectionRepository;
    this.manuscriptRepo = options.manuscriptRepo || manuscriptRepository;

    // Check URL query parameters if present in browser
    const queryParams = typeof window !== 'undefined' && window.location && window.location.search
      ? new URLSearchParams(window.location.search)
      : null;

    const sectionFromQuery = queryParams ? (queryParams.get('section') || queryParams.get('filter')) : null;
    this.activeSection = sectionFromQuery || initialFilter || 'all';

    this.viewMode = (queryParams && queryParams.get('view')) || options.initialView || 'grid';
    this.currentSort = (queryParams && queryParams.get('sort')) || options.initialSort || 'updatedAt:desc';
    this.isFilterOpen = false;

    // Filter criteria
    this.activeFilter = {
      category: (queryParams && queryParams.get('category')) || options.initialCategory || null,
      tag: (queryParams && queryParams.get('tag')) || options.initialTag || null,
      collectionId: (queryParams && queryParams.get('collectionId')) || options.initialCollectionId || null,
      isFavorite: (queryParams && queryParams.get('favorites') === 'true') || options.initialIsFavorite || null,
      isArchived: (queryParams && queryParams.get('archived') === 'true') || options.initialIsArchived || null
    };

    // Sub-view state
    this.activeCollectionId = (queryParams && queryParams.get('collectionId') && this.activeSection === 'collections')
      ? queryParams.get('collectionId')
      : null;
    this.isCreateCollectionModalOpen = false;
    this.editingCollection = null;
    this.isAddPoemsModalOpen = false;
    this.lastFocusedElement = null;

    // Bound event handlers
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundChangeHandler = this.handleChange.bind(this);
    this.boundSubmitHandler = this.handleSubmit.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
  }

  /**
   * Synchronizes current active section, sort, and filters to browser URL query state
   */
  syncUrlState() {
    if (typeof window === 'undefined' || !window.history || !window.location) return;
    try {
      const params = new URLSearchParams();
      if (this.activeSection && this.activeSection !== 'all') {
        params.set('section', this.activeSection);
      }
      if (this.activeFilter.category) {
        params.set('category', this.activeFilter.category);
      }
      if (this.activeFilter.tag) {
        params.set('tag', this.activeFilter.tag);
      }
      if (this.activeFilter.collectionId) {
        params.set('collectionId', this.activeFilter.collectionId);
      }
      if (this.activeFilter.isFavorite) {
        params.set('favorites', 'true');
      }
      if (this.currentSort && this.currentSort !== 'updatedAt:desc') {
        params.set('sort', this.currentSort);
      }
      if (this.viewMode && this.viewMode !== 'grid') {
        params.set('view', this.viewMode);
      }

      const queryString = params.toString() ? '?' + params.toString() : '';
      const newPath = window.location.pathname + queryString;
      if (window.location.search !== queryString && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', newPath);
      }
    } catch {
      // Ignore URL sync errors in test/restricted environments
    }
  }

  /**
   * Resolves current sort parameters from currentSort string
   */
  getSortParams() {
    const [field, order] = (this.currentSort || 'updatedAt:desc').split(':');
    return {
      sortField: field || SORT_FIELD.UPDATED_AT,
      sortOrder: order || SORT_ORDER.DESC
    };
  }

  /**
   * Queries poems for the active view based on section and active filters
   */
  getSectionData() {
    try {
      const allPoems = this.poemRepo.getAll({ includeArchived: true });
      const { sortField, sortOrder } = this.getSortParams();

      // 1. Collections section
      if (this.activeSection === 'collections') {
        const collections = this.service.collections.listCollections();
        let activeCollection = null;
        let collectionPoems = [];
        let availablePoemsToAdd = [];

        if (this.activeCollectionId) {
          activeCollection = this.service.collections.getCollection(this.activeCollectionId);
          if (activeCollection) {
            collectionPoems = this.service.collections.getCollectionPoems(this.activeCollectionId);
            // Non-archived poems not already in collection
            const existingIds = new Set(activeCollection.poemIds || []);
            availablePoemsToAdd = allPoems.filter(p => !p.isArchived && !existingIds.has(p.id));
          }
        }

        return {
          type: 'collections',
          collections,
          activeCollection,
          collectionPoems,
          availablePoemsToAdd
        };
      }

      // 2. Categories section
      if (this.activeSection === 'categories') {
        const activePoems = allPoems.filter(p => !p.isArchived);
        const categories = this.service.categories.extractCategoriesFromPoems(activePoems);
        return {
          type: 'categories',
          categories
        };
      }

      // 3. Tags section
      if (this.activeSection === 'tags') {
        const activePoems = allPoems.filter(p => !p.isArchived);
        const tags = this.service.tags.extractTagsFromPoems(activePoems);
        return {
          type: 'tags',
          tags
        };
      }

      // 4. Recent section
      if (this.activeSection === 'recent') {
        const recentItems = this.service.recent.getRecentWithPoems({ poemRepo: this.poemRepo });
        return {
          type: 'recent',
          recentItems
        };
      }

      // 5. Timeline section
      if (this.activeSection === 'timeline') {
        let manuscripts = [];
        try {
          manuscripts = (this.manuscriptRepo && typeof this.manuscriptRepo.getAll === 'function')
            ? this.manuscriptRepo.getAll()
            : [];
        } catch (mErr) {
          manuscripts = [];
        }
        if (this.manuscriptRepo && this.service.timeline) {
          this.service.timeline.manuscriptRepo = this.manuscriptRepo;
        }
        const events = this.service.timeline.getTimeline(allPoems);
        return {
          type: 'timeline',
          events
        };
      }

      // 6. Favorites section
      if (this.activeSection === 'favorites') {
        const filterInput = {
          ...this.activeFilter,
          isFavorite: true,
          isArchived: false,
          sortField,
          sortOrder
        };
        const queryResult = this.service.query(filterInput, { poems: allPoems });
        return {
          type: 'poems',
          poems: queryResult.poems,
          count: queryResult.totalCount
        };
      }

      // 7. Archived section
      if (this.activeSection === 'archived') {
        const filterInput = {
          ...this.activeFilter,
          isArchived: true,
          sortField,
          sortOrder
        };
        const queryResult = this.service.query(filterInput, { poems: allPoems });
        return {
          type: 'poems',
          poems: queryResult.poems,
          count: queryResult.totalCount
        };
      }

      // 8. Default: 'all' section
      const filterInput = {
        ...this.activeFilter,
        isArchived: this.activeFilter.isArchived !== null ? this.activeFilter.isArchived : false,
        sortField,
        sortOrder
      };
      const queryResult = this.service.query(filterInput, { poems: allPoems });
      return {
        type: 'poems',
        poems: queryResult.poems,
        count: queryResult.totalCount
      };
    } catch (err) {
      console.error('[LibraryView] Error querying section data:', err);
      return null;
    }
  }

  /**
   * Counts active filters applied
   */
  getActiveFilterCount() {
    let count = 0;
    if (this.activeFilter.category) count++;
    if (this.activeFilter.tag) count++;
    if (this.activeFilter.collectionId) count++;
    if (this.activeFilter.isFavorite) count++;
    if (this.activeFilter.isArchived) count++;
    return count;
  }

  /**
   * Renders the complete library view HTML
   */
  render() {
    const data = this.getSectionData();

    // 1. Safe Error State
    if (data === null) {
      return `
        <div class="library-view standard-page-view" role="region" aria-label="काव्य पुस्तकालय">
          ${renderPageHeader({
            title: 'मेरी कविताएँ',
            subtitle: 'काव्य पुस्तकालय',
            description: 'आपकी लिखी और सँजोई हुई सभी रचनाएँ।'
          })}
          <div class="library-error-state" role="alert">
            ${renderEmptyState({
              icon: 'book',
              heading: 'डेटा लोड करने में समस्या',
              text: 'काव्य पुस्तकालय लोड करने में अप्रत्याशित समस्या उत्पन्न हुई। कृपया पुनः प्रयास करें।',
              primaryAction: `
                <button type="button" class="btn-primary-action" data-action="reload-view" aria-label="पुनः प्रयास करें">
                  <span>पुनः प्रयास करें</span>
                </button>
              `
            })}
          </div>
        </div>
      `;
    }

    // 2. Page Header with "नई कविता" action
    const headerHtml = renderPageHeader({
      title: 'मेरी कविताएँ',
      subtitle: 'साहित्यिक धरोहर व पुस्तकालय',
      description: 'अपनी कविताएँ पढ़ें और संग्रह में रखें।',
      action: `
        <a href="${ROUTES.NEW_POEM}" data-link class="btn-primary-action" aria-label="नई कविता लिखें">
          ${getIconSvg('quill', 'nav-icon')}
          <span>नई कविता</span>
        </a>
      `
    });

    // Determine count for display
    let itemCount = 0;
    if (data.type === 'poems') itemCount = data.count || 0;
    else if (data.type === 'collections') itemCount = (data.collections || []).length;
    else if (data.type === 'categories') itemCount = (data.categories || []).length;
    else if (data.type === 'tags') itemCount = (data.tags || []).length;
    else if (data.type === 'recent') itemCount = (data.recentItems || []).length;
    else if (data.type === 'timeline') itemCount = (data.events || []).length;

    const countLabelMap = {
      collections: `${itemCount} संग्रह`,
      categories: `${itemCount} श्रेणियाँ`,
      tags: `${itemCount} टैग`,
      recent: `${itemCount} हालिया पठन`,
      timeline: `${itemCount} घटनाक्रम`
    };

    // 3. Toolbar
    const showSortAndFilter = (data.type === 'poems' || data.type === 'recent');
    const toolbarHtml = renderLibraryToolbar({
      activeSection: this.activeSection,
      activeFilter: this.activeSection,
      viewMode: this.viewMode,
      count: itemCount,
      countLabel: countLabelMap[data.type] || null,
      currentSort: this.currentSort,
      isFilterOpen: this.isFilterOpen,
      activeFilterCount: this.getActiveFilterCount(),
      showSortAndFilter
    });

    // 4. Filter Drawer
    const allPoems = this.poemRepo.getAll({ includeArchived: true });
    const availableCategories = this.service.categories.extractCategoriesFromPoems(allPoems);
    const availableTags = this.service.tags.extractTagsFromPoems(allPoems);
    let availableCollections = [];
    try {
      availableCollections = this.service && this.service.collections ? this.service.collections.listCollections() : [];
    } catch {
      availableCollections = [];
    }

    const filterDrawerHtml = showSortAndFilter
      ? renderLibraryFilterDrawer({
          isOpen: this.isFilterOpen,
          activeFilter: this.activeFilter,
          categories: availableCategories,
          tags: availableTags,
          collections: availableCollections
        })
      : '';

    // 5. Section Content Area
    let sectionContentHtml = '';

    if (data.type === 'collections') {
      sectionContentHtml = renderCollectionsSection({
        collections: data.collections,
        activeCollection: data.activeCollection,
        collectionPoems: data.collectionPoems,
        viewMode: this.viewMode,
        isCreateModalOpen: this.isCreateCollectionModalOpen,
        editingCollection: this.editingCollection,
        isAddPoemsModalOpen: this.isAddPoemsModalOpen,
        availablePoemsToAdd: data.availablePoemsToAdd
      });
    } else if (data.type === 'categories') {
      sectionContentHtml = renderCategoriesSection({
        categories: data.categories,
        selectedCategory: this.activeFilter.category
      });
    } else if (data.type === 'tags') {
      sectionContentHtml = renderTagsSection({
        tags: data.tags,
        selectedTag: this.activeFilter.tag
      });
    } else if (data.type === 'recent') {
      sectionContentHtml = renderRecentSection({
        recentItems: data.recentItems,
        viewMode: this.viewMode
      });
    } else if (data.type === 'timeline') {
      sectionContentHtml = renderTimelineSection({
        events: data.events
      });
    } else {
      // Standard Poems List / Grid
      if (data.poems.length === 0) {
        if (this.activeSection === 'favorites') {
          sectionContentHtml = renderEmptyState({
            icon: 'heart',
            heading: 'अभी कोई कविता पसंदीदा नहीं है।',
            text: 'कोई पसंदीदा रचना नहीं मिली। अपनी प्रिय कविताओं को दिल के चिह्न (♥) से पसंदीदा में जोड़ें।',
            primaryAction: `
              <button type="button" class="btn-primary-action" data-action="navigate-section" data-section="all" aria-label="सभी कविताएँ देखें">
                ${getIconSvg('book', 'nav-icon')}
                <span>सभी कविताएँ देखें</span>
              </button>
            `
          });
        } else if (this.activeSection === 'archived') {
          sectionContentHtml = renderEmptyState({
            icon: 'archive',
            heading: 'अभिलेखागार रिक्त है',
            text: 'वर्तमान में कोई भी रचना अभिलेख में नहीं रखी गई है।',
            primaryAction: `
              <button type="button" class="btn-primary-action" data-action="navigate-section" data-section="all" aria-label="पुस्तकालय पर लौटें">
                ${getIconSvg('book', 'nav-icon')}
                <span>पुस्तकालय पर लौटें</span>
              </button>
            `
          });
        } else if (this.getActiveFilterCount() > 0) {
          sectionContentHtml = renderEmptyState({
            icon: 'filter',
            heading: 'इन मानदंडों से कोई कविता नहीं मिली।',
            text: 'फ़िल्टर के अनुसार कोई कविता नहीं मिली। चयनित श्रेणी, टैग अथवा संग्रह के मानदंड बदलें या साफ़ करें।',
            primaryAction: `
              <button type="button" class="btn-primary-action" data-action="clear-all-filters" aria-label="सभी फ़िल्टर हटाएं">
                <span>फ़िल्टर साफ़ करें</span>
              </button>
            `
          });
        } else {
          sectionContentHtml = renderEmptyState({
            icon: 'book',
            heading: 'अभी आपकी काव्य-डायरी खाली है।',
            text: 'काव्य-संग्रह अभी खाली है। अपनी पहली रचना लिखें और उसे इस व्यक्तिगत डिजिटल पुस्तकालय में संजोएं।',
            primaryAction: `
              <a href="${ROUTES.NEW_POEM}" data-link class="btn-primary-action" aria-label="नई कविता लिखें">
                ${getIconSvg('quill', 'nav-icon')}
                <span>नई कविता लिखें</span>
              </a>
            `
          });
        }
      } else {
        const collectionClass = this.viewMode === 'list'
          ? 'library-collection-list'
          : 'library-collection-grid';

        const cardsHtml = data.poems
          .map(poem => renderPoemCard(poem, this.viewMode))
          .join('');

        sectionContentHtml = `
          <div class="${collectionClass}" role="feed" aria-label="काव्य रचना सूची">
            ${cardsHtml}
          </div>
        `;
      }
    }

    return `
      <div class="library-view standard-page-view" role="region" aria-label="काव्य पुस्तकालय">
        ${headerHtml}
        ${toolbarHtml}
        ${filterDrawerHtml}
        <section class="library-content-area" id="library-panel-${this.activeSection}" role="tabpanel" aria-labelledby="library-tab-${this.activeSection}">
          ${sectionContentHtml}
        </section>
      </div>
    `;
  }

  /**
   * Updates the view in DOM
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
    this.syncUrlState();
  }

  /**
   * Mounts the view and attaches listeners
   */
  mount() {
    this.unmount();
    this.container.addEventListener('click', this.boundClickHandler);
    this.container.addEventListener('change', this.boundChangeHandler);
    this.container.addEventListener('submit', this.boundSubmitHandler);
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.boundKeydownHandler);
    }
    this.update();
  }

  /**
   * Unmounts the view and cleans up
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
      this.container.removeEventListener('change', this.boundChangeHandler);
      this.container.removeEventListener('submit', this.boundSubmitHandler);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.boundKeydownHandler);
    }
  }

  /**
   * Handles keyboard navigation on section tabs and modal Escape closing
   */
  handleKeydown(e) {
    // 1. Accessible Escape key handling to close modals & filter drawer
    if (e.key === 'Escape') {
      if (this.isCreateCollectionModalOpen || this.editingCollection || this.isAddPoemsModalOpen) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        this.isCreateCollectionModalOpen = false;
        this.editingCollection = null;
        this.isAddPoemsModalOpen = false;
        this.update();
        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
          this.lastFocusedElement.focus();
        }
        return;
      }
      if (this.isFilterOpen) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        this.isFilterOpen = false;
        this.update();
        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
          this.lastFocusedElement.focus();
        }
        return;
      }
    }

    const activeTab = e.target.closest('.library-section-tab');
    if (!activeTab) return;

    const rawTabs = this.container.querySelectorAll ? this.container.querySelectorAll('.library-section-tab') : [];
    const tabs = Array.from(rawTabs);
    let currentIndex = tabs.indexOf(activeTab);

    if (currentIndex === -1) {
      const sectionAttr = typeof activeTab.getAttribute === 'function'
        ? (activeTab.getAttribute('data-section') || activeTab.getAttribute('data-filter'))
        : this.activeSection;
      currentIndex = LIBRARY_SECTIONS.findIndex(s => s.id === sectionAttr);
      if (currentIndex !== -1) {
        let nextIndex = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          nextIndex = (currentIndex + 1) % LIBRARY_SECTIONS.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          nextIndex = (currentIndex - 1 + LIBRARY_SECTIONS.length) % LIBRARY_SECTIONS.length;
        } else if (e.key === 'Home') {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          nextIndex = 0;
        } else if (e.key === 'End') {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          nextIndex = LIBRARY_SECTIONS.length - 1;
        }

        if (nextIndex !== null) {
          const nextSection = LIBRARY_SECTIONS[nextIndex].id;
          this.activeSection = nextSection;
          this.update();
          if (this.container.querySelector) {
            const updatedTab = this.container.querySelector(`#library-tab-${nextSection}`);
            if (updatedTab && typeof updatedTab.focus === 'function') updatedTab.focus();
          }
        }
        return;
      }
    }

    if (currentIndex === -1 || tabs.length === 0) return;

    let nextIndex = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      const nextTab = tabs[nextIndex];
      const nextSection = nextTab && typeof nextTab.getAttribute === 'function'
        ? nextTab.getAttribute('data-section')
        : null;
      if (nextSection) {
        this.activeSection = nextSection;
        this.update();
        if (this.container.querySelector) {
          const updatedTab = this.container.querySelector(`#library-tab-${nextSection}`);
          if (updatedTab && typeof updatedTab.focus === 'function') updatedTab.focus();
        }
      }
    }
  }

  /**
   * Centralized click delegation
   */
  handleClick(event) {
    // 0. Close modal on backdrop click
    if (event.target && event.target.classList && event.target.classList.contains('modal-backdrop')) {
      this.isCreateCollectionModalOpen = false;
      this.editingCollection = null;
      this.isAddPoemsModalOpen = false;
      this.update();
      if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
        this.lastFocusedElement.focus();
      }
      return;
    }

    // 1. Tab / Section navigation
    const sectionBtn = event.target.closest('[data-section]');
    if (sectionBtn) {
      const section = sectionBtn.getAttribute('data-section');
      if (section && section !== this.activeSection) {
        this.activeSection = section;
        this.activeCollectionId = null;
        this.update();
        if (this.container.querySelector) {
          const updatedTab = this.container.querySelector(`#library-tab-${section}`);
          if (updatedTab && typeof updatedTab.scrollIntoView === 'function') {
            updatedTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }
      return;
    }

    // 1b. Navigate section via action
    const navBtn = event.target.closest('[data-action="navigate-section"]');
    if (navBtn) {
      const section = navBtn.getAttribute('data-section');
      if (section) {
        this.activeSection = section;
        this.activeCollectionId = null;
        this.update();
        if (this.container.querySelector) {
          const updatedTab = this.container.querySelector(`#library-tab-${section}`);
          if (updatedTab && typeof updatedTab.scrollIntoView === 'function') {
            updatedTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }
      return;
    }

    // 2. View mode toggle (grid / list)
    const viewBtn = event.target.closest('[data-view]');
    if (viewBtn) {
      const mode = viewBtn.getAttribute('data-view');
      if (mode && mode !== this.viewMode) {
        this.viewMode = mode;
        this.update();
      }
      return;
    }

    // 3. Filter Drawer Toggle
    const filterToggleBtn = event.target.closest('[data-action="toggle-filter-drawer"]');
    if (filterToggleBtn) {
      if (!this.isFilterOpen && typeof document !== 'undefined' && document.activeElement) {
        this.lastFocusedElement = document.activeElement;
      }
      this.isFilterOpen = !this.isFilterOpen;
      this.update();
      if (this.isFilterOpen && this.container.querySelector) {
        const catSelect = this.container.querySelector('#filter-category-select');
        if (catSelect && typeof catSelect.focus === 'function') {
          catSelect.focus();
        }
      } else if (!this.isFilterOpen && this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
        this.lastFocusedElement.focus();
      }
      return;
    }

    // 4. Remove active filter chip
    const chipBtn = event.target.closest('[data-action="remove-filter-chip"]');
    if (chipBtn) {
      const key = chipBtn.getAttribute('data-filter-key');
      if (key && key in this.activeFilter) {
        this.activeFilter[key] = null;
        this.update();
      }
      return;
    }

    // 5. Clear all filters
    const clearBtn = event.target.closest('[data-action="clear-all-filters"]');
    if (clearBtn) {
      this.activeFilter = {
        category: null,
        tag: null,
        collectionId: null,
        isFavorite: null,
        isArchived: null
      };
      this.update();
      return;
    }

    // 6. Apply filter drawer
    const applyBtn = event.target.closest('[data-action="apply-filter-drawer"]');
    if (applyBtn) {
      const catSelect = this.container.querySelector('#filter-category-select');
      const tagSelect = this.container.querySelector('#filter-tag-select');
      const colSelect = this.container.querySelector('#filter-collection-select');

      if (catSelect) this.activeFilter.category = catSelect.value || null;
      if (tagSelect) this.activeFilter.tag = tagSelect.value || null;
      if (colSelect) this.activeFilter.collectionId = colSelect.value || null;

      this.isFilterOpen = false;
      this.update();
      if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
        this.lastFocusedElement.focus();
      }
      return;
    }

    // 7. Select category from Categories section
    const catSelectBtn = event.target.closest('[data-action="select-category"]');
    if (catSelectBtn) {
      const category = catSelectBtn.getAttribute('data-category');
      if (category) {
        this.activeFilter.category = category;
        this.activeSection = 'all';
        this.update();
      }
      return;
    }

    // 8. Select tag from Tags section
    const tagSelectBtn = event.target.closest('[data-action="select-tag"]');
    if (tagSelectBtn) {
      const tag = tagSelectBtn.getAttribute('data-tag');
      if (tag) {
        this.activeFilter.tag = tag;
        this.activeSection = 'all';
        this.update();
      }
      return;
    }

    // 9. Collections Section Actions
    // Open Collection
    const openColBtn = event.target.closest('[data-action="open-collection"]');
    if (openColBtn) {
      const colId = openColBtn.getAttribute('data-collection-id');
      if (colId) {
        this.activeCollectionId = colId;
        this.activeSection = 'collections';
        this.update();
      }
      return;
    }

    // Back to Collections
    const backColBtn = event.target.closest('[data-action="back-to-collections"]');
    if (backColBtn) {
      this.activeCollectionId = null;
      this.update();
      return;
    }

    // Open Create Collection Modal
    const openCreateBtn = event.target.closest('[data-action="open-create-collection-modal"]');
    if (openCreateBtn) {
      if (typeof document !== 'undefined' && document.activeElement) {
        this.lastFocusedElement = document.activeElement;
      }
      this.isCreateCollectionModalOpen = true;
      this.update();
      const input = this.container.querySelector('#col-name-input');
      if (input && typeof input.focus === 'function') input.focus();
      return;
    }

    // Open Edit Collection Modal
    const openEditBtn = event.target.closest('[data-action="edit-collection"]');
    if (openEditBtn) {
      const colId = openEditBtn.getAttribute('data-collection-id');
      if (colId) {
        if (typeof document !== 'undefined' && document.activeElement) {
          this.lastFocusedElement = document.activeElement;
        }
        this.editingCollection = this.service.collections.getCollection(colId);
        this.update();
        const input = this.container.querySelector('#edit-col-name-input');
        if (input && typeof input.focus === 'function') input.focus();
      }
      return;
    }

    // Delete Collection (CRITICAL: Poems must be preserved!)
    const deleteColBtn = event.target.closest('[data-action="delete-collection"]');
    if (deleteColBtn) {
      const colId = deleteColBtn.getAttribute('data-collection-id');
      const colName = deleteColBtn.getAttribute('data-col-name') || 'इस संग्रह';
      if (colId) {
        const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(`क्या आप ‘${colName}’ संग्रह को हटाना चाहते हैं?\n\n(ध्यान दें: आपकी कविताएँ पूर्णतः सुरक्षित रहेंगी और पुस्तकालय से नहीं हटेंगी।)`)
          : true;
        if (confirmed) {
          this.service.collections.deleteCollection(colId);
          if (this.activeCollectionId === colId) {
            this.activeCollectionId = null;
          }
          this.update();
        }
      }
      return;
    }

    // Open Add Poems Modal
    const openAddPoemsBtn = event.target.closest('[data-action="open-add-poems-modal"]');
    if (openAddPoemsBtn) {
      if (typeof document !== 'undefined' && document.activeElement) {
        this.lastFocusedElement = document.activeElement;
      }
      this.isAddPoemsModalOpen = true;
      this.update();
      const firstInput = this.container.querySelector('input[name="selectedPoems"]') || this.container.querySelector('.btn-modal-close');
      if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
      return;
    }

    // Remove Poem from Collection
    const removePoemBtn = event.target.closest('[data-action="remove-poem-from-collection"]');
    if (removePoemBtn) {
      const poemId = removePoemBtn.getAttribute('data-poem-id');
      const collectionId = removePoemBtn.getAttribute('data-collection-id') || this.activeCollectionId;
      if (poemId && collectionId) {
        this.service.collections.removePoem(collectionId, poemId);
        this.update();
      }
      return;
    }

    // Close any modal
    const closeBtn = event.target.closest('[data-action="close-modal"]');
    if (closeBtn) {
      this.isCreateCollectionModalOpen = false;
      this.editingCollection = null;
      this.isAddPoemsModalOpen = false;
      this.update();
      if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
        this.lastFocusedElement.focus();
      }
      return;
    }

    // 10. Favorite Toggle on poem cards
    const favBtn = event.target.closest('[data-action="toggle-fav"]');
    if (favBtn) {
      const poemId = favBtn.getAttribute('data-poem-id');
      if (poemId) {
        this.service.favorites.toggleFavorite(poemId);
        this.update();
      }
      return;
    }

    // 11. Archive Toggle on poem cards
    const archiveBtn = event.target.closest('[data-action="toggle-archive"]');
    if (archiveBtn) {
      const poemId = archiveBtn.getAttribute('data-poem-id');
      if (poemId) {
        const poem = this.poemRepo.getById(poemId);
        if (poem) {
          if (poem.isArchived) {
            this.poemRepo.restore(poemId);
          } else {
            this.poemRepo.archive(poemId);
          }
          this.update();
        }
      }
      return;
    }

    // 12. Reload View on error state
    const reloadBtn = event.target.closest('[data-action="reload-view"]');
    if (reloadBtn) {
      this.update();
      return;
    }
  }

  /**
   * Handles dropdown and input change events
   */
  handleChange(event) {
    const sortSelect = event.target.closest('[data-action="change-sort"]');
    if (sortSelect) {
      this.currentSort = sortSelect.value;
      this.update();
      return;
    }
  }

  /**
   * Handles modal form submissions
   */
  handleSubmit(event) {
    event.preventDefault();

    // 1. Create Collection Form
    const createForm = event.target.closest('#create-collection-form');
    if (createForm) {
      const nameInput = createForm.querySelector('#col-name-input');
      const descInput = createForm.querySelector('#col-desc-input');
      const name = nameInput ? nameInput.value.trim() : '';
      const description = descInput ? descInput.value.trim() : '';

      if (!name) {
        if (nameInput) {
          nameInput.focus();
          nameInput.classList.add('is-invalid');
        }
        return;
      }

      try {
        const newCol = this.service.collections.createCollection({ name, description });
        this.isCreateCollectionModalOpen = false;
        this.activeCollectionId = newCol.id;
        this.activeSection = 'collections';
        this.update();
      } catch (err) {
        console.error('[LibraryView] Failed to create collection:', err);
      }
      return;
    }

    // 2. Edit Collection Form
    const editForm = event.target.closest('#edit-collection-form');
    if (editForm) {
      const colId = editForm.getAttribute('data-col-id');
      const nameInput = editForm.querySelector('#edit-col-name-input');
      const descInput = editForm.querySelector('#edit-col-desc-input');
      const name = nameInput ? nameInput.value.trim() : '';
      const description = descInput ? descInput.value.trim() : '';

      if (!name) {
        if (nameInput) nameInput.focus();
        return;
      }

      try {
        if (colId) {
          this.service.collections.renameCollection(colId, name);
          this.service.collections.updateDescription(colId, description);
        }
        this.editingCollection = null;
        this.update();
      } catch (err) {
        console.error('[LibraryView] Failed to edit collection:', err);
      }
      return;
    }

    // 3. Add Poems to Collection Form
    const addPoemsForm = event.target.closest('#add-poems-to-collection-form');
    if (addPoemsForm) {
      const colId = addPoemsForm.getAttribute('data-col-id');
      const checkedInputs = addPoemsForm.querySelectorAll('input[name="selectedPoems"]:checked');
      if (colId && checkedInputs.length > 0) {
        for (const input of checkedInputs) {
          const poemId = input.value;
          if (poemId) {
            this.service.collections.addPoem(colId, poemId);
          }
        }
      }
      this.isAddPoemsModalOpen = false;
      this.update();
      return;
    }
  }
}

/**
 * Factory function to mount LibraryView
 */
export function mountLibraryView(container, router, initialFilter = 'all', options = {}) {
  const view = new LibraryView(container, router, initialFilter, options);
  view.mount();
  return view;
}
