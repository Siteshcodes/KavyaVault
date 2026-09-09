/**
 * काव्यकलश (KavyaVault) — Manuscript Detail & Archival View (ManuscriptView.js)
 *
 * Phase 2 / Task 2.2: Manuscript Capture & Import
 *
 * Dignified archival presentation of a preserved original manuscript.
 * Displays the original manuscript image prominently as an archival artifact,
 * alongside complete preservation metadata, provenance notes, and untranscribed status.
 */

import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { formatPoeticDate } from '../../utils/date.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

export class ManuscriptView {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   * @param {string} options.manuscriptId Unique manuscript identifier
   */
  constructor({ container, router, manuscriptId }) {
    this.container = container;
    this.router = router;
    this.manuscriptId = manuscriptId;
    this.manuscript = null;
    this.showDeleteModal = false;

    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
  }

  /**
   * Mounts the view into the DOM and loads manuscript data
   */
  mount() {
    this.manuscript = manuscriptRepository.getById(this.manuscriptId);

    if (!this.manuscript) {
      this.renderNotFound();
      return;
    }

    this.update();
    this.container.addEventListener('click', this.boundClickHandler);
    document.addEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * Unmounts the view and detaches event listeners
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
    }
    document.removeEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * Re-renders the component HTML
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Escapes HTML for secure rendering
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
   * Formats source identifier into Hindi label
   */
  formatSource(source) {
    switch (source) {
      case 'handwritten_manuscript': return 'हस्तलिखित पांडुलिपि';
      case 'scanned_document': return 'स्कैन किया गया दस्तावेज़';
      case 'photo_capture': return 'कैमरा तस्वीर';
      default: return source || 'अभिलेख';
    }
  }

  /**
   * Handles click events
   */
  handleClick(e) {
    const target = e.target;

    // Trigger delete modal
    const deleteBtn = target.closest('[data-action="open-delete-modal"]');
    if (deleteBtn) {
      e.preventDefault();
      this.showDeleteModal = true;
      this.update();
      return;
    }

    // Cancel delete
    const cancelDeleteBtn = target.closest('[data-action="cancel-delete"]');
    if (cancelDeleteBtn) {
      e.preventDefault();
      this.showDeleteModal = false;
      this.update();
      return;
    }

    // Confirm delete
    const confirmDeleteBtn = target.closest('[data-action="confirm-delete"]');
    if (confirmDeleteBtn) {
      e.preventDefault();
      try {
        manuscriptRepository.delete(this.manuscriptId);
        this.router.navigate(ROUTES.POEMS);
      } catch (err) {
        console.error('[ManuscriptView] Error deleting manuscript:', err);
      }
      return;
    }
  }

  /**
   * Handles keyboard navigation (e.g. Escape to close delete modal)
   */
  handleKeyDown(e) {
    if (e.key === 'Escape' && this.showDeleteModal) {
      e.preventDefault();
      this.showDeleteModal = false;
      this.update();
    }
  }

  /**
   * Renders localized 404 state when manuscript record is not found
   */
  renderNotFound() {
    this.container.innerHTML = `
      <div class="manuscript-detail-view standard-page-view" role="region" aria-label="पांडुलिपि अप्राप्य">
        <div class="manuscript-top-bar">
          <a href="${ROUTES.POEMS}" data-link class="manuscript-nav-back" aria-label="पुस्तकालय पर लौटें">
            ${getIconSvg('arrow-left', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>
        </div>
        <div style="text-align: center; padding: var(--space-12) var(--space-4); background: var(--color-bg-card); border-radius: var(--radius-lg); border: 1px solid var(--color-border-subtle); margin-top: var(--space-6);">
          <div style="font-size: 2.5rem; margin-bottom: var(--space-3); color: var(--color-accent-gold);" aria-hidden="true">❦</div>
          <h2 style="font-family: var(--font-display); font-size: var(--text-h2); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            पांडुलिपि अप्राप्य
          </h2>
          <p style="font-family: var(--font-interface); color: var(--color-text-muted); margin: 0 0 var(--space-6) 0; max-width: 480px; margin-left: auto; margin-right: auto; line-height: var(--leading-normal);">
            जिस पांडुलिपि की आप खोज कर रहे हैं, वह इस संग्रह में उपस्थित नहीं है अथवा हटा दी गई है।
          </p>
          <a
            href="${ROUTES.POEMS}"
            data-link
            class="manuscript-nav-back"
            style="background: var(--color-accent-gold); color: #1a150e; border: none; font-weight: 600;"
          >
            ${getIconSvg('book', 'nav-icon')}
            <span>पुस्तकालय पर लौटें</span>
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Renders the complete archival view
   */
  render() {
    const ms = this.manuscript;
    const orig = ms.originalManuscript || {};
    const prov = ms.provenance || {};
    const trans = ms.transcription || {};

    // Determine safe image source (Data URL or base64)
    const rawData = orig.data || '';
    const imgSrc = rawData.startsWith('data:')
      ? rawData
      : `data:${orig.mimeType || 'image/jpeg'};base64,${rawData}`;

    const captureDate = orig.capturedAt
      ? formatPoeticDate(orig.capturedAt)
      : formatPoeticDate(ms.createdAt);

    const provenanceDate = prov.recordedAt
      ? formatPoeticDate(prov.recordedAt)
      : formatPoeticDate(ms.createdAt);

    return `
      <div class="manuscript-detail-view" role="region" aria-label="पांडुलिपि अभिलेख: ${this.escapeHtml(ms.title)}">
        <!-- Top Navigation Bar -->
        <div class="manuscript-top-bar">
          <a href="${ROUTES.POEMS}" data-link class="manuscript-nav-back" aria-label="काव्य पुस्तकालय पर लौटें">
            ${getIconSvg('arrow-left', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>

          <div style="display: flex; gap: var(--space-2); align-items: center;">
            <a
              href="${ROUTES.MANUSCRIPT_NEW}"
              data-link
              class="manuscript-nav-back"
              aria-label="नई पांडुलिपि सहेजें"
            >
              ${getIconSvg('upload', 'nav-icon')}
              <span>नई पांडुलिपि</span>
            </a>

            <button
              type="button"
              class="manuscript-nav-back"
              data-action="open-delete-modal"
              style="color: var(--color-accent-terracotta);"
              aria-label="पांडुलिपि हटाएं"
            >
              ${getIconSvg('trash', 'nav-icon')}
              <span>हटाएँ</span>
            </button>
          </div>
        </div>

        <!-- Archival Card Container -->
        <article class="manuscript-detail-card">
          <!-- Header with Title & Transcription Status Badge -->
          <header class="manuscript-detail-header">
            <div>
              <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
                <span class="manuscript-badge-original">
                  ${getIconSvg('check', 'badge-icon')}
                  <span>मूल पांडुलिपि</span>
                </span>
                <span style="font-family: var(--font-interface); font-size: var(--text-caption); color: var(--color-text-muted);">
                  आईडी: ${this.escapeHtml(ms.id)}
                </span>
              </div>
              <h1 class="manuscript-detail-title">
                ${this.escapeHtml(ms.title)}
              </h1>
            </div>

            <!-- Transcription Status (Untranscribed) -->
            <div>
              <span class="manuscript-status-badge status-untranscribed" title="प्रतिलिपि की स्थिति">
                ${getIconSvg('book', 'badge-icon')}
                <span>${trans.status === 'untranscribed' ? 'अप्रतिलिपिबद्ध' : this.escapeHtml(trans.status)}</span>
              </span>
            </div>
          </header>

          <!-- Archival Image Showcase -->
          <div class="manuscript-archival-display">
            <figure class="manuscript-archival-frame" style="margin: 0;">
              <img
                src="${imgSrc}"
                alt="मूल पांडुलिपि: ${this.escapeHtml(ms.title)}"
                class="manuscript-archival-img"
              />
            </figure>
          </div>

          <!-- Archival Metadata Grid -->
          <div class="manuscript-detail-metadata-grid">
            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">मूल फ़ाइल नाम</span>
              <span class="manuscript-meta-value">${this.escapeHtml(orig.filename || 'अज्ञात फ़ाइल')}</span>
            </div>

            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">कैप्चर / आयात तिथि</span>
              <span class="manuscript-meta-value">${captureDate}</span>
            </div>

            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">छवि प्रारूप (MIME)</span>
              <span class="manuscript-meta-value">${this.escapeHtml(orig.mimeType || 'image/jpeg')}</span>
            </div>

            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">उद्गम स्रोत</span>
              <span class="manuscript-meta-value">${this.formatSource(prov.source)}</span>
            </div>
          </div>

          <!-- Provenance Notes Section -->
          ${prov.notes ? `
            <div class="manuscript-notes-section">
              <h2 class="manuscript-notes-heading">उद्गम व साहित्यिक संदर्भ</h2>
              <div class="manuscript-notes-body">${this.escapeHtml(prov.notes)}</div>
            </div>
          ` : ''}
        </article>

        <!-- Delete Confirmation Modal -->
        ${this.showDeleteModal ? this.renderDeleteModal() : ''}
      </div>
    `;
  }

  /**
   * Renders the delete confirmation modal
   */
  renderDeleteModal() {
    return `
      <div
        class="modal-backdrop"
        style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-4);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div
          class="modal-dialog"
          style="background: var(--color-bg-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); padding: var(--space-6); max-width: 440px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.4);"
        >
          <h3 id="delete-dialog-title" style="font-family: var(--font-display); font-size: var(--text-h3); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            पांडुलिपि स्थायी रूप से हटाएँ?
          </h3>
          <p style="font-family: var(--font-interface); font-size: var(--text-body-small); color: var(--color-text-secondary); margin: 0 0 var(--space-6) 0; line-height: var(--leading-normal);">
            क्या आप <strong>"${this.escapeHtml(this.manuscript.title)}"</strong> पांडुलिपि को स्थायी रूप से हटाना चाहते हैं? यह मूल छवि आपके डिजिटल संदूक से मिटा दी जाएगी।
          </p>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-3);">
            <button
              type="button"
              class="btn-preserve-cancel"
              data-action="cancel-delete"
              style="min-height: 44px;"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-preserve-primary"
              data-action="confirm-delete"
              style="background: var(--color-accent-terracotta); color: #fff; min-height: 44px;"
            >
              हाँ, हटाएँ
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
