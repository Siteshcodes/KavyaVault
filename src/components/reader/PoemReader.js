/**
 * काव्यकलश (KavyaVault) — Poetry Reader Component (PoemReader.js)
 * Dignified reading sanctuary with full lifecycle actions: Favorite toggle,
 * Archive/Restore, Delete confirmation modal, and Edit routing.
 */

import { poemRepository } from '../../services/PoemRepository.js';
import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { formatPoeticDate } from '../../utils/date.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

export class PoemReader {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   * @param {string} options.poemId Unique poem ID
   * @param {Object} [options.manuscriptRepo=manuscriptRepository] Manuscript repository instance
   */
  constructor({ container, router, poemId, manuscriptRepo = manuscriptRepository }) {
    this.container = container;
    this.router = router;
    this.poemId = poemId;
    this.manuscriptRepo = manuscriptRepo;
    this.poem = null;
    this.showDeleteModal = false;

    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
  }

  /**
   * Mounts the reader into DOM and fetches poem data
   */
  mount() {
    this.poem = poemRepository.getById(this.poemId);

    if (!this.poem) {
      this.renderMissingPoem();
      return;
    }

    this.update();

    this.container.addEventListener('click', this.boundClickHandler);
    document.addEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * Unmounts reader and cleans up event listeners
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
    }
    document.removeEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * Re-renders the reader HTML in place
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Renders localized 404 state when poem is not found
   */
  renderMissingPoem() {
    this.container.innerHTML = `
      <div class="poem-reader-view standard-page-view" role="region" aria-label="रचना अनुपलब्ध">
        <div class="reader-top-bar">
          <a href="${ROUTES.POEMS}" data-link class="reader-nav-back" aria-label="पुस्तकालय पर लौटें">
            ${getIconSvg('book', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>
        </div>
        <div class="reader-article" style="text-align: center; padding: var(--space-10) var(--space-4);">
          <div class="reader-ornament" aria-hidden="true">❦</div>
          <h2 class="reader-poem-title" style="margin-top: var(--space-2);">रचना अप्राप्य</h2>
          <p style="font-family: var(--font-interface); color: var(--color-text-muted); margin: var(--space-3) 0 var(--space-6) 0;">
            जिस काव्य पन्ने की आप खोज कर रहे हैं, वह इस संग्रह में उपस्थित नहीं है अथवा हटा दिया गया है।
          </p>
          <div>
            <a href="${ROUTES.POEMS}" data-link class="btn-reader-action" style="padding: 0 var(--space-5); text-decoration: none; display: inline-flex;">
              ${getIconSvg('book', 'nav-icon')}
              <span>पुस्तकालय पर लौटें</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Escapes HTML to prevent injection while preserving verse integrity
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Formats multiline poetry body into semantic stanzas and verse lines
   */
  renderStanzas(bodyText) {
    if (!bodyText || typeof bodyText !== 'string') return '';

    // Split on double newlines to delineate stanzas
    const rawStanzas = bodyText.split(/\r?\n\s*\r?\n/);

    return rawStanzas
      .map(stanza => {
        const lines = stanza.split(/\r?\n/);
        const linesHtml = lines
          .map(line => {
            const trimmed = line.trim();
            if (!trimmed) {
              return '<div class="reader-stanza-spacer" aria-hidden="true"></div>';
            }
            return `<p class="reader-verse-line">${this.escapeHtml(line)}</p>`;
          })
          .join('');

        return `<div class="reader-stanza">${linesHtml}</div>`;
      })
      .join('');
  }

  /**
   * Returns complete HTML for Reader
   */
  render() {
    const poem = this.poem;
    if (!poem) return '';

    const formattedDate = formatPoeticDate(poem.updatedAt || poem.createdAt);
    const createdDate = formatPoeticDate(poem.createdAt);

    const isFavorite = Boolean(poem.isFavorite);
    const isArchived = Boolean(poem.isArchived);

    // Tags rendering
    const tagsHtml = (Array.isArray(poem.tags) && poem.tags.length > 0)
      ? `<div class="reader-tags">${poem.tags.map(t => `<span class="reader-tag">#${this.escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    // Archived banner
    const archiveBannerHtml = isArchived ? `
      <div class="reader-archived-banner" role="status">
        <div class="banner-content">
          ${getIconSvg('archive', 'nav-icon')}
          <span>यह रचना आपके अभिलेखागार में सुरक्षित है।</span>
        </div>
        <button
          type="button"
          class="btn-banner-restore"
          data-action="toggle-archive"
          aria-label="मुख्य पुस्तकालय में पुनर्स्थापित करें"
        >
          ${getIconSvg('restore', 'nav-icon')}
          <span>मुख्य पुस्तकालय में लाएं</span>
        </button>
      </div>
    ` : '';

    // Delete confirmation modal
    const deleteModalHtml = this.showDeleteModal ? `
      <div class="delete-modal-backdrop" id="delete-modal-backdrop" role="presentation">
        <div
          class="delete-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div class="delete-modal-header">
            <h3 id="delete-dialog-title" class="delete-modal-title">क्या आप इस रचना को हटाना चाहते हैं?</h3>
          </div>
          <div class="delete-modal-body">
            <p id="delete-dialog-desc">
              "<strong>${this.escapeHtml(poem.title)}</strong>" हमेशा के लिए संग्रह से मिटा दी जाएगी। यह क्रिया पूर्ववत नहीं की जा सकती।
            </p>
          </div>
          <div class="delete-modal-actions">
            <button
              type="button"
              class="btn-modal-cancel"
              data-action="close-delete-modal"
              aria-label="हटाने की प्रक्रिया रद्द करें"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-modal-confirm"
              data-action="confirm-delete"
              aria-label="रचना स्थायी रूप से हटाएं"
            >
              स्थायी रूप से हटाएं
            </button>
          </div>
        </div>
      </div>
    ` : '';

    return `
      <div class="poem-reader-view standard-page-view" role="region" aria-label="काव्य पठन कक्ष">
        <!-- Top Action Toolbar -->
        <header class="reader-top-bar" role="toolbar" aria-label="पठन नियंत्रण पट्टी">
          <a href="${ROUTES.POEMS}" data-link class="reader-nav-back" aria-label="पुस्तकालय पर लौटें">
            ${getIconSvg('book', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>

          <div class="reader-lifecycle-actions" role="group" aria-label="रचना क्रियाएँ">
            <!-- Favorite Action -->
            <button
              type="button"
              class="btn-reader-action btn-reader-fav ${isFavorite ? 'is-favorite' : ''}"
              data-action="toggle-fav"
              aria-label="${isFavorite ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें'}"
              aria-pressed="${isFavorite}"
              title="${isFavorite ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें'}"
            >
              ${getIconSvg(isFavorite ? 'heart-filled' : 'heart', 'nav-icon')}
              <span>${isFavorite ? 'पसंदीदा' : 'पसंद'}</span>
            </button>

            <!-- Edit Action -->
            <a
              href="/poems/${poem.id}/edit"
              data-link
              class="btn-reader-action btn-reader-edit"
              aria-label="रचना संपादित करें"
              title="रचना संपादित करें"
            >
              ${getIconSvg('edit', 'nav-icon')}
              <span>संपादित करें</span>
            </a>

            <!-- Archive / Restore Action -->
            <button
              type="button"
              class="btn-reader-action btn-reader-archive"
              data-action="toggle-archive"
              aria-label="${isArchived ? 'पुनर्स्थापित करें' : 'अभिलेख में भेजें'}"
              title="${isArchived ? 'पुनर्स्थापित करें' : 'अभिलेख में भेजें'}"
            >
              ${getIconSvg(isArchived ? 'restore' : 'archive', 'nav-icon')}
              <span>${isArchived ? 'पुनर्स्थापित करें' : 'अभिलेख'}</span>
            </button>

            <!-- Delete Action -->
            <button
              type="button"
              class="btn-reader-action btn-reader-delete"
              data-action="open-delete-modal"
              aria-label="रचना हटाएं"
              title="रचना हटाएं"
            >
              ${getIconSvg('trash', 'nav-icon')}
              <span>हटाएं</span>
            </button>
          </div>
        </header>

        <!-- Archived Status Banner -->
        ${archiveBannerHtml}

        <!-- Sanctuary: The Poem Article -->
        <article class="reader-article" aria-labelledby="poem-reader-title">
          <header class="reader-header">
            <h1 id="poem-reader-title" class="reader-poem-title">
              ${this.escapeHtml(poem.title || 'शीर्षकहीन रचना')}
            </h1>

            <div class="reader-meta">
              <span class="reader-author">${this.escapeHtml(poem.author || 'अज्ञात')}</span>
              <span class="reader-meta-dot" aria-hidden="true">•</span>
              <time datetime="${poem.updatedAt || poem.createdAt}">${formattedDate}</time>
            </div>

            ${tagsHtml}
          </header>

          <!-- Poetry Stanzas & Verses -->
          <main class="reader-poetry-canvas">
            ${this.renderStanzas(poem.body)}
          </main>

          <!-- Linked Archival Manuscripts -->
          ${this.renderLinkedManuscriptsSection()}

          <!-- Reader Footer: Dingbat & Timestamps -->
          <footer class="reader-footer">
            <div class="reader-ornament" aria-hidden="true">❦</div>
            <div class="reader-timestamp">
              <span>रचना तिथि: ${createdDate}</span>
              ${poem.updatedAt && poem.updatedAt !== poem.createdAt ? `<span> • अद्यतन: ${formattedDate}</span>` : ''}
            </div>
          </footer>
        </article>

        <!-- Accessible Delete Confirmation Modal -->
        ${deleteModalHtml}
      </div>
    `;
  }

  /**
   * Central click event delegation handler
   */
  handleClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');

    if (action === 'toggle-fav') {
      this.toggleFavorite();
    } else if (action === 'toggle-archive') {
      this.toggleArchive();
    } else if (action === 'open-delete-modal') {
      this.openDeleteModal();
    } else if (action === 'close-delete-modal') {
      this.closeDeleteModal();
    } else if (action === 'confirm-delete') {
      this.confirmDelete();
    }
  }

  /**
   * Toggles favorite status in PoemRepository and updates view
   */
  toggleFavorite() {
    if (!this.poem) return;
    try {
      const updated = poemRepository.setFavorite(this.poem.id, !this.poem.isFavorite);
      this.poem = updated;
      this.update();
    } catch (err) {
      console.error('[PoemReader] Error toggling favorite:', err);
    }
  }

  /**
   * Toggles archive status in PoemRepository and updates view
   */
  toggleArchive() {
    if (!this.poem) return;
    try {
      let updated;
      if (this.poem.isArchived) {
        updated = poemRepository.restore(this.poem.id);
      } else {
        updated = poemRepository.archive(this.poem.id);
      }
      this.poem = updated;
      this.update();
    } catch (err) {
      console.error('[PoemReader] Error toggling archive:', err);
    }
  }

  /**
   * Formats source identifier for archival display in reader
   * @param {string} source
   * @returns {string}
   */
  formatSource(source) {
    switch (source) {
      case 'handwritten-manuscript':
      case 'handwritten_manuscript':
      case 'handwritten':
        return 'हस्तलिखित पांडुलिपि';
      case 'scanned-document':
      case 'scanned_document':
        return 'स्कैन किया गया दस्तावेज़';
      case 'camera-capture':
      case 'photo_capture':
        return 'कैमरा तस्वीर';
      case 'imported-image':
      case 'imported_image':
        return 'आयातित छवि';
      case 'other':
        return 'अन्य स्रोत';
      default:
        return source || 'अभिलेख';
    }
  }

  /**
   * Opens delete confirmation modal
   */
  openDeleteModal() {
    this.showDeleteModal = true;
    this.update();

    // Focus cancel button for safe keyboard defaults
    const cancelBtn = this.container.querySelector('.btn-modal-cancel');
    if (cancelBtn) cancelBtn.focus();
  }

  /**
   * Closes delete confirmation modal
   */
  closeDeleteModal() {
    this.showDeleteModal = false;
    this.update();
  }

  /**
   * Permanently deletes poem through PoemRepository and navigates to library
   */
  confirmDelete() {
    if (!this.poem) return;
    try {
      const id = this.poem.id;
      poemRepository.delete(id);

      // Clean any lingering draft tied to this poem ID
      const draft = poemRepository.getDraft();
      if (draft && draft.poemId === id) {
        poemRepository.clearDraft();
      }

      this.showDeleteModal = false;
      this.router.navigate(ROUTES.POEMS);
    } catch (err) {
      console.error('[PoemReader] Error deleting poem:', err);
    }
  }

  /**
   * Keyboard shortcuts (Escape key dismisses delete modal)
   */
  handleKeyDown(event) {
    if (event.key === 'Escape' && this.showDeleteModal) {
      event.preventDefault();
      this.closeDeleteModal();
    }
  }

  /**
   * Renders archival linked manuscripts section beneath poem verses
   * @returns {string} HTML string
   */
  renderLinkedManuscriptsSection() {
    let linkedManuscripts = [];
    try {
      const repo = this.manuscriptRepo || manuscriptRepository;
      linkedManuscripts = repo.getManuscriptsForPoem
        ? repo.getManuscriptsForPoem(this.poemId)
        : (repo.getByPoemId ? repo.getByPoemId(this.poemId) : []);
    } catch (_) {
      linkedManuscripts = [];
    }

    if (!Array.isArray(linkedManuscripts) || linkedManuscripts.length === 0) {
      return '';
    }

    return `
      <section class="reader-linked-manuscripts-section" aria-labelledby="reader-linked-ms-title">
        <div class="reader-linked-ms-header">
          <span class="reader-linked-ms-icon" aria-hidden="true">📜</span>
          <h2 id="reader-linked-ms-title" class="reader-linked-ms-title">
            मूल पांडुलिपि${linkedManuscripts.length > 1 ? 'याँ' : ''}
          </h2>
        </div>

        <div class="reader-linked-ms-grid">
          ${linkedManuscripts.map(ms => {
            const orig = ms.originalManuscript || {};
            const derived = ms.derivedManuscript || {};
            const prov = ms.provenance || {};
            const raw = derived.data || orig.data || '';
            const mime = derived.data ? (derived.mimeType || 'image/png') : (orig.mimeType || 'image/jpeg');
            const imgSrc = raw.startsWith('data:') ? raw : (raw ? `data:${mime};base64,${raw}` : '');
            const captureDate = orig.capturedAt ? formatPoeticDate(orig.capturedAt) : formatPoeticDate(ms.createdAt);
            const sourceLabel = prov.source ? this.formatSource(prov.source) : null;

            return `
              <div class="reader-linked-ms-card" role="region" aria-label="पांडुलिपि: ${this.escapeHtml(ms.title)}">
                <div class="reader-linked-ms-thumb-frame">
                  ${imgSrc ? `
                    <img src="${imgSrc}" alt="${this.escapeHtml(ms.title)}" class="reader-linked-ms-thumb" />
                  ` : `
                    <span class="reader-linked-ms-thumb-fallback">📜</span>
                  `}
                </div>
                <div class="reader-linked-ms-info">
                  <h3 class="reader-linked-ms-name">${this.escapeHtml(ms.title || 'शीर्षकहीन पांडुलिपि')}</h3>
                  <div class="reader-linked-ms-meta">
                    <span class="reader-linked-ms-date">${captureDate}</span>
                    ${sourceLabel ? `
                      <span class="reader-linked-ms-dot" aria-hidden="true">•</span>
                      <span class="reader-linked-ms-source">${this.escapeHtml(sourceLabel)}</span>
                    ` : ''}
                  </div>
                  ${prov.notes ? `
                    <p class="reader-linked-ms-notes">${this.escapeHtml(prov.notes)}</p>
                  ` : ''}
                </div>
                <div class="reader-linked-ms-action">
                  <a
                    href="/manuscripts/${encodeURIComponent(ms.id)}"
                    data-link
                    class="btn-reader-view-manuscript"
                    aria-label="${this.escapeHtml(ms.title)} पांडुलिपि देखें"
                  >
                    ${getIconSvg('archive', 'icon-inline')}
                    <span>पांडुलिपि देखें</span>
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }
}
