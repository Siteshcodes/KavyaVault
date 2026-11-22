/**
 * काव्यकलश (KavyaVault) — Book Print Preview Component (BookPrintPreview.js)
 * Phase 7 / Task 7.3: Book Layout Engine & Print Preview
 *
 * Immersive, print-oriented book preview and page inspection:
 * - Centered authentic book canvas with real page dimensions (A5, A4, Letter)
 * - Page navigation: previous, next, first, last, jump to page
 * - Zoom controls: zoom in, zoom out, reset to 100%
 * - Live LayoutConfig drawer: dynamically change page size, margins, fonts, line height, stanzas, and toggles
 * - Live deterministic re-pagination with automatic TOC page number updates
 * - Full keyboard navigation (ArrowLeft, ArrowRight, PageUp, PageDown, Home, End, Escape)
 * - Safe input handling: keyboard shortcuts never intercept typing in form inputs
 * - Fully accessible dialog region with ARIA attributes and screen reader announcements
 * - Fully responsive: scales smoothly on mobile (390px) with single-page layout and 48px touch targets
 * - 100% read-only: never mutates underlying book projects or poems
 */

import { bookLayoutService } from '../../services/books/BookLayoutService.js';
import {
  PAGE_SIZE,
  PAGE_ORIENTATION,
  TEXT_ALIGNMENT,
  BODY_FONT,
  PAGE_NUMBER_POSITION,
  PAGE_TYPE,
  toDevanagariNumerals,
  PAGE_DIMENSIONS
} from '../../services/books/bookLayoutTypes.js';
import { escapeHtml } from '../../services/SearchService.js';
import { getIconSvg } from '../navigation/icons.js';
import { bookExportService } from '../../services/books/export/index.js';

export class BookPrintPreview {
  /**
   * @param {Object} options
   * @param {Object} options.book - Book project entity
   * @param {import('../../services/books/BookProjectService.js').BookProjectService} [options.bookService]
   * @param {Object} [options.initialConfig={}] - Initial LayoutConfig overrides
   * @param {Function} [options.onClose] - Callback when closing preview
   */
  constructor({
    book,
    bookService,
    initialConfig = {},
    onClose = () => {}
  }) {
    this.book = book;
    this.bookService = bookService;
    this.onClose = onClose;

    this.layoutConfig = bookLayoutService.createDefaultLayoutConfig(initialConfig);
    this.layoutDoc = null;
    this.currentPageIndex = 0;
    this.zoomLevel = 1.0;
    this.showSettings = false;
    this.exportStatus = null; // null | 'generating-pdf' | 'generating-epub' | 'success' | 'error'
    this.exportMessage = '';

    // Zoom scale factors
    this.zoomLevels = [0.7, 0.85, 1.0, 1.25, 1.5];

    this.boundKeydown = this.handleKeydown.bind(this);

    // Initial layout generation
    this.refreshLayout();
  }

  /**
   * Generates or refreshes the ephemeral layout document
   */
  refreshLayout() {
    try {
      if (this.bookService && typeof this.bookService.generateBookLayout === 'function') {
        this.layoutDoc = this.bookService.generateBookLayout(this.book.id, this.layoutConfig);
      } else {
        this.layoutDoc = bookLayoutService.generateLayout(this.book.id, this.layoutConfig);
      }
    } catch {
      // Fallback: generate from basic book structure if service lookup fails
      this.layoutDoc = bookLayoutService.generateLayoutFromDocument({
        id: this.book.id,
        metadata: {
          title: this.book.title,
          subtitle: this.book.subtitle,
          author: this.book.author,
          dedication: this.book.dedication,
          description: this.book.description,
          cover: this.book.cover
        },
        sections: this.book.sections || []
      }, this.layoutConfig);
    }

    // Clamp current page index
    const total = this.getTotalPages();
    if (this.currentPageIndex >= total) {
      this.currentPageIndex = Math.max(0, total - 1);
    }
  }

  /**
   * Total pages count
   * @returns {number}
   */
  getTotalPages() {
    return (this.layoutDoc && Array.isArray(this.layoutDoc.pages))
      ? this.layoutDoc.pages.length
      : 0;
  }

  /**
   * Current active page object
   * @returns {Object|null}
   */
  getCurrentPage() {
    const total = this.getTotalPages();
    if (total === 0 || this.currentPageIndex < 0 || this.currentPageIndex >= total) {
      return null;
    }
    return this.layoutDoc.pages[this.currentPageIndex];
  }

  // ==========================================================================
  // NAVIGATION CONTROLS
  // ==========================================================================

  nextPage() {
    if (this.currentPageIndex < this.getTotalPages() - 1) {
      this.currentPageIndex++;
      return true;
    }
    return false;
  }

  prevPage() {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      return true;
    }
    return false;
  }

  firstPage() {
    if (this.currentPageIndex !== 0) {
      this.currentPageIndex = 0;
      return true;
    }
    return false;
  }

  lastPage() {
    const last = Math.max(0, this.getTotalPages() - 1);
    if (this.currentPageIndex !== last) {
      this.currentPageIndex = last;
      return true;
    }
    return false;
  }

  goToPage(pageNum) {
    const target = Number(pageNum) - 1;
    if (!isNaN(target) && target >= 0 && target < this.getTotalPages()) {
      this.currentPageIndex = target;
      return true;
    }
    return false;
  }

  // ==========================================================================
  // ZOOM CONTROLS
  // ==========================================================================

  zoomIn() {
    const currentIdx = this.zoomLevels.indexOf(this.zoomLevel);
    if (currentIdx !== -1 && currentIdx < this.zoomLevels.length - 1) {
      this.zoomLevel = this.zoomLevels[currentIdx + 1];
      return true;
    } else if (this.zoomLevel < 1.5) {
      this.zoomLevel = Math.min(1.5, Math.round((this.zoomLevel + 0.15) * 100) / 100);
      return true;
    }
    return false;
  }

  zoomOut() {
    const currentIdx = this.zoomLevels.indexOf(this.zoomLevel);
    if (currentIdx > 0) {
      this.zoomLevel = this.zoomLevels[currentIdx - 1];
      return true;
    } else if (this.zoomLevel > 0.7) {
      this.zoomLevel = Math.max(0.7, Math.round((this.zoomLevel - 0.15) * 100) / 100);
      return true;
    }
    return false;
  }

  resetZoom() {
    if (this.zoomLevel !== 1.0) {
      this.zoomLevel = 1.0;
      return true;
    }
    return false;
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
    return this.showSettings;
  }

  // ==========================================================================
  // CONFIGURATION UPDATES
  // ==========================================================================

  updateConfig(updates = {}) {
    this.layoutConfig = bookLayoutService.createDefaultLayoutConfig({
      ...this.layoutConfig,
      ...updates
    });
    this.refreshLayout();
  }

  // ==========================================================================
  // EXPORT HANDLERS
  // ==========================================================================

  exportPdf() {
    this.exportStatus = 'generating-pdf';
    this.exportMessage = 'PDF तैयार किया जा रहा है...';
    try {
      const res = (this.bookService && typeof this.bookService.exportToPdf === 'function')
        ? this.bookService.exportToPdf(this.book.id, this.layoutConfig)
        : bookExportService.exportToPdf(this.book.id, this.layoutConfig);
      bookExportService.downloadFile(res.filename, res.data, res.mimeType);
      this.exportStatus = 'success';
      this.exportMessage = `PDF "${res.filename}" सफलतापूर्वक डाउनलोड हुआ!`;
      return res;
    } catch (err) {
      this.exportStatus = 'error';
      this.exportMessage = `PDF निर्यात में त्रुटि: ${err.message || 'अज्ञात त्रुटि'}`;
      throw err;
    }
  }

  exportEpub() {
    this.exportStatus = 'generating-epub';
    this.exportMessage = 'EPUB 3 ई-पुस्तक तैयार की जा रही है...';
    try {
      const res = (this.bookService && typeof this.bookService.exportToEpub === 'function')
        ? this.bookService.exportToEpub(this.book.id, this.layoutConfig)
        : bookExportService.exportToEpub(this.book.id, this.layoutConfig);
      bookExportService.downloadFile(res.filename, res.data, res.mimeType);
      this.exportStatus = 'success';
      this.exportMessage = `EPUB "${res.filename}" सफलतापूर्वक डाउनलोड हुआ!`;
      return res;
    } catch (err) {
      this.exportStatus = 'error';
      this.exportMessage = `EPUB निर्यात में त्रुटि: ${err.message || 'अज्ञात त्रुटि'}`;
      throw err;
    }
  }

  nativePrint() {
    return bookExportService.printBook(this.book.id, this.layoutConfig);
  }

  // ==========================================================================
  // KEYBOARD NAVIGATION
  // ==========================================================================

  /**
   * Safe keyboard handler: navigation shortcuts are ignored when focused on inputs
   * @param {KeyboardEvent} e
   * @returns {boolean} Whether an action was executed
   */
  handleKeydown(e) {
    if (!e) return false;

    // Check if target is an interactive form element
    const targetTag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
    if (targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'TEXTAREA') {
      // In text input, allow Escape to blur or close
      if (e.key === 'Escape') {
        if (typeof e.target.blur === 'function') e.target.blur();
        return true;
      }
      return false;
    }

    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      return this.nextPage();
    }

    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      return this.prevPage();
    }

    if (e.key === 'Home') {
      e.preventDefault();
      return this.firstPage();
    }

    if (e.key === 'End') {
      e.preventDefault();
      return this.lastPage();
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.showSettings) {
        this.showSettings = false;
        return true;
      }
      this.onClose();
      return true;
    }

    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      return this.zoomIn();
    }

    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      return this.zoomOut();
    }

    if (e.key === '0') {
      e.preventDefault();
      return this.resetZoom();
    }

    return false;
  }

  // ==========================================================================
  // HTML RENDERING
  // ==========================================================================

  /**
   * Renders the complete print preview modal dialog
   * @returns {string} Safe HTML string
   */
  render() {
    const totalPages = this.getTotalPages();
    const currentPage = this.getCurrentPage();
    const currNum = this.currentPageIndex + 1;
    const devanagariCurr = toDevanagariNumerals(currNum);
    const devanagariTotal = toDevanagariNumerals(totalPages);

    const dims = PAGE_DIMENSIONS[this.layoutConfig.pageSize] || PAGE_DIMENSIONS[PAGE_SIZE.A5];
    const isLandscape = this.layoutConfig.orientation === PAGE_ORIENTATION.LANDSCAPE;
    const aspectWidth = isLandscape ? dims.heightMm : dims.widthMm;
    const aspectHeight = isLandscape ? dims.widthMm : dims.heightMm;
    const aspectRatio = aspectWidth / aspectHeight;

    return `
      <div
        class="modal-backdrop print-preview-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-prev-title"
        id="print-preview-modal-dialog"
      >
        <div class="print-preview-viewport" role="region" aria-label="पुस्तक मुद्रण पूर्वावलोकन कार्यशाला">
          <!-- Top Bar -->
          <header class="print-prev-header">
            <div class="print-prev-header-left">
              <span class="print-prev-book-badge">
                ${getIconSvg('book', 'nav-icon')}
                <span>मुद्रण पूर्वावलोकन</span>
              </span>
              <h2 id="print-prev-title" class="print-prev-book-title">${escapeHtml(this.book.title)}</h2>
              ${this.book.author ? `<span class="print-prev-book-author">(${escapeHtml(this.book.author)})</span>` : ''}
            </div>

            <!-- Page Counter Live Indicator -->
            <div class="print-prev-page-badge" aria-live="polite" aria-atomic="true">
              <span>पृष्ठ</span>
              <strong id="print-prev-page-indicator">${devanagariCurr} / ${devanagariTotal}</strong>
              <span style="opacity: 0.6; font-size: 0.8em;">(${currNum}/${totalPages})</span>
            </div>

            <div class="print-prev-header-right">
              <!-- Export Action Cluster -->
              <div class="print-export-cluster">
                <button
                  type="button"
                  class="btn-primary-action print-export-btn"
                  data-action="export-pdf"
                  id="btn-export-pdf"
                  aria-label="PDF प्रारूप में पुस्तक निर्यात करें"
                  title="PDF निर्यात"
                >
                  ${getIconSvg('download', 'nav-icon')}
                  <span>PDF निर्यात</span>
                </button>

                <button
                  type="button"
                  class="btn-secondary-action print-export-btn"
                  data-action="export-epub"
                  id="btn-export-epub"
                  aria-label="EPUB 3 प्रारूप में ई-पुस्तक निर्यात करें"
                  title="EPUB 3 निर्यात"
                >
                  ${getIconSvg('download', 'nav-icon')}
                  <span>EPUB निर्यात</span>
                </button>

                <button
                  type="button"
                  class="btn-secondary-action print-print-btn"
                  data-action="native-print"
                  id="btn-native-print"
                  aria-label="वर्तमान पूर्वावलोकन पृष्ठ मुद्रित करें"
                  title="वर्तमान पृष्ठ मुद्रण (Print)"
                >
                  ${getIconSvg('quill', 'nav-icon')}
                  <span>यह पृष्ठ</span>
                </button>
              </div>

              <button
                type="button"
                class="btn-secondary-action ${this.showSettings ? 'is-active' : ''}"
                data-action="toggle-preview-settings"
                id="btn-toggle-layout-settings"
                aria-label="मुद्रण व लेआउट विन्यास खोलें"
                title="लेआउट विन्यास"
              >
                ${getIconSvg('settings', 'nav-icon')}
                <span>विन्यास</span>
              </button>

              <button
                type="button"
                class="btn-icon-control"
                data-action="close-print-preview"
                id="btn-close-print-preview"
                aria-label="मुद्रण पूर्वावलोकन बंद करें"
                title="बंद करें (Esc)"
              >
                ${getIconSvg('close', 'nav-icon')}
              </button>
            </div>
          </header>

          <!-- Main Layout Area: Stage & Settings Drawer -->
          <div class="print-prev-body ${this.showSettings ? 'has-drawer-open' : ''}">
            <!-- Center Canvas Stage -->
            <main class="print-prev-stage" id="print-prev-stage" tabindex="0" aria-label="पुस्तक पृष्ठ कैनवास">
              <div
                class="print-prev-canvas-wrapper"
                style="transform: scale(${this.zoomLevel}); transform-origin: top center;"
              >
                <div
                  class="print-page-sheet type-${currentPage ? currentPage.type : 'blank'} font-${this.layoutConfig.bodyFont}"
                  id="print-active-page-sheet"
                  style="
                    aspect-ratio: ${aspectRatio};
                    padding: ${this.layoutConfig.margins.top}mm ${this.layoutConfig.margins.right}mm ${this.layoutConfig.margins.bottom}mm ${this.layoutConfig.margins.left}mm;
                    text-align: ${this.layoutConfig.alignment};
                    line-height: ${this.layoutConfig.lineHeight};
                  "
                  data-page-index="${this.currentPageIndex}"
                  data-page-type="${currentPage ? currentPage.type : 'none'}"
                >
                  ${this.renderPageContent(currentPage)}
                </div>
              </div>
            </main>

            <!-- Settings Drawer (Right Side) -->
            ${this.renderSettingsDrawer()}
          </div>

          <!-- Bottom Control Toolbar -->
          <footer class="print-prev-footer" role="toolbar" aria-label="पृष्ठ संचालन और ज़ूम नियंत्रण">
            <!-- Navigation buttons -->
            <div class="print-nav-cluster">
              <button
                type="button"
                class="btn-icon-control"
                data-action="first-page"
                id="btn-first-page"
                ${this.currentPageIndex === 0 ? 'disabled' : ''}
                aria-label="प्रथम पृष्ठ पर जाएँ"
                title="प्रथम पृष्ठ (Home)"
              >
                ${getIconSvg('arrow-left', 'nav-icon')}
                <span class="sr-only">प्रथम पृष्ठ</span>
              </button>

              <button
                type="button"
                class="btn-icon-control is-primary-touch"
                data-action="prev-page"
                id="btn-prev-page"
                ${this.currentPageIndex === 0 ? 'disabled' : ''}
                aria-label="पिछला पृष्ठ देखें"
                title="पिछला पृष्ठ (←)"
              >
                ${getIconSvg('arrow-left', 'nav-icon')}
                <span>पिछला</span>
              </button>

              <!-- Jump to page input -->
              <div class="print-page-jump-box">
                <label for="jump-page-input" class="sr-only">पृष्ठ संख्या पर जाएँ</label>
                <input
                  type="number"
                  min="1"
                  max="${totalPages}"
                  value="${currNum}"
                  class="print-jump-input"
                  id="jump-page-input"
                  data-action="jump-page-change"
                  aria-label="पृष्ठ संख्या दर्ज करें"
                />
                <span class="print-jump-sep">/ ${devanagariTotal}</span>
              </div>

              <button
                type="button"
                class="btn-icon-control is-primary-touch"
                data-action="next-page"
                id="btn-next-page"
                ${this.currentPageIndex >= totalPages - 1 ? 'disabled' : ''}
                aria-label="अगला पृष्ठ देखें"
                title="अगला पृष्ठ (→)"
              >
                <span>अगला</span>
                ${getIconSvg('arrow-up', 'nav-icon')}
              </button>

              <button
                type="button"
                class="btn-icon-control"
                data-action="last-page"
                id="btn-last-page"
                ${this.currentPageIndex >= totalPages - 1 ? 'disabled' : ''}
                aria-label="अंतिम पृष्ठ पर जाएँ"
                title="अंतिम पृष्ठ (End)"
              >
                ${getIconSvg('arrow-up', 'nav-icon')}
                <span class="sr-only">अंतिम पृष्ठ</span>
              </button>
            </div>

            <!-- Zoom Cluster -->
            <div class="print-zoom-cluster">
              <button
                type="button"
                class="btn-icon-control"
                data-action="zoom-out"
                id="btn-zoom-out"
                ${this.zoomLevel <= 0.7 ? 'disabled' : ''}
                aria-label="ज़ूम कम करें"
                title="ज़ूम कम करें (-)"
              >
                −
              </button>

              <button
                type="button"
                class="btn-secondary-action print-zoom-indicator-btn"
                data-action="zoom-reset"
                id="btn-zoom-reset"
                aria-label="ज़ूम १००% पर पुनर्स्थापित करें"
                title="मूल आकार (0)"
              >
                ${Math.round(this.zoomLevel * 100)}%
              </button>

              <button
                type="button"
                class="btn-icon-control"
                data-action="zoom-in"
                id="btn-zoom-in"
                ${this.zoomLevel >= 1.5 ? 'disabled' : ''}
                aria-label="ज़ूम बढ़ाएँ"
                title="ज़ूम बढ़ाएँ (+)"
              >
                +
              </button>
            </div>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Renders the internal content of the current page based on its type
   * @param {Object|null} page
   * @returns {string} Safe HTML
   */
  renderPageContent(page) {
    if (!page) {
      return `
        <div class="page-empty-placeholder">
          <p>कोई पृष्ठ उपलब्ध नहीं है।</p>
        </div>
      `;
    }

    const runningHeader = (page.type === PAGE_TYPE.POEM || page.type === PAGE_TYPE.SECTION || page.type === PAGE_TYPE.TOC) ? `
      <div class="page-running-header" aria-hidden="true">
        <span class="header-left">${escapeHtml(page.header?.left || this.book.title || '')}</span>
        <span class="header-right">${escapeHtml(page.header?.right || '')}</span>
      </div>
    ` : '';

    const runningFooter = page.pageNumber !== null ? `
      <div class="page-running-footer" aria-hidden="true">
        <span class="footer-center">${escapeHtml(page.footer?.center || page.displayPageNumber)}</span>
      </div>
    ` : '';

    let bodyHtml = '';

    switch (page.type) {
      case PAGE_TYPE.COVER: {
        const coverBg = this.book.cover?.background || 'bhojpatra';
        const coverClass = `cover-bg-${coverBg}`;
        bodyHtml = `
          <div class="page-cover-container ${coverClass}">
            <div class="page-cover-ornament-top">❦</div>
            <h1 class="page-cover-title">${escapeHtml(this.book.title)}</h1>
            ${this.book.subtitle ? `<h2 class="page-cover-subtitle">${escapeHtml(this.book.subtitle)}</h2>` : ''}
            <div class="page-cover-rule"></div>
            <div class="page-cover-author">${escapeHtml(this.book.author || 'अज्ञात')}</div>
            <div class="page-cover-bottom">
              <span class="page-cover-imprint">काव्यकलश साहित्यिक धरोहर</span>
            </div>
          </div>
        `;
        break;
      }

      case PAGE_TYPE.TITLE: {
        bodyHtml = `
          <div class="page-title-container">
            <div class="page-title-inner">
              <span class="page-title-top-ornament">❖</span>
              <h1 class="page-title-heading">${escapeHtml(this.book.title)}</h1>
              ${this.book.subtitle ? `<h2 class="page-title-subheading">${escapeHtml(this.book.subtitle)}</h2>` : ''}
              <div class="page-title-divider"></div>
              <div class="page-title-author-line">
                <span class="page-title-by">रचनाकार</span>
                <span class="page-title-author-name">${escapeHtml(this.book.author || 'अज्ञात')}</span>
              </div>
              ${this.book.dedication ? `
                <div class="page-title-dedication-snippet">
                  <em>${escapeHtml(this.book.dedication)}</em>
                </div>
              ` : ''}
              <div class="page-title-footer-imprint">
                <p>काव्यकलश निजी साहित्यिक धरोहर</p>
                <p style="font-size: 0.85em; opacity: 0.7;">मुद्रण पूर्वावलोकन संस्करण</p>
              </div>
            </div>
          </div>
        `;
        break;
      }

      case PAGE_TYPE.DEDICATION: {
        const dedBlock = page.blocks.find(b => b.type === 'dedication-body');
        bodyHtml = `
          <div class="page-dedication-container">
            <div class="page-dedication-inner">
              <span class="page-dedication-ornament">❧</span>
              <h2 class="page-dedication-heading">समर्पण</h2>
              <blockquote class="page-dedication-quote">
                ${escapeHtml(dedBlock ? dedBlock.content : this.book.dedication || '')}
              </blockquote>
            </div>
          </div>
        `;
        break;
      }

      case PAGE_TYPE.TOC: {
        const entriesBlock = page.blocks.find(b => b.type === 'toc-entries');
        const entries = entriesBlock ? entriesBlock.content : [];
        const headingBlock = page.blocks.find(b => b.type === 'toc-heading');

        bodyHtml = `
          <div class="page-toc-container">
            <h2 class="page-toc-heading">${escapeHtml(headingBlock ? headingBlock.content : 'विषय-सूची')}</h2>
            <div class="page-toc-rule"></div>
            <div class="page-toc-list" role="list">
              ${entries.map(e => `
                <div class="page-toc-row is-${e.type}" role="listitem">
                  <span class="page-toc-title">${escapeHtml(e.title)}</span>
                  <span class="page-toc-dots" aria-hidden="true"></span>
                  <span class="page-toc-num">${escapeHtml(e.pageNumberFormatted)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        break;
      }

      case PAGE_TYPE.SECTION: {
        const secNumBlock = page.blocks.find(b => b.type === 'section-divider-number');
        const secTitleBlock = page.blocks.find(b => b.type === 'section-divider-title');
        const secDescBlock = page.blocks.find(b => b.type === 'section-divider-desc');
        const secCountBlock = page.blocks.find(b => b.type === 'section-divider-poem-count');

        bodyHtml = `
          <div class="page-section-container">
            <div class="page-section-inner">
              <span class="page-section-num-tag">${escapeHtml(secNumBlock ? secNumBlock.content : '')}</span>
              <h2 class="page-section-main-title">${escapeHtml(secTitleBlock ? secTitleBlock.content : page.sectionTitle || '')}</h2>
              <div class="page-section-rule"></div>
              ${secDescBlock && secDescBlock.content ? `
                <p class="page-section-desc">${escapeHtml(secDescBlock.content)}</p>
              ` : ''}
              ${secCountBlock && secCountBlock.content ? `
                <span class="page-section-poem-badge">${escapeHtml(secCountBlock.content)}</span>
              ` : ''}
            </div>
          </div>
        `;
        break;
      }

      case PAGE_TYPE.POEM: {
        const titleBlock = page.blocks.find(b => b.type === 'poem-title');
        const authorBlock = page.blocks.find(b => b.type === 'poem-author');
        const contBlock = page.blocks.find(b => b.type === 'poem-continuation-header');
        const stanzaBlocks = page.blocks.filter(b => b.type === 'stanza');

        bodyHtml = `
          <div class="page-poem-container">
            ${titleBlock ? `
              <header class="page-poem-header">
                <h2 class="page-poem-title" style="font-size: ${this.layoutConfig.titleFontSize}pt;">${escapeHtml(titleBlock.content)}</h2>
                ${authorBlock ? `<div class="page-poem-author">${escapeHtml(authorBlock.content)}</div>` : ''}
                <div class="page-poem-rule"></div>
              </header>
            ` : ''}

            ${contBlock ? `
              <div class="page-poem-continuation-note">
                <span>${escapeHtml(contBlock.content)}</span>
              </div>
            ` : ''}

            <div
              class="page-poem-stanzas"
              style="
                font-size: ${this.layoutConfig.bodyFontSize}pt;
                line-height: ${this.layoutConfig.lineHeight};
              "
            >
              ${stanzaBlocks.map(sb => {
                const lines = Array.isArray(sb.content) ? sb.content : [];
                return `
                  <div class="page-poem-stanza" style="margin-bottom: ${this.layoutConfig.stanzaSpacing}pt;">
                    ${lines.map(line => `<div class="page-poem-line">${escapeHtml(line)}</div>`).join('')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
        break;
      }

      default:
        bodyHtml = `<div class="page-empty-placeholder"></div>`;
    }

    return `
      ${runningHeader}
      <div class="page-body-flow">
        ${bodyHtml}
      </div>
      ${runningFooter}
    `;
  }

  /**
   * Renders the layout settings drawer
   * @returns {string} Safe HTML
   */
  renderSettingsDrawer() {
    return `
      <aside
        class="print-settings-drawer ${this.showSettings ? 'is-open' : ''}"
        role="region"
        aria-label="मुद्रण व लेआउट विन्यास फलक"
        id="print-settings-panel"
      >
        <div class="print-drawer-header">
          <h3>
            ${getIconSvg('settings', 'nav-icon')}
            <span>मुद्रण विन्यास</span>
          </h3>
          <button
            type="button"
            class="btn-icon-control"
            data-action="toggle-preview-settings"
            aria-label="विन्यास बंद करें"
          >
            ${getIconSvg('close', 'nav-icon')}
          </button>
        </div>

        <div class="print-drawer-content">
          <!-- Page Size -->
          <div class="print-setting-group">
            <label for="cfg-page-size" class="print-setting-label">पृष्ठ आकार (Page Size)</label>
            <select id="cfg-page-size" class="print-select" data-action="update-config-page-size">
              <option value="${PAGE_SIZE.A5}" ${this.layoutConfig.pageSize === PAGE_SIZE.A5 ? 'selected' : ''}>A5 (१४८ × २१० मिमी — काव्य मानक)</option>
              <option value="${PAGE_SIZE.A4}" ${this.layoutConfig.pageSize === PAGE_SIZE.A4 ? 'selected' : ''}>A4 (२१० × २९७ मिमी)</option>
              <option value="${PAGE_SIZE.LETTER}" ${this.layoutConfig.pageSize === PAGE_SIZE.LETTER ? 'selected' : ''}>Letter (२१६ × २७९ मिमी)</option>
            </select>
          </div>

          <!-- Orientation -->
          <div class="print-setting-group">
            <label for="cfg-orientation" class="print-setting-label">अभिविन्यास (Orientation)</label>
            <select id="cfg-orientation" class="print-select" data-action="update-config-orientation">
              <option value="${PAGE_ORIENTATION.PORTRAIT}" ${this.layoutConfig.orientation === PAGE_ORIENTATION.PORTRAIT ? 'selected' : ''}>लम्बाकार (Portrait)</option>
              <option value="${PAGE_ORIENTATION.LANDSCAPE}" ${this.layoutConfig.orientation === PAGE_ORIENTATION.LANDSCAPE ? 'selected' : ''}>चौड़ाकार (Landscape)</option>
            </select>
          </div>

          <!-- Font Family -->
          <div class="print-setting-group">
            <label for="cfg-body-font" class="print-setting-label">पूर्वावलोकन का देवनागरी फ़ॉन्ट (Typeface)</label>
            <select id="cfg-body-font" class="print-select" data-action="update-config-body-font">
              <option value="${BODY_FONT.MARTEL}" ${this.layoutConfig.bodyFont === BODY_FONT.MARTEL ? 'selected' : ''}>मार्टेल (Martel — क्लासिक पुस्तक शैली)</option>
              <option value="${BODY_FONT.ROZHA_ONE}" ${this.layoutConfig.bodyFont === BODY_FONT.ROZHA_ONE ? 'selected' : ''}>रोझा वन (Rozha One — सुशोभित)</option>
              <option value="${BODY_FONT.YATRA_ONE}" ${this.layoutConfig.bodyFont === BODY_FONT.YATRA_ONE ? 'selected' : ''}>यात्रा वन (Yatra One — काष्ठ ब्लॉक)</option>
              <option value="${BODY_FONT.MUKTA}" ${this.layoutConfig.bodyFont === BODY_FONT.MUKTA ? 'selected' : ''}>मुक्ता (Mukta — समकालीन सरल)</option>
            </select>
            <p class="print-setting-hint">PDF और EPUB में स्थानीय Noto फ़ॉन्ट सम्मिलित होते हैं। पूरी पुस्तक छापने के लिए डाउनलोड किया गया PDF खोलें।</p>
          </div>

          <!-- Font Size -->
          <div class="print-setting-group">
            <label for="cfg-font-size" class="print-setting-label">फ़ॉन्ट आकार: ${this.layoutConfig.bodyFontSize}pt</label>
            <input
              type="range"
              min="9"
              max="16"
              step="1"
              value="${this.layoutConfig.bodyFontSize}"
              class="print-range"
              id="cfg-font-size"
              data-action="update-config-font-size"
            />
          </div>

          <!-- Line Height -->
          <div class="print-setting-group">
            <label for="cfg-line-height" class="print-setting-label">पंक्ति अंतराल (Line Spacing)</label>
            <select id="cfg-line-height" class="print-select" data-action="update-config-line-height">
              <option value="1.6" ${Math.abs(this.layoutConfig.lineHeight - 1.6) < 0.05 ? 'selected' : ''}>सघन (1.6)</option>
              <option value="1.8" ${Math.abs(this.layoutConfig.lineHeight - 1.8) < 0.05 ? 'selected' : ''}>सामान्य (1.8)</option>
              <option value="1.95" ${Math.abs(this.layoutConfig.lineHeight - 1.95) < 0.05 ? 'selected' : ''}>काव्य मानक (1.95)</option>
              <option value="2.2" ${Math.abs(this.layoutConfig.lineHeight - 2.2) < 0.05 ? 'selected' : ''}>खुला / विस्तृत (2.2)</option>
            </select>
          </div>

          <!-- Text Alignment -->
          <div class="print-setting-group">
            <label for="cfg-alignment" class="print-setting-label">संरेखण (Alignment)</label>
            <select id="cfg-alignment" class="print-select" data-action="update-config-alignment">
              <option value="${TEXT_ALIGNMENT.CENTER}" ${this.layoutConfig.alignment === TEXT_ALIGNMENT.CENTER ? 'selected' : ''}>केन्द्रित (Center — काव्य परंपरा)</option>
              <option value="${TEXT_ALIGNMENT.LEFT}" ${this.layoutConfig.alignment === TEXT_ALIGNMENT.LEFT ? 'selected' : ''}>बाईं ओर (Left)</option>
              <option value="${TEXT_ALIGNMENT.JUSTIFY}" ${this.layoutConfig.alignment === TEXT_ALIGNMENT.JUSTIFY ? 'selected' : ''}>समान (Justify)</option>
            </select>
          </div>

          <!-- Margins Preset -->
          <div class="print-setting-group">
            <label for="cfg-margins" class="print-setting-label">हाशिये (Margins)</label>
            <select id="cfg-margins" class="print-select" data-action="update-config-margins">
              <option value="compact" ${this.layoutConfig.margins.top === 14 ? 'selected' : ''}>सघन (14mm)</option>
              <option value="normal" ${this.layoutConfig.margins.top === 20 ? 'selected' : ''}>मानक पुस्तक (20mm)</option>
              <option value="generous" ${this.layoutConfig.margins.top === 28 ? 'selected' : ''}>विस्तृत (28mm)</option>
            </select>
          </div>

          <div class="print-setting-divider"></div>

          <!-- Toggles -->
          <div class="print-setting-group">
            <span class="print-setting-label" style="margin-bottom: var(--space-2);">पृष्ठ संरचना विकल्प</span>

            <label class="print-checkbox-label">
              <input
                type="checkbox"
                id="cfg-show-cover"
                data-action="toggle-config-flag"
                data-flag="showCover"
                ${this.layoutConfig.showCover ? 'checked' : ''}
              />
              <span>मुखपृष्ठ सम्मिलित करें (Cover)</span>
            </label>

            <label class="print-checkbox-label">
              <input
                type="checkbox"
                id="cfg-show-title-page"
                data-action="toggle-config-flag"
                data-flag="showTitlePage"
                ${this.layoutConfig.showTitlePage ? 'checked' : ''}
              />
              <span>आंतरिक शीर्षक पृष्ठ (Title Page)</span>
            </label>

            <label class="print-checkbox-label">
              <input
                type="checkbox"
                id="cfg-show-dedication"
                data-action="toggle-config-flag"
                data-flag="showDedication"
                ${this.layoutConfig.showDedication ? 'checked' : ''}
              />
              <span>समर्पण पृष्ठ (Dedication)</span>
            </label>

            <label class="print-checkbox-label">
              <input
                type="checkbox"
                id="cfg-show-toc"
                data-action="toggle-config-flag"
                data-flag="showTableOfContents"
                ${this.layoutConfig.showTableOfContents ? 'checked' : ''}
              />
              <span>विषय-सूची (Table of Contents)</span>
            </label>

            <label class="print-checkbox-label">
              <input
                type="checkbox"
                id="cfg-widow-orphan"
                data-action="toggle-config-flag"
                data-flag="widowOrphanControl"
                ${this.layoutConfig.widowOrphanControl ? 'checked' : ''}
              />
              <span>छंद विभाजन सुरक्षा (Widow/Orphan)</span>
            </label>
          </div>

          <div class="print-setting-divider"></div>

          <!-- Drawer Export Section -->
          <div class="print-setting-group print-drawer-export-group">
            <span class="print-setting-label">स्थानीय पुस्तक निर्यात (Export)</span>
            <p class="print-setting-hint">पूरी पुस्तक छापने के लिए PDF चुनें। PDF से हिन्दी पाठ कॉपी करने पर कुछ पाठकों में मात्राएँ बदल या दोहराई जा सकती हैं; अक्षरशः पाठ के लिए EPUB या मूल रचना इस्तेमाल करें।</p>

            ${this.exportStatus ? `
              <div class="export-status-banner is-${this.exportStatus}" role="status" aria-live="polite">
                ${this.exportStatus.startsWith('generating') ? '<span class="export-spinner" aria-hidden="true">⏳</span>' : ''}
                <span>${escapeHtml(this.exportMessage)}</span>
              </div>
            ` : ''}

            <div class="print-drawer-export-actions">
              <button
                type="button"
                class="btn-primary-action print-full-width-btn"
                data-action="export-pdf"
                id="btn-drawer-export-pdf"
                aria-label="PDF डाउनलोड करें"
              >
                ${getIconSvg('download', 'nav-icon')}
                <span>PDF डाउनलोड करें (${this.layoutConfig.pageSize.toUpperCase()})</span>
              </button>

              <button
                type="button"
                class="btn-secondary-action print-full-width-btn"
                data-action="export-epub"
                id="btn-drawer-export-epub"
                aria-label="EPUB 3 डाउनलोड करें"
              >
                ${getIconSvg('download', 'nav-icon')}
                <span>EPUB 3 डाउनलोड करें (ई-रीडर)</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    `;
  }
}
