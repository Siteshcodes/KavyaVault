/**
 * काव्यकलश (KavyaVault) — Poetry Search View Component (SearchView.js)
 * Phase 5 / Task 5.4: Hybrid Search + Natural-Language Search UX
 *
 * Implements an accessible, literary, Hindi-first search experience with:
 * 1. पाठ खोज (Text Search)
 * 2. भावार्थ खोज (Semantic Search)
 * 3. मिश्रित खोज (Hybrid Search via Reciprocal Rank Fusion)
 *
 * Integrates with SearchService, supports accessible tab semantics (WAI-ARIA),
 * provides honest status banners for offline semantic models, and accepts natural-language queries.
 */

import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { renderPoemCard } from '../library/PoemCard.js';
import { poemRepository } from '../../services/PoemRepository.js';
import {
  searchService,
  SEARCH_MODE,
  SEARCH_STATUS,
  escapeHtml
} from '../../services/SearchService.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

/**
 * Descriptions for search modes in literary Hindi
 */
export const MODE_DESCRIPTIONS = {
  [SEARCH_MODE.TEXT]: 'शब्दों और वाक्यांशों में खोजें',
  [SEARCH_MODE.SEMANTIC]: 'अर्थ के आधार पर खोजें',
  [SEARCH_MODE.HYBRID]: 'शब्द + अर्थ दोनों से खोजें'
};

/**
 * Mode labels in Devanagari
 */
export const MODE_LABELS = {
  [SEARCH_MODE.TEXT]: 'पाठ खोज',
  [SEARCH_MODE.SEMANTIC]: 'भावार्थ खोज',
  [SEARCH_MODE.HYBRID]: 'मिश्रित खोज'
};

/**
 * Converts Western digits to Devanagari numerals for authentic Hindi UX
 * @param {number|string} num
 * @returns {string}
 */
function toDevanagariNumber(num) {
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, d => digits[Number(d)]);
}

export class SearchView {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Object} [options.router]
   * @param {string} [options.initialQuery='']
   * @param {string} [options.initialMode='text']
   */
  constructor({ container, router, initialQuery = '', initialMode = SEARCH_MODE.TEXT }) {
    this.container = container;
    this.router = router;

    // Check URL parameters if initialQuery/mode not explicitly provided
    const urlParams = typeof window !== 'undefined' && window.location
      ? new URLSearchParams(window.location.search)
      : null;

    this.query = initialQuery || (urlParams ? urlParams.get('q') || '' : '');

    const validModes = [SEARCH_MODE.TEXT, SEARCH_MODE.SEMANTIC, SEARCH_MODE.HYBRID];
    const urlMode = urlParams ? urlParams.get('mode') : null;
    this.searchMode = (urlMode && validModes.includes(urlMode))
      ? urlMode
      : (validModes.includes(initialMode) ? initialMode : SEARCH_MODE.TEXT);

    this.allPoems = [];
    this.searchResults = [];
    this.searchStatus = null;
    this.searchNotice = null;
    this.isLoading = false;
    this.searchRequestId = 0;

    // Bound event handlers
    this.handleInput = this.handleInput.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleTabKeydown = this.handleTabKeydown.bind(this);
  }

  /**
   * Loads non-archived poems from repository into memory
   */
  loadPoems() {
    try {
      this.allPoems = poemRepository.getAll({ includeArchived: false });
    } catch (err) {
      console.error('[SearchView] Failed to load poems from repository:', err);
      this.allPoems = [];
    }
  }

  /**
   * Refreshes in-memory poems and re-evaluates current search
   */
  refreshPoemsAndSearch() {
    this.loadPoems();
    this.executeSearch();
  }

  /**
   * Executes search asynchronously through SearchService strategy dispatch
   */
  async executeSearch() {
    const trimmedQuery = this.query.trim();
    const requestId = ++this.searchRequestId;

    if (!trimmedQuery) {
      this.searchResults = [];
      this.searchStatus = null;
      this.searchNotice = null;
      this.isLoading = false;
      this.updateResultsDisplay();
      return;
    }

    this.isLoading = true;
    this.updateResultsDisplay();

    try {
      const response = await searchService.search(
        { text: trimmedQuery, mode: this.searchMode },
        { poems: this.allPoems }
      );

      // Guard against stale async responses
      if (requestId !== this.searchRequestId) {
        return;
      }

      this.searchResults = response.results || [];
      this.searchStatus = response.status || (this.searchResults.length > 0
        ? SEARCH_STATUS.SUCCESS
        : SEARCH_STATUS.EMPTY);
      this.searchNotice = response.message || null;
    } catch (err) {
      if (requestId !== this.searchRequestId) return;
      this.searchResults = [];
      this.searchStatus = SEARCH_STATUS.ERROR;
      this.searchNotice = err.message || 'खोज के दौरान त्रुटि उत्पन्न हुई।';
    } finally {
      if (requestId === this.searchRequestId) {
        this.isLoading = false;
        this.updateResultsDisplay();
      }
    }
  }

  /**
   * Switches search mode, updates ARIA states and executes search
   * @param {string} newMode
   * @param {boolean} [focusTab=false]
   */
  setMode(newMode, focusTab = false) {
    const validModes = [SEARCH_MODE.TEXT, SEARCH_MODE.SEMANTIC, SEARCH_MODE.HYBRID];
    if (!validModes.includes(newMode) || this.searchMode === newMode) {
      return;
    }

    this.searchMode = newMode;
    this.syncUrlQuery();

    // Update tab attributes
    if (this.container) {
      const tabs = this.container.querySelectorAll('.search-mode-tab');
      tabs.forEach(tab => {
        const mode = tab.getAttribute('data-mode');
        const isSelected = mode === this.searchMode;
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        tab.setAttribute('tabindex', isSelected ? '0' : '-1');
        tab.classList.toggle('is-active', isSelected);
        if (isSelected && focusTab) {
          tab.focus();
        }
      });

      const descEl = this.container.querySelector('#search-mode-desc');
      if (descEl) {
        descEl.textContent = MODE_DESCRIPTIONS[this.searchMode] || '';
      }
    }

    this.executeSearch();
  }

  /**
   * Mounts the SearchView into container
   */
  mount() {
    this.loadPoems();
    this.renderInitialSkeleton();

    // Attach listeners
    this.container.addEventListener('input', this.handleInput);
    this.container.addEventListener('click', this.handleClick);
    this.container.addEventListener('keydown', this.handleTabKeydown);
    window.addEventListener('keydown', this.handleKeydown);

    // Initial search if query was present in URL
    if (this.query) {
      this.executeSearch();
    }

    // Focus search input
    const input = this.container.querySelector('#kavya-search-input');
    if (input) {
      input.focus();
      if (this.query) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  /**
   * Unmounts SearchView and removes event listeners
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('input', this.handleInput);
      this.container.removeEventListener('click', this.handleClick);
      this.container.removeEventListener('keydown', this.handleTabKeydown);
    }
    window.removeEventListener('keydown', this.handleKeydown);
  }

  /**
   * Renders the initial structure of the search screen
   */
  renderInitialSkeleton() {
    const hasQuery = Boolean(this.query.trim());

    this.container.innerHTML = `
      <div class="search-view standard-page-view" role="region" aria-label="काव्य अन्वेषण">
        ${renderPageHeader({
          title: 'काव्य अन्वेषण',
          subtitle: 'शब्दों, भावों एवं पंक्तियों की खोज',
          description: 'अपने निजी पुस्तकालय में शीर्षक, पंक्तियों, रचनाकार अथवा भावार्थ से खोजें।'
        })}

        <section class="search-controls-section" aria-label="खोज बार व प्रकार">
          <!-- Search Mode Selector Tabs (WAI-ARIA compliant) -->
          <div class="search-mode-container" aria-label="खोज मोड चयन">
            <div class="search-mode-tabs" role="tablist" aria-label="खोज प्रकार">
              <button
                type="button"
                role="tab"
                id="tab-text"
                class="search-mode-tab ${this.searchMode === SEARCH_MODE.TEXT ? 'is-active' : ''}"
                aria-selected="${this.searchMode === SEARCH_MODE.TEXT ? 'true' : 'false'}"
                aria-controls="search-results-area"
                data-mode="${SEARCH_MODE.TEXT}"
                tabindex="${this.searchMode === SEARCH_MODE.TEXT ? '0' : '-1'}"
              >
                ${MODE_LABELS[SEARCH_MODE.TEXT]}
              </button>
              <button
                type="button"
                role="tab"
                id="tab-semantic"
                class="search-mode-tab ${this.searchMode === SEARCH_MODE.SEMANTIC ? 'is-active' : ''}"
                aria-selected="${this.searchMode === SEARCH_MODE.SEMANTIC ? 'true' : 'false'}"
                aria-controls="search-results-area"
                data-mode="${SEARCH_MODE.SEMANTIC}"
                tabindex="${this.searchMode === SEARCH_MODE.SEMANTIC ? '0' : '-1'}"
              >
                ${MODE_LABELS[SEARCH_MODE.SEMANTIC]}
              </button>
              <button
                type="button"
                role="tab"
                id="tab-hybrid"
                class="search-mode-tab ${this.searchMode === SEARCH_MODE.HYBRID ? 'is-active' : ''}"
                aria-selected="${this.searchMode === SEARCH_MODE.HYBRID ? 'true' : 'false'}"
                aria-controls="search-results-area"
                data-mode="${SEARCH_MODE.HYBRID}"
                tabindex="${this.searchMode === SEARCH_MODE.HYBRID ? '0' : '-1'}"
              >
                ${MODE_LABELS[SEARCH_MODE.HYBRID]}
              </button>
            </div>
            <p class="search-mode-desc" id="search-mode-desc" aria-live="polite">
              ${MODE_DESCRIPTIONS[this.searchMode] || ''}
            </p>
          </div>

          <form class="search-form" onsubmit="event.preventDefault();" role="search">
            <label for="kavya-search-input" class="sr-only">कविताएँ खोजें</label>
            <div class="search-input-wrapper">
              <span class="search-icon-adornment" aria-hidden="true">
                ${getIconSvg('search', 'nav-icon')}
              </span>
              <input
                type="search"
                id="kavya-search-input"
                class="search-input"
                placeholder="${this.searchMode === SEARCH_MODE.SEMANTIC ? 'भावार्थ या प्रसंग से खोजें (उदा. पहाड़ और नदी वाली शांत कविता)…' : 'कविताएँ खोजें…'}"
                value="${escapeHtml(this.query)}"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                spellcheck="false"
                aria-label="कविताएँ खोजें"
                aria-controls="search-results-area"
              />
              <button
                type="button"
                class="search-clear-btn"
                data-action="clear-search"
                aria-label="खोज साफ़ करें"
                title="खोज साफ़ करें"
                style="display: ${hasQuery ? 'flex' : 'none'};"
              >
                ${getIconSvg('close', 'nav-icon')}
              </button>
            </div>
          </form>

          <div class="search-status-bar" id="search-status-bar">
            <div
              class="search-count-badge"
              id="search-live-status"
              role="status"
              aria-live="polite"
            >
              ${this.getStatusText()}
            </div>
            <div class="search-keyboard-hint" aria-hidden="true">
              <span>फोकस करने के लिए</span>
              <kbd class="search-kbd">Ctrl/Cmd + K</kbd>
            </div>
          </div>

          <!-- Status notice container (for degraded / unsupported / error banners) -->
          <div id="search-notice-area" class="search-notice-area" aria-live="polite">
            ${this.getNoticeHtml()}
          </div>
        </section>

        <section
          class="search-results-container"
          id="search-results-area"
          role="tabpanel"
          aria-labelledby="tab-${this.searchMode}"
          aria-label="खोज परिणाम"
          aria-busy="${this.isLoading ? 'true' : 'false'}"
        >
          ${this.renderResultsHtml()}
        </section>
      </div>
    `;
  }

  /**
   * Generates live polite status text based on active query
   */
  getStatusText() {
    if (!this.query.trim()) {
      return '';
    }
    if (this.isLoading) {
      return 'खोज जारी है…';
    }
    const count = this.searchResults.length;
    if (count === 0) {
      if (this.searchMode === SEARCH_MODE.SEMANTIC && this.searchStatus === SEARCH_STATUS.UNSUPPORTED) {
        return 'भावार्थ खोज अनुपलब्ध';
      }
      return 'कोई रचना नहीं मिली';
    }
    const hindiNum = toDevanagariNumber(count);
    return `${hindiNum} रचना${count === 1 ? '' : 'एँ'} मिलीं`;
  }

  /**
   * Renders honest status notices for degraded or unsupported semantic search
   */
  getNoticeHtml() {
    if (!this.query.trim()) return '';

    // Semantic mode unavailable
    if (this.searchMode === SEARCH_MODE.SEMANTIC && this.searchStatus === SEARCH_STATUS.UNSUPPORTED) {
      return `
        <div class="search-notice-banner search-notice-warning" role="alert">
          <span class="search-notice-icon" aria-hidden="true">${getIconSvg('info', 'nav-icon')}</span>
          <div class="search-notice-content">
            <p>भावार्थ खोज के लिए स्थानीय सिमेंटिक मॉडल अभी उपलब्ध नहीं है। पाठ खोज का उपयोग जारी रखें।</p>
          </div>
        </div>
      `;
    }

    // Hybrid mode degraded: semantic unavailable but text results returned
    if (this.searchMode === SEARCH_MODE.HYBRID) {
      if (this.searchStatus === SEARCH_STATUS.DEGRADED) {
        return `
          <div class="search-notice-banner search-notice-degraded" role="status">
            <span class="search-notice-icon" aria-hidden="true">${getIconSvg('info', 'nav-icon')}</span>
            <div class="search-notice-content">
              <p>भावार्थ खोज के लिए स्थानीय सिमेंटिक मॉडल अभी उपलब्ध नहीं है; पाठ खोज के आधार पर परिणाम दिखाए जा रहे हैं।</p>
            </div>
          </div>
        `;
      }
      if (this.searchStatus === SEARCH_STATUS.UNSUPPORTED) {
        return `
          <div class="search-notice-banner search-notice-warning" role="alert">
            <span class="search-notice-icon" aria-hidden="true">${getIconSvg('info', 'nav-icon')}</span>
            <div class="search-notice-content">
              <p>भावार्थ खोज उपलब्ध नहीं है; पाठ खोज से परिणाम नहीं मिले।</p>
            </div>
          </div>
        `;
      }
    }

    // Error status
    if (this.searchStatus === SEARCH_STATUS.ERROR && this.searchNotice) {
      return `
        <div class="search-notice-banner search-notice-error" role="alert">
          <span class="search-notice-icon" aria-hidden="true">${getIconSvg('info', 'nav-icon')}</span>
          <div class="search-notice-content">
            <p>${escapeHtml(this.searchNotice)}</p>
          </div>
        </div>
      `;
    }

    return '';
  }

  /**
   * Renders appropriate HTML for current results state: Landing, No-results, or Cards
   */
  renderResultsHtml() {
    const trimmedQuery = this.query.trim();

    // 1. Empty Query State (Calm Landing State)
    if (!trimmedQuery) {
      return `
        <div class="search-landing-box">
          <div class="search-landing-icon" aria-hidden="true">
            ${getIconSvg('search', 'large-icon')}
          </div>
          <h2 class="search-landing-title">कविताएँ खोजें</h2>
          <p class="search-landing-desc">
            शीर्षक, पंक्तियों, रचनाकार या भावार्थ से खोजें। आपकी रचनाएँ स्वतः सामने आ जाएँगी।
          </p>
          <div class="search-suggestion-pills">
            <button type="button" class="search-suggestion-pill" data-suggest-query="सावन">सावन</button>
            <button type="button" class="search-suggestion-pill" data-suggest-query="बारिश">बारिश</button>
            <button type="button" class="search-suggestion-pill" data-suggest-query="यादें">यादें</button>
            <button type="button" class="search-suggestion-pill" data-suggest-query="बचपन">बचपन</button>
            <button type="button" class="search-suggestion-pill" data-suggest-query="प्रेम">प्रेम</button>
          </div>
        </div>
      `;
    }

    // 2. Loading State
    if (this.isLoading && this.searchResults.length === 0) {
      return `
        <div class="search-loading-container" aria-live="polite">
          <p class="search-loading-text">खोज प्रगति पर है…</p>
        </div>
      `;
    }

    // 3. No Results State
    if (this.searchResults.length === 0) {
      let emptyHeading = 'कोई कविता नहीं मिली';
      let emptyText = `"${escapeHtml(trimmedQuery)}" से मिलती-जुलती कोई रचना पुस्तकालय में नहीं मिली। दूसरे शब्दों या वर्तनी से खोजकर देखें।`;

      if (this.searchMode === SEARCH_MODE.SEMANTIC && this.searchStatus === SEARCH_STATUS.UNSUPPORTED) {
        emptyHeading = 'भावार्थ खोज अभी उपलब्ध नहीं है';
        emptyText = 'भावार्थ खोज के लिए स्थानीय सिमेंटिक मॉडल अभी उपलब्ध नहीं है। पाठ खोज का उपयोग जारी रखें।';
      } else if (this.searchMode === SEARCH_MODE.HYBRID && this.searchStatus === SEARCH_STATUS.UNSUPPORTED) {
        emptyHeading = 'कोई परिणाम नहीं मिला';
        emptyText = 'भावार्थ खोज उपलब्ध नहीं है; पाठ खोज से परिणाम नहीं मिले।';
      }

      return `
        <div class="search-no-results">
          ${renderEmptyState({
            icon: 'search',
            heading: emptyHeading,
            text: emptyText,
            primaryAction: `
              <a href="${ROUTES.POEMS}" data-link class="btn-primary-action" aria-label="पुस्तकालय पर लौटें">
                ${getIconSvg('book', 'nav-icon')}
                <span>पुस्तकालय पर लौटें</span>
              </a>
            `
          })}
        </div>
      `;
    }

    // 4. Results Found State
    const cardsHtml = this.searchResults.map(result => {
      let matchBadge = result.matchContext;

      if (this.searchMode === SEARCH_MODE.HYBRID) {
        if (result.source === 'hybrid' || result.matchContext === 'शब्द + भावार्थ') {
          matchBadge = 'मिश्रित';
        } else if (result.source === 'text') {
          matchBadge = 'पाठ';
        } else if (result.source === 'semantic') {
          matchBadge = 'भावार्थ';
        } else {
          matchBadge = 'मिश्रित';
        }
      } else if (this.searchMode === SEARCH_MODE.SEMANTIC) {
        matchBadge = 'भावार्थ से मिला';
      }

      return renderPoemCard(result.poem, 'grid', {
        matchBadge,
        highlightQuery: trimmedQuery
      });
    }).join('');

    return `
      <div class="search-results-list" role="feed" aria-label="खोज परिणाम सूची">
        ${cardsHtml}
      </div>
    `;
  }

  /**
   * Updates only the results and status portions without clobbering input focus
   */
  updateResultsDisplay() {
    const resultsArea = this.container.querySelector('#search-results-area');
    const statusBadge = this.container.querySelector('#search-live-status');
    const clearBtn = this.container.querySelector('[data-action="clear-search"]');
    const noticeArea = this.container.querySelector('#search-notice-area');

    if (resultsArea) {
      resultsArea.setAttribute('aria-busy', this.isLoading ? 'true' : 'false');
      resultsArea.setAttribute('aria-labelledby', `tab-${this.searchMode}`);
      resultsArea.innerHTML = this.renderResultsHtml();
    }
    if (statusBadge) {
      statusBadge.textContent = this.getStatusText();
    }
    if (noticeArea) {
      noticeArea.innerHTML = this.getNoticeHtml();
    }
    if (clearBtn) {
      clearBtn.style.display = this.query.trim() ? 'flex' : 'none';
    }
  }

  /**
   * Synchronizes browser URL with search query and mode
   */
  syncUrlQuery() {
    const trimmed = this.query.trim();
    const params = new URLSearchParams();
    if (trimmed) {
      params.set('q', trimmed);
    }
    if (this.searchMode !== SEARCH_MODE.TEXT) {
      params.set('mode', this.searchMode);
    }
    const queryString = params.toString();
    const newUrl = queryString ? `/search?${queryString}` : '/search';

    if (typeof window !== 'undefined' && window.location && window.history) {
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.replaceState({}, '', newUrl);
      }
    }
  }

  /**
   * Handles user typing in search input
   */
  handleInput(event) {
    if (event.target.id === 'kavya-search-input') {
      this.query = event.target.value;
      this.syncUrlQuery();
      this.executeSearch();
    }
  }

  /**
   * Handles clicks on mode tabs, clear button, suggestions, favorites, and archives
   */
  handleClick(event) {
    // 1. Search Mode Tab click
    const modeTab = event.target.closest('.search-mode-tab');
    if (modeTab) {
      const newMode = modeTab.getAttribute('data-mode');
      if (newMode) {
        this.setMode(newMode, true);
      }
      return;
    }

    // 2. Clear search button
    const clearBtn = event.target.closest('[data-action="clear-search"]');
    if (clearBtn) {
      this.query = '';
      const input = this.container.querySelector('#kavya-search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      this.syncUrlQuery();
      this.executeSearch();
      return;
    }

    // 3. Suggestion pill click
    const pill = event.target.closest('[data-suggest-query]');
    if (pill) {
      const suggestText = pill.getAttribute('data-suggest-query');
      if (suggestText) {
        this.query = suggestText;
        const input = this.container.querySelector('#kavya-search-input');
        if (input) {
          input.value = suggestText;
          input.focus();
        }
        this.syncUrlQuery();
        this.executeSearch();
      }
      return;
    }

    // 4. Favorite toggle action within result card
    const favBtn = event.target.closest('[data-action="toggle-fav"]');
    if (favBtn) {
      const poemId = favBtn.getAttribute('data-poem-id');
      if (poemId) {
        const poem = poemRepository.getById(poemId);
        if (poem) {
          poemRepository.setFavorite(poemId, !poem.isFavorite);
          this.refreshPoemsAndSearch();
        }
      }
      return;
    }

    // 5. Archive / Restore toggle action within result card
    const archiveBtn = event.target.closest('[data-action="toggle-archive"]');
    if (archiveBtn) {
      const poemId = archiveBtn.getAttribute('data-poem-id');
      if (poemId) {
        const poem = poemRepository.getById(poemId);
        if (poem) {
          if (poem.isArchived) {
            poemRepository.restore(poemId);
          } else {
            poemRepository.archive(poemId);
          }
          this.refreshPoemsAndSearch();
        }
      }
      return;
    }
  }

  /**
   * Handles keyboard navigation on mode tabs (ArrowLeft, ArrowRight, Home, End)
   */
  handleTabKeydown(event) {
    if (!event.target.classList.contains('search-mode-tab')) {
      return;
    }

    const tabs = [SEARCH_MODE.TEXT, SEARCH_MODE.SEMANTIC, SEARCH_MODE.HYBRID];
    const currentIndex = tabs.indexOf(this.searchMode);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== -1) {
      event.preventDefault();
      this.setMode(tabs[nextIndex], true);
    }
  }

  /**
   * Handles Escape key to clear search
   */
  handleKeydown(event) {
    if (event.key === 'Escape') {
      const input = this.container ? this.container.querySelector('#kavya-search-input') : null;
      if (input && (document.activeElement === input || this.query.trim())) {
        this.query = '';
        input.value = '';
        input.focus();
        this.syncUrlQuery();
        this.executeSearch();
      }
    }
  }
}
