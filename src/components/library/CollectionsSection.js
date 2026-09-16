/**
 * काव्यकलश (KavyaVault) — Collections Section Component (CollectionsSection.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Provides literary collection browsing, creation modal, renaming,
 * poem membership management, and safe deletion.
 *
 * CRITICAL TENET: Deleting a collection MUST NEVER delete poem records.
 */

import { escapeHtml } from '../../services/SearchService.js';
import { getIconSvg } from '../navigation/icons.js';
import { renderPoemCard } from './PoemCard.js';
import { renderEmptyState } from '../layout/EmptyState.js';

/**
 * Converts Western digits to Devanagari numerals
 * @param {number|string} num
 * @returns {string}
 */
export function toDevanagariNumber(num) {
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, d => digits[Number(d)]);
}

/**
 * Renders the Collections section
 * @param {Object} options
 * @param {Array} options.collections
 * @param {Object|null} options.activeCollection
 * @param {Array} options.collectionPoems
 * @param {string} [options.viewMode='grid']
 * @param {boolean} [options.isCreateModalOpen=false]
 * @param {Object|null} [options.editingCollection=null]
 * @param {boolean} [options.isAddPoemsModalOpen=false]
 * @param {Array} [options.availablePoemsToAdd=[]]
 * @returns {string} HTML string
 */
export function renderCollectionsSection({
  collections = [],
  activeCollection = null,
  collectionPoems = [],
  viewMode = 'grid',
  isCreateModalOpen = false,
  editingCollection = null,
  isAddPoemsModalOpen = false,
  availablePoemsToAdd = []
}) {
  // If viewing a specific collection detail inside the library:
  if (activeCollection) {
    return renderActiveCollectionDetail({
      collection: activeCollection,
      poems: collectionPoems,
      viewMode,
      isAddPoemsModalOpen,
      availablePoemsToAdd,
      editingCollection
    });
  }

  // Collections Overview Grid
  const headerHtml = `
    <div class="collections-section-header">
      <div class="section-title-wrap">
        <h2 class="section-title">काव्य संग्रह</h2>
        <p class="section-desc">अपनी कविताओं को अपनी बनाई हुई साहित्यिक विधाओं व संग्रहों में सँजोएँ।</p>
      </div>
      <button
        type="button"
        class="btn-primary-action"
        data-action="open-create-collection-modal"
        aria-label="नया संग्रह बनाएँ"
      >
        ${getIconSvg('collection', 'nav-icon')}
        <span>नया संग्रह बनाएँ</span>
      </button>
    </div>
  `;

  let contentHtml = '';

  if (collections.length === 0) {
    contentHtml = renderEmptyState({
      icon: 'collection',
      heading: 'अभी कोई संग्रह नहीं बनाया गया है',
      text: 'अपनी कविताओं को रस, भाव, अथवा विषय के आधार पर व्यक्तिगत संग्रहों में सजाना शुरू करें।',
      primaryAction: `
        <button
          type="button"
          class="btn-primary-action"
          data-action="open-create-collection-modal"
          aria-label="पहला संग्रह बनाएँ"
        >
          ${getIconSvg('collection', 'nav-icon')}
          <span>पहला संग्रह बनाएँ</span>
        </button>
      `
    });
  } else {
    const cardsHtml = collections.map(col => {
      const count = Array.isArray(col.poemIds) ? col.poemIds.length : 0;
      const countStr = count === 0
        ? 'कोई कविता नहीं'
        : `${toDevanagariNumber(count)} कविता${count === 1 ? '' : 'एँ'}`;

      const descHtml = col.description
        ? `<p class="collection-card-desc">${escapeHtml(col.description)}</p>`
        : '<p class="collection-card-desc is-empty">कोई विवरण नहीं दिया गया</p>';

      return `
        <article class="collection-card" data-collection-id="${col.id}" aria-labelledby="col-title-${col.id}">
          <div class="collection-card-body">
            <header class="collection-card-header">
              <div class="collection-card-icon-badge" aria-hidden="true">
                ${getIconSvg('folder', 'nav-icon')}
              </div>
              <h3 id="col-title-${col.id}" class="collection-card-title">
                <button
                  type="button"
                  class="btn-col-title-link"
                  data-action="open-collection"
                  data-collection-id="${col.id}"
                  aria-label="${escapeHtml(col.name)} संग्रह खोलें"
                >
                  ${escapeHtml(col.name)}
                </button>
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
                class="btn-icon-action"
                data-action="edit-collection"
                data-collection-id="${col.id}"
                aria-label="${escapeHtml(col.name)} संग्रह का नाम व विवरण बदलें"
                title="संपादित करें"
              >
                ${getIconSvg('edit', 'nav-icon')}
              </button>

              <button
                type="button"
                class="btn-icon-action btn-danger-action"
                data-action="delete-collection"
                data-collection-id="${col.id}"
                data-col-name="${escapeHtml(col.name)}"
                aria-label="${escapeHtml(col.name)} संग्रह हटाएं (कविताएँ सुरक्षित रहेंगी)"
                title="संग्रह हटाएं"
              >
                ${getIconSvg('trash', 'nav-icon')}
              </button>

              <button
                type="button"
                class="btn-secondary-action btn-open-collection"
                data-action="open-collection"
                data-collection-id="${col.id}"
                aria-label="${escapeHtml(col.name)} संग्रह खोलें"
              >
                <span>खोलें</span>
              </button>
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

  // Modals
  const createModalHtml = isCreateModalOpen ? renderCreateCollectionModal() : '';
  const editModalHtml = editingCollection ? renderEditCollectionModal(editingCollection) : '';

  return `
    <div class="library-collections-view" role="region" aria-label="काव्य संग्रह अनुभाग">
      ${headerHtml}
      ${contentHtml}
      ${createModalHtml}
      ${editModalHtml}
    </div>
  `;
}

/**
 * Renders details of a single opened collection
 */
function renderActiveCollectionDetail({
  collection,
  poems = [],
  viewMode = 'grid',
  isAddPoemsModalOpen = false,
  availablePoemsToAdd = [],
  editingCollection = null
}) {
  const count = poems.length;
  const countStr = `${toDevanagariNumber(count)} कविता${count === 1 ? '' : 'एँ'}`;

  const topNavHtml = `
    <div class="collection-detail-top-nav">
      <button
        type="button"
        class="btn-back-link"
        data-action="back-to-collections"
        aria-label="सभी संग्रहों पर वापस लौटें"
      >
        ${getIconSvg('arrow-left', 'nav-icon')}
        <span>सभी संग्रह</span>
      </button>

      <div class="collection-detail-controls">
        <button
          type="button"
          class="btn-primary-action"
          data-action="open-add-poems-modal"
          aria-label="इस संग्रह में कविताएँ जोड़ें"
        >
          ${getIconSvg('book', 'nav-icon')}
          <span>+ कविता जोड़ें</span>
        </button>

        <button
          type="button"
          class="btn-secondary-action"
          data-action="edit-collection"
          data-collection-id="${collection.id}"
          aria-label="संग्रह का नाम व विवरण बदलें"
        >
          ${getIconSvg('edit', 'nav-icon')}
          <span>संपादित करें</span>
        </button>

        <button
          type="button"
          class="btn-secondary-action btn-danger-action"
          data-action="delete-collection"
          data-collection-id="${collection.id}"
          data-col-name="${escapeHtml(collection.name)}"
          aria-label="संग्रह हटाएं (कविताएँ सुरक्षित रहेंगी)"
          title="संग्रह हटाएं"
        >
          ${getIconSvg('trash', 'nav-icon')}
          <span>हटाएं</span>
        </button>
      </div>
    </div>
  `;

  const bannerHtml = `
    <div class="collection-detail-banner">
      <div class="collection-banner-meta">
        <span class="collection-badge-ornament" aria-hidden="true">❦</span>
        <h2 class="collection-banner-title">${escapeHtml(collection.name)}</h2>
        <span class="collection-banner-count">${countStr}</span>
      </div>
      ${collection.description ? `<p class="collection-banner-desc">${escapeHtml(collection.description)}</p>` : ''}
    </div>
  `;

  let poemsHtml = '';
  if (poems.length === 0) {
    poemsHtml = renderEmptyState({
      icon: 'book',
      heading: 'इस संग्रह में अभी कोई कविता नहीं है',
      text: 'अपनी लिखी हुई रचनाओं में से इस संग्रह के अनुकूल कविताएँ चुनें और जोड़ें।',
      primaryAction: `
        <button
          type="button"
          class="btn-primary-action"
          data-action="open-add-poems-modal"
          aria-label="कविता जोड़ें"
        >
          ${getIconSvg('book', 'nav-icon')}
          <span>कविता जोड़ें</span>
        </button>
      `
    });
  } else {
    const listClass = viewMode === 'list' ? 'library-collection-list' : 'library-collection-grid';
    const cards = poems.map(poem => {
      const card = renderPoemCard(poem, viewMode);
      // Inject "Remove from collection" button before the closing tag of card-actions
      const removeBtn = `
        <button
          type="button"
          class="btn-card-action btn-card-remove-from-col"
          data-action="remove-poem-from-collection"
          data-poem-id="${poem.id}"
          data-collection-id="${collection.id}"
          aria-label="${escapeHtml(poem.title || 'रचना')} को इस संग्रह से हटाएं"
          title="संग्रह से हटाएं"
        >
          ${getIconSvg('close', 'nav-icon')}
        </button>
      `;
      return card.replace('<div class="card-actions">', `<div class="card-actions">${removeBtn}`);
    }).join('');

    poemsHtml = `<div class="${listClass}" role="feed" aria-label="${escapeHtml(collection.name)} की कविताएँ">${cards}</div>`;
  }

  const addPoemsModalHtml = isAddPoemsModalOpen
    ? renderAddPoemsModal({ collection, availablePoems: availablePoemsToAdd })
    : '';

  const editModalHtml = editingCollection ? renderEditCollectionModal(editingCollection) : '';

  return `
    <div class="library-collection-detail-view" role="region" aria-label="${escapeHtml(collection.name)} विवरण">
      ${topNavHtml}
      ${bannerHtml}
      <div class="collection-poems-area">
        ${poemsHtml}
      </div>
      ${addPoemsModalHtml}
      ${editModalHtml}
    </div>
  `;
}

/**
 * Renders modal for creating a new collection
 */
function renderCreateCollectionModal() {
  return `
    <div class="modal-backdrop" id="collection-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-col-title">
      <div class="modal-dialog">
        <header class="modal-header">
          <h3 id="create-col-title" class="modal-title">नया काव्य संग्रह बनाएँ</h3>
          <button
            type="button"
            class="btn-modal-close"
            data-action="close-modal"
            aria-label="बंद करें"
          >
            ${getIconSvg('close', 'nav-icon')}
          </button>
        </header>

        <form id="create-collection-form" class="modal-form" novalidate>
          <div class="form-group">
            <label for="col-name-input" class="form-label">
              संग्रह का नाम <span class="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              id="col-name-input"
              name="name"
              class="form-input"
              placeholder="उदा. श्रृंगार रस, विरह के छंद, आधुनिक मुक्तक..."
              required
              maxlength="100"
              autocomplete="off"
            />
            <span class="form-help-text">काव्य-संग्रह का एक सार्थक साहित्यिक नाम दें।</span>
          </div>

          <div class="form-group">
            <label for="col-desc-input" class="form-label">विवरण (वैकल्पिक)</label>
            <textarea
              id="col-desc-input"
              name="description"
              class="form-textarea"
              rows="3"
              placeholder="इस संग्रह के भाव, विधा या रचना काल का संक्षिप्त परिचय..."
              maxlength="300"
            ></textarea>
          </div>

          <footer class="modal-footer">
            <button
              type="button"
              class="btn-secondary-action"
              data-action="close-modal"
            >
              <span>रद्द करें</span>
            </button>
            <button
              type="submit"
              class="btn-primary-action"
              id="btn-submit-create-collection"
            >
              ${getIconSvg('check', 'nav-icon')}
              <span>संग्रह सहेजें</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  `;
}

/**
 * Renders modal for editing an existing collection
 */
function renderEditCollectionModal(col) {
  return `
    <div class="modal-backdrop" id="edit-col-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-col-title">
      <div class="modal-dialog">
        <header class="modal-header">
          <h3 id="edit-col-title" class="modal-title">संग्रह संपादित करें</h3>
          <button
            type="button"
            class="btn-modal-close"
            data-action="close-modal"
            aria-label="बंद करें"
          >
            ${getIconSvg('close', 'nav-icon')}
          </button>
        </header>

        <form id="edit-collection-form" class="modal-form" data-col-id="${col.id}" novalidate>
          <div class="form-group">
            <label for="edit-col-name-input" class="form-label">
              संग्रह का नाम <span class="required-mark" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              id="edit-col-name-input"
              name="name"
              class="form-input"
              value="${escapeHtml(col.name)}"
              required
              maxlength="100"
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label for="edit-col-desc-input" class="form-label">विवरण</label>
            <textarea
              id="edit-col-desc-input"
              name="description"
              class="form-textarea"
              rows="3"
              maxlength="300"
            >${escapeHtml(col.description || '')}</textarea>
          </div>

          <footer class="modal-footer">
            <button
              type="button"
              class="btn-secondary-action"
              data-action="close-modal"
            >
              <span>रद्द करें</span>
            </button>
            <button
              type="submit"
              class="btn-primary-action"
              id="btn-submit-edit-collection"
            >
              ${getIconSvg('check', 'nav-icon')}
              <span>परिवर्तन सहेजें</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  `;
}

/**
 * Renders modal for adding poems to a collection
 */
function renderAddPoemsModal({ collection, availablePoems = [] }) {
  const optionsHtml = availablePoems.length === 0
    ? `<p class="modal-empty-notice">जोड़ने के लिए कोई अन्य कविता उपलब्ध नहीं है।</p>`
    : availablePoems.map(p => `
        <label class="poem-checkbox-item" for="poem-pick-${p.id}">
          <input
            type="checkbox"
            name="selectedPoems"
            value="${p.id}"
            id="poem-pick-${p.id}"
            class="poem-pick-checkbox"
          />
          <span class="poem-pick-label">
            <span class="poem-pick-title">${escapeHtml(p.title || 'शीर्षकहीन रचना')}</span>
            <span class="poem-pick-author">${escapeHtml(p.author || 'अज्ञात')}</span>
          </span>
        </label>
      `).join('');

  return `
    <div class="modal-backdrop" id="add-poems-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-poems-title">
      <div class="modal-dialog modal-dialog-wide">
        <header class="modal-header">
          <h3 id="add-poems-title" class="modal-title">‘${escapeHtml(collection.name)}’ में कविताएँ जोड़ें</h3>
          <button
            type="button"
            class="btn-modal-close"
            data-action="close-modal"
            aria-label="बंद करें"
          >
            ${getIconSvg('close', 'nav-icon')}
          </button>
        </header>

        <form id="add-poems-to-collection-form" class="modal-form" data-col-id="${collection.id}">
          <div class="add-poems-list" role="group" aria-label="कविता चयन सूची">
            ${optionsHtml}
          </div>

          <footer class="modal-footer">
            <button
              type="button"
              class="btn-secondary-action"
              data-action="close-modal"
            >
              <span>रद्द करें</span>
            </button>
            <button
              type="submit"
              class="btn-primary-action"
              id="btn-submit-add-poems"
              ${availablePoems.length === 0 ? 'disabled' : ''}
            >
              ${getIconSvg('check', 'nav-icon')}
              <span>चयनित कविताएँ जोड़ें</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  `;
}
