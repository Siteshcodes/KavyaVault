/**
 * काव्यकलश (KavyaVault) — Poetry Library View Component (LibraryView.js)
 * Real data-driven Poetry Library presenting poems from PoemRepository.
 * Supports Grid and List views, category filtering (सभी, पसंदीदा, अभिलेख),
 * favorite toggles, and archive/restore actions.
 */

import './library.css';
import '../layout/layout.css';
import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { renderLibraryToolbar } from './LibraryToolbar.js';
import { renderPoemCard } from './PoemCard.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

export class LibraryView {
  /**
   * @param {HTMLElement} container
   * @param {Object} router
   * @param {string} [initialFilter='all']
   */
  constructor(container, router, initialFilter = 'all') {
    this.container = container;
    this.router = router;
    this.activeFilter = initialFilter;
    this.viewMode = 'grid';
    this.boundClickHandler = this.handleClick.bind(this);
  }

  /**
   * Queries PoemRepository according to active filter
   * @returns {Array|null} Array of poems or null on error
   */
  getFilteredPoems() {
    try {
      if (this.activeFilter === 'favorites') {
        return poemRepository.getAll({ includeArchived: false, onlyFavorites: true });
      }

      if (this.activeFilter === 'archived') {
        const all = poemRepository.getAll({ includeArchived: true });
        return all.filter(p => p.isArchived);
      }

      // Default: 'all' active non-archived poems
      return poemRepository.getAll({ includeArchived: false, onlyFavorites: false });
    } catch (err) {
      console.error('[LibraryView] Error loading poems from repository:', err);
      return null;
    }
  }

  /**
   * Renders the complete library view HTML
   */
  render() {
    const poems = this.getFilteredPoems();

    // 1. Error State
    if (poems === null) {
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
              heading: 'डेटा लोड करने में त्रुटि',
              text: 'काव्य संग्रह लोड करने में तकनीकी समस्या उत्पन्न हुई। कृपया पृष्ठ को पुनः लोड करें।',
              primaryAction: `
                <button type="button" class="btn-primary-action" onclick="window.location.reload()" aria-label="पुनः लोड करें">
                  <span>पुनः लोड करें</span>
                </button>
              `
            })}
          </div>
        </div>
      `;
    }

    // 2. Page Header
    const headerHtml = renderPageHeader({
      title: 'मेरी कविताएँ',
      subtitle: 'काव्य पुस्तकालय',
      description: 'आपकी लिखी और सँजोई हुई सभी रचनाएँ।',
      action: `
        <a href="${ROUTES.NEW_POEM}" data-link class="btn-primary-action" aria-label="नई कविता लिखें">
          ${getIconSvg('quill', 'nav-icon')}
          <span>नई कविता</span>
        </a>
      `
    });

    // 3. Toolbar (Filter pills, Count badge, View toggle)
    const toolbarHtml = renderLibraryToolbar({
      activeFilter: this.activeFilter,
      viewMode: this.viewMode,
      count: poems.length
    });

    // 4. Collection / Empty State
    let contentHtml = '';

    if (poems.length === 0) {
      if (this.activeFilter === 'favorites') {
        contentHtml = renderEmptyState({
          icon: 'heart',
          heading: 'कोई पसंदीदा रचना नहीं',
          text: 'अपनी प्रिय कविताओं को दिल के चिह्न (♥) से पसंदीदा में जोड़ें।',
          primaryAction: `
            <button type="button" class="btn-primary-action" data-filter="all" aria-label="सभी कविताएँ देखें">
              ${getIconSvg('book', 'nav-icon')}
              <span>सभी कविताएँ देखें</span>
            </button>
          `
        });
      } else if (this.activeFilter === 'archived') {
        contentHtml = renderEmptyState({
          icon: 'archive',
          heading: 'अभिलेखागार रिक्त है',
          text: 'वर्तमान में कोई भी रचना अभिलेख में नहीं रखी गई है।',
          primaryAction: `
            <button type="button" class="btn-primary-action" data-filter="all" aria-label="पुस्तकालय पर लौटें">
              ${getIconSvg('book', 'nav-icon')}
              <span>पुस्तकालय पर लौटें</span>
            </button>
          `
        });
      } else {
        // Default empty library
        contentHtml = renderEmptyState({
          icon: 'book',
          heading: 'आपका काव्य-संग्रह अभी खाली है',
          text: 'अपनी पहली कविता लिखिए और उसे इस पुस्तकालय में सँजोइए।',
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

      const cardsHtml = poems
        .map(poem => renderPoemCard(poem, this.viewMode))
        .join('');

      contentHtml = `
        <div class="${collectionClass}" role="feed" aria-label="काव्य रचना सूची">
          ${cardsHtml}
        </div>
      `;
    }

    return `
      <div class="library-view standard-page-view" role="region" aria-label="काव्य पुस्तकालय">
        ${headerHtml}
        ${toolbarHtml}
        <section class="library-content-area" aria-label="रचना संग्रह">
          ${contentHtml}
        </section>
      </div>
    `;
  }

  /**
   * Updates the DOM and re-attaches view structure
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Mounts the view and wires event listeners
   */
  mount() {
    this.container.removeEventListener('click', this.boundClickHandler);
    this.container.addEventListener('click', this.boundClickHandler);
    this.update();
  }

  /**
   * Unmounts the view and cleans up listeners
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
    }
  }

  /**
   * Centralized click event delegation for library interactions
   */
  handleClick(event) {
    // 1. Filter pill click
    const filterBtn = event.target.closest('[data-filter]');
    if (filterBtn) {
      const filterId = filterBtn.getAttribute('data-filter');
      if (filterId && filterId !== this.activeFilter) {
        this.activeFilter = filterId;
        this.update();
      }
      return;
    }

    // 2. View mode toggle click (grid / list)
    const viewBtn = event.target.closest('[data-view]');
    if (viewBtn) {
      const mode = viewBtn.getAttribute('data-view');
      if (mode && mode !== this.viewMode) {
        this.viewMode = mode;
        this.update();
      }
      return;
    }

    // 3. Favorite toggle action
    const favBtn = event.target.closest('[data-action="toggle-fav"]');
    if (favBtn) {
      const poemId = favBtn.getAttribute('data-poem-id');
      if (poemId) {
        const poem = poemRepository.getById(poemId);
        if (poem) {
          poemRepository.setFavorite(poemId, !poem.isFavorite);
          this.update();
        }
      }
      return;
    }

    // 4. Archive / Restore toggle action
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
          this.update();
        }
      }
      return;
    }
  }
}

/**
 * Factory function to mount LibraryView
 */
export function mountLibraryView(container, router, initialFilter = 'all') {
  const view = new LibraryView(container, router, initialFilter);
  view.mount();
  return view;
}
