import { BookLayoutEngine } from '../BookLayoutEngine.js';
import { BookPdfGenerator } from './BookPdfGenerator.js';
import { BookEpubGenerator } from './BookEpubGenerator.js';

self.onmessage = ({ data: { bookDocument, format, config } }) => {
  try {
    const result = format === 'pdf' ? BookPdfGenerator.generatePdf(BookLayoutEngine.generateLayout(bookDocument, config))
      : BookEpubGenerator.generateEpub(bookDocument, config);
    self.postMessage({ result }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ error: /[\u0900-\u097f]/u.test(error.message) ? error.message : 'पुस्तक निर्यात नहीं हो सका। सामग्री और आकार जाँचकर फिर प्रयास करें।' });
  }
};
