/**
 * काव्यकलश (KavyaVault) — Archive View Component (ArchiveView.js)
 * Dedicated, data-driven view for archived literary works.
 * Displays only archived poems with seamless restore capability into library & search.
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

export class ArchiveView {
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
   * Retrieves strictly archived poems directly from PoemRepository
   * @returns {Array|null}
   */
  getArchivedPoems() {
    try {
      const all = poemRepository.getAll({ includeArchived: true });
      return all.filter(p => p.isArchived);
    } catch (err) {
      console.error('[ArchiveView] Error querying archived poems from repository:', err);
      return null;
    }
  }

  /**
   * Renders the complete HTML string for the archive view
   * @returns {string}
   */
  render() {
    const poems = this.getArchivedPoems();

    // 1. Error state handling
    if (poems === null) {
      return `
        <div class="archive-view standard-page-view" role="region" aria-label="साहित्यिक अभिलेख">
          ${renderPageHeader({
            title: 'अभिलेख',
            subtitle: 'साहित्यिक अभिलेख',
            description: 'यहाँ सुरक्षित रखी गई पुरानी रचनाएँ संगृहीत हैं।'
          })}
          <div class="library-error-state" role="alert">
            ${renderEmptyState({
              icon: 'archive',
              heading: 'डेटा लोड करने में त्रुटि',
              text: 'अभिलेख संग्रह लोड करने में तकनीकी समस्या उत्पन्न हुई। कृपया पृष्ठ पुनः लोड करें।',
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
      title: 'अभिलेख',
      subtitle: 'साहित्यिक अभिलेख',
      description: 'यहाँ सुरक्षित रखी गई पुरानी रचनाएँ संगृहीत हैं।'
    });

    // 3. Toolbar (Dedicated count for archived works without category tabs)
    const hindiCount = toDevanagariNumber(poems.length);
    const countLabel = `${hindiCount} सुरक्षित रचना${poems.length === 1 ? '' : 'एँ'}`;
    const toolbarHtml = renderLibraryToolbar({
      activeFilter: 'archived',
      viewMode: this.viewMode,
      count: poems.length,
      showFilters: false,
      countLabel
    });

    // 4. Content / Empty State
    let contentHtml = '';
    if (poems.length === 0) {
      contentHtml = renderEmptyState({
        icon: 'archive',
        heading: 'अभी कोई रचना अभिलेख में नहीं है।',
        text: 'यहाँ सुरक्षित रखी गई पुरानी रचनाएँ दिखाई देंगी।',
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
        <div class="${collectionClass}" role="feed" aria-label="अभिलेख रचना सूची">
          ${cardsHtml}
        </div>
      `;
    }

    return `
      <div class="archive-view standard-page-view" role="region" aria-label="साहित्यिक अभिलेख">
        ${headerHtml}
        ${toolbarHtml}
        <section class="library-content-area" aria-label="अभिलेख काव्य संग्रह">
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
   * Event delegation for view toggling, restore, and favorite actions
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

    // 2. Restore / Archive action
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
          // Immediate reactivity: restored poem disappears from archive view
          this.update();
        }
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
  }
}
