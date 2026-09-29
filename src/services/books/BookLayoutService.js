/**
 * काव्यकलश (KavyaVault) — Book Layout Service (BookLayoutService.js)
 * Phase 7 / Task 7.3: Book Layout Engine & Print Preview
 *
 * Domain facade mediating layout configuration and pagination:
 * - Coordinates with BookProjectService to retrieve live BookDocument
 * - Applies user layout preferences through BookLayoutEngine
 * - Provides read-only, ephemeral BookLayoutDocument representations
 * - Guarantees zero disk persistence of rendered pages and zero poem mutations
 */

import { BookLayoutEngine } from './BookLayoutEngine.js';
import { bookProjectService } from './BookProjectService.js';
import {
  createLayoutConfig,
  validateLayoutConfig,
  PAGE_SIZE,
  PAGE_ORIENTATION,
  TEXT_ALIGNMENT,
  BODY_FONT,
  PAGE_NUMBER_POSITION,
  TITLE_STYLE
} from './bookLayoutTypes.js';

export class BookLayoutService {
  /**
   * @param {Object} [options={}]
   * @param {import('./BookProjectService.js').BookProjectService} [options.bookService]
   */
  constructor(options = {}) {
    this.bookService = options.bookService || bookProjectService;
  }

  /**
   * Returns a fresh, validated default LayoutConfig with literary poetry defaults
   * @param {Object} [overrides={}]
   * @returns {Object}
   */
  createDefaultLayoutConfig(overrides = {}) {
    return createLayoutConfig(overrides);
  }

  /**
   * Validates a LayoutConfig payload
   * @param {Object} config
   */
  validateConfig(config) {
    return validateLayoutConfig(config);
  }

  /**
   * Generates an ephemeral print layout document for a book project
   * @param {string} bookId
   * @param {Object} [layoutConfigInput={}]
   * @returns {Object} BookLayoutDocument
   */
  generateLayout(bookId, layoutConfigInput = {}) {
    const bookDoc = this.bookService.generateBookDocument(bookId);
    return BookLayoutEngine.generateLayout(bookDoc, layoutConfigInput);
  }

  /**
   * Generates an ephemeral print layout directly from an in-memory BookDocument
   * @param {Object} bookDoc
   * @param {Object} [layoutConfigInput={}]
   * @returns {Object} BookLayoutDocument
   */
  generateLayoutFromDocument(bookDoc, layoutConfigInput = {}) {
    return BookLayoutEngine.generateLayout(bookDoc, layoutConfigInput);
  }
}

export const bookLayoutService = new BookLayoutService();

// Re-export enums and types for convenient consumer access
export {
  PAGE_SIZE,
  PAGE_ORIENTATION,
  TEXT_ALIGNMENT,
  BODY_FONT,
  PAGE_NUMBER_POSITION,
  TITLE_STYLE
};
