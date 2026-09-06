/**
 * काव्यकलश (KavyaVault) — Favorites View Component (FavoritesView.js)
 * Dedicated, data-driven view for favorite poems.
 * Displays only active poems marked favorite with instant unfavorite reactivity.
 */

import '../library/library.css';
import '../layout/layout.css';
import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { renderLibraryToolbar } from '../library/LibraryToolbar.js';
import { renderPoemCard } from '../library/PoemCard.js';
import { poemRepository } from '../../services/PoemRepository.js';
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

export class FavoritesView {
  /**
   * @param {HTMLElement} container
   * @param {Object} router
   */
  constructor(container, router) {
    this.container = container;
    this.router = router;
    this.viewMode = 'grid';
    this.boundClickHandler = this.handleClick.bind(this);
  }

  /**
   * Retrieves active favorite poems directly from PoemRepository
   * @returns {Array|null}
   */
  getFavoritePoems() {
    try {
      return poemRepository.getAll({ includeArchived: false, onlyFavorites: true });
    } catch (err) {
      console.error('[FavoritesView] Error querying favorites from repository:', err);
      return null;
    }
  }

  /**
   * Renders the complete HTML string for the favorites view
   * @returns {string}
   */
  render() {
    const poems = this.getFavoritePoems();

    // 1. Error state handling
    if (poems === null) {
      return `
        <div class="favorites-view standard-page-view" role="region" aria-label="पसंदीदा रचनाएँ">
          ${renderPageHeader({
            title: 'पसंदीदा रचनाएँ',
            subtitle: 'संजोई हुई प्रिय रचनाएँ',
            description: 'आपकी चुनी हुई प्रिय कविताएँ एवं दोहे।'
          })}
          <div class="library-error-state" role="alert">
            ${renderEmptyState({
              icon: 'heart',
              heading: 'डेटा लोड करने में त्रुटि',
              text: 'पसंदीदा संग्रह लोड करने में तकनीकी समस्या उत्पन्न हुई। कृपया पृष्ठ पुनः लोड करें।',
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

    // 2. Header
    const headerHtml = renderPageHeader({
      title: 'पसंदीदा रचनाएँ',
      subtitle: 'संजोई हुई प्रिय रचनाएँ',
      description: 'आपकी चुनी हुई प्रिय कविताएँ एवं दोहे।',
      action: `
        <a href="${ROUTES.NEW_POEM}" data-link class="btn-primary-action" aria-label="नई कविता लिखें">
          ${getIconSvg('quill', 'nav-icon')}
          <span>नई कविता</span>
        </a>
      `
    });

    // 3. Toolbar (No filter pills needed on dedicated favorites route)
    const hindiCount = toDevanagariNumber(poems.length);
    const countLabel = `${hindiCount} पसंदीदा रचना${poems.length === 1 ? '' : 'एँ'}`;
    const toolbarHtml = renderLibraryToolbar({
      activeFilter: 'favorites',
      viewMode: this.viewMode,
      count: poems.length,
      showFilters: false,
      countLabel
    });

    // 4. Content / Empty State
    let contentHtml = '';
    if (poems.length === 0) {
      contentHtml = renderEmptyState({
        icon: 'heart',
        heading: 'अभी कोई रचना पसंदीदा नहीं है।',
        text: 'अपनी प्रिय कविताओं को दिल के चिह्न (♥) से पसंदीदा में जोड़ें।',
        primaryAction: `
          <a href="${ROUTES.POEMS}" data-link class="btn-primary-action" aria-label="कविताएँ देखें">
            ${getIconSvg('book', 'nav-icon')}
            <span>कविताएँ देखें</span>
          </a>
        `
      });
    } else {
      const collectionClass = this.viewMode === 'list'
        ? 'library-collection-list'
        : 'library-collection-grid';

      const cardsHtml = poems
        .map(poem => renderPoemCard(poem, this.viewMode))
        .join('');

      contentHtml = `
        <div class="${collectionClass}" role="feed" aria-label="पसंदीदा रचना सूची">
          ${cardsHtml}
        </div>
      `;
    }

    return `
      <div class="favorites-view standard-page-view" role="region" aria-label="पसंदीदा रचनाएँ">
        ${headerHtml}
        ${toolbarHtml}
        <section class="library-content-area" aria-label="पसंदीदा काव्य संग्रह">
          ${contentHtml}
        </section>
      </div>
    `;
  }

  /**
   * Re-renders view contents into container
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Mounts view and wires event listener
   */
  mount() {
    this.container.removeEventListener('click', this.boundClickHandler);
    this.container.addEventListener('click', this.boundClickHandler);
    this.update();
  }

  /**
   * Cleans up view listeners on unmount
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
    }
  }

  /**
   * Event delegation for view toggling, unfavorite, and archive
   */
  handleClick(event) {
    // 1. View mode toggle (grid / list)
    const viewBtn = event.target.closest('[data-view]');
    if (viewBtn) {
      const mode = viewBtn.getAttribute('data-view');
      if (mode && mode !== this.viewMode) {
        this.viewMode = mode;
        this.update();
      }
      return;
    }

    // 2. Favorite toggle action
    const favBtn = event.target.closest('[data-action="toggle-fav"]');
    if (favBtn) {
      const poemId = favBtn.getAttribute('data-poem-id');
      if (poemId) {
        const poem = poemRepository.getById(poemId);
        if (poem) {
          poemRepository.setFavorite(poemId, !poem.isFavorite);
          // Immediate reactivity: poem disappears from favorites view
          this.update();
        }
      }
      return;
    }

    // 3. Archive toggle action
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
          // Immediate reactivity: archived poem disappears from active favorites
          this.update();
        }
      }
      return;
    }
  }
}
