/**
 * काव्यकलश (KavyaVault) — Book Projects List View Component (BooksListView.js)
 * Phase 7 / Task 7.2: Book Builder UI & Poem Curation
 *
 * Displays all user book projects with cover previews, metadata chips,
 * creation entry point, and safe deletion confirmation dialog.
 */

import { bookProjectService } from '../../services/books/BookProjectService.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { formatPoeticDate } from '../../utils/date.js';
import { escapeHtml } from '../../services/SearchService.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

/**
 * Converts Western digits to Devanagari numerals
 * @param {number|string} num
 * @returns {string}
 */
function toDevanagariNumber(num) {
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, d => digits[Number(d)]);
}

export class BooksListView {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Object} options.router
   * @param {import('../../services/books/BookProjectService.js').BookProjectService} [options.bookService]
   */
  constructor({ container, router, bookService = bookProjectService }) {
    this.container = container;
    this.router = router;
    this.bookService = bookService;

    this.deletingBookId = null;
    this.lastFocusedElement = null;

    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
  }

  /**
   * Retrieves all stored book projects
   * @returns {Array<Object>}
   */
  getBooks() {
    return this.bookService.getAllBooks();
  }

  /**
   * Mounts the component into DOM
   */
  mount() {
    this.render();
    if (this.container) {
      this.container.addEventListener('click', this.boundClickHandler);
      if (typeof document !== 'undefined') {
        document.addEventListener('keydown', this.boundKeydownHandler);
      }
    }
  }

  /**
   * Unmounts the component and removes event listeners
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', this.boundKeydownHandler);
      }
    }
  }

  /**
   * Renders the complete view
   */
  render() {
    const books = this.getBooks();

    let contentHtml = '';
    if (books.length === 0) {
      contentHtml = renderEmptyState({
        icon: 'book',
        heading: 'अभी कोई काव्य-संकलन तैयार नहीं है।',
        text: 'अपनी कविताओं को एक सुव्यवस्थित पुस्तक या संकलन का रूप देने के लिए नया संकलन प्रारंभ करें।',
        primaryAction: `
          <a href="${ROUTES.BOOK_NEW}" data-link class="btn-primary-action" id="btn-create-first-book">
            ${getIconSvg('plus', 'nav-icon')}
            <span>पहला संकलन बनाएँ</span>
          </a>
        `
      });
    } else {
      contentHtml = `
        <div class="books-grid" role="feed" aria-label="काव्य संकलन सूची">
          ${books.map(b => this.renderBookCard(b)).join('')}
        </div>
      `;
    }

    const deleteModalHtml = this.deletingBookId ? this.renderDeleteModal() : '';

    this.container.innerHTML = `
      <div class="books-page-view standard-page-view" role="region" aria-label="काव्य संकलन एवं पुस्तकें">
        <header class="books-top-bar">
          <div class="books-header-left">
            <h1 class="books-title">काव्य संकलन एवं पुस्तकें</h1>
            <p class="books-subtitle">कविताओं से संपूर्ण पुस्तक निर्माण व प्रकाशन संपादन</p>
          </div>
          <div class="books-header-right">
            <a href="${ROUTES.BOOK_NEW}" data-link class="btn-primary-action" id="btn-create-book-top">
              ${getIconSvg('plus', 'nav-icon')}
              <span>नया संकलन बनाएँ</span>
            </a>
          </div>
        </header>

        ${contentHtml}
        ${deleteModalHtml}
      </div>
    `;
  }

  /**
   * Renders an individual book card
   * @param {Object} book
   * @returns {string}
   */
  renderBookCard(book) {
    const cover = book.cover || {};
    const bgClass = `cover-bg-${cover.background || 'bhojpatra'}`;
    const sectionsCount = Array.isArray(book.sections) ? book.sections.length : 0;
    const poemsCount = Array.isArray(book.poemIds) ? book.poemIds.length : 0;
    const formattedDate = formatPoeticDate(book.updatedAt || book.createdAt);

    return `
      <article class="book-card" id="book-card-${book.id}" aria-label="${escapeHtml(book.title)}">
        <div class="book-card-cover-band ${bgClass}">
          <h2 class="book-card-cover-title">${escapeHtml(book.title)}</h2>
          <span class="book-card-cover-author">${escapeHtml(book.author || 'अज्ञात')}</span>
        </div>

        <div class="book-card-body">
          ${book.description ? `<p class="book-card-desc">${escapeHtml(book.description)}</p>` : ''}
          <div class="book-card-meta-chips">
            <span class="book-meta-chip">
              ${getIconSvg('folder', 'nav-icon')}
              <span>${toDevanagariNumber(sectionsCount)} खण्ड</span>
            </span>
            <span class="book-meta-chip">
              ${getIconSvg('book', 'nav-icon')}
              <span>${toDevanagariNumber(poemsCount)} रचनाएँ</span>
            </span>
          </div>
        </div>

        <div class="book-card-footer">
          <span class="book-updated-text">${formattedDate}</span>
          <div class="book-card-actions">
            <a
              href="/books/${book.id}"
              data-link
              class="btn-secondary-action"
              aria-label="‘${escapeHtml(book.title)}’ संपादित करें"
            >
              ${getIconSvg('edit', 'nav-icon')}
              <span>संपादन</span>
            </a>
            <button
              type="button"
              class="btn-icon-control is-danger"
              data-action="confirm-delete-book"
              data-book-id="${book.id}"
              data-book-title="${escapeHtml(book.title)}"
              aria-label="‘${escapeHtml(book.title)}’ संकलन हटाएं"
              title="संकलन हटाएं"
            >
              ${getIconSvg('trash', 'nav-icon')}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Renders the delete confirmation modal
   * @returns {string}
   */
  renderDeleteModal() {
    const book = this.bookService.getBook(this.deletingBookId);
    if (!book) return '';

    return `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-del-title">
        <div class="modal-container">
          <header class="modal-header">
            <h2 id="modal-del-title" class="modal-title">संकलन हटाएं?</h2>
            <button
              type="button"
              class="btn-icon-control"
              data-action="close-delete-modal"
              aria-label="बंद करें"
            >
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
            <button
              type="button"
              class="btn-secondary-action"
              data-action="close-delete-modal"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-primary-action"
              style="background-color: var(--color-error, #d32f2f);"
              data-action="execute-delete-book"
              data-book-id="${book.id}"
            >
              हाँ, संकलन हटाएं
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  /**
   * Centralized click handler
   * @param {Event} event
   */
  handleClick(event) {
    // 1. Close modal on backdrop click
    if (event.target && event.target.classList && event.target.classList.contains('modal-backdrop')) {
      this.closeDeleteModal();
      return;
    }

    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.getAttribute('data-action');

    if (action === 'confirm-delete-book') {
      const bookId = trigger.getAttribute('data-book-id');
      this.lastFocusedElement = trigger;
      this.deletingBookId = bookId;
      this.render();
      return;
    }

    if (action === 'close-delete-modal') {
      this.closeDeleteModal();
      return;
    }

    if (action === 'execute-delete-book') {
      const bookId = trigger.getAttribute('data-book-id');
      if (bookId) {
        this.bookService.deleteBook(bookId);
      }
      this.deletingBookId = null;
      this.render();
    }
  }

  /**
   * Closes delete modal and restores focus
   */
  closeDeleteModal() {
    this.deletingBookId = null;
    this.render();
    if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
      this.lastFocusedElement.focus();
    }
  }

  /**
   * Keyboard navigation and Escape handling
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    if (e.key === 'Escape' && this.deletingBookId) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      this.closeDeleteModal();
    }
  }
}
