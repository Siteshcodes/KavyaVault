/**
 * काव्यकलश (KavyaVault) — Book Export Service (BookExportService.js)
 * Phase 7 / Task 7.4: Local PDF & EPUB Export
 *
 * Domain facade orchestrating local PDF and EPUB exports:
 * - Coordinates with BookProjectService and BookLayoutEngine
 * - Generates binary PDF via BookPdfGenerator
 * - Generates binary EPUB 3 via BookEpubGenerator
 * - Triggers zero-network, local browser downloads
 * - 100% read-only: never modifies books, poems, or repositories
 */

import { bookProjectService } from '../BookProjectService.js';
import { bookLayoutService } from '../BookLayoutService.js';
import { BookLayoutEngine } from '../BookLayoutEngine.js';
import { BookPdfGenerator } from './BookPdfGenerator.js';
import { BookEpubGenerator } from './BookEpubGenerator.js';

export class BookExportService {
  /**
   * @param {Object} [options={}]
   * @param {import('../BookProjectService.js').BookProjectService} [options.bookService]
   * @param {import('../BookLayoutService.js').BookLayoutService} [options.layoutService]
   */
  constructor(options = {}) {
    this._bookService = options.bookService || null;
    this._layoutService = options.layoutService || null;
  }

  get bookService() {
    return this._bookService || bookProjectService;
  }

  set bookService(service) {
    this._bookService = service;
  }

  get layoutService() {
    return this._layoutService || bookLayoutService;
  }

  set layoutService(service) {
    this._layoutService = service;
  }

  /**
   * Exports a book project to a PDF binary document
   * @param {string} bookId
   * @param {Object} [layoutConfigInput={}]
   * @returns {{ filename: string, mimeType: string, data: Uint8Array, size: number, pageCount: number, warnings: Array<string> }}
   */
  exportToPdf(bookId, layoutConfigInput = {}) {
    const bookDoc = this.bookService.generateBookDocument(bookId);
    const layoutDoc = BookLayoutEngine.generateLayout(bookDoc, layoutConfigInput);
    return BookPdfGenerator.generatePdf(layoutDoc);
  }

  /**
   * Exports a book project to an EPUB 3 binary archive
   * @param {string} bookId
   * @param {Object} [layoutConfigInput={}]
   * @returns {{ filename: string, mimeType: string, data: Uint8Array, size: number, sectionCount: number, poemCount: number, warnings: Array<string> }}
   */
  exportToEpub(bookId, layoutConfigInput = {}) {
    const bookDoc = this.bookService.generateBookDocument(bookId);
    return BookEpubGenerator.generateEpub(bookDoc, layoutConfigInput);
  }

  /**
   * Triggers a local browser download for the generated export buffer
   * In non-browser (Node.js/test) environments, returns file metadata safely without throwing
   * @param {string} filename
   * @param {Uint8Array} data
   * @param {string} mimeType
   * @returns {{ filename: string, mimeType: string, size: number, downloaded: boolean }}
   */
  downloadFile(filename, data, mimeType) {
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof Blob !== 'undefined';

    if (isBrowser) {
      const blob = new Blob([data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        window.URL.revokeObjectURL(url);
      }, 1000);

      return { filename, mimeType, size: data.length, downloaded: true };
    }

    return { filename, mimeType, size: data.length, downloaded: false };
  }

  /**
   * Generates and triggers local download of a PDF document
   * @param {string} bookId
   * @param {Object} [layoutConfigInput={}]
   * @returns {Object} Export result
   */
  downloadPdf(bookId, layoutConfigInput = {}) {
    const result = this.exportToPdf(bookId, layoutConfigInput);
    this.downloadFile(result.filename, result.data, result.mimeType);
    return result;
  }

  /**
   * Generates and triggers local download of an EPUB document
   * @param {string} bookId
   * @param {Object} [layoutConfigInput={}]
   * @returns {Object} Export result
   */
  downloadEpub(bookId, layoutConfigInput = {}) {
    const result = this.exportToEpub(bookId, layoutConfigInput);
    this.downloadFile(result.filename, result.data, result.mimeType);
    return result;
  }

  /**
   * Triggers browser-native print dialog with exact @page dimensions
   * @param {string} bookId
   * @param {Object} [layoutConfigInput={}]
   */
  printBook(bookId, layoutConfigInput = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    window.print();
    return true;
  }
}

export const bookExportService = new BookExportService();
