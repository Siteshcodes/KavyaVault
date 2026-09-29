/**
 * काव्यकलश (KavyaVault) — Book Editor & Poem Curation Component (BookEditorView.js)
 * Phase 7 / Task 7.2: Book Builder UI & Poem Curation
 *
 * Provides complete visual curation for book projects:
 * - Book creation with live cover specimen preview
 * - Metadata editing (title, subtitle, author, dedication, description, language, cover preset)
 * - Section management (add, edit, delete safely without deleting poems, reorder up/down)
 * - Poem curation within sections (browse library, search/filter, add, remove, reorder up/down)
 * - Missing/deleted poem graceful resilience in UI
 * - Live structural book tree preview (Book -> Section -> Poems)
 * - Safe book deletion with literary non-destructive guarantee
 * - Accessible modals with focus restoration and Escape key dismissal
 */

import { bookProjectService } from '../../services/books/BookProjectService.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';
import { escapeHtml, normalizeSearchText } from '../../services/SearchService.js';
import { formatPoeticDate } from '../../utils/date.js';
import { COVER_TYPE } from '../../services/books/bookTypes.js';

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
 * Cover Background Presets
 */
export const COVER_BACKGROUNDS = [
  { id: 'bhojpatra', label: 'भोजपत्र (Bhojpatra)' },
  { id: 'syahi', label: 'स्याही (Syahi)' },
  { id: 'khaddar', label: 'खद्दर (Khaddar)' },
  { id: 'makhmali-raat', label: 'मखमली रात (Makhmali Raat)' }
];

/**
 * Cover Presentation Styles
 */
export const COVER_STYLES = [
  { id: COVER_TYPE.CLASSIC, label: 'शास्त्रीय (Classic)' },
  { id: COVER_TYPE.SIMPLE, label: 'सरल (Simple)' },
  { id: COVER_TYPE.MODERN, label: 'आधुनिक (Modern)' },
  { id: COVER_TYPE.ORNATE, label: 'अलंकृत (Ornate)' }
];

/**
 * Supported Languages
 */
export const BOOK_LANGUAGES = [
  { id: 'hi', label: 'हिन्दी (Hindi)' },
  { id: 'sa', label: 'संस्कृत (Sanskrit)' },
  { id: 'en', label: 'English' }
];

export class BookEditorView {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Object} options.router
   * @param {string|null} [options.bookId=null]
   * @param {import('../../services/books/BookProjectService.js').BookProjectService} [options.bookService]
   */
  constructor({
    container,
    router,
    bookId = null,
    bookService = bookProjectService
  }) {
    this.container = container;
    this.router = router;
    this.bookId = bookId;
    this.bookService = bookService;

    this.isCreating = !bookId || bookId === 'new';
    this.activeSectionId = null;

    // Modals: 'metadata' | 'section-create' | 'section-edit' | 'poem-picker' | 'preview' | 'delete-section' | 'delete-book' | null
    this.activeModal = null;
    this.editingSectionId = null;
    this.deletingSectionId = null;

    // Creation form scratch state
    this.createFormState = {
      title: '',
      subtitle: '',
      author: '',
      dedication: '',
      description: '',
      language: 'hi',
      coverType: COVER_TYPE.CLASSIC,
      coverBackground: 'bhojpatra'
    };
    this.createFormError = null;

    // Poem picker filters state
    this.pickerSearch = '';
    this.pickerCategory = 'all';
    this.pickerFavoritesOnly = false;
    this.pickerSelectedPoemIds = new Set();

    this.saveStatus = 'saved';
    this.errorMessage = null;
    this.lastFocusedElement = null;

    this.boundClickHandler = this.handleClick.bind(this);
    this.boundInputHandler = this.handleInput.bind(this);
    this.boundSubmitHandler = this.handleSubmit.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
  }

  /**
   * Mounts the view and binds listeners
   */
  mount() {
    this.render();
    if (this.container) {
      this.container.addEventListener('click', this.boundClickHandler);
      this.container.addEventListener('input', this.boundInputHandler);
      this.container.addEventListener('submit', this.boundSubmitHandler);
      if (typeof document !== 'undefined') {
        document.addEventListener('keydown', this.boundKeydownHandler);
      }
    }
  }

  /**
   * Unmounts the view and cleans up
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
      this.container.removeEventListener('input', this.boundInputHandler);
      this.container.removeEventListener('submit', this.boundSubmitHandler);
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', this.boundKeydownHandler);
      }
    }
  }

  /**
   * Main render dispatch
   */
  render() {
    if (!this.container) return;

    if (this.isCreating) {
      this.renderCreateFlow();
      return;
    }

    const book = this.bookService.getBook(this.bookId);
    if (!book) {
      this.renderNotFound();
      return;
    }

    // Ensure active section is valid
    const sections = Array.isArray(book.sections) ? book.sections : [];
    if (sections.length > 0) {
      if (!this.activeSectionId || !sections.some(s => s.id === this.activeSectionId)) {
        this.activeSectionId = sections[0].id;
      }
    } else {
      this.activeSectionId = null;
    }

    const activeSection = sections.find(s => s.id === this.activeSectionId) || null;
    const cover = book.cover || {};
    const coverBgClass = `cover-bg-${cover.background || 'bhojpatra'}`;
    const formattedDate = formatPoeticDate(book.updatedAt || book.createdAt);
    const sectionsCount = sections.length;
    const totalPoemsCount = Array.isArray(book.poemIds) ? book.poemIds.length : 0;

    let modalHtml = '';
    if (this.activeModal === 'metadata') {
      modalHtml = this.renderMetadataModal(book);
    } else if (this.activeModal === 'section-create') {
      modalHtml = this.renderSectionModal(null);
    } else if (this.activeModal === 'section-edit') {
      const secToEdit = sections.find(s => s.id === this.editingSectionId);
      modalHtml = this.renderSectionModal(secToEdit);
    } else if (this.activeModal === 'poem-picker' && activeSection) {
      modalHtml = this.renderPoemPickerModal(book, activeSection);
    } else if (this.activeModal === 'preview') {
      modalHtml = this.renderPreviewModal(book);
    } else if (this.activeModal === 'delete-section') {
      const secToDelete = sections.find(s => s.id === this.deletingSectionId);
      modalHtml = this.renderDeleteSectionModal(secToDelete);
    } else if (this.activeModal === 'delete-book') {
      modalHtml = this.renderDeleteBookModal(book);
    }

    this.container.innerHTML = `
      <div class="book-builder-view standard-page-view" role="region" aria-label="पुस्तक संपादन कार्यशाला">
        <!-- Top Navigation Bar -->
        <header class="builder-top-nav">
          <div class="builder-top-left">
            <a href="${ROUTES.BOOKS}" data-link class="btn-secondary-action" id="btn-back-to-books" aria-label="काव्य संकलन सूची पर लौटें">
              ${getIconSvg('arrow-left', 'nav-icon')}
              <span>संकलन सूची</span>
            </a>
            <span class="save-badge is-saved" id="builder-save-status">
              ${getIconSvg('check', 'nav-icon')}
              <span>परिवर्तन सहेजे गए</span>
            </span>
          </div>

          <div class="builder-top-right">
            <button
              type="button"
              class="btn-secondary-action"
              data-action="open-preview"
              id="btn-open-preview"
              aria-label="पुस्तक की संरचना का पूर्वावलोकन देखें"
            >
              ${getIconSvg('book', 'nav-icon')}
              <span>संरचना पूर्वावलोकन</span>
            </button>
            <button
              type="button"
              class="btn-secondary-action"
              data-action="open-metadata-modal"
              id="btn-edit-metadata"
              aria-label="पुस्तक विवरण संपादित करें"
            >
              ${getIconSvg('edit', 'nav-icon')}
              <span>विवरण संपादन</span>
            </button>
            <button
              type="button"
              class="btn-icon-control is-danger"
              data-action="open-delete-book-modal"
              id="btn-delete-book"
              aria-label="यह संकलन हटाएं"
              title="संकलन हटाएं"
            >
              ${getIconSvg('trash', 'nav-icon')}
            </button>
          </div>
        </header>

        <!-- Book Hero Card & Specimen Preview -->
        <section class="builder-hero-card" aria-label="पुस्तक सारांश">
          <div class="builder-cover-column ${coverBgClass}" id="builder-cover-preview">
            <span class="cover-specimen-badge">मुखपृष्ठ प्रारूप</span>
            <div class="cover-specimen-text">
              <h2 class="cover-specimen-title">${escapeHtml(book.title)}</h2>
              ${book.subtitle ? `<p class="cover-specimen-subtitle">${escapeHtml(book.subtitle)}</p>` : ''}
            </div>
            <span class="cover-specimen-author">${escapeHtml(book.author || 'अज्ञात')}</span>
          </div>

          <div class="builder-meta-column">
            <div class="builder-meta-main">
              <h1 class="builder-book-title">${escapeHtml(book.title)}</h1>
              ${book.subtitle ? `<p class="builder-book-subtitle">${escapeHtml(book.subtitle)}</p>` : ''}
              <div class="builder-book-author">रचनाकार: ${escapeHtml(book.author || 'अज्ञात')}</div>
              ${book.dedication ? `<blockquote class="builder-dedication-quote">“${escapeHtml(book.dedication)}”</blockquote>` : ''}
              ${book.description ? `<p class="builder-book-desc">${escapeHtml(book.description)}</p>` : ''}
            </div>

            <div class="builder-hero-stats">
              <span class="builder-stat-item">
                ${getIconSvg('folder', 'nav-icon')}
                <span>खण्ड: <strong class="builder-stat-value">${toDevanagariNumber(sectionsCount)}</strong></span>
              </span>
              <span class="builder-stat-item">
                ${getIconSvg('book', 'nav-icon')}
                <span>कुल रचनाएँ: <strong class="builder-stat-value">${toDevanagariNumber(totalPoemsCount)}</strong></span>
              </span>
              <span class="builder-stat-item">
                ${getIconSvg('calendar', 'nav-icon')}
                <span>अंतिम अद्यतन: <strong class="builder-stat-value">${formattedDate}</strong></span>
              </span>
            </div>
          </div>
        </section>

        <!-- Split Workspace: Sections + Active Section Poems -->
        <div class="builder-workspace-grid">
          <!-- Left: Sections Panel -->
          <aside class="sections-panel" aria-label="खण्ड एवं अध्याय सूची">
            <div class="panel-header">
              <h2 class="panel-title">खण्ड / अध्याय</h2>
              <button
                type="button"
                class="btn-secondary-action"
                style="min-height: 36px; padding: 0 var(--space-3);"
                data-action="open-add-section-modal"
                id="btn-add-section"
                aria-label="नया खण्ड जोड़ें"
              >
                ${getIconSvg('plus', 'nav-icon')}
                <span>नया खण्ड</span>
              </button>
            </div>

            <div class="sections-list" role="list">
              ${sections.length === 0 ? `
                <p style="color: var(--color-text-subtle); font-size: var(--text-body-small); margin: var(--space-2) 0;">
                  अभी कोई खण्ड नहीं है। कविताएँ व्यवस्थित करने के लिए नया खण्ड जोड़ें।
                </p>
              ` : sections.map((sec, idx) => {
                const isActive = sec.id === this.activeSectionId;
                const poemCount = Array.isArray(sec.poemIds) ? sec.poemIds.length : 0;
                const isFirst = idx === 0;
                const isLast = idx === sections.length - 1;

                return `
                  <div
                    class="section-item-row ${isActive ? 'is-active' : ''}"
                    role="listitem"
                    data-action="select-section"
                    data-section-id="${sec.id}"
                    tabindex="0"
                    aria-current="${isActive ? 'true' : 'false'}"
                    aria-label="खण्ड: ${escapeHtml(sec.title)}"
                  >
                    <div class="section-item-content">
                      <span class="section-item-title">${escapeHtml(sec.title)}</span>
                      <span class="section-item-meta">${toDevanagariNumber(poemCount)} रचनाएँ</span>
                    </div>

                    <div class="section-item-actions" onclick="event.stopPropagation();">
                      <button
                        type="button"
                        class="btn-icon-control"
                        data-action="move-section-up"
                        data-section-id="${sec.id}"
                        ${isFirst ? 'disabled' : ''}
                        aria-label="खण्ड ‘${escapeHtml(sec.title)}’ ऊपर करें"
                        title="ऊपर करें"
                      >
                        ${getIconSvg('arrow-up', 'nav-icon')}
                      </button>
                      <button
                        type="button"
                        class="btn-icon-control"
                        data-action="move-section-down"
                        data-section-id="${sec.id}"
                        ${isLast ? 'disabled' : ''}
                        aria-label="खण्ड ‘${escapeHtml(sec.title)}’ नीचे करें"
                        title="नीचे करें"
                      >
                        ${getIconSvg('arrow-down', 'nav-icon')}
                      </button>
                      <button
                        type="button"
                        class="btn-icon-control"
                        data-action="open-edit-section-modal"
                        data-section-id="${sec.id}"
                        aria-label="खण्ड ‘${escapeHtml(sec.title)}’ संपादित करें"
                        title="संपादित करें"
                      >
                        ${getIconSvg('edit', 'nav-icon')}
                      </button>
                      <button
                        type="button"
                        class="btn-icon-control is-danger"
                        data-action="open-delete-section-modal"
                        data-section-id="${sec.id}"
                        aria-label="खण्ड ‘${escapeHtml(sec.title)}’ हटाएं"
                        title="खण्ड हटाएं"
                      >
                        ${getIconSvg('trash', 'nav-icon')}
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </aside>

          <!-- Right: Poems Curation Panel -->
          <main class="poems-curation-panel" aria-label="खण्ड की कविताएँ">
            ${activeSection ? `
              <div class="curation-panel-header">
                <div class="curation-section-title-wrap">
                  <h2 class="curation-section-title">${escapeHtml(activeSection.title)}</h2>
                  ${activeSection.description ? `<p class="curation-section-desc">${escapeHtml(activeSection.description)}</p>` : ''}
                </div>

                <button
                  type="button"
                  class="btn-primary-action"
                  data-action="open-poem-picker"
                  id="btn-open-poem-picker"
                  aria-label="इस खण्ड में रचनाएँ जोड़ें"
                >
                  ${getIconSvg('plus', 'nav-icon')}
                  <span>रचना जोड़ें</span>
                </button>
              </div>

              <div class="curated-poems-list" role="list">
                ${activeSection.poemIds.length === 0 ? `
                  <div style="padding: var(--space-8) var(--space-4); text-align: center; color: var(--color-text-subtle);">
                    <p style="font-family: var(--font-reading); font-size: var(--text-body); margin: 0 0 var(--space-4) 0;">
                      इस खण्ड में अभी कोई रचना सम्मिलित नहीं है।
                    </p>
                    <button
                      type="button"
                      class="btn-secondary-action"
                      data-action="open-poem-picker"
                    >
                      ${getIconSvg('book', 'nav-icon')}
                      <span>पुस्तकालय से कविताएँ चुनें</span>
                    </button>
                  </div>
                ` : activeSection.poemIds.map((pid, idx) => {
                  const poem = this.bookService.getPoem(pid);
                  const isFirst = idx === 0;
                  const isLast = idx === activeSection.poemIds.length - 1;
                  const orderNum = toDevanagariNumber(idx + 1);

                  if (!poem) {
                    // Resilient missing poem row
                    return `
                      <div class="curated-poem-row" role="listitem" style="border-left: 3px solid var(--color-warning, #ed6c02);">
                        <div class="curated-poem-left">
                          <span class="curated-poem-order">${orderNum}.</span>
                          <div class="curated-poem-info">
                            <span class="curated-poem-title" style="color: var(--color-text-subtle);">रचना अनुपलब्ध (आईडी: ${escapeHtml(pid)})</span>
                            <span class="curated-poem-author-line" style="color: var(--color-warning, #ed6c02);">यह रचना पुस्तकालय से हटाई जा चुकी है</span>
                          </div>
                        </div>

                        <div class="curated-poem-controls">
                          <button
                            type="button"
                            class="btn-icon-control"
                            data-action="move-poem-up"
                            data-poem-id="${pid}"
                            ${isFirst ? 'disabled' : ''}
                            aria-label="रचना ऊपर करें"
                            title="ऊपर करें"
                          >
                            ${getIconSvg('arrow-up', 'nav-icon')}
                          </button>
                          <button
                            type="button"
                            class="btn-icon-control"
                            data-action="move-poem-down"
                            data-poem-id="${pid}"
                            ${isLast ? 'disabled' : ''}
                            aria-label="रचना नीचे करें"
                            title="नीचे करें"
                          >
                            ${getIconSvg('arrow-down', 'nav-icon')}
                          </button>
                          <button
                            type="button"
                            class="btn-icon-control is-danger"
                            data-action="remove-poem-from-section"
                            data-poem-id="${pid}"
                            aria-label="अनुपलब्ध रचना खण्ड से हटाएं"
                            title="खण्ड से हटाएं"
                          >
                            ${getIconSvg('close', 'nav-icon')}
                          </button>
                        </div>
                      </div>
                    `;
                  }

                  return `
                    <div class="curated-poem-row" role="listitem">
                      <div class="curated-poem-left">
                        <span class="curated-poem-order">${orderNum}.</span>
                        <div class="curated-poem-info">
                          <span class="curated-poem-title">${escapeHtml(poem.title)}</span>
                          <div class="curated-poem-author-line">
                            <span>${escapeHtml(poem.author || 'अज्ञात')}</span>
                            ${poem.category ? `<span class="curated-poem-cat-badge">${escapeHtml(poem.category)}</span>` : ''}
                          </div>
                        </div>
                      </div>

                      <div class="curated-poem-controls">
                        <button
                          type="button"
                          class="btn-icon-control"
                          data-action="move-poem-up"
                          data-poem-id="${pid}"
                          ${isFirst ? 'disabled' : ''}
                          aria-label="‘${escapeHtml(poem.title)}’ ऊपर करें"
                          title="ऊपर करें"
                        >
                          ${getIconSvg('arrow-up', 'nav-icon')}
                        </button>
                        <button
                          type="button"
                          class="btn-icon-control"
                          data-action="move-poem-down"
                          data-poem-id="${pid}"
                          ${isLast ? 'disabled' : ''}
                          aria-label="‘${escapeHtml(poem.title)}’ नीचे करें"
                          title="नीचे करें"
                        >
                          ${getIconSvg('arrow-down', 'nav-icon')}
                        </button>
                        <button
                          type="button"
                          class="btn-icon-control is-danger"
                          data-action="remove-poem-from-section"
                          data-poem-id="${pid}"
                          aria-label="‘${escapeHtml(poem.title)}’ खण्ड से हटाएं"
                          title="खण्ड से हटाएं"
                        >
                          ${getIconSvg('close', 'nav-icon')}
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="padding: var(--space-8); text-align: center; color: var(--color-text-subtle);">
                <p>कृपया बाएँ पैनल से कोई खण्ड चुनें या नया खण्ड जोड़ें।</p>
              </div>
            `}
          </main>
        </div>

        ${modalHtml}
      </div>
    `;
  }

  /**
   * Focused creation flow when creating a new book project
   */
  renderCreateFlow() {
    const bgClass = `cover-bg-${this.createFormState.coverBackground || 'bhojpatra'}`;

    this.container.innerHTML = `
      <div class="book-builder-view standard-page-view" role="region" aria-label="नया काव्य संकलन निर्माण">
        <header class="builder-top-nav">
          <div class="builder-top-left">
            <a href="${ROUTES.BOOKS}" data-link class="btn-secondary-action" id="btn-cancel-create">
              ${getIconSvg('arrow-left', 'nav-icon')}
              <span>संकलन सूची पर लौटें</span>
            </a>
          </div>
        </header>

        <section class="builder-hero-card">
          <div class="builder-cover-column ${bgClass}" id="create-cover-specimen">
            <span class="cover-specimen-badge">मुखपृष्ठ पूर्वावलोकन</span>
            <div class="cover-specimen-text">
              <h2 class="cover-specimen-title" id="specimen-title">${escapeHtml(this.createFormState.title || 'पुस्तक का शीर्षक')}</h2>
              <p class="cover-specimen-subtitle" id="specimen-subtitle">${escapeHtml(this.createFormState.subtitle || '')}</p>
            </div>
            <span class="cover-specimen-author" id="specimen-author">${escapeHtml(this.createFormState.author || 'रचनाकार')}</span>
          </div>

          <div class="builder-meta-column">
            <div>
              <h1 class="builder-book-title">नया काव्य-संकलन प्रारंभ करें</h1>
              <p class="builder-book-desc">अपनी कविताओं को सुगठित खण्डों में संजोकर संपूर्ण पुस्तक का स्वरूप दें।</p>
            </div>

            ${this.createFormError ? `
              <div class="form-error-banner" style="color: var(--color-error, #d32f2f); font-size: var(--text-body-small); padding: var(--space-2) var(--space-3); background: rgba(211,47,47,0.08); border-radius: var(--radius-sm);" role="alert">
                ${escapeHtml(this.createFormError)}
              </div>
            ` : ''}

            <form id="form-create-book" class="form-grid" style="display: flex; flex-direction: column; gap: var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="book-form-title">पुस्तक का शीर्षक *</label>
                <input
                  type="text"
                  id="book-form-title"
                  name="title"
                  class="form-input"
                  required
                  placeholder="उदा. रश्मिरथी, कामायनी, मधुशाला..."
                  value="${escapeHtml(this.createFormState.title)}"
                  autofocus
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="book-form-subtitle">उपशीर्षक (वैकल्पिक)</label>
                <input
                  type="text"
                  id="book-form-subtitle"
                  name="subtitle"
                  class="form-input"
                  placeholder="उदा. प्रतिनिधि कविताओं का संग्रह"
                  value="${escapeHtml(this.createFormState.subtitle)}"
                />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div class="form-group">
                  <label class="form-label" for="book-form-author">रचनाकार / संपादक</label>
                  <input
                    type="text"
                    id="book-form-author"
                    name="author"
                    class="form-input"
                    placeholder="कवि का नाम"
                    value="${escapeHtml(this.createFormState.author)}"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="book-form-language">भाषा</label>
                  <select id="book-form-language" name="language" class="form-select">
                    ${BOOK_LANGUAGES.map(lang => `
                      <option value="${lang.id}" ${this.createFormState.language === lang.id ? 'selected' : ''}>${lang.label}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="book-form-dedication">समर्पण (Dedication)</label>
                <input
                  type="text"
                  id="book-form-dedication"
                  name="dedication"
                  class="form-input"
                  placeholder="उदा. पूज्य माता-पिता के श्रीचरणों में..."
                  value="${escapeHtml(this.createFormState.dedication)}"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="book-form-description">पुस्तक परिचय / आमुख</label>
                <textarea
                  id="book-form-description"
                  name="description"
                  class="form-textarea"
                  rows="2"
                  placeholder="इस संकलन के भाव एवं उद्देश्य का संक्षिप्त परिचय..."
                >${escapeHtml(this.createFormState.description)}</textarea>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div class="form-group">
                  <label class="form-label" for="book-form-cover-bg">मुखपृष्ठ आवरण शैली</label>
                  <select id="book-form-cover-bg" name="coverBackground" class="form-select">
                    ${COVER_BACKGROUNDS.map(bg => `
                      <option value="${bg.id}" ${this.createFormState.coverBackground === bg.id ? 'selected' : ''}>${bg.label}</option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="book-form-cover-style">प्रस्तुति प्रारूप</label>
                  <select id="book-form-cover-style" name="coverType" class="form-select">
                    ${COVER_STYLES.map(st => `
                      <option value="${st.id}" ${this.createFormState.coverType === st.id ? 'selected' : ''}>${st.label}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-3);">
                <a href="${ROUTES.BOOKS}" data-link class="btn-secondary-action">रद्द करें</a>
                <button type="submit" class="btn-primary-action" id="btn-submit-create-book">
                  ${getIconSvg('plus', 'nav-icon')}
                  <span>संकलन बनाएँ</span>
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Not found state when bookId does not exist
   */
  renderNotFound() {
    this.container.innerHTML = `
      <div class="book-builder-view standard-page-view" style="text-align: center; padding: var(--space-12) var(--space-4);">
        <h1 class="books-title">काव्य संकलन नहीं मिला</h1>
        <p class="books-subtitle" style="margin: var(--space-3) 0 var(--space-6) 0;">
          यह संकलन उपलब्ध नहीं है या इसे हटाया जा चुका है।
        </p>
        <a href="${ROUTES.BOOKS}" data-link class="btn-primary-action">
          ${getIconSvg('arrow-left', 'nav-icon')}
          <span>संकलन सूची पर लौटें</span>
        </a>
      </div>
    `;
  }

  /**
   * Modal: Edit Book Metadata
   */
  renderMetadataModal(book) {
    const cover = book.cover || {};

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-meta-title">
        <div class="modal-container">
          <header class="modal-header">
            <h2 id="modal-meta-title" class="modal-title">पुस्तक विवरण संपादन</h2>
            <button type="button" class="btn-icon-control" data-action="close-modal" aria-label="बंद करें">
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <form id="form-edit-metadata">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label" for="edit-book-title">पुस्तक का शीर्षक *</label>
                <input
                  type="text"
                  id="edit-book-title"
                  name="title"
                  class="form-input"
                  required
                  value="${escapeHtml(book.title)}"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="edit-book-subtitle">उपशीर्षक</label>
                <input
                  type="text"
                  id="edit-book-subtitle"
                  name="subtitle"
                  class="form-input"
                  value="${escapeHtml(book.subtitle || '')}"
                />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div class="form-group">
                  <label class="form-label" for="edit-book-author">रचनाकार / संपादक</label>
                  <input
                    type="text"
                    id="edit-book-author"
                    name="author"
                    class="form-input"
                    value="${escapeHtml(book.author || '')}"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="edit-book-language">भाषा</label>
                  <select id="edit-book-language" name="language" class="form-select">
                    ${BOOK_LANGUAGES.map(lang => `
                      <option value="${lang.id}" ${book.language === lang.id ? 'selected' : ''}>${lang.label}</option>
                    `).join('')}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="edit-book-dedication">समर्पण (Dedication)</label>
                <input
                  type="text"
                  id="edit-book-dedication"
                  name="dedication"
                  class="form-input"
                  value="${escapeHtml(book.dedication || '')}"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="edit-book-description">पुस्तक परिचय</label>
                <textarea
                  id="edit-book-description"
                  name="description"
                  class="form-textarea"
                  rows="2"
                >${escapeHtml(book.description || '')}</textarea>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div class="form-group">
                  <label class="form-label" for="edit-book-cover-bg">मुखपृष्ठ आवरण शैली</label>
                  <select id="edit-book-cover-bg" name="coverBackground" class="form-select">
                    ${COVER_BACKGROUNDS.map(bg => `
                      <option value="${bg.id}" ${(cover.background || 'bhojpatra') === bg.id ? 'selected' : ''}>${bg.label}</option>
                    `).join('')}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="edit-book-cover-style">प्रस्तुति प्रारूप</label>
                  <select id="edit-book-cover-style" name="coverType" class="form-select">
                    ${COVER_STYLES.map(st => `
                      <option value="${st.id}" ${(cover.type || COVER_TYPE.CLASSIC) === st.id ? 'selected' : ''}>${st.label}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn-secondary-action" data-action="close-modal">रद्द करें</button>
              <button type="submit" class="btn-primary-action" id="btn-save-metadata">
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
   * Modal: Create or Edit Section
   */
  renderSectionModal(sectionToEdit = null) {
    const isEdit = Boolean(sectionToEdit);
    const title = isEdit ? sectionToEdit.title : '';
    const description = isEdit ? (sectionToEdit.description || '') : '';

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-sec-title">
        <div class="modal-container">
          <header class="modal-header">
            <h2 id="modal-sec-title" class="modal-title">${isEdit ? 'खण्ड संपादित करें' : 'नया खण्ड जोड़ें'}</h2>
            <button type="button" class="btn-icon-control" data-action="close-modal" aria-label="बंद करें">
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <form id="form-section">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label" for="sec-input-title">खण्ड का शीर्षक *</label>
                <input
                  type="text"
                  id="sec-input-title"
                  name="title"
                  class="form-input"
                  required
                  placeholder="उदा. प्रथम खण्ड, प्रेम और विरह, चेतना के स्वर..."
                  value="${escapeHtml(title)}"
                  autofocus
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="sec-input-desc">खण्ड का संक्षिप्त विवरण (वैकल्पिक)</label>
                <textarea
                  id="sec-input-desc"
                  name="description"
                  class="form-textarea"
                  rows="2"
                  placeholder="इस खण्ड के भाव अथवा विषय-वस्तु का परिचय..."
                >${escapeHtml(description)}</textarea>
              </div>
            </div>

            <footer class="modal-footer">
              <button type="button" class="btn-secondary-action" data-action="close-modal">रद्द करें</button>
              <button type="submit" class="btn-primary-action" id="btn-submit-section">
                ${getIconSvg('check', 'nav-icon')}
                <span>${isEdit ? 'सहेजें' : 'खण्ड जोड़ें'}</span>
              </button>
            </footer>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Modal: Poem Picker with Search and Filter
   */
  renderPoemPickerModal(book, activeSection) {
    const allPoems = this.bookService.getLibraryPoems({ includeArchived: true });
    const existingPoemIds = new Set(activeSection.poemIds || []);

    // Filter poems according to active picker filters
    const searchNorm = normalizeSearchText(this.pickerSearch);
    const filteredPoems = allPoems.filter(p => {
      // 1. Favorites toggle
      if (this.pickerFavoritesOnly && !p.isFavorite) return false;

      // 2. Category filter
      if (this.pickerCategory !== 'all' && p.category !== this.pickerCategory) return false;

      // 3. Search text matching title, author, category, or tags
      if (searchNorm) {
        const titleNorm = normalizeSearchText(p.title);
        const authorNorm = normalizeSearchText(p.author);
        const catNorm = normalizeSearchText(p.category);
        const tagsNorm = Array.isArray(p.tags) ? p.tags.map(t => normalizeSearchText(t)).join(' ') : '';
        const match = titleNorm.includes(searchNorm) ||
                      authorNorm.includes(searchNorm) ||
                      catNorm.includes(searchNorm) ||
                      tagsNorm.includes(searchNorm);
        if (!match) return false;
      }

      return true;
    });

    // Gather distinct categories for category chips
    const categoriesSet = new Set();
    allPoems.forEach(p => {
      if (p.category && typeof p.category === 'string') {
        categoriesSet.add(p.category);
      }
    });
    const categories = Array.from(categoriesSet).sort();

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-picker-title">
        <div class="modal-container is-wide">
          <header class="modal-header">
            <div>
              <h2 id="modal-picker-title" class="modal-title">खण्ड ‘${escapeHtml(activeSection.title)}’ में रचनाएँ जोड़ें</h2>
              <p style="color: var(--color-text-subtle); font-size: var(--text-body-small); margin: 2px 0 0 0;">
                पुस्तकालय से कविताएँ चुनें (${toDevanagariNumber(filteredPoems.length)} उपलब्ध)
              </p>
            </div>
            <button type="button" class="btn-icon-control" data-action="close-modal" aria-label="बंद करें">
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <div class="modal-body">
            <!-- Filter toolbar -->
            <div class="picker-filter-bar">
              <input
                type="text"
                class="picker-search-input"
                id="picker-search-field"
                placeholder="शीर्षक, रचनाकार, श्रेणी या टैग से खोजें..."
                value="${escapeHtml(this.pickerSearch)}"
                data-action="picker-search-input"
                aria-label="कविता खोजें"
              />

              <div class="picker-filter-chips">
                <button
                  type="button"
                  class="picker-chip-btn ${this.pickerCategory === 'all' ? 'is-active' : ''}"
                  data-action="picker-filter-cat"
                  data-category="all"
                >
                  सभी श्रेणियाँ
                </button>
                ${categories.map(cat => `
                  <button
                    type="button"
                    class="picker-chip-btn ${this.pickerCategory === cat ? 'is-active' : ''}"
                    data-action="picker-filter-cat"
                    data-category="${escapeHtml(cat)}"
                  >
                    ${escapeHtml(cat)}
                  </button>
                `).join('')}
                <button
                  type="button"
                  class="picker-chip-btn ${this.pickerFavoritesOnly ? 'is-active' : ''}"
                  data-action="picker-toggle-fav"
                >
                  ${getIconSvg('heart', 'nav-icon')}
                  <span>केवल पसंदीदा</span>
                </button>
              </div>
            </div>

            <!-- Poem items list -->
            <div class="picker-poems-container" role="list">
              ${filteredPoems.length === 0 ? `
                <p style="padding: var(--space-6); text-align: center; color: var(--color-text-subtle); margin: 0;">
                  कोई कविता नहीं मिली। कृपया अपने खोज मापदंड बदलें।
                </p>
              ` : filteredPoems.map(poem => {
                const isAlreadyInSec = existingPoemIds.has(poem.id);
                const isSelected = this.pickerSelectedPoemIds.has(poem.id);

                return `
                  <div
                    class="picker-poem-item ${isAlreadyInSec ? 'is-already-added' : ''}"
                    role="listitem"
                    data-action="${isAlreadyInSec ? '' : 'toggle-picker-selection'}"
                    data-poem-id="${poem.id}"
                  >
                    <input
                      type="checkbox"
                      class="picker-checkbox"
                      id="chk-poem-${poem.id}" ${isAlreadyInSec ? 'disabled checked' : (isSelected ? 'checked' : '')}
                      data-action="toggle-picker-selection"
                      data-poem-id="${poem.id}"
                      aria-label="चयन करें: ${escapeHtml(poem.title)}"
                    />
                    <div class="picker-poem-content">
                      <div class="picker-poem-title">${escapeHtml(poem.title)}</div>
                      <div class="picker-poem-sub">
                        <span>${escapeHtml(poem.author || 'अज्ञात')}</span>
                        ${poem.category ? `<span class="curated-poem-cat-badge">${escapeHtml(poem.category)}</span>` : ''}
                        ${isAlreadyInSec ? `<span class="already-added-tag">✓ पहले से सम्मिलित</span>` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <footer class="modal-footer">
            <span style="font-family: var(--font-interface); font-size: var(--text-body-small); color: var(--color-text-subtle); margin-right: auto;">
              ${toDevanagariNumber(this.pickerSelectedPoemIds.size)} रचनाएँ चयनित
            </span>
            <button type="button" class="btn-secondary-action" data-action="close-modal">रद्द करें</button>
            <button
              type="button"
              class="btn-primary-action"
              data-action="confirm-add-selected-poems"
              id="btn-confirm-add-poems"
              ${this.pickerSelectedPoemIds.size === 0 ? 'disabled' : ''}
            >
              ${getIconSvg('plus', 'nav-icon')}
              <span>खण्ड में जोड़ें (${toDevanagariNumber(this.pickerSelectedPoemIds.size)})</span>
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Modal: Live Structural Tree Preview
   */
  renderPreviewModal(book) {
    const doc = this.bookService.generateBookDocument(book.id);
    const meta = doc.metadata || {};
    const stats = doc.stats || {};

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-prev-title">
        <div class="modal-container is-wide">
          <header class="modal-header">
            <h2 id="modal-prev-title" class="modal-title">पुस्तक संरचना पूर्वावलोकन</h2>
            <button type="button" class="btn-icon-control" data-action="close-modal" aria-label="बंद करें">
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <div class="modal-body">
            <div class="structural-tree">
              <div class="tree-book-header">
                <h3 class="tree-book-title">${escapeHtml(meta.title)}</h3>
                ${meta.subtitle ? `<div class="tree-book-meta">${escapeHtml(meta.subtitle)}</div>` : ''}
                <div class="tree-book-meta">
                  रचनाकार: <strong>${escapeHtml(meta.author || 'अज्ञात')}</strong> |
                  खण्ड: <strong>${toDevanagariNumber(stats.totalSections || 0)}</strong> |
                  रचनाएँ: <strong>${toDevanagariNumber(stats.totalPoems || 0)}</strong> |
                  शब्द: <strong>${toDevanagariNumber(stats.wordCount || 0)}</strong>
                </div>
              </div>

              ${doc.warnings && doc.warnings.length > 0 ? `
                <div style="padding: var(--space-3); background: rgba(237,108,2,0.1); border-left: 3px solid var(--color-warning, #ed6c02); border-radius: var(--radius-sm); font-size: var(--text-body-small);">
                  <strong>साहित्यिक सूचना:</strong>
                  <ul style="margin: var(--space-1) 0 0 var(--space-4); padding: 0;">
                    ${doc.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              ${doc.sections.map((sec, sIdx) => `
                <div class="tree-section-block">
                  <h4 class="tree-section-title">खण्ड ${toDevanagariNumber(sIdx + 1)}: ${escapeHtml(sec.title)}</h4>
                  ${sec.description ? `<p style="font-size: var(--text-caption); color: var(--color-text-subtle); margin: 0;">${escapeHtml(sec.description)}</p>` : ''}

                  <div style="display: flex; flex-direction: column; gap: var(--space-1); margin-top: var(--space-2);">
                    ${sec.poems.length === 0 ? `
                      <span style="color: var(--color-text-subtle); font-size: var(--text-body-small); font-style: italic;">
                        (इस खण्ड में कोई रचना सम्मिलित नहीं है)
                      </span>
                    ` : sec.poems.map((poem, pIdx) => `
                      <div class="tree-poem-item">
                        <span class="tree-bullet">•</span>
                        <span style="font-weight: 500;">${toDevanagariNumber(pIdx + 1)}. ${escapeHtml(poem.title)}</span>
                        <span style="color: var(--color-text-subtle); font-size: var(--text-caption);">(${escapeHtml(poem.author || 'अज्ञात')})</span>
                      </div>
                    `).join('')}

                    ${sec.missingPoemIds && sec.missingPoemIds.length > 0 ? sec.missingPoemIds.map(mpid => `
                      <div class="tree-poem-item" style="color: var(--color-warning, #ed6c02);">
                        <span class="tree-bullet">⚠</span>
                        <span>अनुपलब्ध रचना (आईडी: ${escapeHtml(mpid)})</span>
                      </div>
                    `).join('') : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-primary-action" data-action="close-modal">
              <span>ठीक है</span>
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Modal: Confirm Delete Section
   */
  renderDeleteSectionModal(section) {
    if (!section) return '';

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-del-sec-title">
        <div class="modal-container">
          <header class="modal-header">
            <h2 id="modal-del-sec-title" class="modal-title">खण्ड हटाएं?</h2>
            <button type="button" class="btn-icon-control" data-action="close-modal" aria-label="बंद करें">
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <div class="modal-body">
            <p>क्या आप निश्चित रूप से <strong>‘${escapeHtml(section.title)}’</strong> खण्ड को हटाना चाहते हैं?</p>
            <p style="color: var(--color-text-subtle); font-size: var(--text-body-small); margin: 0;">
              <strong>साहित्यिक सुरक्षा गारंटी:</strong> खण्ड हटाने से इसमें उपस्थित कविताएँ नष्ट नहीं होंगी। वे आपके पुस्तकालय में पूर्णतः सुरक्षित रहेंगी।
            </p>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-secondary-action" data-action="close-modal">रद्द करें</button>
            <button
              type="button"
              class="btn-primary-action"
              style="background-color: var(--color-error, #d32f2f);"
              data-action="execute-delete-section"
              data-section-id="${section.id}"
            >
              हाँ, खण्ड हटाएं
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Modal: Confirm Delete Book
   */
  renderDeleteBookModal(book) {
    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-del-book-title">
        <div class="modal-container">
          <header class="modal-header">
            <h2 id="modal-del-book-title" class="modal-title">संकलन हटाएं?</h2>
            <button type="button" class="btn-icon-control" data-action="close-modal" aria-label="बंद करें">
              ${getIconSvg('close', 'nav-icon')}
            </button>
          </header>

          <div class="modal-body">
            <p>क्या आप निश्चित रूप से <strong>‘${escapeHtml(book.title)}’</strong> संकलन को हटाना चाहते हैं?</p>
            <p style="color: var(--color-text-subtle); font-size: var(--text-body-small); margin: 0;">
              <strong>साहित्यिक सुरक्षा गारंटी:</strong> केवल यह पुस्तक परियोजना हटाई जाएगी। इसमें सम्मिलित आपकी समस्त कविताएँ पुस्तकालय में पूर्णतः सुरक्षित रहेंगी।
            </p>
          </div>

          <footer class="modal-footer">
            <button type="button" class="btn-secondary-action" data-action="close-modal">रद्द करें</button>
            <button
              type="button"
              class="btn-primary-action"
              style="background-color: var(--color-error, #d32f2f);"
              data-action="execute-delete-book"
            >
              हाँ, संकलन हटाएं
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Form submission handler
   */
  handleSubmit(e) {
    e.preventDefault();

    // 1. Create Book Form
    if (e.target && e.target.id === 'form-create-book') {
      const form = e.target;
      const title = (form.title.value || '').trim();
      const subtitle = (form.subtitle.value || '').trim();
      const author = (form.author.value || '').trim();
      const dedication = (form.dedication.value || '').trim();
      const description = (form.description.value || '').trim();
      const language = form.language.value || 'hi';
      const coverBackground = form.coverBackground.value || 'bhojpatra';
      const coverType = form.coverType.value || COVER_TYPE.CLASSIC;

      if (!title) {
        this.createFormError = 'कृपया पुस्तक का शीर्षक दर्ज करें।';
        this.render();
        return;
      }

      this.createFormError = null;
      try {
        const created = this.bookService.createBook({
          title,
          subtitle: subtitle || null,
          author: author || null,
          dedication: dedication || null,
          description: description || null,
          language,
          cover: {
            type: coverType,
            background: coverBackground,
            title,
            subtitle: subtitle || null,
            author: author || null
          },
          sections: [
            {
              title: 'प्रथम खण्ड',
              description: 'प्रारंभिक कविताएँ',
              poemIds: [],
              order: 0
            }
          ]
        });

        this.bookId = created.id;
        this.isCreating = false;
        if (created.sections && created.sections.length > 0) {
          this.activeSectionId = created.sections[0].id;
        }

        if (this.router && typeof this.router.navigate === 'function') {
          this.router.navigate(`/books/${created.id}`);
        } else {
          this.render();
        }
      } catch (err) {
        this.createFormError = err.message || 'संकलन निर्माण में त्रुटि हुई।';
        this.render();
      }
      return;
    }

    // 2. Edit Metadata Form
    if (e.target && e.target.id === 'form-edit-metadata') {
      const form = e.target;
      const title = (form.title.value || '').trim();
      const subtitle = (form.subtitle.value || '').trim();
      const author = (form.author.value || '').trim();
      const dedication = (form.dedication.value || '').trim();
      const description = (form.description.value || '').trim();
      const language = form.language.value || 'hi';
      const coverBackground = form.coverBackground.value || 'bhojpatra';
      const coverType = form.coverType.value || COVER_TYPE.CLASSIC;

      if (!title) return;

      this.bookService.updateBookMetadata(this.bookId, {
        title,
        subtitle: subtitle || null,
        author: author || null,
        dedication: dedication || null,
        description: description || null,
        language,
        cover: {
          type: coverType,
          background: coverBackground,
          title,
          subtitle: subtitle || null,
          author: author || null
        }
      });

      this.closeModal();
      return;
    }

    // 3. Section Form (Add or Edit)
    if (e.target && e.target.id === 'form-section') {
      const form = e.target;
      const title = (form.title.value || '').trim();
      const description = (form.description.value || '').trim();

      if (!title) return;

      if (this.activeModal === 'section-edit' && this.editingSectionId) {
        this.bookService.updateSection(this.bookId, this.editingSectionId, {
          title,
          description: description || null
        });
      } else if (this.activeModal === 'section-create') {
        const updated = this.bookService.addSection(this.bookId, {
          title,
          description: description || null
        });
        const added = updated.sections[updated.sections.length - 1];
        if (added) {
          this.activeSectionId = added.id;
        }
      }

      this.closeModal();
    }
  }

  /**
   * Input event handler for live preview updates & search filtering
   */
  handleInput(e) {
    // 1. Live update in Create Form
    if (this.isCreating) {
      const titleInput = this.container.querySelector('#book-form-title');
      const subtitleInput = this.container.querySelector('#book-form-subtitle');
      const authorInput = this.container.querySelector('#book-form-author');
      const bgSelect = this.container.querySelector('#book-form-cover-bg');

      if (titleInput) this.createFormState.title = titleInput.value;
      if (subtitleInput) this.createFormState.subtitle = subtitleInput.value;
      if (authorInput) this.createFormState.author = authorInput.value;
      if (bgSelect) this.createFormState.coverBackground = bgSelect.value;

      const specimenTitle = this.container.querySelector('#specimen-title');
      const specimenSubtitle = this.container.querySelector('#specimen-subtitle');
      const specimenAuthor = this.container.querySelector('#specimen-author');
      const specimenCover = this.container.querySelector('#create-cover-specimen');

      if (specimenTitle) specimenTitle.textContent = this.createFormState.title || 'पुस्तक का शीर्षक';
      if (specimenSubtitle) specimenSubtitle.textContent = this.createFormState.subtitle || '';
      if (specimenAuthor) specimenAuthor.textContent = this.createFormState.author || 'रचनाकार';
      if (specimenCover && bgSelect) {
        specimenCover.className = `builder-cover-column cover-bg-${this.createFormState.coverBackground}`;
      }
      return;
    }

    // 2. Search filter in Poem Picker
    if (e.target && e.target.id === 'picker-search-field') {
      this.pickerSearch = e.target.value;
      const book = this.bookService.getBook(this.bookId);
      const sections = book ? (book.sections || []) : [];
      const activeSection = sections.find(s => s.id === this.activeSectionId);
      if (book && activeSection) {
        const cursor = e.target.selectionStart;
        this.render();
        const refocused = this.container.querySelector('#picker-search-field');
        if (refocused) {
          refocused.focus();
          refocused.setSelectionRange(cursor, cursor);
        }
      }
    }
  }

  /**
   * Central click event handler
   */
  handleClick(e) {
    // Backdrop click closes modal
    if (e.target && e.target.classList && e.target.classList.contains('modal-backdrop')) {
      this.closeModal();
      return;
    }

    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.getAttribute('data-action');

    // Section selection
    if (action === 'select-section') {
      const sid = trigger.getAttribute('data-section-id');
      if (sid && sid !== this.activeSectionId) {
        this.activeSectionId = sid;
        this.render();
      }
      return;
    }

    // Modal triggers
    if (action === 'open-metadata-modal') {
      this.lastFocusedElement = trigger;
      this.activeModal = 'metadata';
      this.render();
      return;
    }

    if (action === 'open-add-section-modal') {
      this.lastFocusedElement = trigger;
      this.activeModal = 'section-create';
      this.render();
      return;
    }

    if (action === 'open-edit-section-modal') {
      this.lastFocusedElement = trigger;
      this.editingSectionId = trigger.getAttribute('data-section-id');
      this.activeModal = 'section-edit';
      this.render();
      return;
    }

    if (action === 'open-delete-section-modal') {
      this.lastFocusedElement = trigger;
      this.deletingSectionId = trigger.getAttribute('data-section-id');
      this.activeModal = 'delete-section';
      this.render();
      return;
    }

    if (action === 'open-delete-book-modal') {
      this.lastFocusedElement = trigger;
      this.activeModal = 'delete-book';
      this.render();
      return;
    }

    if (action === 'open-poem-picker') {
      this.lastFocusedElement = trigger;
      this.activeModal = 'poem-picker';
      this.pickerSearch = '';
      this.pickerCategory = 'all';
      this.pickerFavoritesOnly = false;
      this.pickerSelectedPoemIds.clear();
      this.render();
      return;
    }

    if (action === 'open-preview') {
      this.lastFocusedElement = trigger;
      this.activeModal = 'preview';
      this.render();
      return;
    }

    if (action === 'close-modal') {
      this.closeModal();
      return;
    }

    // Section ordering
    if (action === 'move-section-up') {
      const sid = trigger.getAttribute('data-section-id');
      this.bookService.moveSectionUp(this.bookId, sid);
      this.render();
      return;
    }

    if (action === 'move-section-down') {
      const sid = trigger.getAttribute('data-section-id');
      this.bookService.moveSectionDown(this.bookId, sid);
      this.render();
      return;
    }

    // Section deletion
    if (action === 'execute-delete-section') {
      const sid = trigger.getAttribute('data-section-id');
      if (sid) {
        const updated = this.bookService.deleteSection(this.bookId, sid);
        if (this.activeSectionId === sid) {
          const remaining = updated.sections || [];
          this.activeSectionId = remaining.length > 0 ? remaining[0].id : null;
        }
      }
      this.closeModal();
      return;
    }

    // Book deletion
    if (action === 'execute-delete-book') {
      this.bookService.deleteBook(this.bookId);
      this.closeModal();
      if (this.router && typeof this.router.navigate === 'function') {
        this.router.navigate(ROUTES.BOOKS);
      }
      return;
    }

    // Poem ordering inside active section
    if (action === 'move-poem-up') {
      const pid = trigger.getAttribute('data-poem-id');
      this.bookService.movePoemUp(this.bookId, this.activeSectionId, pid);
      this.render();
      return;
    }

    if (action === 'move-poem-down') {
      const pid = trigger.getAttribute('data-poem-id');
      this.bookService.movePoemDown(this.bookId, this.activeSectionId, pid);
      this.render();
      return;
    }

    // Poem removal from section (safe non-destructive)
    if (action === 'remove-poem-from-section') {
      const pid = trigger.getAttribute('data-poem-id');
      this.bookService.removePoemFromSection(this.bookId, this.activeSectionId, pid);
      this.render();
      return;
    }

    // Poem picker filters
    if (action === 'picker-filter-cat') {
      const cat = trigger.getAttribute('data-category');
      this.pickerCategory = cat || 'all';
      this.render();
      return;
    }

    if (action === 'picker-toggle-fav') {
      this.pickerFavoritesOnly = !this.pickerFavoritesOnly;
      this.render();
      return;
    }

    // Poem selection toggle in picker
    if (action === 'toggle-picker-selection') {
      const pid = trigger.getAttribute('data-poem-id');
      if (pid) {
        if (this.pickerSelectedPoemIds.has(pid)) {
          this.pickerSelectedPoemIds.delete(pid);
        } else {
          this.pickerSelectedPoemIds.add(pid);
        }
        this.render();
      }
      return;
    }

    // Confirm add selected poems to active section
    if (action === 'confirm-add-selected-poems') {
      if (this.pickerSelectedPoemIds.size > 0 && this.activeSectionId) {
        for (const pid of this.pickerSelectedPoemIds) {
          this.bookService.addPoemToSection(this.bookId, this.activeSectionId, pid);
        }
      }
      this.closeModal();
    }
  }

  /**
   * Closes any open modal and restores keyboard focus
   */
  closeModal() {
    this.activeModal = null;
    this.editingSectionId = null;
    this.deletingSectionId = null;
    this.pickerSelectedPoemIds.clear();
    this.render();

    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }
  }

  /**
   * Escape key dismisses modals
   */
  handleKeydown(e) {
    if (e.key === 'Escape' && this.activeModal) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      this.closeModal();
    }
  }
}
