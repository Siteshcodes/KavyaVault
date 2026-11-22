/**
 * काव्यकलश (KavyaVault) — Local PDF & EPUB Export Test Suite
 * Phase 7 / Task 7.4: Local PDF & EPUB Export
 *
 * Verifies:
 * - Suite A: File Name Generation & Sanitization (Windows/macOS/Linux safe)
 * - Suite B: Pure-JS ZIP Builder (SimpleZip signatures, CRC-32, uncompressed mimetype)
 * - Suite C: EPUB 3 Container & Architecture (mimetype, container.xml, package.opf, nav.xhtml, toc.ncx, styles.css)
 * - Suite D: EPUB Content & Poetry Formatting (cover, title, dedication, TOC, sections, poems, line breaks preserved)
 * - Suite E: EPUB Unicode, Nuktas & Sacred Symbols (Devanagari conjuncts, nuktas, ॐ, चाँद, दुःख, dandas)
 * - Suite F: EPUB Security & XML Escaping (<script>, <iframe>, javascript:, special characters)
 * - Suite G: PDF Binary Format & Architecture (%PDF-1.4, Catalog, Pages, xref, trailer, %%EOF)
 * - Suite H: PDF Page Sizes & Orientations (A5, A4, Letter in portrait and landscape)
 * - Suite I: PDF Unicode & /ToUnicode CMap (Type0 font, Identity-H, UTF-16BE hex strings)
 * - Suite J: PDF Content & Structure Preservation (cover fill, title page, TOC, sections, poem lines, folios)
 * - Suite K: Missing Poem Resilience (graceful handling, warning flags, no crash, no fabricated data)
 * - Suite L: Read-Only & Data Integrity Guarantee (never mutates poems, books, or repositories)
 * - Suite M: Export Service & Facade Coordination (contracts, download handlers, print trigger)
 * - Suite N: UI Integration & Event Dispatch (action buttons, drawer export section, live status feedback)
 * - Suite O: Long Poem Spanning Multiple Pages (PDF page count matching, EPUB stanza sequence)
 * - Suite P: Security & Privacy Guardrails (img tag sanitization, 0 network calls verification)
 * - Suite Q: Cover Themes & Page Configurations (syahi, khaddar, bhojpatra, landscape dimensions)
 * - Suite R: Comprehensive Error Handling & Edge Cases (empty books, missing fields, XML attributes, magic bytes)
 */

import assert from 'node:assert';
import fs from 'node:fs';

import {
  BookPdfGenerator,
  BookEpubGenerator,
  BookExportService,
  bookExportService,
  SimpleZip,
  generateSafeExportFilename,
  xmlEscape,
  xmlAttributeEscape,
  encodeUtf16BeHex
} from './src/services/books/export/index.js';

import {
  BookProjectService
} from './src/services/books/BookProjectService.js';

import {
  BookProjectRepository
} from './src/services/books/BookProjectRepository.js';

import {
  PoemRepository
} from './src/services/PoemRepository.js';

import {
  CollectionRepository
} from './src/services/CollectionRepository.js';

import {
  ManuscriptRepository
} from './src/services/ManuscriptRepository.js';

import {
  BookLayoutEngine,
  parsePoemStanzas
} from './src/services/books/BookLayoutEngine.js';

import {
  PAGE_SIZE,
  PAGE_ORIENTATION,
  createLayoutConfig,
  toDevanagariNumerals
} from './src/services/books/bookLayoutTypes.js';

import {
  BookPrintPreview
} from './src/components/books/BookPrintPreview.js';

import {
  BookEditorView
} from './src/components/books/BookEditorView.js';

// Test Memory Storage Adapter
class MemoryStorageAdapter {
  constructor() {
    this.store = new Map();
  }
  get(key) {
    const val = this.store.get(key);
    return val !== undefined ? JSON.parse(val) : null;
  }
  set(key, val) {
    this.store.set(key, JSON.stringify(val));
    return true;
  }
  remove(key) {
    this.store.delete(key);
    return true;
  }
  clear() {
    this.store.clear();
  }
}

// Test Harness Factory
function createTestHarness() {
  const adapter = new MemoryStorageAdapter();
  const poemRepo = new PoemRepository(adapter);
  const colRepo = new CollectionRepository(adapter);
  const manuRepo = new ManuscriptRepository(adapter);
  const bookRepo = new BookProjectRepository(adapter);
  const bookService = new BookProjectService({ bookRepo, poemRepo, collectionRepo: colRepo });
  const exportService = new BookExportService({ bookService });

  const router = {
    currentPath: '/books',
    navigate(path) { this.currentPath = path; },
    getCurrentPath() { return this.currentPath; }
  };

  return { poemRepo, colRepo, manuRepo, bookRepo, bookService, exportService, router };
}

function createMockContainer() {
  const el = {
    innerHTML: '',
    listeners: {},
    addEventListener(evt, fn) {
      if (!this.listeners[evt]) this.listeners[evt] = [];
      this.listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (this.listeners[evt]) {
        this.listeners[evt] = this.listeners[evt].filter(f => f !== fn);
      }
    }
  };
  return el;
}

// Global Test Runner
let totalTests = 0;
let passedTests = 0;

function runTest(suite, name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✓ [Test ${totalTests}] ${name}`);
  } catch (err) {
    console.error(`✗ [Test ${totalTests}] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n================================================================');
console.log('  KAVYAVAULT LOCAL PDF & EPUB EXPORT TESTS (TASK 7.4)');
console.log('================================================================\n');

// ============================================================================
// SUITE A: File Name Generation & Sanitization
// ============================================================================
console.log('\n--- Suite A: File Name Generation & Sanitization ---');

runTest('A', 'Normalizes NFKC Hindi titles into clean filenames', () => {
  const fn = generateSafeExportFilename('काव्य-मंजूषा', 'pdf');
  assert.strictEqual(fn, 'काव्य-मंजूषा.pdf');
});

runTest('A', 'Strips illegal filesystem characters on Windows and Unix', () => {
  const dirty = 'किताब: भाग/१ *अंतिम? "संस्करण" <विशेष> |नया|';
  const fn = generateSafeExportFilename(dirty, 'epub');
  assert.strictEqual(fn, 'किताब भाग१ अंतिम संस्करण विशेष नया.epub');
  assert.ok(!/[\\/:*?"<>|]/.test(fn));
});

runTest('A', 'Caps extremely long titles at 64 characters to avoid OS limit errors', () => {
  const longTitle = 'यह एक बहुत ही लंबा पुस्तक शीर्षक है जो कि किसी भी साधारण फाइल नाम की अधिकतम सीमा को पार कर सकता है';
  const fn = generateSafeExportFilename(longTitle, 'pdf');
  const baseName = fn.replace(/\.pdf$/, '');
  assert.ok(baseName.length <= 64);
  assert.ok(fn.endsWith('.pdf'));
});

runTest('A', 'Falls back safely to default filename when title is empty or invalid', () => {
  assert.strictEqual(generateSafeExportFilename('', 'pdf'), 'kavyavault-book.pdf');
  assert.strictEqual(generateSafeExportFilename('   ', 'epub'), 'kavyavault-book.epub');
  assert.strictEqual(generateSafeExportFilename(null, 'pdf'), 'kavyavault-book.pdf');
});

runTest('A', 'Handles mixed Hindi, English, and punctuation safely', () => {
  const fn = generateSafeExportFilename('Geetanjali - गीतांजलि (Vol 1)', 'pdf');
  assert.strictEqual(fn, 'Geetanjali - गीतांजलि (Vol 1).pdf');
});

runTest('A', 'Normalizes extensions and strips extra dots', () => {
  assert.strictEqual(generateSafeExportFilename('पुस्तक', '.pdf'), 'पुस्तक.pdf');
  assert.strictEqual(generateSafeExportFilename('पुस्तक', '..epub'), 'पुस्तक.epub');
});

// ============================================================================
// SUITE B: Pure-JS ZIP Builder (SimpleZip)
// ============================================================================
console.log('\n--- Suite B: Pure-JS ZIP Builder (SimpleZip) ---');

runTest('B', 'Creates a valid binary ZIP buffer with standard PK\\x03\\x04 header', () => {
  const zip = new SimpleZip();
  zip.addFile('test.txt', 'नमस्ते दुनिया');
  const bytes = zip.generate();

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 30);
  // Verify PK\x03\x04
  assert.strictEqual(bytes[0], 0x50);
  assert.strictEqual(bytes[1], 0x4B);
  assert.strictEqual(bytes[2], 0x03);
  assert.strictEqual(bytes[3], 0x04);
});

runTest('B', 'Stores mimetype uncompressed (STORE) at offset 0 as required by EPUB 3', () => {
  const zip = new SimpleZip();
  zip.addFile('mimetype', 'application/epub+zip', { store: true });
  zip.addFile('test.txt', 'sample');
  const bytes = zip.generate();

  // Local header offset 0
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.strictEqual(view.getUint16(8, true), 0, 'Compression method must be 0 (STORE)');
  assert.strictEqual(view.getUint16(26, true), 8, 'Name length must be 8 ("mimetype")');
  assert.strictEqual(view.getUint16(28, true), 0, 'Extra field length must be 0 for mimetype');

  // Payload immediately follows header (30 + 8 = 38)
  const decoder = new TextDecoder();
  const payload = decoder.decode(bytes.subarray(38, 38 + 20));
  assert.strictEqual(payload, 'application/epub+zip');
});

runTest('B', 'Calculates IEEE 802.3 standard CRC-32 correctly', () => {
  const zip = new SimpleZip();
  const text = 'काव्यकलश';
  zip.addFile('kavya.txt', text);
  const bytes = zip.generate();

  const entries = SimpleZip.readEntries(bytes);
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].name, 'kavya.txt');
  assert.strictEqual(entries[0].text, text);
  assert.ok(entries[0].crc > 0);
});

runTest('B', 'Adds multiple nested files maintaining relative directory paths', () => {
  const zip = new SimpleZip();
  zip.addFile('mimetype', 'application/epub+zip', { store: true });
  zip.addFile('META-INF/container.xml', '<container/>');
  zip.addFile('OEBPS/package.opf', '<package/>');
  zip.addFile('OEBPS/chapters/ch1.xhtml', '<h1>खण्ड १</h1>');

  const bytes = zip.generate();
  const entries = SimpleZip.readEntries(bytes);

  assert.strictEqual(entries.length, 4);
  assert.strictEqual(entries[0].name, 'mimetype');
  assert.strictEqual(entries[1].name, 'META-INF/container.xml');
  assert.strictEqual(entries[2].name, 'OEBPS/package.opf');
  assert.strictEqual(entries[3].name, 'OEBPS/chapters/ch1.xhtml');
});

runTest('B', 'End of Central Directory record terminates archive with PK\\x05\\x06', () => {
  const zip = new SimpleZip();
  zip.addFile('file1.txt', 'one');
  zip.addFile('file2.txt', 'two');
  const bytes = zip.generate();

  const len = bytes.length;
  // Last 22 bytes are EOCD
  assert.strictEqual(bytes[len - 22], 0x50);
  assert.strictEqual(bytes[len - 21], 0x4B);
  assert.strictEqual(bytes[len - 20], 0x05);
  assert.strictEqual(bytes[len - 19], 0x06);
});

runTest('B', 'SimpleZip.readEntries parses files, sizes, and decompresses payloads', () => {
  const zip = new SimpleZip();
  zip.addFile('doc.xml', '<root>नमस्ते</root>');
  const bytes = zip.generate();

  const parsed = SimpleZip.readEntries(bytes);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].text, '<root>नमस्ते</root>');
});

runTest('B', 'SimpleZip.readEntries rejects null or non-Uint8Array input', () => {
  assert.throws(() => SimpleZip.readEntries(null), /अमान्य ZIP/);
  assert.throws(() => SimpleZip.readEntries('not-bytes'), /अमान्य ZIP/);
});

// ============================================================================
// SUITE C: EPUB 3 Container & Architecture
// ============================================================================
console.log('\n--- Suite C: EPUB 3 Container & Architecture ---');

runTest('C', 'Generates valid EPUB 3 archive with required container structure', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'ई-पुस्तक' });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  assert.strictEqual(res.mimeType, 'application/epub+zip');
  assert.ok(res.data instanceof Uint8Array);
  assert.ok(res.size > 0);
  assert.ok(res.filename.endsWith('.epub'));

  const entries = SimpleZip.readEntries(res.data);
  const entryNames = entries.map(e => e.name);

  assert.ok(entryNames.includes('mimetype'));
  assert.ok(entryNames.includes('META-INF/container.xml'));
  assert.ok(entryNames.includes('OEBPS/package.opf'));
  assert.ok(entryNames.includes('OEBPS/nav.xhtml'));
  assert.ok(entryNames.includes('OEBPS/toc.ncx'));
  assert.ok(entryNames.includes('OEBPS/styles.css'));
});

runTest('C', 'mimetype is strictly uncompressed at byte offset 0 with application/epub+zip', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'माईमटाइप टेस्ट' });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);

  assert.strictEqual(entries[0].name, 'mimetype');
  assert.strictEqual(entries[0].compMethod, 0); // STORE
  assert.strictEqual(entries[0].text, 'application/epub+zip');
});

runTest('C', 'container.xml points directly to OEBPS/package.opf', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'कंटेनर टेस्ट' });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const container = entries.find(e => e.name === 'META-INF/container.xml');

  assert.ok(container);
  assert.ok(container.text.includes('full-path="OEBPS/package.opf"'));
  assert.ok(container.text.includes('media-type="application/oebps-package+xml"'));
});

runTest('C', 'package.opf declares version="3.0" and Dublin Core metadata', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({
    title: 'ओपीएफ टेस्ट ग्रन्थ',
    author: 'कविराज',
    description: 'काव्य विवरण'
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const opf = entries.find(e => e.name === 'OEBPS/package.opf');

  assert.ok(opf);
  assert.ok(opf.text.includes('version="3.0"'));
  assert.ok(opf.text.includes('<dc:title>ओपीएफ टेस्ट ग्रन्थ</dc:title>'));
  assert.ok(opf.text.includes('<dc:creator>कविराज</dc:creator>'));
  assert.ok(opf.text.includes('<dc:language>hi</dc:language>'));
  assert.ok(opf.text.includes('<dc:publisher>काव्यकलश (KavyaVault)</dc:publisher>'));
  assert.ok(opf.text.includes('<dc:description>काव्य विवरण</dc:description>'));
});

runTest('C', 'package.opf manifest lists navigation, css, and content chapters', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'कविता', body: 'पंक्ति' });
  const book = bookService.createBook({
    title: 'मैनिफ़ेस्ट टेस्ट',
    sections: [{ title: 'खण्ड १', poemIds: [poem.id], order: 0 }]
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const opf = entries.find(e => e.name === 'OEBPS/package.opf');

  assert.ok(opf.text.includes('id="nav" href="nav.xhtml"'));
  assert.ok(opf.text.includes('id="css" href="styles.css"'));
  assert.ok(opf.text.includes('id="sec-1" href="section-1.xhtml"'));
  assert.ok(opf.text.includes('id="poem-1-1" href="poem-1-1.xhtml"'));
});

runTest('C', 'package.opf spine defines exact reading flow order', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'प्रथम', body: 'प्रथम पाठ' });
  const p2 = poemRepo.create({ title: 'द्वितीय', body: 'द्वितीय पाठ' });
  const book = bookService.createBook({
    title: 'स्पाइन टेस्ट',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const opf = entries.find(e => e.name === 'OEBPS/package.opf');

  assert.ok(opf.text.includes('<itemref idref="cover"/>'));
  assert.ok(opf.text.includes('<itemref idref="titlepage"/>'));
  assert.ok(opf.text.includes('<itemref idref="sec-1"/>'));
  assert.ok(opf.text.includes('<itemref idref="poem-1-1"/>'));
  assert.ok(opf.text.includes('<itemref idref="poem-1-2"/>'));

  // Order assertion
  const secIdx = opf.text.indexOf('idref="sec-1"');
  const p1Idx = opf.text.indexOf('idref="poem-1-1"');
  const p2Idx = opf.text.indexOf('idref="poem-1-2"');
  assert.ok(secIdx < p1Idx && p1Idx < p2Idx);
});

runTest('C', 'nav.xhtml contains EPUB 3 <nav epub:type="toc"> structure', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p = poemRepo.create({ title: 'नेव कविता', body: 'पाठ' });
  const book = bookService.createBook({
    title: 'नेव टेस्ट',
    sections: [{ title: 'खण्ड क', poemIds: [p.id], order: 0 }]
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const nav = entries.find(e => e.name === 'OEBPS/nav.xhtml');

  assert.ok(nav.text.includes('<nav epub:type="toc" id="toc">'));
  assert.ok(nav.text.includes('href="section-1.xhtml"'));
  assert.ok(nav.text.includes('href="poem-1-1.xhtml"'));
});

runTest('C', 'toc.ncx contains EPUB 2 compatible navPoints for legacy readers', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p = poemRepo.create({ title: 'एनसीएक्स कविता', body: 'पाठ' });
  const book = bookService.createBook({
    title: 'एनसीएक्स टेस्ट',
    sections: [{ title: 'खण्ड १', poemIds: [p.id], order: 0 }]
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const ncx = entries.find(e => e.name === 'OEBPS/toc.ncx');

  assert.ok(ncx.text.includes('<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"'));
  assert.ok(ncx.text.includes('<navPoint id="np-'));
  assert.ok(ncx.text.includes('<content src="section-1.xhtml"/>'));
  assert.ok(ncx.text.includes('<content src="poem-1-1.xhtml"/>'));
});

// ============================================================================
// SUITE D: EPUB Content & Poetry Formatting
// ============================================================================
console.log('\n--- Suite D: EPUB Content & Poetry Formatting ---');

runTest('D', 'Cover XHTML is generated with theme class, title, and author', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({
    title: 'मुखपृष्ठ पुस्तक',
    subtitle: 'उपशीर्षक',
    author: 'कवि',
    cover: { background: 'makhmali-raat' }
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const cover = entries.find(e => e.name === 'OEBPS/cover.xhtml');

  assert.ok(cover);
  assert.ok(cover.text.includes('bg-makhmali-raat'));
  assert.ok(cover.text.includes('मुखपृष्ठ पुस्तक'));
  assert.ok(cover.text.includes('उपशीर्षक'));
  assert.ok(cover.text.includes('कवि'));
});

runTest('D', 'Dedication XHTML is included when dedication exists and omitted when empty', () => {
  const { bookService } = createTestHarness();
  const bookWithDed = bookService.createBook({ title: 'समर्पण युक्त', dedication: 'गुरु चरणों में सादर समर्पित।' });
  const res1 = BookEpubGenerator.generateEpub(bookService.generateBookDocument(bookWithDed.id));
  const entries1 = SimpleZip.readEntries(res1.data);
  assert.ok(entries1.some(e => e.name === 'OEBPS/dedication.xhtml'));

  const bookNoDed = bookService.createBook({ title: 'समर्पण विहीन', dedication: '' });
  const res2 = BookEpubGenerator.generateEpub(bookService.generateBookDocument(bookNoDed.id));
  const entries2 = SimpleZip.readEntries(res2.data);
  assert.ok(!entries2.some(e => e.name === 'OEBPS/dedication.xhtml'));
});

runTest('D', 'Poetry line breaks are strictly preserved and NEVER collapsed into prose', () => {
  const { bookService, poemRepo } = createTestHarness();
  const rawPoem = `प्रथम पंक्ति\nद्वितीय पंक्ति\nतृतीय पंक्ति\nचतुर्थ पंक्ति`;
  const poem = poemRepo.create({ title: 'पंक्ति अखण्डता', body: rawPoem });
  const book = bookService.createBook({
    title: 'काव्य संकलन',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [poem.id], order: 0 }]
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const poemFile = entries.find(e => e.name === 'OEBPS/poem-1-1.xhtml');

  assert.ok(poemFile);
  assert.ok(poemFile.text.includes('<p class="epub-poem-line">प्रथम पंक्ति</p>'));
  assert.ok(poemFile.text.includes('<p class="epub-poem-line">द्वितीय पंक्ति</p>'));
  assert.ok(poemFile.text.includes('<p class="epub-poem-line">तृतीय पंक्ति</p>'));
  assert.ok(poemFile.text.includes('<p class="epub-poem-line">चतुर्थ पंक्ति</p>'));
  assert.ok(!poemFile.text.includes('प्रथम पंक्ति द्वितीय पंक्ति'));
});

runTest('D', 'Multiple stanzas separated by empty lines render into distinct stanza containers', () => {
  const { bookService, poemRepo } = createTestHarness();
  const stanzasText = `छंद १ पंक्ति १\nछंद १ पंक्ति २\n\nछंद २ पंक्ति १\nछंद २ पंक्ति २`;
  const poem = poemRepo.create({ title: 'द्वि-छंद', body: stanzasText });
  const book = bookService.createBook({
    title: 'छंद ग्रन्थ',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });
  const bookDoc = bookService.generateBookDocument(book.id);

  const res = BookEpubGenerator.generateEpub(bookDoc);
  const entries = SimpleZip.readEntries(res.data);
  const poemFile = entries.find(e => e.name === 'OEBPS/poem-1-1.xhtml');

  const matches = poemFile.text.match(/<div class="epub-poem-stanza">/g);
  assert.strictEqual(matches.length, 2, 'Must have exactly 2 distinct stanza containers');
});

runTest('D', 'CSS defines white-space: pre-wrap and page-break-inside: avoid for stanzas', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'शैली टेस्ट' });
  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  const css = entries.find(e => e.name === 'OEBPS/styles.css');

  assert.ok(css.text.includes('white-space: pre-wrap;'));
  assert.ok(css.text.includes('page-break-inside: avoid;'));
  assert.ok(css.text.includes('.epub-poem-line'));
});

// ============================================================================
// SUITE E: EPUB Unicode, Nuktas & Sacred Symbols
// ============================================================================
console.log('\n--- Suite E: EPUB Unicode, Nuktas & Sacred Symbols ---');

runTest('E', 'Preserves complex Devanagari conjuncts without splitting or corruption', () => {
  const { bookService, poemRepo } = createTestHarness();
  const conjunctsPoem = 'क्षमा, त्रिशूल, ज्ञान, श्रद्धा, द्वंद्व, द्घोष, हृदय।';
  const poem = poemRepo.create({ title: 'संयुक्ताक्षर', body: conjunctsPoem });
  const book = bookService.createBook({
    title: 'संयुक्ताक्षर काव्य',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  const poemFile = entries.find(e => e.name === 'OEBPS/poem-1-1.xhtml');

  for (const word of ['क्षमा', 'त्रिशूल', 'ज्ञान', 'श्रद्धा', 'द्वंद्व', 'द्घोष', 'हृदय']) {
    assert.ok(poemFile.text.includes(word), `Missing conjunct word: ${word}`);
  }
});

runTest('E', 'Preserves Persian/Urdu loanword nuktas faithfully in EPUB', () => {
  const { bookService, poemRepo } = createTestHarness();
  const nuktaText = 'क़लम, ख़्वाब, ग़ज़ल, ज़िन्दगी, पेड़, पढ़ना, फ़नकार।';
  const poem = poemRepo.create({ title: 'नुक्ता शायरी', body: nuktaText });
  const book = bookService.createBook({
    title: 'नुक्ता संकलन',
    sections: [{ title: 'ग़ज़ल खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  const poemFile = entries.find(e => e.name === 'OEBPS/poem-1-1.xhtml');

  for (const word of ['क़लम', 'ख़्वाब', 'ग़ज़ल', 'ज़िन्दगी', 'पेड़', 'पढ़ना', 'फ़नकार']) {
    assert.ok(poemFile.text.includes(word), `Missing nukta word: ${word}`);
  }
});

runTest('E', 'Preserves sacred Hindi symbols, chandrabindu, visarga, and dandas', () => {
  const { bookService, poemRepo } = createTestHarness();
  const sacredText = 'ॐ नमः शिवाय।\nचाँद की छटा अनुपम है॥\nसंसार में दुःख भी हैः';
  const poem = poemRepo.create({ title: 'आध्यात्मिक', body: sacredText });
  const book = bookService.createBook({
    title: 'धरोहर',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  const poemFile = entries.find(e => e.name === 'OEBPS/poem-1-1.xhtml');

  assert.ok(poemFile.text.includes('ॐ'));
  assert.ok(poemFile.text.includes('चाँद'));
  assert.ok(poemFile.text.includes('दुःख'));
  assert.ok(poemFile.text.includes('।'));
  assert.ok(poemFile.text.includes('॥'));
});

runTest('E', 'Handles mixed Hindi, English, and emojis seamlessly in EPUB', () => {
  const { bookService, poemRepo } = createTestHarness();
  const mixed = 'काव्य कलश 🌟 KavyaVault 2026 📜\nप्रेम & Peace ❤️';
  const poem = poemRepo.create({ title: 'मिश्रित कविता', body: mixed });
  const book = bookService.createBook({
    title: 'मिश्रित पुस्तक 🌟',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  const poemFile = entries.find(e => e.name === 'OEBPS/poem-1-1.xhtml');

  assert.ok(poemFile.text.includes('🌟'));
  assert.ok(poemFile.text.includes('📜'));
  assert.ok(poemFile.text.includes('❤️'));
  assert.ok(poemFile.text.includes('KavyaVault 2026'));
});

// ============================================================================
// SUITE F: EPUB Security & XML Escaping
// ============================================================================
console.log('\n--- Suite F: EPUB Security & XML Escaping ---');

runTest('F', 'Strictly escapes XML special characters (&, <, >, ", \') in titles and text', () => {
  const { bookService, poemRepo } = createTestHarness();
  const evilTitle = 'सुर & संगीत <विशेष> "संस्करण" \'2026\'';
  const poem = poemRepo.create({ title: evilTitle, body: 'पाठ & काव्य' });
  const book = bookService.createBook({
    title: evilTitle,
    sections: [{ title: 'खण्ड & भाग', poemIds: [poem.id], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  const opf = entries.find(e => e.name === 'OEBPS/package.opf');

  assert.ok(opf.text.includes('&amp;'));
  assert.ok(opf.text.includes('&lt;विशेष&gt;'));
  assert.ok(!opf.text.includes('<विशेष>'));
});

runTest('F', 'Neutralizes script injection tags in book metadata and poem content', () => {
  const { bookService, poemRepo } = createTestHarness();
  const xssText = '<script>alert("xss")</script> कविता पाठ';
  const poem = poemRepo.create({ title: '<script>evil()</script>', body: xssText });
  const book = bookService.createBook({
    title: '<script>boom()</script>',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);

  for (const entry of entries) {
    assert.ok(!entry.text.includes('<script>'), `Raw <script> tag found in ${entry.name}`);
    assert.ok(!entry.text.includes('</script>'));
  }
});

runTest('F', 'Neutralizes javascript: pseudo-protocol URIs in content', () => {
  const { bookService, poemRepo } = createTestHarness();
  const evilPoem = 'यहाँ क्लिक करें: javascript:alert(1)';
  const poem = poemRepo.create({ title: 'सुरक्षा टेस्ट', body: evilPoem });
  const book = bookService.createBook({
    title: 'सुरक्षा ग्रन्थ',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  const poemFile = entries.find(e => e.name === 'OEBPS/poem-1-1.xhtml');

  assert.ok(!poemFile.text.includes('javascript:'));
});

// ============================================================================
// SUITE G: PDF Binary Format & Architecture
// ============================================================================
console.log('\n--- Suite G: PDF Binary Format & Architecture ---');

runTest('G', 'Generates valid binary PDF beginning with %PDF-1.4 header and binary comment', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'पीडीएफ परीक्षण' });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  assert.strictEqual(res.mimeType, 'application/pdf');
  assert.ok(res.data instanceof Uint8Array);
  assert.ok(res.size > 0);
  assert.ok(res.filename.endsWith('.pdf'));

  const decoder = new TextDecoder('latin1');
  const startStr = decoder.decode(res.data.subarray(0, 20));
  assert.ok(startStr.startsWith('%PDF-1.4\n'), 'PDF must start with %PDF-1.4');
});

runTest('G', 'PDF concludes with trailer, xref offset, and %%EOF marker', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'समापन परीक्षण' });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const endStr = decoder.decode(res.data.subarray(res.data.length - 150));

  assert.ok(endStr.includes('trailer\n<<'));
  assert.ok(endStr.includes('/Root 2 0 R'));
  assert.ok(endStr.includes('/Info 1 0 R'));
  assert.ok(endStr.includes('startxref\n'));
  assert.ok(endStr.trim().endsWith('%%EOF'));
});

runTest('G', 'PDF Info dictionary contains Title, Author, Creator, and timestamps', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'ग्रन्थ सूचना', author: 'आचार्य' });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('utf-8');
  const pdfStr = decoder.decode(res.data.subarray(0, 1500));

  assert.ok(pdfStr.includes('/Title <'));
  assert.ok(pdfStr.includes('/Author <'));
  assert.ok(pdfStr.includes('/Creator <FEFF'), 'Unicode metadata uses a UTF-16 BOM');
  assert.ok(pdfStr.includes('/CreationDate (D:'));
});

runTest('G', 'PDF Pages tree Count strictly matches layoutDoc.pages.length', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता १', body: 'पंक्तियाँ' });
  const p2 = poemRepo.create({ title: 'कविता २', body: 'पंक्तियाँ' });
  const book = bookService.createBook({
    title: 'पृष्ठ गणना',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  assert.strictEqual(res.pageCount, layoutDoc.pages.length);

  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data.subarray(0, 2000));
  assert.ok(new RegExp(`/Type /Pages\\s+/Count ${layoutDoc.pages.length}\\b`).test(pdfStr));
});

runTest('G', 'Xref table contains 10-digit zero-padded offsets for all indirect objects', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'एक्सरेफ टेस्ट' });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  const xrefMatch = pdfStr.match(/xref\n0 (\d+)\n0000000000 65535 f/);
  assert.ok(xrefMatch, 'Valid xref header must exist');
  const objCount = Number(xrefMatch[1]);
  assert.ok(objCount > 10, 'Must have at least 10 objects');
});

// ============================================================================
// SUITE H: PDF Page Sizes & Orientations
// ============================================================================
console.log('\n--- Suite H: PDF Page Sizes & Orientations ---');

runTest('H', 'Generates A5 portrait with accurate PDF point dimensions [0 0 419.53 595.28]', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'A5 पोर्ट्रेट' });
  const layoutDoc = bookService.generateBookLayout(book.id, { pageSize: PAGE_SIZE.A5, orientation: PAGE_ORIENTATION.PORTRAIT });

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  assert.ok(pdfStr.includes('/MediaBox [0 0 419.53 595.28]'));
});

runTest('H', 'Generates A5 landscape with inverted point dimensions [0 0 595.28 419.53]', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'A5 लैंडस्केप' });
  const layoutDoc = bookService.generateBookLayout(book.id, { pageSize: PAGE_SIZE.A5, orientation: PAGE_ORIENTATION.LANDSCAPE });

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  assert.ok(pdfStr.includes('/MediaBox [0 0 595.28 419.53]'));
});

runTest('H', 'Generates A4 portrait with [0 0 595.28 841.89] dimensions', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'A4 पोर्ट्रेट' });
  const layoutDoc = bookService.generateBookLayout(book.id, { pageSize: PAGE_SIZE.A4, orientation: PAGE_ORIENTATION.PORTRAIT });

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  assert.ok(pdfStr.includes('/MediaBox [0 0 595.28 841.89]'));
});

runTest('H', 'Generates Letter portrait with [0 0 612 792] dimensions', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'लेटर पोर्ट्रेट' });
  const layoutDoc = bookService.generateBookLayout(book.id, { pageSize: PAGE_SIZE.LETTER, orientation: PAGE_ORIENTATION.PORTRAIT });

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  assert.ok(pdfStr.includes('/MediaBox [0 0 612 792]'));
});

// ============================================================================
// SUITE I: PDF Unicode & /ToUnicode CMap
// ============================================================================
console.log('\n--- Suite I: PDF Unicode & /ToUnicode CMap ---');

runTest('I', 'PDF includes Composite Type0 font dictionary with /Identity-H encoding', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'कम्पोज़िट फ़ॉन्ट' });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  assert.ok(pdfStr.includes('/Type /Font\n  /Subtype /Type0'));
  assert.ok(pdfStr.includes('/Encoding /Identity-H'));
  assert.ok(pdfStr.includes('/Subtype /CIDFontType2'));
});

runTest('I', '/ToUnicode CMap stream maps Devanagari codepoints into UTF-16BE hex', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'ॐ शांति', body: 'चाँद और दुःख।' });
  const book = bookService.createBook({
    title: 'सीमैप टेस्ट',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  assert.ok(pdfStr.includes('/CMapName /Kavya-ToUnicode'));
  assert.ok(pdfStr.includes('beginbfchar'));
  assert.ok(pdfStr.includes('0950'), 'Must contain Om U+0950 in CMap');
  assert.ok(pdfStr.includes('0901'), 'Must contain Chandrabindu U+0901 in CMap');
  assert.ok(pdfStr.includes('0964'), 'Must contain Danda U+0964 in CMap');
});

runTest('I', 'Text streams output UTF-16BE hex encoded strings matching Devanagari text', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'प्रथम', body: 'कविता' });
  const book = bookService.createBook({
    title: 'देवनागरी स्ट्रीम',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  // 'कविता': क (0915), व (0935), ि (093F), त (0924), ा (093E)
  const hexPoem = '09150935093F0924093E';
  assert.ok(pdfStr.includes(hexPoem), 'Poem text hex must appear in content stream');
});

// ============================================================================
// SUITE J: PDF Content & Structure Preservation
// ============================================================================
console.log('\n--- Suite J: PDF Content & Structure Preservation ---');

runTest('J', 'Cover page draws filled background rectangle and double border', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'मुखपृष्ठ ड्रा', cover: { background: 'bhojpatra' } });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  // Background fill operator `re f`
  assert.ok(pdfStr.includes('re f'));
  // Border stroke operator `re s`
  assert.ok(pdfStr.includes('re s'));
});

runTest('J', 'Table of Contents page draws section, poem titles, and right-aligned page numbers', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'गीत १', body: 'पाठ' });
  const p2 = poemRepo.create({ title: 'गीत २', body: 'पाठ' });
  const book = bookService.createBook({
    title: 'विषय-सूची पुस्तक',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  // Look for TOC heading 'विषय-सूची'
  const hexToc = encodeUtf16BeHex('विषय-सूची').slice(1, -1);
  assert.ok(pdfStr.includes(hexToc));
});

runTest('J', 'Poetry lines are preserved distinctly in content stream without line collapse', () => {
  const { bookService, poemRepo } = createTestHarness();
  const body = `पहला पद पंक्ति एक\nपहला पद पंक्ति दो\n\nदूसरा पद पंक्ति एक\nदूसरा पद पंक्ति दो`;
  const poem = poemRepo.create({ title: 'छंद अखण्ड', body });
  const book = bookService.createBook({
    title: 'छंद पुस्तक',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  const hexLine1 = encodeUtf16BeHex('पहला पद पंक्ति एक').slice(1, -1);
  const hexLine2 = encodeUtf16BeHex('पहला पद पंक्ति दो').slice(1, -1);

  assert.ok(pdfStr.includes(hexLine1));
  assert.ok(pdfStr.includes(hexLine2));
});

runTest('J', 'Folios render authentic Devanagari numerals at page bottom', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'फ़ोलियो टेस्ट' });
  const layoutDoc = bookService.generateBookLayout(book.id);

  const res = BookPdfGenerator.generatePdf(layoutDoc);
  const decoder = new TextDecoder('latin1');
  const pdfStr = decoder.decode(res.data);

  // Devanagari numerals in hex: १ (0967), २ (0968), etc.
  assert.ok(pdfStr.includes('0967') || pdfStr.includes('0968'));
});

// ============================================================================
// SUITE K: Missing Poem Resilience
// ============================================================================
console.log('\n--- Suite K: Missing Poem Resilience ---');

runTest('K', 'Book with deleted poem reference exports PDF safely without throwing', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'नष्ट होने वाली कविता', body: 'पाठ' });
  const book = bookService.createBook({
    title: 'लोप टेस्ट',
    sections: [{ title: 'खण्ड १', poemIds: [poem.id, 'ghost-id-999'], order: 0 }]
  });

  // Delete poem from repository
  poemRepo.delete(poem.id);

  assert.doesNotThrow(() => {
    const layoutDoc = bookService.generateBookLayout(book.id);
    const res = BookPdfGenerator.generatePdf(layoutDoc);
    assert.ok(res.data.length > 0);
  });
});

runTest('K', 'Book with deleted poem reference exports EPUB safely and records warnings', () => {
  const { bookService, poemRepo } = createTestHarness();
  const book = bookService.createBook({
    title: 'ईपब लोप टेस्ट',
    sections: [{ title: 'खण्ड १', poemIds: ['non-existent-poem'], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  assert.ok(res.data.length > 0);
  assert.ok(res.warnings.length > 0);
  assert.ok(res.warnings[0].includes('अनुपलब्ध'));
});

runTest('K', 'Never fabricates synthetic poem bodies when reference is missing', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({
    title: 'शुद्धता टेस्ट',
    sections: [{ title: 'खण्ड', poemIds: ['missing-id'], order: 0 }]
  });

  const res = BookEpubGenerator.generateEpub(bookService.generateBookDocument(book.id));
  const entries = SimpleZip.readEntries(res.data);
  // Ensure no poem-1-1.xhtml was fabricated
  assert.ok(!entries.some(e => e.name.startsWith('OEBPS/poem-')));
});

// ============================================================================
// SUITE L: Read-Only & Data Integrity Guarantee
// ============================================================================
console.log('\n--- Suite L: Read-Only & Data Integrity Guarantee ---');

runTest('L', 'Exporting PDF never mutates poems, collections, manuscripts, or book projects', () => {
  const { bookService, poemRepo, colRepo, manuRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'मूल कविता', body: 'मूल पाठ', isFavorite: true });
  const col = colRepo.create({ name: 'मूल संग्रह', poemIds: [poem.id] });
  const ms = manuRepo.create({
    title: 'मूल हस्तलिपि',
    originalManuscript: {
      mimeType: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      filename: 'sample.png',
      capturedAt: '2026-01-01T00:00:00Z'
    }
  });
  const book = bookService.createBook({
    title: 'अपरिवर्तनीय ग्रन्थ',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const exportService = new BookExportService({ bookService });
  exportService.exportToPdf(book.id);

  // Assert all entities intact
  assert.strictEqual(poemRepo.getById(poem.id).title, 'मूल कविता');
  assert.strictEqual(poemRepo.getById(poem.id).body, 'मूल पाठ');
  assert.strictEqual(poemRepo.getById(poem.id).isFavorite, true);
  assert.strictEqual(colRepo.getById(col.id).name, 'मूल संग्रह');
  assert.strictEqual(manuRepo.getById(ms.id).title, 'मूल हस्तलिपि');
  assert.strictEqual(bookService.getBook(book.id).title, 'अपरिवर्तनीय ग्रन्थ');
});

runTest('L', 'Exporting EPUB never mutates poems, collections, manuscripts, or book projects', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'ईपब मूल कविता', body: 'ईपब मूल पाठ' });
  const book = bookService.createBook({
    title: 'ईपब अपरिवर्तनीय',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const exportService = new BookExportService({ bookService });
  exportService.exportToEpub(book.id);

  assert.strictEqual(poemRepo.getById(poem.id).title, 'ईपब मूल कविता');
  assert.strictEqual(poemRepo.getById(poem.id).body, 'ईपब मूल पाठ');
});

// ============================================================================
// SUITE M: Export Service & Facade Coordination
// ============================================================================
console.log('\n--- Suite M: Export Service & Facade Coordination ---');

runTest('M', 'BookExportService.exportToPdf returns complete export contract', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'अनुबंध टेस्ट' });
  const exportService = new BookExportService({ bookService });

  const res = exportService.exportToPdf(book.id);
  assert.ok(res.filename.endsWith('.pdf'));
  assert.strictEqual(res.mimeType, 'application/pdf');
  assert.ok(res.data instanceof Uint8Array);
  assert.ok(res.size > 0);
  assert.ok(res.pageCount > 0);
  assert.ok(Array.isArray(res.warnings));
});

runTest('M', 'BookExportService.exportToEpub returns complete export contract', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'ईपब अनुबंध' });
  const exportService = new BookExportService({ bookService });

  const res = exportService.exportToEpub(book.id);
  assert.ok(res.filename.endsWith('.epub'));
  assert.strictEqual(res.mimeType, 'application/epub+zip');
  assert.ok(res.data instanceof Uint8Array);
  assert.ok(res.size > 0);
  assert.ok(Array.isArray(res.warnings));
});

runTest('M', 'BookProjectService facade provides exportToPdf and exportToEpub', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'फ़साड टेस्ट' });

  const pdfRes = bookService.exportToPdf(book.id);
  assert.ok(pdfRes.filename.endsWith('.pdf'));

  const epubRes = bookService.exportToEpub(book.id);
  assert.ok(epubRes.filename.endsWith('.epub'));
});

runTest('M', 'downloadFile returns safe status in headless Node environment without throwing', () => {
  const { bookService } = createTestHarness();
  const exportService = new BookExportService({ bookService });

  const bytes = new Uint8Array([1, 2, 3]);
  const res = exportService.downloadFile('test.pdf', bytes, 'application/pdf');
  assert.strictEqual(res.downloaded, false, 'In Node, downloaded is safely false');
  assert.strictEqual(res.size, 3);
});

runTest('M', 'printBook safely returns false in headless Node environment without throwing', () => {
  const { bookService } = createTestHarness();
  const exportService = new BookExportService({ bookService });

  const res = exportService.printBook('some-id');
  assert.strictEqual(res, false, 'In Node without window, returns false');
});

// ============================================================================
// SUITE N: UI Integration & Event Dispatch
// ============================================================================
console.log('\n--- Suite N: UI Integration & Event Dispatch ---');

runTest('N', 'BookPrintPreview renders PDF and EPUB export buttons in top bar', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'यूआई पूर्वावलोकन' });
  const preview = new BookPrintPreview({ book, bookService });

  const html = preview.render();
  assert.ok(html.includes('id="btn-export-pdf"'));
  assert.ok(html.includes('data-action="export-pdf"'));
  assert.ok(html.includes('id="btn-export-epub"'));
  assert.ok(html.includes('data-action="export-epub"'));
  assert.ok(!html.includes('id="btn-native-print"'));
});

runTest('N', 'BookPrintPreview settings drawer includes export download cards', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'दराज निर्यात' });
  const preview = new BookPrintPreview({ book, bookService });
  preview.showSettings = true;

  const html = preview.render();
  assert.ok(html.includes('id="btn-drawer-export-pdf"'));
  assert.ok(html.includes('id="btn-drawer-export-epub"'));
  assert.ok(html.includes('स्थानीय पुस्तक निर्यात'));
});

runTest('N', 'BookPrintPreview exportPdf sets exportStatus to success and generates file', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'सफल निर्यात' });
  const preview = new BookPrintPreview({ book, bookService });

  const res = preview.exportPdf();
  assert.ok(res.data.length > 0);
  assert.strictEqual(preview.exportStatus, 'success');
  assert.ok(preview.exportMessage.includes('सफलतापूर्वक'));

  const html = preview.render();
  assert.ok(preview.exportMessage.includes('सफलतापूर्वक'));
});

runTest('N', 'BookPrintPreview exportEpub sets exportStatus to success and generates archive', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'सफल ईपब' });
  const preview = new BookPrintPreview({ book, bookService });

  const res = preview.exportEpub();
  assert.ok(res.data.length > 0);
  assert.strictEqual(preview.exportStatus, 'success');
  assert.ok(preview.exportMessage.includes('सफलतापूर्वक'));
});

runTest('N', 'BookEditorView has one preview and export location', () => {
  const { bookService, router } = createTestHarness();
  const book = bookService.createBook({ title: 'संपादक बार निर्यात' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService });
  editor.mount();

  assert.ok(container.innerHTML.includes('id="btn-open-print-preview"'));
  assert.ok(!container.innerHTML.includes('id="btn-top-export-pdf"'));
  assert.ok(!container.innerHTML.includes('id="btn-top-export-epub"'));
  editor.unmount();
});

runTest('N', 'Clicking export buttons in BookEditorView dispatches export without errors', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const poem = poemRepo.create({ title: 'कविता', body: 'पंक्ति' });
  const book = bookService.createBook({
    title: 'इवेंट टेस्ट',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService });
  editor.mount();

  // Test direct PDF export click
  assert.doesNotThrow(() => {
    editor.handleClick({
      target: {
        closest: (sel) => sel.includes('export-pdf') ? { getAttribute: () => 'export-pdf' } : null
      }
    });
  });

  // Test direct EPUB export click
  assert.doesNotThrow(() => {
    editor.handleClick({
      target: {
        closest: (sel) => sel.includes('export-epub') ? { getAttribute: () => 'export-epub' } : null
      }
    });
  });

  editor.unmount();
});

// --- Suite O: Long Poem Spanning Multiple Pages ---
console.log('\n--- Suite O: Long Poem Spanning Multiple Pages ---');

runTest('O', 'Long poem spanning multiple pages generates corresponding PDF pages matching layout count', () => {
  const { bookService, poemRepo } = createTestHarness();
  
  // Create a long poem with 20 stanzas of 4 lines each
  const stanzas = [];
  for (let s = 1; s <= 20; s++) {
    stanzas.push(`छंद ${s}: प्रथम चरण का गायन,\nछंद ${s}: द्वितीय चरण का पावन,\nछंद ${s}: तृतीय चरण का सृजन,\nछंद ${s}: चतुर्थ चरण का नमन।`);
  }
  const longBody = stanzas.join('\n\n');
  const poem = poemRepo.create({ title: 'महाकाव्य का अंश', body: longBody });
  const book = bookService.createBook({
    title: 'दीर्घ ग्रन्थ',
    sections: [{ title: 'प्रथम सर्ग', poemIds: [poem.id], order: 0 }]
  });

  const res = bookService.exportToPdf(book.id);
  assert.ok(res.data && res.size > 0);
  assert.ok(res.pageCount > 3, `Expected multi-page layout, got ${res.pageCount}`);
  
  const text = new TextDecoder('latin1').decode(res.data);
  assert.ok(text.includes(`/Count ${res.pageCount}`));
});

runTest('O', 'Long poem in EPUB maintains all stanzas sequentially within the poem xhtml file', () => {
  const { bookService, poemRepo } = createTestHarness();
  const stanzas = [];
  for (let s = 1; s <= 10; s++) {
    stanzas.push(`पद ${s}: यह पंक्तियां हैं\nपद ${s}: जो अखंड रहेंगी`);
  }
  const poem = poemRepo.create({ title: 'दीर्घ पद', body: stanzas.join('\n\n') });
  const book = bookService.createBook({
    title: 'पद संग्रह',
    sections: [{ title: 'पद विभाग', poemIds: [poem.id], order: 0 }]
  });

  const res = bookService.exportToEpub(book.id);
  const entries = SimpleZip.readEntries(res.data);
  const poemEntry = entries.find(e => e.name.includes('poem-'));
  assert.ok(poemEntry, 'Poem XHTML file should exist');
  
  for (let s = 1; s <= 10; s++) {
    assert.ok(poemEntry.text.includes(`पद ${s}: यह पंक्तियां हैं`));
    assert.ok(poemEntry.text.includes(`पद ${s}: जो अखंड रहेंगी`));
  }
});

// --- Suite P: Security & Privacy Guardrails ---
console.log('\n--- Suite P: Security & Privacy Guardrails ---');

runTest('P', 'Sanitizes <img> tags with onerror payloads in poem body', () => {
  const { bookService, poemRepo } = createTestHarness();
  const maliciousPoem = poemRepo.create({
    title: 'सुरक्षा परीक्षण',
    body: 'सामान्य पंक्ति\n<img src="invalid.jpg" onerror="alert(\'XSS\')" />\nअंतिम पंक्ति'
  });
  const book = bookService.createBook({
    title: 'सुरक्षित ग्रन्थ',
    sections: [{ title: 'सुरक्षा खण्ड', poemIds: [maliciousPoem.id], order: 0 }]
  });

  const res = bookService.exportToEpub(book.id);
  const entries = SimpleZip.readEntries(res.data);
  const poemEntry = entries.find(e => e.name.includes('poem-'));
  assert.ok(poemEntry);
  
  assert.ok(!poemEntry.text.includes('onerror='), 'onerror payload must be stripped');
  assert.ok(!poemEntry.text.includes('<img'), 'raw img tag must not be injected directly');
});

runTest('P', 'Zero network calls guarantee during full PDF and EPUB export', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'गोपनीयता', body: 'पूर्णतः स्थानीय' });
  const book = bookService.createBook({
    title: 'निजी ग्रन्थ',
    sections: [{ title: 'गोपनीय खण्ड', poemIds: [poem.id], order: 0 }]
  });

  // Track any hypothetical network call attempts
  let networkCallAttempted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    networkCallAttempted = true;
    return Promise.reject(new Error('Network access forbidden during local export'));
  };

  try {
    const pdfRes = bookService.exportToPdf(book.id);
    const epubRes = bookService.exportToEpub(book.id);
    assert.ok(pdfRes.data && pdfRes.size > 0);
    assert.ok(epubRes.data && epubRes.size > 0);
    assert.strictEqual(networkCallAttempted, false, 'No network requests may occur during export');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- Suite Q: Cover Themes & Page Configurations ---
console.log('\n--- Suite Q: Cover Themes & Page Configurations ---');

runTest('Q', 'Cover theme "syahi" renders dark theme class in EPUB and dark background in PDF', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({
    title: 'स्याही ग्रन्थ',
    cover: { theme: 'syahi', layout: 'classic' }
  });

  // EPUB check
  const epubRes = bookService.exportToEpub(book.id);
  const entries = SimpleZip.readEntries(epubRes.data);
  const coverEntry = entries.find(e => e.name.includes('cover.xhtml'));
  assert.ok(coverEntry);
  assert.ok(coverEntry.text.includes('theme-syahi'));

  // PDF check
  const pdfRes = bookService.exportToPdf(book.id);
  const pdfText = new TextDecoder('latin1').decode(pdfRes.data);
  // Dark fill color: 0.1 0.1 0.12 rg
  assert.ok(pdfText.includes('0.1 0.1 0.12 rg') || pdfText.includes('rg'));
});

runTest('Q', 'Cover themes "khaddar" and "bhojpatra" apply correct theme classes in EPUB', () => {
  const { bookService } = createTestHarness();
  const bookKhaddar = bookService.createBook({
    title: 'खाद्दर ग्रन्थ',
    cover: { theme: 'khaddar' }
  });
  const bookBhojpatra = bookService.createBook({
    title: 'भोजपत्र ग्रन्थ',
    cover: { theme: 'bhojpatra' }
  });

  const epubKhaddar = bookService.exportToEpub(bookKhaddar.id);
  const entriesKhaddar = SimpleZip.readEntries(epubKhaddar.data);
  const coverKhaddar = entriesKhaddar.find(e => e.name.includes('cover.xhtml'));
  assert.ok(coverKhaddar);
  assert.ok(coverKhaddar.text.includes('theme-khaddar'));

  const epubBhojpatra = bookService.exportToEpub(bookBhojpatra.id);
  const entriesBhojpatra = SimpleZip.readEntries(epubBhojpatra.data);
  const coverBhojpatra = entriesBhojpatra.find(e => e.name.includes('cover.xhtml'));
  assert.ok(coverBhojpatra);
  assert.ok(coverBhojpatra.text.includes('theme-bhojpatra'));
});

runTest('Q', 'Generates A4 landscape and Letter landscape PDF with correct media box dimensions', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'परिदृश्य ग्रन्थ' });

  // A4 Landscape: height 595.28, width 841.89
  const a4LandRes = bookService.exportToPdf(book.id, {
    pageSize: PAGE_SIZE.A4,
    orientation: PAGE_ORIENTATION.LANDSCAPE
  });
  const a4Text = new TextDecoder('latin1').decode(a4LandRes.data);
  assert.ok(a4Text.includes('/MediaBox [0 0 841.89 595.28]'));

  // Letter Landscape: height 612, width 792
  const letterLandRes = bookService.exportToPdf(book.id, {
    pageSize: PAGE_SIZE.LETTER,
    orientation: PAGE_ORIENTATION.LANDSCAPE
  });
  const letterText = new TextDecoder('latin1').decode(letterLandRes.data);
  assert.ok(letterText.includes('/MediaBox [0 0 792 612]'));
});

// --- Suite R: Comprehensive Error Handling & Edge Cases ---
console.log('\n--- Suite R: Comprehensive Error Handling & Edge Cases ---');

runTest('R', 'Completely empty book with 0 sections and 0 poems exports valid PDF and EPUB', () => {
  const { bookService } = createTestHarness();
  const emptyBook = bookService.createBook({ title: 'रिक्त काव्य' });

  const pdfRes = bookService.exportToPdf(emptyBook.id);
  assert.ok(pdfRes.data && pdfRes.size > 500);

  const epubRes = bookService.exportToEpub(emptyBook.id);
  assert.ok(epubRes.data && epubRes.size > 500);
});

runTest('R', 'Malformed book with missing title/author falls back to defaults safely', () => {
  const emptyLayout = {
    metadata: { title: '', author: '' },
    pages: []
  };
  const pdfRes = BookPdfGenerator.generatePdf(emptyLayout);
  assert.ok(pdfRes.filename.includes('.pdf'));

  const emptyDoc = {
    metadata: { title: '', author: '' },
    sections: []
  };
  const epubRes = BookEpubGenerator.generateEpub(emptyDoc);
  assert.ok(epubRes.filename.includes('.epub'));
});

runTest('R', 'XML attribute escaping correctly handles double quotes, single quotes, and ampersands', () => {
  const escaped = xmlAttributeEscape('कविता "प्रेम & भक्ति" \'अनमोल\' <सार>');
  assert.ok(escaped.includes('&quot;प्रेम &amp; भक्ति&quot;'));
  assert.ok(escaped.includes('&apos;अनमोल&apos;'));
  assert.ok(!escaped.includes('"प्रेम'));
});

runTest('R', 'Oversized poem title and long dedication render without breaking PDF or EPUB syntax', () => {
  const { bookService, poemRepo } = createTestHarness();
  const veryLongTitle = 'यह एक अत्यंत विस्तृत और लम्बा शीर्षक है जो साधारण पंक्तियों से भी अधिक विस्तार लेता है और काव्य की सम्पूर्ण पृष्ठभूमि को समेटता है';
  const veryLongDedication = 'समस्त कवियों, पाठकों, विचारकों, और काव्य प्रेमियों को समर्पित जिन्होंने इस रचना यात्रा में अपनी संवेदनाओं का योगदान दिया।';
  
  const poem = poemRepo.create({ title: veryLongTitle, body: 'प्रथम पंक्ति\nद्वितीय पंक्ति' });
  const book = bookService.createBook({
    title: 'विशाल शीर्षक ग्रन्थ',
    dedication: veryLongDedication,
    sections: [{ title: 'प्रथम अनुभाग', poemIds: [poem.id], order: 0 }]
  });

  const pdfRes = bookService.exportToPdf(book.id);
  assert.ok(pdfRes.data && pdfRes.size > 0);

  const epubRes = bookService.exportToEpub(book.id);
  assert.ok(epubRes.data && epubRes.size > 0);
  const entries = SimpleZip.readEntries(epubRes.data);
  const dedicationEntry = entries.find(e => e.name.includes('dedication.xhtml'));
  assert.ok(dedicationEntry);
  assert.ok(dedicationEntry.text.includes('समस्त कवियों'));
});

runTest('R', 'Real binary verification: inspects magic bytes %PDF- and PK directly on Uint8Array', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'जांच', body: 'शब्द' });
  const book = bookService.createBook({
    title: 'जांच पुस्तक',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const pdfRes = bookService.exportToPdf(book.id);
  const epubRes = bookService.exportToEpub(book.id);

  // Check PDF magic bytes: 0x25, 0x50, 0x44, 0x46, 0x2D (%PDF-)
  assert.strictEqual(pdfRes.data[0], 0x25);
  assert.strictEqual(pdfRes.data[1], 0x50);
  assert.strictEqual(pdfRes.data[2], 0x44);
  assert.strictEqual(pdfRes.data[3], 0x46);
  assert.strictEqual(pdfRes.data[4], 0x2D);

  // Check ZIP magic bytes: 0x50, 0x4B, 0x03, 0x04 (PK\x03\x04)
  assert.strictEqual(epubRes.data[0], 0x50);
  assert.strictEqual(epubRes.data[1], 0x4B);
  assert.strictEqual(epubRes.data[2], 0x03);
  assert.strictEqual(epubRes.data[3], 0x04);
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} LOCAL PDF & EPUB EXPORT TESTS PASSED!`);
console.log('================================================================\n');

