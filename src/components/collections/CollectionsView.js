/**
 * काव्यकलश (KavyaVault) — Collections View Component (CollectionsView.js)
 * Displays user-created collections with creation modal and delete management.
 */

import './collections.css';
import '../layout/layout.css';
import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { collectionRepository } from '../../services/CollectionRepository.js';
import { escapeHtml } from '../../services/SearchService.js';
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

export class CollectionsView {
  /**
   * @param {HTMLElement} container
   * @param {Object} router
   */
  constructor(container, router) {
    this.container = container;
    this.router = router;
    this.isCreateModalOpen = false;
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
    this.boundSubmitHandler = this.handleSubmit.bind(this);
  }

  /**
   * Retrieves collections from repository
   */
  getCollections() {
    try {
      return collectionRepository.getAll();
    } catch (err) {
      console.error('[CollectionsView] Failed to load collections:', err);
      return [];
    }
  }

  /**
   * Renders the complete HTML string
   */
  render() {
    const collections = this.getCollections();

    // 1. Header
    const headerHtml = renderPageHeader({
      title: 'संग्रह',
      subtitle: 'काव्य संग्रह व भाव',
      description: 'अपनी कविताओं को अपनी बनाई हुई श्रेणियों में सँजोएँ।',
      action: `
        <button type="button" class="btn-primary-action" data-action="open-create-modal" aria-label="नया संग्रह बनाएँ">
          ${getIconSvg('collection', 'nav-icon')}
          <span>नया संग्रह</span>
        </button>
      `
    });

    // 2. Body / Empty state
    let contentHtml = '';
    if (collections.length === 0) {
      contentHtml = renderEmptyState({
        icon: 'collection',
        heading: 'अभी कोई संग्रह नहीं है।',
        text: 'अपनी कविताओं को अलग-अलग संग्रहों में सँजोना शुरू करें।',
        primaryAction: `
          <button type="button" class="btn-primary-action" data-action="open-create-modal" aria-label="नया संग्रह बनाएँ">
            ${getIconSvg('collection', 'nav-icon')}
            <span>नया संग्रह</span>
          </button>
        `
      });
    } else {
      const cardsHtml = collections.map(col => {
        const count = col.poemIds ? col.poemIds.length : 0;
        const countStr = count === 0
          ? 'कोई कविता नहीं'
          : `${toDevanagariNumber(count)} कविता${count === 1 ? '' : 'एँ'}`;

        const descHtml = col.description
          ? `<p class="collection-card-desc">${escapeHtml(col.description)}</p>`
          : '';

        return `
          <article class="collection-card" data-collection-id="${col.id}">
            <div class="collection-card-body">
              <header class="collection-card-header">
                <h3 class="collection-card-title">
                  <a href="/collections/${col.id}" data-link class="collection-card-link">
                    ${escapeHtml(col.name)}
                  </a>
                </h3>
                ${descHtml}
              </header>
            </div>

            <footer class="collection-card-footer">
              <span class="collection-poem-count" aria-label="${countStr}">
                ${getIconSvg('book', 'nav-icon')}
                <span>${countStr}</span>
              </span>

              <div class="collection-card-actions">
                <button
                  type="button"
                  class="btn-card-delete-collection"
                  data-action="delete-collection"
                  data-col-id="${col.id}"
                  data-col-name="${escapeHtml(col.name)}"
                  aria-label="${escapeHtml(col.name)} संग्रह हटाएं"
                  title="संग्रह हटाएं"
                >
                  ${getIconSvg('trash', 'nav-icon')}
                </button>

                <a
                  href="/collections/${col.id}"
                  data-link
                  class="btn-secondary-action"
                  aria-label="${escapeHtml(col.name)} खोलें"
                >
                  <span>खोलें</span>
                </a>
              </div>
            </footer>
          </article>
        `;
      }).join('');

      contentHtml = `
        <div class="collections-grid" role="feed" aria-label="काव्य संग्रह सूची">
          ${cardsHtml}
        </div>
      `;
    }

    // 3. Modal Dialog markup (hidden or visible based on isCreateModalOpen)
    const modalHtml = `
      <div
        class="collection-modal-backdrop"
        id="create-collection-modal"
        style="display: ${this.isCreateModalOpen ? 'flex' : 'none'};"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
      >
        <div class="collection-modal-window">
          <header class="collection-modal-header">
            <h2 id="create-collection-title" class="collection-modal-title">नया संग्रह बनाएँ</h2>
            <button
              type="button"
              class="collection-modal-close-btn"
              data-action="close-create-modal"
              aria-label="संवाद बंद करें"
            >
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <form id="create-collection-form" class="collection-modal-form">
            <div class="collection-modal-body">
              <div class="collection-form-group">
                <label for="col-name-input" class="collection-form-label">
                  संग्रह का नाम <span aria-hidden="true" style="color: #c93b2b;">*</span>
                </label>
                <input
                  type="text"
                  id="col-name-input"
                  class="collection-form-input"
                  placeholder="उदा. सावन, प्रेम, यादें…"
                  required
                  autocomplete="off"
                />
                <div id="col-name-error" class="collection-form-error">संग्रह का नाम गैर-रिक्त होना अनिवार्य है।</div>
              </div>

              <div class="collection-form-group">
                <label for="col-desc-input" class="collection-form-label">विवरण (वैकल्पिक)</label>
                <textarea
                  id="col-desc-input"
                  class="collection-form-textarea"
                  placeholder="इस संग्रह के बारे में एक संक्षिप्त पंक्ति…"
                  rows="3"
                ></textarea>
              </div>
            </div>

            <footer class="collection-modal-footer">
              <button
                type="button"
                class="btn-secondary-action"
                data-action="close-create-modal"
              >
                <span>रद्द करें</span>
              </button>
              <button type="submit" class="btn-primary-action">
                <span>संग्रह बनाएँ</span>
              </button>
            </footer>
          </form>
        </div>
      </div>
    `;

    return `
      <div class="collections-view standard-page-view" role="region" aria-label="काव्य संग्रह">
        ${headerHtml}
        <section class="collections-content-area" aria-label="संग्रह सूची">
          ${contentHtml}
        </section>
        ${modalHtml}
      </div>
    `;
  }

  /**
   * Re-renders view
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Mounts view and event listeners
   */
  mount() {
    this.container.addEventListener('click', this.boundClickHandler);
    this.container.addEventListener('submit', this.boundSubmitHandler);
    window.addEventListener('keydown', this.boundKeydownHandler);
    this.update();
  }

  /**
   * Unmounts view and cleans up
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
      this.container.removeEventListener('submit', this.boundSubmitHandler);
    }
    window.removeEventListener('keydown', this.boundKeydownHandler);
  }

  /**
   * Opens the collection creation modal
   */
  openCreateModal() {
    this.isCreateModalOpen = true;
    this.update();
    const input = this.container.querySelector('#col-name-input');
    if (input) {
      input.focus();
    }
  }

  /**
   * Closes the collection creation modal
   */
  closeCreateModal() {
    this.isCreateModalOpen = false;
    this.update();
  }

  /**
   * Handles click delegation
   */
  handleClick(event) {
    // 1. Open create modal
    if (event.target.closest('[data-action="open-create-modal"]')) {
      this.openCreateModal();
      return;
    }

    // 2. Close create modal
    if (event.target.closest('[data-action="close-create-modal"]')) {
      this.closeCreateModal();
      return;
    }

    // 3. Click on backdrop closes modal
    if (event.target.classList.contains('collection-modal-backdrop')) {
      this.closeCreateModal();
      return;
    }

    // 4. Delete collection button
    const deleteBtn = event.target.closest('[data-action="delete-collection"]');
    if (deleteBtn) {
      const colId = deleteBtn.getAttribute('data-col-id');
      const colName = deleteBtn.getAttribute('data-col-name') || 'इस संग्रह';
      if (colId) {
        // Confirmation dialog
        const confirmed = window.confirm(`क्या आप "${colName}" संग्रह को हटाना चाहते हैं? (कविताएँ सुरक्षित रहेंगी)`);
        if (confirmed) {
          collectionRepository.delete(colId);
          this.update();
        }
      }
      return;
    }
  }

  /**
   * Handles creation form submit
   */
  handleSubmit(event) {
    if (event.target.id === 'create-collection-form') {
      event.preventDefault();
      const nameInput = this.container.querySelector('#col-name-input');
      const descInput = this.container.querySelector('#col-desc-input');
      const errorEl = this.container.querySelector('#col-name-error');

      const name = nameInput ? nameInput.value.trim() : '';
      const description = descInput ? descInput.value.trim() : '';

      if (!name) {
        if (errorEl) errorEl.style.display = 'block';
        if (nameInput) nameInput.focus();
        return;
      }

      try {
        collectionRepository.create({ name, description });
        this.isCreateModalOpen = false;
        this.update();
      } catch (err) {
        console.error('[CollectionsView] Failed to create collection:', err);
        if (errorEl) {
          errorEl.textContent = err.message || 'त्रुटि उत्पन्न हुई।';
          errorEl.style.display = 'block';
        }
      }
    }
  }

  /**
   * Handles keyboard escape
   */
  handleKeydown(event) {
    if (event.key === 'Escape' && this.isCreateModalOpen) {
      this.closeCreateModal();
    }
  }
}
