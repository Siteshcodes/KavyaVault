/**
 * काव्यकलश (KavyaVault) — Collection Detail View Component (CollectionDetailView.js)
 * Displays a single collection, resolves poemIds through PoemRepository,
 * allows adding/removing poems, and handles collection deletion.
 */

import './collections.css';
import '../library/library.css';
import '../layout/layout.css';
import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { renderLibraryToolbar } from '../library/LibraryToolbar.js';
import { renderPoemCard } from '../library/PoemCard.js';
import { collectionRepository } from '../../services/CollectionRepository.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { escapeHtml } from '../../services/SearchService.js';
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

export class CollectionDetailView {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Object} options.router
   * @param {string} options.collectionId
   */
  constructor({ container, router, collectionId }) {
    this.container = container;
    this.router = router;
    this.collectionId = collectionId;
    this.viewMode = 'grid';
    this.isAddModalOpen = false;

    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
  }

  /**
   * Retrieves the current collection
   */
  getCollection() {
    return collectionRepository.getById(this.collectionId);
  }

  /**
   * Renders the complete detail view HTML
   */
  render() {
    const collection = this.getCollection();

    // 1. Missing / Not Found state
    if (!collection) {
      return `
        <div class="collection-detail-view standard-page-view" role="region" aria-label="संग्रह विवरण">
          <div class="collection-detail-top-nav">
            <a href="${ROUTES.COLLECTIONS}" data-link class="btn-back-link">
              ${getIconSvg('arrow-left', 'nav-icon')}
              <span>सभी संग्रह</span>
            </a>
          </div>
          ${renderEmptyState({
            icon: 'collection',
            heading: 'संग्रह अप्राप्य',
            text: 'जिस संग्रह को आप खोज रहे हैं, वह उपस्थित नहीं है अथवा हटा दिया गया है।',
            primaryAction: `
              <a href="${ROUTES.COLLECTIONS}" data-link class="btn-primary-action" aria-label="सभी संग्रह देखें">
                ${getIconSvg('collection', 'nav-icon')}
                <span>सभी संग्रह देखें</span>
              </a>
            `
          })}
        </div>
      `;
    }

    // 2. Resolve poems safely through PoemRepository (ignoring missing IDs without crashing)
    const rawIds = Array.isArray(collection.poemIds) ? collection.poemIds : [];
    const poems = rawIds
      .map(id => poemRepository.getById(id))
      .filter(Boolean);

    // 3. Header
    const countStr = `${toDevanagariNumber(poems.length)} कविता${poems.length === 1 ? '' : 'एँ'}`;
    const headerHtml = renderPageHeader({
      title: escapeHtml(collection.name),
      subtitle: countStr,
      description: collection.description ? escapeHtml(collection.description) : 'इस संग्रह में आपकी चुनिंदा रचनाएँ संगृहीत हैं।',
      action: `
        <div class="collection-detail-actions">
          <button
            type="button"
            class="btn-primary-action"
            data-action="open-add-modal"
            aria-label="कविता जोड़ें"
          >
            ${getIconSvg('book', 'nav-icon')}
            <span>+ कविता जोड़ें</span>
          </button>

          <button
            type="button"
            class="btn-secondary-action"
            data-action="delete-this-collection"
            aria-label="संग्रह हटाएं"
            title="संग्रह हटाएं"
          >
            ${getIconSvg('trash', 'nav-icon')}
            <span>हटाएं</span>
          </button>
        </div>
      `
    });

    // 4. Toolbar with viewMode toggle and count
    const toolbarHtml = renderLibraryToolbar({
      activeFilter: 'all',
      viewMode: this.viewMode,
      count: poems.length,
      showFilters: false,
      countLabel: countStr
    });

    // 5. Content Area: Empty state vs Cards grid
    let contentHtml = '';
    if (poems.length === 0) {
      contentHtml = renderEmptyState({
        icon: 'book',
        heading: 'इस संग्रह में अभी कोई कविता नहीं है।',
        text: 'इस संग्रह में अपनी पसंदीदा या चुनी हुई कविताएँ जोड़ें।',
        primaryAction: `
          <button type="button" class="btn-primary-action" data-action="open-add-modal" aria-label="कविता जोड़ें">
            ${getIconSvg('book', 'nav-icon')}
            <span>कविता जोड़ें</span>
          </button>
        `
      });
    } else {
      const collectionClass = this.viewMode === 'list'
        ? 'library-collection-list'
        : 'library-collection-grid';

      const cardsHtml = poems.map(poem => {
        // Render card with an extra removal action for collection membership
        const cardMarkup = renderPoemCard(poem, this.viewMode);
        // Inject a subtle "संग्रह से हटाएं" action button into card footer
        const removalBtn = `
          <button
            type="button"
            class="btn-remove-from-collection"
            data-action="remove-poem-from-collection"
            data-poem-id="${poem.id}"
            data-poem-title="${escapeHtml(poem.title || 'रचना')}"
            aria-label="${escapeHtml(poem.title || 'रचना')} को इस संग्रह से हटाएं"
            title="संग्रह से निकालें (कविता सुरक्षित रहेगी)"
          >
            ${getIconSvg('close', 'nav-icon')}
            <span>हटाएं</span>
          </button>
        `;
        return cardMarkup.replace('</footer>', `${removalBtn}</footer>`);
      }).join('');

      contentHtml = `
        <div class="${collectionClass}" role="feed" aria-label="संग्रह की कविताएँ">
          ${cardsHtml}
        </div>
      `;
    }

    // 6. Add Poem Picker Modal Dialog
    const allAvailablePoems = poemRepository.getAll({ includeArchived: true });
    const modalHtml = this.renderAddPoemModalHtml(collection, allAvailablePoems);

    return `
      <div class="collection-detail-view standard-page-view" role="region" aria-label="संग्रह विवरण">
        <div class="collection-detail-top-nav">
          <a href="${ROUTES.COLLECTIONS}" data-link class="btn-back-link" aria-label="सभी संग्रह देखें">
            ${getIconSvg('arrow-left', 'nav-icon')}
            <span>सभी संग्रह</span>
          </a>
        </div>

        ${headerHtml}
        ${toolbarHtml}

        <section class="library-content-area" aria-label="संग्रहीत रचनाएँ">
          ${contentHtml}
        </section>

        ${modalHtml}
      </div>
    `;
  }

  /**
   * Renders the Add Poem picker modal dialog
   */
  renderAddPoemModalHtml(collection, allPoems) {
    const existingIds = new Set(collection.poemIds || []);

    const poemItemsHtml = allPoems.length === 0
      ? `<p class="collection-empty-picker-hint">पुस्तकालय में कोई कविता उपलब्ध नहीं है।</p>`
      : allPoems.map(p => {
          const isAdded = existingIds.has(p.id);
          return `
            <div class="add-poem-picker-item">
              <div class="add-poem-picker-info">
                <h4 class="add-poem-picker-title">${escapeHtml(p.title || 'शीर्षकहीन')}</h4>
                <p class="add-poem-picker-author">${escapeHtml(p.author || 'अज्ञात')}${p.isArchived ? ' (अभिलेख)' : ''}</p>
              </div>

              ${isAdded ? `
                <span class="btn-add-poem-action is-added" aria-label="पहले से संग्रह में शामिल है">
                  ✓ शामिल है
                </span>
              ` : `
                <button
                  type="button"
                  class="btn-primary-action btn-add-poem-action"
                  data-action="add-poem-to-collection"
                  data-poem-id="${p.id}"
                  aria-label="${escapeHtml(p.title || 'रचना')} को संग्रह में जोड़ें"
                >
                  <span>+ जोड़ें</span>
                </button>
              `}
            </div>
          `;
        }).join('');

    return `
      <div
        class="collection-modal-backdrop"
        id="add-poem-modal"
        style="display: ${this.isAddModalOpen ? 'flex' : 'none'};"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-poem-modal-title"
      >
        <div class="collection-modal-window">
          <header class="collection-modal-header">
            <h2 id="add-poem-modal-title" class="collection-modal-title">संग्रह में कविता जोड़ें</h2>
            <button
              type="button"
              class="collection-modal-close-btn"
              data-action="close-add-modal"
              aria-label="संवाद बंद करें"
            >
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <div class="collection-modal-body">
            <div class="add-poem-picker-list" role="list">
              ${poemItemsHtml}
            </div>
          </div>

          <footer class="collection-modal-footer">
            <button
              type="button"
              class="btn-primary-action"
              data-action="close-add-modal"
            >
              <span>पूर्ण</span>
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Re-renders the view
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Mounts view and wires listeners
   */
  mount() {
    this.container.addEventListener('click', this.boundClickHandler);
    window.addEventListener('keydown', this.boundKeydownHandler);
    this.update();
  }

  /**
   * Unmounts view
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
    }
    window.removeEventListener('keydown', this.boundKeydownHandler);
  }

  /**
   * Handles click delegation
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

    // 2. Open Add Poem modal
    if (event.target.closest('[data-action="open-add-modal"]')) {
      this.isAddModalOpen = true;
      this.update();
      return;
    }

    // 3. Close Add Poem modal
    if (event.target.closest('[data-action="close-add-modal"]') ||
        event.target.classList.contains('collection-modal-backdrop')) {
      this.isAddModalOpen = false;
      this.update();
      return;
    }

    // 4. Add poem to collection
    const addBtn = event.target.closest('[data-action="add-poem-to-collection"]');
    if (addBtn) {
      const poemId = addBtn.getAttribute('data-poem-id');
      if (poemId) {
        collectionRepository.addPoem(this.collectionId, poemId);
        this.update();
      }
      return;
    }

    // 5. Remove poem from collection
    const removeBtn = event.target.closest('[data-action="remove-poem-from-collection"]');
    if (removeBtn) {
      const poemId = removeBtn.getAttribute('data-poem-id');
      const poemTitle = removeBtn.getAttribute('data-poem-title') || 'इस रचना';
      if (poemId) {
        const confirmed = window.confirm(`क्या आप "${poemTitle}" को इस संग्रह से निकालना चाहते हैं? (कविता पुस्तकालय में सुरक्षित रहेगी)`);
        if (confirmed) {
          collectionRepository.removePoem(this.collectionId, poemId);
          this.update();
        }
      }
      return;
    }

    // 6. Delete this entire collection
    const deleteColBtn = event.target.closest('[data-action="delete-this-collection"]');
    if (deleteColBtn) {
      const col = this.getCollection();
      const name = col ? col.name : 'यह संग्रह';
      const confirmed = window.confirm(`क्या आप "${name}" संग्रह को हटाना चाहते हैं? (इसकी सभी कविताएँ पुस्तकालय में सुरक्षित रहेंगी)`);
      if (confirmed) {
        collectionRepository.delete(this.collectionId);
        this.router.navigate(ROUTES.COLLECTIONS);
      }
      return;
    }

    // 7. Favorite toggle inside collection
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

    // 8. Archive / Restore toggle inside collection
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

  /**
   * Handles keyboard escape
   */
  handleKeydown(event) {
    if (event.key === 'Escape' && this.isAddModalOpen) {
      this.isAddModalOpen = false;
      this.update();
    }
  }
}
