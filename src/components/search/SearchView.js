/**
 * काव्यकलश (KavyaVault) — Poetry Search View Component (SearchView.js)
 * Implements deterministic, Unicode-safe, Hindi-first search experience.
 * Integrates with PoemRepository and reuses PoemCard presentation.
 */

import './search.css';
import '../layout/layout.css';
import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { renderPoemCard } from '../library/PoemCard.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { searchPoems, escapeHtml } from '../../services/SearchService.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

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
   * @param {Object} options.router
   * @param {string} [options.initialQuery='']
   */
  constructor({ container, router, initialQuery = '' }) {
    this.container = container;
    this.router = router;

    // Check URL parameters if initialQuery not provided
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    this.query = initialQuery || (urlParams ? urlParams.get('q') || '' : '');

    this.allPoems = [];
    this.searchResults = [];

    // Bound event handlers
    this.handleInput = this.handleInput.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
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
   * Executes deterministic search over the in-memory poem collection
   */
  executeSearch() {
    if (!this.query.trim()) {
      this.searchResults = [];
    } else {
      const searchOutput = searchPoems(this.allPoems, this.query);
      this.searchResults = searchOutput.results;
    }
    this.updateResultsDisplay();
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
          description: 'अपने निजी पुस्तकालय में शीर्षक, पंक्तियों, रचनाकार अथवा विषय-टैग से खोजें।'
        })}

        <section class="search-controls-section" aria-label="खोज बार">
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
                placeholder="कविताएँ खोजें…"
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
        </section>

        <section
          class="search-results-container"
          id="search-results-area"
          aria-label="खोज परिणाम"
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
    const count = this.searchResults.length;
    if (count === 0) {
      return 'कोई रचना नहीं मिली';
    }
    const hindiNum = toDevanagariNumber(count);
    return `${hindiNum} रचना${count === 1 ? '' : 'एँ'} मिलीं`;
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
            शीर्षक, पंक्तियों, रचनाकार या टैग से खोजें। आपकी रचनाएँ स्वतः सामने आ जाएँगी।
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

    // 2. No Results State
    if (this.searchResults.length === 0) {
      return `
        <div class="search-no-results">
          ${renderEmptyState({
            icon: 'search',
            heading: 'कोई रचना नहीं मिली',
            text: `"${escapeHtml(trimmedQuery)}" से मिलती-जुलती कोई रचना पुस्तकालय में नहीं मिली। दूसरे शब्दों या वर्तनी से खोजकर देखें।`,
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

    // 3. Results Found State
    const cardsHtml = this.searchResults.map(result => {
      return renderPoemCard(result.poem, 'grid', {
        matchBadge: result.matchContext,
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

    if (resultsArea) {
      resultsArea.innerHTML = this.renderResultsHtml();
    }
    if (statusBadge) {
      statusBadge.textContent = this.getStatusText();
    }
    if (clearBtn) {
      clearBtn.style.display = this.query.trim() ? 'flex' : 'none';
    }
  }

  /**
   * Synchronizes browser URL with search query
   */
  syncUrlQuery() {
    const trimmed = this.query.trim();
    const newUrl = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search';
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
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
   * Handles clicks on clear button, suggestions, favorites, and archives
   */
  handleClick(event) {
    // 1. Clear search button
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

    // 2. Suggestion pill click
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

    // 3. Favorite toggle action within result card
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

    // 4. Archive / Restore toggle action within result card
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
   * Handles Escape key to clear search
   */
  handleKeydown(event) {
    if (event.key === 'Escape') {
      const input = this.container.querySelector('#kavya-search-input');
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
