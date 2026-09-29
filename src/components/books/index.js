/**
 * काव्यकलश (KavyaVault) — Book Builder Components (books/index.js)
 * Phase 7 / Task 7.2: Book Builder UI & Poem Curation
 */

export { BooksListView } from './BooksListView.js';
export { BookEditorView, COVER_BACKGROUNDS, COVER_STYLES, BOOK_LANGUAGES, toDevanagariNumber } from './BookEditorView.js';
export { BookPrintPreview } from './BookPrintPreview.js';
export { BookLayoutEngine, parsePoemStanzas } from '../../services/books/BookLayoutEngine.js';
export { BookLayoutService, bookLayoutService } from '../../services/books/BookLayoutService.js';
export {
  PAGE_SIZE,
  PAGE_ORIENTATION,
  TEXT_ALIGNMENT,
  BODY_FONT,
  PAGE_NUMBER_POSITION,
  PAGE_TYPE,
  TITLE_STYLE,
  toDevanagariNumerals,
  createLayoutConfig,
  validateLayoutConfig
} from '../../services/books/bookLayoutTypes.js';

