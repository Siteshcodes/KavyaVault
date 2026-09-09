/**
 * काव्यकलश (KavyaVault) — Manuscript Gallery Component (ManuscriptGallery.js)
 *
 * Phase 2 / Task 2.4: Manuscript Gallery & Reader
 *
 * Dedicated archival gallery view for browsing, filtering, and previewing
 * preserved handwritten manuscripts.
 *
 * Archival Principles:
 * - Direct UI → ManuscriptRepository → StorageAdapter integration.
 * - Thumbnails prefer derivedManuscript.data when present, falling back to originalManuscript.data.
 * - Responsive archival cards with calm paper/ink aesthetics.
 * - Deterministic filtering by title, provenance source, and transcription status.
 * - Resilient against malformed or missing data.
 */

import { renderPageHeader } from '../layout/PageHeader.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { formatPoeticDate } from '../../utils/date.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';
import { escapeHtml, normalizeSearchText } from '../../services/SearchService.js';

export class ManuscriptGallery {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   * @param {Object} [options.repository=manuscriptRepository] Manuscript repository instance
   */
  constructor({ container, router, repository = manuscriptRepository }) {
    this.container = container;
    this.router = router;
    this.repository = repository;

    // Filter state
    this.searchQuery = '';
    this.statusFilter = 'all'; // 'all' | 'untranscribed' | 'draft' | 'verified'
    this.sourceFilter = 'all'; // 'all' | 'handwritten_manuscript' | 'scanned_document' | 'photo_capture'

    // Bound listeners
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundInputHandler = this.handleInput.bind(this);
    this.boundChangeHandler = this.handleChange.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
  }

  /**
   * Mounts the gallery into DOM and binds event handlers
   */
  mount() {
    this.update();
    if (this.container) {
      this.container.addEventListener('click', this.boundClickHandler);
      this.container.addEventListener('input', this.boundInputHandler);
      this.container.addEventListener('change', this.boundChangeHandler);
      this.container.addEventListener('keydown', this.boundKeydownHandler);
    }
  }

  /**
   * Unmounts the gallery and detaches event handlers
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
      this.container.removeEventListener('input', this.boundInputHandler);
      this.container.removeEventListener('change', this.boundChangeHandler);
      this.container.removeEventListener('keydown', this.boundKeydownHandler);
    }
  }

  /**
   * Updates component inner HTML
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Safely retrieves all manuscripts from the repository
   * @returns {Array}
   */
  getManuscripts() {
    try {
      const records = this.repository.getAll();
      if (!Array.isArray(records)) return [];
      return records.filter(m => m && typeof m === 'object' && typeof m.id === 'string');
    } catch (err) {
      console.error('[ManuscriptGallery] Error loading manuscripts:', err);
      return [];
    }
  }

  /**
   * Formats source identifier into literary Hindi
   * @param {string} source
   * @returns {string}
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
   * Formats transcription status into literary Hindi
   * @param {string} status
   * @returns {string}
   */
  formatStatus(status) {
    switch (status) {
      case 'verified': return 'प्रमाणित';
      case 'draft': return 'प्रारूप';
      case 'untranscribed':
      default:
        return 'अप्रतिलिपिबद्ध';
    }
  }

  /**
   * Resolves thumbnail image source for a manuscript card:
   * Prioritizes derivedManuscript.data, falls back to originalManuscript.data.
   * @param {Object} ms
   * @returns {string|null}
   */
  getThumbnailSrc(ms) {
    if (!ms || typeof ms !== 'object') return null;

    // 1. Prefer derived image if available
    if (ms.derivedManuscript && typeof ms.derivedManuscript.data === 'string' && ms.derivedManuscript.data) {
      const d = ms.derivedManuscript.data;
      if (d.startsWith('data:')) return d;
      return `data:${ms.derivedManuscript.mimeType || 'image/png'};base64,${d}`;
    }

    // 2. Fall back to original image
    if (ms.originalManuscript && typeof ms.originalManuscript.data === 'string' && ms.originalManuscript.data) {
      const orig = ms.originalManuscript;
      const d = orig.data;
      if (d.startsWith('data:')) return d;
      return `data:${orig.mimeType || 'image/jpeg'};base64,${d}`;
    }

    return null;
  }

  /**
   * Applies deterministic search and filters to manuscript records
   * @param {Array} manuscripts
   * @returns {Array}
   */
  filterManuscripts(manuscripts) {
    if (!Array.isArray(manuscripts)) return [];

    let filtered = [...manuscripts];

    // 1. Text filter (Title, notes, source)
    const query = normalizeSearchText(this.searchQuery);
    if (query) {
      filtered = filtered.filter(ms => {
        const titleNorm = normalizeSearchText(ms.title || '');
        const notesNorm = normalizeSearchText(ms.provenance?.notes || '');
        const filenameNorm = normalizeSearchText(ms.originalManuscript?.filename || '');
        return titleNorm.includes(query) || notesNorm.includes(query) || filenameNorm.includes(query);
      });
    }

    // 2. Transcription status filter
    if (this.statusFilter && this.statusFilter !== 'all') {
      filtered = filtered.filter(ms => {
        const status = ms.transcription?.status || 'untranscribed';
        return status === this.statusFilter;
      });
    }

    // 3. Provenance source filter
    if (this.sourceFilter && this.sourceFilter !== 'all') {
      filtered = filtered.filter(ms => {
        const src = ms.provenance?.source || 'handwritten_manuscript';
        return src === this.sourceFilter;
      });
    }

    return filtered;
  }

  /**
   * Handles click events
   */
  handleClick(e) {
    const target = e.target;

    // Reset filters action
    const resetBtn = target.closest('[data-action="reset-filters"]');
    if (resetBtn) {
      e.preventDefault();
      this.searchQuery = '';
      this.statusFilter = 'all';
      this.sourceFilter = 'all';
      this.update();
      return;
    }
  }

  /**
   * Handles real-time search input
   */
  handleInput(e) {
    if (e.target.id === 'gallery-search-input') {
      this.searchQuery = e.target.value;
      // Re-render gallery grid and count without losing input focus
      this.updateGridOnly();
    }
  }

  /**
   * Handles filter select changes
   */
  handleChange(e) {
    if (e.target.id === 'gallery-status-select') {
      this.statusFilter = e.target.value;
      this.update();
    } else if (e.target.id === 'gallery-source-select') {
      this.sourceFilter = e.target.value;
      this.update();
    }
  }

  /**
   * Handles keyboard shortcuts
   */
  handleKeydown(e) {
    if (e.key === 'Escape' && this.searchQuery) {
      this.searchQuery = '';
      this.update();
    }
  }

  /**
   * Granularly updates the grid and filter count to avoid losing text input focus
   */
  updateGridOnly() {
    const gridContainer = this.container?.querySelector('#gallery-cards-container');
    const countBadge = this.container?.querySelector('#gallery-count-badge');
    if (!gridContainer) {
      this.update();
      return;
    }

    const allManuscripts = this.getManuscripts();
    const filtered = this.filterManuscripts(allManuscripts);

    if (countBadge) {
      countBadge.textContent = `${filtered.length} पांडुलिपि${filtered.length === 1 ? '' : 'याँ'}`;
    }

    gridContainer.innerHTML = this.renderCardsContent(filtered, allManuscripts.length);
  }

  /**
   * Renders the cards grid or matching empty state
   */
  renderCardsContent(filtered, totalCount) {
    if (filtered.length === 0) {
      if (totalCount === 0) {
        return renderEmptyState({
          icon: 'archive',
          heading: 'वीथिका में अभी कोई पांडुलिपि नहीं है',
          text: 'अपने पूर्वजों, प्रियजनों या स्वयं की पुरानी हस्तलिखित रचनाओं को यहाँ सुरक्षित सहेजें। मूल पांडुलिपि सदैव अक्षुण्ण रहेगी।',
          primaryAction: `
            <a
              href="${ROUTES.MANUSCRIPT_NEW}"
              data-link
              class="btn-primary-action"
              aria-label="पांडुलिपि सहेजें"
            >
              ${getIconSvg('upload', 'nav-icon')}
              <span>पांडुलिपि सहेजें</span>
            </a>
          `
        });
      }

      return renderEmptyState({
        icon: 'search',
        heading: 'कोई पांडुलिपि नहीं मिली',
        text: 'आपके खोज मापदंड से मेल खाती कोई पांडुलिपि उपलब्ध नहीं है।',
        primaryAction: `
          <button
            type="button"
            class="btn-secondary-action"
            data-action="reset-filters"
            aria-label="फ़िल्टर रीसेट करें"
          >
            ${getIconSvg('restore', 'nav-icon')}
            <span>फ़िल्टर रीसेट करें</span>
          </button>
        `
      });
    }

    return `
      <div class="manuscript-gallery-grid" role="list">
        ${filtered.map(ms => this.renderCard(ms)).join('')}
      </div>
    `;
  }

  /**
   * Renders a single manuscript archival card
   * @param {Object} ms
   * @returns {string}
   */
  renderCard(ms) {
    const id = ms.id || '';
    const title = ms.title || 'अनाम पांडुलिपि';
    const orig = ms.originalManuscript || {};
    const derived = ms.derivedManuscript || null;
    const trans = ms.transcription || {};
    const prov = ms.provenance || {};

    const hasDerived = Boolean(derived);
    const thumbSrc = this.getThumbnailSrc(ms);

    const dateStr = orig.capturedAt
      ? formatPoeticDate(orig.capturedAt)
      : (ms.createdAt ? formatPoeticDate(ms.createdAt) : 'सहेजा गया');

    const sourceLabel = this.formatSource(prov.source);
    const statusLabel = this.formatStatus(trans.status);
    const statusClass = trans.status === 'verified'
      ? 'status-verified'
      : (trans.status === 'draft' ? 'status-draft' : 'status-untranscribed');

    return `
      <article class="manuscript-card" data-id="${escapeHtml(id)}" role="listitem">
        <a
          href="/manuscripts/${encodeURIComponent(id)}"
          data-link
          class="manuscript-card-link"
          aria-label="पांडुलिपि खोलें: ${escapeHtml(title)}"
        >
          <!-- Thumbnail Showcase Frame -->
          <div class="manuscript-card-thumb-wrap">
            ${thumbSrc ? `
              <img
                src="${thumbSrc}"
                alt="पांडुलिपि: ${escapeHtml(title)}"
                class="manuscript-card-thumb"
                loading="lazy"
              />
            ` : `
              <div class="manuscript-card-thumb-fallback" aria-hidden="true">
                ${getIconSvg('image', 'thumb-fallback-icon')}
                <span>चित्र अनुपलब्ध</span>
              </div>
            `}

            <!-- Badges Overlay -->
            <div class="manuscript-card-badges">
              ${hasDerived ? `
                <span class="manuscript-badge-pill badge-pill-derived" title="संपादित प्रति उपलब्ध">
                  ${getIconSvg('check', 'pill-icon')}
                  <span>संपादित प्रति</span>
                </span>
              ` : `
                <span class="manuscript-badge-pill badge-pill-original" title="केवल मूल प्रति सुरक्षित">
                  <span>मूल प्रति</span>
                </span>
              `}
            </div>
          </div>

          <!-- Card Content Body -->
          <div class="manuscript-card-body">
            <div class="manuscript-card-header">
              <h3 class="manuscript-card-title" title="${escapeHtml(title)}">
                ${escapeHtml(title)}
              </h3>
              <span class="manuscript-status-badge ${statusClass}">
                ${escapeHtml(statusLabel)}
              </span>
            </div>

            <!-- Archival Metadata Summary -->
            <div class="manuscript-card-meta">
              <span class="card-meta-date" title="सहेजने की तिथि">
                ${escapeHtml(dateStr)}
              </span>
              <span class="card-meta-dot" aria-hidden="true">•</span>
              <span class="card-meta-source" title="उद्गम स्रोत">
                ${escapeHtml(sourceLabel)}
              </span>
            </div>

            ${orig.filename ? `
              <div class="manuscript-card-filename" title="मूल फ़ाइल: ${escapeHtml(orig.filename)}">
                ${escapeHtml(orig.filename)}
              </div>
            ` : ''}

            ${prov.notes ? `
              <p class="manuscript-card-notes" title="${escapeHtml(prov.notes)}">
                ${escapeHtml(prov.notes)}
              </p>
            ` : ''}
          </div>
        </a>
      </article>
    `;
  }

  /**
   * Renders the complete gallery HTML
   * @returns {string}
   */
  render() {
    const allManuscripts = this.getManuscripts();
    const filtered = this.filterManuscripts(allManuscripts);
    const hasActiveFilters = Boolean(
      this.searchQuery ||
      (this.statusFilter && this.statusFilter !== 'all') ||
      (this.sourceFilter && this.sourceFilter !== 'all')
    );

    const headerHtml = renderPageHeader({
      title: 'पांडुलिपि वीथिका',
      subtitle: 'हस्तलिखित धरोहर एवं मूल अभिलेख',
      description: 'पुरानी डायरियों, ऐतिहासिक पन्नों एवं हस्तलिखित पांडुलिपियों का डिजिटल संग्रहालय।',
      action: `
        <a
          href="${ROUTES.MANUSCRIPT_NEW}"
          data-link
          class="btn-primary-action"
          aria-label="नई पांडुलिपि सहेजें"
        >
          ${getIconSvg('upload', 'nav-icon')}
          <span>नई पांडुलिपि</span>
        </a>
      `
    });

    return `
      <div class="manuscript-gallery-view standard-page-view" role="region" aria-label="पांडुलिपि वीथिका">
        ${headerHtml}

        <!-- Gallery Controls & Deterministic Filters -->
        <div class="manuscript-filter-bar" role="search" aria-label="पांडुलिपि फ़िल्टर">
          <div class="filter-search-wrap">
            <div class="filter-search-icon" aria-hidden="true">
              ${getIconSvg('search', 'nav-icon')}
            </div>
            <input
              type="search"
              id="gallery-search-input"
              class="gallery-search-input"
              placeholder="शीर्षक, फ़ाइल या टिप्पणी खोजें..."
              value="${escapeHtml(this.searchQuery)}"
              aria-label="पांडुलिपि खोजें"
              autocomplete="off"
            />
          </div>

          <div class="filter-selects-wrap">
            <!-- Status Filter -->
            <div class="filter-select-group">
              <label for="gallery-status-select" class="filter-label">प्रतिलिपि:</label>
              <select id="gallery-status-select" class="filter-select" aria-label="प्रतिलिपि स्थिति अनुसार छाँटें">
                <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>सभी स्थितियाँ</option>
                <option value="untranscribed" ${this.statusFilter === 'untranscribed' ? 'selected' : ''}>अप्रतिलिपिबद्ध</option>
                <option value="draft" ${this.statusFilter === 'draft' ? 'selected' : ''}>प्रारूप</option>
                <option value="verified" ${this.statusFilter === 'verified' ? 'selected' : ''}>प्रमाणित</option>
              </select>
            </div>

            <!-- Source Filter -->
            <div class="filter-select-group">
              <label for="gallery-source-select" class="filter-label">स्रोत:</label>
              <select id="gallery-source-select" class="filter-select" aria-label="उद्गम स्रोत अनुसार छाँटें">
                <option value="all" ${this.sourceFilter === 'all' ? 'selected' : ''}>सभी स्रोत</option>
                <option value="handwritten_manuscript" ${this.sourceFilter === 'handwritten_manuscript' ? 'selected' : ''}>हस्तलिखित पांडुलिपि</option>
                <option value="scanned_document" ${this.sourceFilter === 'scanned_document' ? 'selected' : ''}>स्कैन किया दस्तावेज़</option>
                <option value="photo_capture" ${this.sourceFilter === 'photo_capture' ? 'selected' : ''}>कैमरा तस्वीर</option>
              </select>
            </div>

            ${hasActiveFilters ? `
              <button
                type="button"
                class="btn-reset-filters"
                data-action="reset-filters"
                aria-label="फ़िल्टर रीसेट करें"
                title="सभी फ़िल्टर हटाएँ"
              >
                ${getIconSvg('close', 'icon-inline')}
                <span>रीसेट</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Filter Count Header -->
        ${allManuscripts.length > 0 ? `
          <div class="manuscript-gallery-subhead">
            <span id="gallery-count-badge" class="gallery-count-badge">
              ${filtered.length} पांडुलिपि${filtered.length === 1 ? '' : 'याँ'}
            </span>
          </div>
        ` : ''}

        <!-- Cards Container -->
        <div id="gallery-cards-container">
          ${this.renderCardsContent(filtered, allManuscripts.length)}
        </div>
      </div>
    `;
  }
}
