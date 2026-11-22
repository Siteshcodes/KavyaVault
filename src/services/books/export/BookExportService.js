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

  async generateAsync(bookId, format, config = {}, signal) {
    if (!['pdf', 'epub'].includes(format)) throw new Error('असमर्थित निर्यात प्रारूप।');
    if (signal?.aborted) throw new Error('निर्यात रद्द किया गया।');
    if (typeof Worker === 'undefined') return format === 'pdf' ? this.exportToPdf(bookId, config) : this.exportToEpub(bookId, config);
    const bookDocument = this.bookService.generateBookDocument(bookId);
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./exportWorker.js', import.meta.url), { type: 'module' });
      const finish = (error, result) => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate(); error ? reject(error) : resolve(result); };
      const cancel = () => finish(new Error('निर्यात रद्द किया गया।'));
      const timer = setTimeout(() => finish(new Error('निर्यात में बहुत समय लगा। छोटी पुस्तक से फिर प्रयास करें।')), 120000);
      signal?.addEventListener('abort', cancel, { once: true });
      worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
      worker.onerror = () => finish(new Error('निर्यात प्रक्रिया शुरू नहीं हो सकी। ऐप फिर खोलकर प्रयास करें।'));
      try { worker.postMessage({ bookDocument, format, config }); }
      catch { finish(new Error('निर्यात के लिए पुस्तक पढ़ी नहीं जा सकी।')); }
    });
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
