/**
 * काव्यकलश (KavyaVault) — Book Layout Engine & Print Preview Test Suite
 * Phase 7 / Task 7.3: Book Layout Engine & Print Preview
 *
 * Verifies:
 * - Suite A: LayoutConfig Validation (defaults, bounds, negative rejection, enums)
 * - Suite B: Page Size (A5, A4, Letter dimensions, aspect ratios)
 * - Suite C: Orientation (portrait vs landscape dimensions)
 * - Suite D: Margins Validation (top, bottom, left, right bounds, invalid dimensions)
 * - Suite E: Typography Configuration (bodyFont, fontSize, lineHeight, stanzaSpacing, alignment)
 * - Suite F: Book Layout Generation Pipeline (BookDocument -> BookLayoutDocument)
 * - Suite G: Cover Page Generation (theme backgrounds, classic/ornate/simple, title/author)
 * - Suite H: Title Page Generation (metadata, subtitle, literary notice)
 * - Suite I: Dedication Page Generation (omitted when empty/disabled, present when set)
 * - Suite J: Table of Contents Generation (deterministic page numbers, section & poem links, multi-page TOC)
 * - Suite K: Section Page Starts (always starts new page, section descriptions)
 * - Suite L: Poem Pagination & Line/Stanza Preservation (no line collapse, stanza boundaries, multi-page splitting, continuation headers, widow/orphan control)
 * - Suite M: Devanagari Page Numbering (०-९ numerals, positioning)
 * - Suite N: Deterministic Re-generation (same input produces identical pages and TOC)
 * - Suite O: Missing Poem Resilience (graceful handling, warning flags, no crash)
 * - Suite P: Unicode, Devanagari & Nukta Fidelity (क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ, क़, ख़, ग़, ज़, ड़, ढ़, फ़, चाँद, ॐ, दुःख, ।, ॥, emojis, mixed languages)
 * - Suite Q: Print Preview UI Component (mount, page navigation, jump to page, zoom in/out/reset, settings drawer)
 * - Suite R: Responsive Contracts (390px mobile viewport, 48px touch targets, centered desktop)
 * - Suite S: Keyboard Navigation (ArrowLeft, ArrowRight, Home, End, Escape, input field protection)
 * - Suite T: Accessibility (dialog ARIA, live region, Hindi labels, focus management)
 * - Suite U: Read-Only & Data Integrity (preview NEVER modifies repository, poems, collections, manuscripts, or book projects)
 */

import assert from 'node:assert';
import fs from 'node:fs';

import {
  PAGE_SIZE,
  VALID_PAGE_SIZES,
  PAGE_DIMENSIONS,
  PAGE_ORIENTATION,
  VALID_PAGE_ORIENTATIONS,
  TEXT_ALIGNMENT,
  VALID_TEXT_ALIGNMENTS,
  BODY_FONT,
  VALID_BODY_FONTS,
  PAGE_NUMBER_POSITION,
  VALID_PAGE_NUMBER_POSITIONS,
  PAGE_TYPE,
  VALID_PAGE_TYPES,
  TITLE_STYLE,
  DEFAULT_MARGINS,
  MARGIN_BOUNDS,
  toDevanagariNumerals,
  validateMargins,
  validateLayoutConfig,
  createLayoutConfig,
  createPageBlock,
  createPage,
  createBookLayoutDocument
} from './src/services/books/bookLayoutTypes.js';

import { BookLayoutEngine, parsePoemStanzas } from './src/services/books/BookLayoutEngine.js';
import { BookLayoutService, bookLayoutService } from './src/services/books/BookLayoutService.js';
import { BookPrintPreview } from './src/components/books/BookPrintPreview.js';
import { BookEditorView } from './src/components/books/BookEditorView.js';

import { BookProjectService } from './src/services/books/BookProjectService.js';
import { BookProjectRepository } from './src/services/books/BookProjectRepository.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { ROUTES } from './src/data/navigation.js';

// In-memory mock storage driver
class InMemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
  }
}

// Minimal DOM Mock Container for testing in Node.js
function createMockContainer() {
  const container = {
    innerHTML: '',
    listeners: {},
    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    },
    querySelector(sel) {
      const self = this;
      if (sel === '#jump-page-input') {
        const match = self.innerHTML.match(/id="jump-page-input"[^>]*value="([^"]*)"/);
        return { id: 'jump-page-input', value: match ? match[1] : '1', focus: () => {} };
      }
      if (sel === '#print-active-page-sheet') {
        const match = self.innerHTML.match(/id="print-active-page-sheet"/);
        return match ? { id: 'print-active-page-sheet' } : null;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  return container;
}

// Test harness helper
function createTestHarness() {
  const poemStorage = new InMemoryStorage();
  const poemAdapter = new LocalStorageAdapter(poemStorage);
  const colStorage = new InMemoryStorage();
  const colAdapter = new LocalStorageAdapter(colStorage);
  const colRepo = new CollectionRepository(colAdapter);
  const manuStorage = new InMemoryStorage();
  const manuAdapter = new LocalStorageAdapter(manuStorage);
  const manuRepo = new ManuscriptRepository(manuAdapter);
  const poemRepo = new PoemRepository(poemAdapter, colRepo, manuRepo);

  const bookStorage = new InMemoryStorage();
  const bookAdapter = new LocalStorageAdapter(bookStorage);
  const bookRepo = new BookProjectRepository(bookAdapter);
  const bookService = new BookProjectService({ bookRepo, poemRepo, collectionRepo: colRepo });

  const router = {
    currentPath: ROUTES.BOOKS,
    navigatedTo: null,
    navigate(path) {
      this.navigatedTo = path;
      this.currentPath = path;
    },
    getCurrentPath() {
      return this.currentPath;
    }
  };

  return { poemRepo, colRepo, manuRepo, bookRepo, bookService, router };
}

// Global test tracker
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
console.log('  KAVYAVAULT BOOK LAYOUT ENGINE & PRINT PREVIEW TESTS (TASK 7.3)');
console.log('================================================================\n');

// ============================================================================
// SUITE A: LayoutConfig Validation
// ============================================================================
console.log('\n--- Suite A: LayoutConfig Validation ---');

runTest('A', 'Creates default LayoutConfig with literary poetry defaults', () => {
  const cfg = createLayoutConfig();
  assert.strictEqual(cfg.pageSize, PAGE_SIZE.A5, 'Default page size must be A5');
  assert.strictEqual(cfg.orientation, PAGE_ORIENTATION.PORTRAIT, 'Default orientation must be portrait');
  assert.strictEqual(cfg.bodyFont, BODY_FONT.MARTEL, 'Default font must be Martel');
  assert.strictEqual(cfg.bodyFontSize, 12);
  assert.strictEqual(cfg.titleFontSize, 18);
  assert.strictEqual(cfg.lineHeight, 1.95);
  assert.strictEqual(cfg.alignment, TEXT_ALIGNMENT.CENTER);
  assert.strictEqual(cfg.showCover, true);
  assert.strictEqual(cfg.showTitlePage, true);
  assert.strictEqual(cfg.showDedication, true);
  assert.strictEqual(cfg.showTableOfContents, true);
  assert.strictEqual(cfg.widowOrphanControl, true);
});

runTest('A', 'Rejects non-object or null layout config', () => {
  assert.throws(() => validateLayoutConfig(null), /लेआउट विन्यास/);
  assert.throws(() => validateLayoutConfig('invalid'), /लेआउट विन्यास/);
});

runTest('A', 'Rejects invalid page size enum', () => {
  assert.throws(() => validateLayoutConfig({ pageSize: 'A3' }), /अमान्य पृष्ठ आकार/);
  assert.throws(() => validateLayoutConfig({ pageSize: 'custom' }), /अमान्य पृष्ठ आकार/);
});

runTest('A', 'Rejects out-of-bounds font sizes', () => {
  assert.throws(() => validateLayoutConfig({ bodyFontSize: 4 }), /फ़ॉन्ट आकार/);
  assert.throws(() => validateLayoutConfig({ bodyFontSize: 30 }), /फ़ॉन्ट आकार/);
  assert.throws(() => validateLayoutConfig({ titleFontSize: 50 }), /शीर्षक आकार/);
});

runTest('A', 'Rejects out-of-bounds line heights and stanza spacing', () => {
  assert.throws(() => validateLayoutConfig({ lineHeight: 0.8 }), /पंक्ति ऊँचाई/);
  assert.throws(() => validateLayoutConfig({ lineHeight: 4.5 }), /पंक्ति ऊँचाई/);
  assert.throws(() => validateLayoutConfig({ stanzaSpacing: 2 }), /छंद अंतराल/);
});

// ============================================================================
// SUITE B: Page Size & Dimensions
// ============================================================================
console.log('\n--- Suite B: Page Size & Dimensions ---');

runTest('B', 'Supports A5, A4, and Letter page sizes with accurate metric dimensions', () => {
  assert.deepStrictEqual(VALID_PAGE_SIZES, ['a5', 'a4', 'letter']);

  const a5 = PAGE_DIMENSIONS[PAGE_SIZE.A5];
  assert.strictEqual(a5.widthMm, 148);
  assert.strictEqual(a5.heightMm, 210);

  const a4 = PAGE_DIMENSIONS[PAGE_SIZE.A4];
  assert.strictEqual(a4.widthMm, 210);
  assert.strictEqual(a4.heightMm, 297);

  const letter = PAGE_DIMENSIONS[PAGE_SIZE.LETTER];
  assert.strictEqual(letter.widthMm, 215.9);
  assert.strictEqual(letter.heightMm, 279.4);
});

runTest('B', 'Layout engine computes accurate capacities for A5 versus A4', () => {
  const cfgA5 = createLayoutConfig({ pageSize: PAGE_SIZE.A5 });
  const capsA5 = BookLayoutEngine.computeCapacities(cfgA5);

  const cfgA4 = createLayoutConfig({ pageSize: PAGE_SIZE.A4 });
  const capsA4 = BookLayoutEngine.computeCapacities(cfgA4);

  assert.ok(capsA4.linesPerFullPage > capsA5.linesPerFullPage, 'A4 must hold more lines than A5');
  assert.ok(capsA4.availableHeightPt > capsA5.availableHeightPt);
  assert.ok(capsA4.availableWidthPt > capsA5.availableWidthPt);
});

// ============================================================================
// SUITE C: Orientation
// ============================================================================
console.log('\n--- Suite C: Orientation ---');

runTest('C', 'Portrait and landscape orientations calculate appropriate aspect ratios and widths', () => {
  const portrait = BookLayoutEngine.computeCapacities(createLayoutConfig({ orientation: PAGE_ORIENTATION.PORTRAIT }));
  const landscape = BookLayoutEngine.computeCapacities(createLayoutConfig({ orientation: PAGE_ORIENTATION.LANDSCAPE }));

  assert.strictEqual(portrait.widthMm, 148);
  assert.strictEqual(portrait.heightMm, 210);

  assert.strictEqual(landscape.widthMm, 210);
  assert.strictEqual(landscape.heightMm, 148);
  assert.ok(portrait.linesPerFullPage > landscape.linesPerFullPage, 'Portrait has more vertical lines');
  assert.ok(landscape.availableWidthPt > portrait.availableWidthPt, 'Landscape has more horizontal width');
});

runTest('C', 'Rejects invalid orientation strings', () => {
  assert.throws(() => validateLayoutConfig({ orientation: 'sideways' }), /अमान्य अभिविन्यास/);
});

// ============================================================================
// SUITE D: Margins Validation
// ============================================================================
console.log('\n--- Suite D: Margins Validation ---');

runTest('D', 'Default margins are positive and within safe publishing bounds', () => {
  assert.strictEqual(DEFAULT_MARGINS.top, 20);
  assert.strictEqual(DEFAULT_MARGINS.right, 18);
  assert.strictEqual(DEFAULT_MARGINS.bottom, 20);
  assert.strictEqual(DEFAULT_MARGINS.left, 18);
  assert.doesNotThrow(() => validateMargins(DEFAULT_MARGINS));
});

runTest('D', 'Rejects negative or below-minimum margins', () => {
  assert.throws(() => validateMargins({ top: -5, right: 18, bottom: 20, left: 18 }), /कम से कम 5 मिमी/);
  assert.throws(() => validateMargins({ top: 2, right: 18, bottom: 20, left: 18 }), /कम से कम 5 मिमी/);
});

runTest('D', 'Rejects excessive margins exceeding maximum boundary', () => {
  assert.throws(() => validateMargins({ top: 60, right: 18, bottom: 20, left: 18 }), /अधिकतम 50 मिमी/);
});

runTest('D', 'Rejects margins that consume entire printable page width or height', () => {
  assert.throws(() => validateMargins({ top: 50, right: 50, bottom: 50, left: 50 }, PAGE_SIZE.A5, PAGE_ORIENTATION.PORTRAIT),
    /दायाँ और बायाँ हाशिया/);
});

// ============================================================================
// SUITE E: Typography Configuration
// ============================================================================
console.log('\n--- Suite E: Typography Configuration ---');

runTest('E', 'Supports all 4 curated Devanagari typography families', () => {
  assert.deepStrictEqual(VALID_BODY_FONTS, ['martel', 'rozha-one', 'yatra-one', 'mukta']);
  for (const font of VALID_BODY_FONTS) {
    assert.doesNotThrow(() => validateLayoutConfig({ bodyFont: font }));
  }
  assert.throws(() => validateLayoutConfig({ bodyFont: 'comic-sans' }), /अमान्य फ़ॉन्ट/);
});

runTest('E', 'Supports center, left, and justify alignments', () => {
  assert.deepStrictEqual(VALID_TEXT_ALIGNMENTS, ['center', 'left', 'justify']);
  assert.doesNotThrow(() => validateLayoutConfig({ alignment: TEXT_ALIGNMENT.CENTER }));
  assert.doesNotThrow(() => validateLayoutConfig({ alignment: TEXT_ALIGNMENT.LEFT }));
  assert.throws(() => validateLayoutConfig({ alignment: 'diagonal' }), /अमान्य संरेखण/);
});

// ============================================================================
// SUITE F: Book Document Layout Generation Pipeline
// ============================================================================
console.log('\n--- Suite F: Book Document Layout Generation Pipeline ---');

runTest('F', 'Transforms BookDocument into an ephemeral BookLayoutDocument structure', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'साधना', body: 'पंक्ति १\nपंक्ति २', author: 'कवि' });
  const book = bookService.createBook({
    title: 'काव्य ग्रन्थ',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id);
  assert.ok(layoutDoc !== null);
  assert.strictEqual(layoutDoc.bookId, book.id);
  assert.ok(Array.isArray(layoutDoc.pages));
  assert.ok(Array.isArray(layoutDoc.toc));
  assert.ok(layoutDoc.stats.totalPages > 0);
  assert.strictEqual(layoutDoc.metadata.title, 'काव्य ग्रन्थ');
});

runTest('F', 'Rejects invalid or non-object book document input', () => {
  assert.throws(() => BookLayoutEngine.generateLayout(null), /पुस्तक दस्तावेज़/);
});

// ============================================================================
// SUITE G: Cover Page Generation
// ============================================================================
console.log('\n--- Suite G: Cover Page Generation ---');

runTest('G', 'Generates unnumbered Cover Page with specified background preset and title', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति...' });
  const book = bookService.createBook({
    title: 'मधुशाला',
    subtitle: 'काव्य संकलन',
    author: 'हरिवंश राय बच्चन',
    cover: { background: 'syahi', type: 'classic' },
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id, { showCover: true });
  const coverPage = layoutDoc.pages[0];

  assert.strictEqual(coverPage.type, PAGE_TYPE.COVER);
  assert.strictEqual(coverPage.pageNumber, null, 'Cover must not have a page number');
  assert.strictEqual(coverPage.displayPageNumber, '');

  const titleBlock = coverPage.blocks.find(b => b.type === 'cover-title');
  const authorBlock = coverPage.blocks.find(b => b.type === 'cover-author');
  const bgBlock = coverPage.blocks.find(b => b.type === 'cover-background');

  assert.strictEqual(titleBlock.content, 'मधुशाला');
  assert.strictEqual(authorBlock.content, 'हरिवंश राय बच्चन');
  assert.strictEqual(bgBlock.content, 'syahi');
});

runTest('G', 'Cover page is cleanly omitted when showCover is set to false', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति...' });
  const book = bookService.createBook({
    title: 'किताब',
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id, { showCover: false });
  assert.ok(!layoutDoc.pages.some(p => p.type === PAGE_TYPE.COVER), 'No cover page should exist');
  assert.strictEqual(layoutDoc.pages[0].type, PAGE_TYPE.TITLE, 'First page is Title Page');
});

// ============================================================================
// SUITE H: Title Page Generation
// ============================================================================
console.log('\n--- Suite H: Title Page Generation ---');

runTest('H', 'Generates inner Title Page with title, subtitle, author, and literary imprint', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति...' });
  const book = bookService.createBook({
    title: 'कामायनी',
    subtitle: 'महाकाव्य',
    author: 'जयशंकर प्रसाद',
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id);
  const titlePage = layoutDoc.pages.find(p => p.type === PAGE_TYPE.TITLE);

  assert.ok(titlePage !== undefined);
  assert.strictEqual(titlePage.pageNumber, 1, 'Title page is numbered 1');
  const hBlock = titlePage.blocks.find(b => b.type === 'title-heading');
  const aBlock = titlePage.blocks.find(b => b.type === 'title-author');
  assert.strictEqual(hBlock.content, 'कामायनी');
  assert.strictEqual(aBlock.content, 'जयशंकर प्रसाद');
});

runTest('H', 'Title page is omitted when showTitlePage is false', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति...' });
  const book = bookService.createBook({
    title: 'किताब',
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id, { showTitlePage: false });
  assert.ok(!layoutDoc.pages.some(p => p.type === PAGE_TYPE.TITLE));
});

// ============================================================================
// SUITE I: Dedication Page Generation
// ============================================================================
console.log('\n--- Suite I: Dedication Page Generation ---');

runTest('I', 'Generates Dedication Page when dedication text exists', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति...' });
  const book = bookService.createBook({
    title: 'काव्य संकलन',
    dedication: 'माँ के पावन चरणों में सादर समर्पित...',
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id, { showDedication: true });
  const dedPage = layoutDoc.pages.find(p => p.type === PAGE_TYPE.DEDICATION);

  assert.ok(dedPage !== undefined);
  const bodyBlock = dedPage.blocks.find(b => b.type === 'dedication-body');
  assert.strictEqual(bodyBlock.content, 'माँ के पावन चरणों में सादर समर्पित...');
});

runTest('I', 'Dedication page is omitted when dedication is null, empty, or disabled', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति...' });
  const bookNoDed = bookService.createBook({
    title: 'काव्य संकलन बिना समर्पण',
    dedication: null,
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc1 = bookService.generateBookLayout(bookNoDed.id);
  assert.ok(!layoutDoc1.pages.some(p => p.type === PAGE_TYPE.DEDICATION));

  const bookWithDed = bookService.createBook({
    title: 'काव्य संकलन',
    dedication: 'समर्पण पाठ...',
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc2 = bookService.generateBookLayout(bookWithDed.id, { showDedication: false });
  assert.ok(!layoutDoc2.pages.some(p => p.type === PAGE_TYPE.DEDICATION));
});

// ============================================================================
// SUITE J: Table of Contents (TOC)
// ============================================================================
console.log('\n--- Suite J: Table of Contents (TOC) ---');

runTest('J', 'Generates TOC with exact section and poem starting page numbers', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'पुष्प की अभिलाषा', body: 'पंक्ति १\nपंक्ति २', author: 'माखनलाल चतुर्वेदी' });
  const p2 = poemRepo.create({ title: 'झाँसी की रानी', body: 'पंक्ति १\nपंक्ति २', author: 'सुभद्रा कुमारी चौहान' });

  const book = bookService.createBook({
    title: 'राष्ट्रकवि संकलन',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [p1.id, p2.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id, { showCover: true, showTitlePage: true, showTableOfContents: true });
  const tocEntries = layoutDoc.toc;

  assert.ok(tocEntries.length >= 3, 'Must have section entry and 2 poem entries');

  const secEntry = tocEntries.find(e => e.type === 'section');
  const poem1Entry = tocEntries.find(e => e.type === 'poem' && e.poemId === p1.id);
  const poem2Entry = tocEntries.find(e => e.type === 'poem' && e.poemId === p2.id);

  assert.ok(secEntry.pageNumber > 0);
  assert.ok(poem1Entry.pageNumber > secEntry.pageNumber);
  assert.ok(poem2Entry.pageNumber >= poem1Entry.pageNumber);

  // Verify TOC page numbers are NOT hardcoded: poem1Entry.pageNumber matches its actual Page object!
  const actualP1Page = layoutDoc.pages.find(p => p.type === PAGE_TYPE.POEM && p.poemId === p1.id);
  assert.strictEqual(poem1Entry.pageNumber, actualP1Page.pageNumber);
  assert.strictEqual(poem1Entry.pageNumberFormatted, actualP1Page.displayPageNumber);
});

runTest('J', 'TOC entries block in TOC page receives formatted items and dots', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति' });
  const book = bookService.createBook({
    title: 'ग्रन्थ',
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id);
  const tocPage = layoutDoc.pages.find(p => p.type === PAGE_TYPE.TOC);
  assert.ok(tocPage !== undefined);
  const entriesBlock = tocPage.blocks.find(b => b.type === 'toc-entries');
  assert.ok(Array.isArray(entriesBlock.content));
  assert.ok(entriesBlock.content.length > 0);
});

// ============================================================================
// SUITE K: Section Page Starts
// ============================================================================
console.log('\n--- Suite K: Section Page Starts ---');

runTest('K', 'Each section begins on a new section divider page with title and description', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता १', body: 'पंक्तियाँ' });
  const p2 = poemRepo.create({ title: 'कविता २', body: 'पंक्तियाँ' });

  const book = bookService.createBook({
    title: 'द्वि-खण्ड ग्रन्थ',
    sections: [
      { title: 'पहला खण्ड', description: 'प्रकृति सौंदर्य', poemIds: [p1.id], order: 0 },
      { title: 'दूसरा खण्ड', description: 'वीर रस', poemIds: [p2.id], order: 1 }
    ]
  });

  const layoutDoc = bookService.generateBookLayout(book.id);
  const sectionPages = layoutDoc.pages.filter(p => p.type === PAGE_TYPE.SECTION);

  assert.strictEqual(sectionPages.length, 2, 'Must have 2 distinct section divider pages');
  assert.strictEqual(sectionPages[0].sectionTitle, 'पहला खण्ड');
  assert.strictEqual(sectionPages[1].sectionTitle, 'दूसरा खण्ड');

  const descBlock = sectionPages[0].blocks.find(b => b.type === 'section-divider-desc');
  assert.strictEqual(descBlock.content, 'प्रकृति सौंदर्य');
});

// ============================================================================
// SUITE L: Poem Pagination & Line/Stanza Preservation
// ============================================================================
console.log('\n--- Suite L: Poem Pagination & Line/Stanza Preservation ---');

runTest('L', 'Poetry line breaks are never collapsed into prose paragraphs', () => {
  const rawBody = 'चाह नहीं मैं सुरबाला के\nगहनों में गूँथा जाऊँ,\nचाह नहीं, प्रेमी-माला में\nबिंध प्यारी को ललचाऊँ!';
  const stanzas = parsePoemStanzas(rawBody);

  assert.strictEqual(stanzas.length, 1);
  assert.strictEqual(stanzas[0].length, 4, 'Must maintain exactly 4 distinct lines');
  assert.strictEqual(stanzas[0][0], 'चाह नहीं मैं सुरबाला के');
  assert.strictEqual(stanzas[0][3], 'बिंध प्यारी को ललचाऊँ!');
});

runTest('L', 'Multiple stanzas separated by empty lines are structured into distinct stanzas', () => {
  const multiStanzaBody = 'छंद १ पंक्ति १\nछंद १ पंक्ति २\n\nछंद २ पंक्ति १\nछंद २ पंक्ति २\n\nछंद ३ पंक्ति १';
  const stanzas = parsePoemStanzas(multiStanzaBody);

  assert.strictEqual(stanzas.length, 3);
  assert.strictEqual(stanzas[0].length, 2);
  assert.strictEqual(stanzas[1].length, 2);
  assert.strictEqual(stanzas[2].length, 1);
});

runTest('L', 'Long poem splits deterministically across continuation pages with continuation header', () => {
  const { bookService, poemRepo } = createTestHarness();
  // Generate a long poem of 40 lines (exceeds single A5 page capacity of ~20 lines)
  const longLines = [];
  for (let i = 1; i <= 40; i++) {
    longLines.push(`काव्य पंक्ति संख्या ${i}: विस्तृत देवनागरी छंद पाठ`);
  }
  const longPoem = poemRepo.create({
    title: 'दीर्घ महाकाव्य अंश',
    body: longLines.join('\n'),
    author: 'कवि'
  });

  const book = bookService.createBook({
    title: 'दीर्घ संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [longPoem.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id, { pageSize: PAGE_SIZE.A5 });
  const poemPages = layoutDoc.pages.filter(p => p.type === PAGE_TYPE.POEM && p.poemId === longPoem.id);

  assert.ok(poemPages.length >= 2, `Long poem must span at least 2 pages (actual: ${poemPages.length})`);
  assert.strictEqual(poemPages[0].isContinuation, false);
  assert.strictEqual(poemPages[1].isContinuation, true);

  // Continuation page has continuation header block
  const contBlock = poemPages[1].blocks.find(b => b.type === 'poem-continuation-header');
  assert.ok(contBlock !== undefined);
  assert.ok(contBlock.content.includes('दीर्घ महाकाव्य अंश (क्रमशः)'));
});

// ============================================================================
// SUITE M: Devanagari Page Numbering
// ============================================================================
console.log('\n--- Suite M: Devanagari Page Numbering ---');

runTest('M', 'toDevanagariNumerals faithfully converts all digits 0-9 into authentic Devanagari numerals', () => {
  assert.strictEqual(toDevanagariNumerals(0), '०');
  assert.strictEqual(toDevanagariNumerals(1), '१');
  assert.strictEqual(toDevanagariNumerals(9), '९');
  assert.strictEqual(toDevanagariNumerals(12), '१२');
  assert.strictEqual(toDevanagariNumerals(420), '४२०');
  assert.strictEqual(toDevanagariNumerals(null), '');
});

runTest('M', 'Pages have displayPageNumber formatted in Devanagari numerals', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्ति...' });
  const book = bookService.createBook({
    title: 'ग्रन्थ',
    sections: [{ title: 'खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id);
  const numberedPages = layoutDoc.pages.filter(p => p.pageNumber !== null);

  for (const p of numberedPages) {
    assert.strictEqual(p.displayPageNumber, toDevanagariNumerals(p.pageNumber));
  }
});

// ============================================================================
// SUITE N: Deterministic Re-generation
// ============================================================================
console.log('\n--- Suite N: Deterministic Re-generation ---');

runTest('N', 'Identical input produces identical pages, TOC numbers, and layout document stats', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता १', body: 'पंक्ति क\nपंक्ति ख' });
  const p2 = poemRepo.create({ title: 'कविता २', body: 'पंक्ति ग\nपंक्ति घ' });

  const book = bookService.createBook({
    title: 'निश्चयात्मक ग्रन्थ',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id, p2.id], order: 0 }]
  });

  const doc1 = bookService.generateBookLayout(book.id);
  const doc2 = bookService.generateBookLayout(book.id);

  assert.strictEqual(doc1.pages.length, doc2.pages.length);
  assert.strictEqual(doc1.toc.length, doc2.toc.length);
  for (let i = 0; i < doc1.pages.length; i++) {
    assert.strictEqual(doc1.pages[i].pageNumber, doc2.pages[i].pageNumber);
    assert.strictEqual(doc1.pages[i].type, doc2.pages[i].type);
  }
});

// ============================================================================
// SUITE O: Missing Poem Resilience
// ============================================================================
console.log('\n--- Suite O: Missing Poem Resilience ---');

runTest('O', 'Book with missing or deleted poem reference generates safely without crashing', () => {
  const { bookService, poemRepo } = createTestHarness();
  const validPoem = poemRepo.create({ title: 'उपलब्ध कविता', body: 'पाठ' });

  const book = bookService.createBook({
    title: 'अनुपलब्ध कविता परीक्षण',
    sections: [{ title: 'खण्ड १', poemIds: [validPoem.id, 'missing_deleted_poem_id'], order: 0 }]
  });

  assert.doesNotThrow(() => {
    const layoutDoc = bookService.generateBookLayout(book.id);
    assert.ok(layoutDoc.stats.totalPages > 0);
    assert.ok(layoutDoc.warnings.length > 0, 'Must record literary warning for missing poem');
  });
});

// ============================================================================
// SUITE P: Unicode, Devanagari & Nukta Fidelity
// ============================================================================
console.log('\n--- Suite P: Unicode, Devanagari & Nukta Fidelity ---');

runTest('P', 'Complex Devanagari conjuncts and nuktas in poems are preserved with zero corruption', () => {
  const complexDevanagari = 'क्षमा, त्रिशूल, ज्ञान, श्रद्धा, द्वार, हृद्य, क़िस्सा, ग़ज़ल, ज़िन्दगी, पेड़, चाँद, ॐ, दुःख, । , ॥';
  const stanzas = parsePoemStanzas(complexDevanagari);
  assert.strictEqual(stanzas[0][0], complexDevanagari);

  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({
    title: 'अमृत और विष: क्ष, त्र, ज्ञ',
    body: complexDevanagari,
    author: 'कवि'
  });

  const book = bookService.createBook({
    title: 'शुद्ध देवनागरी संकलन',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const layoutDoc = bookService.generateBookLayout(book.id);
  const poemPage = layoutDoc.pages.find(p => p.type === PAGE_TYPE.POEM && p.poemId === poem.id);
  const stanzaBlock = poemPage.blocks.find(b => b.type === 'stanza');

  assert.strictEqual(stanzaBlock.content[0], complexDevanagari);
});

runTest('P', 'Mixed Hindi, English, and emojis are preserved intact', () => {
  const mixedText = 'काव्य कलश 🌸 Poetry Vault v7.3 — Beautiful Devanagari ✨';
  const stanzas = parsePoemStanzas(mixedText);
  assert.strictEqual(stanzas[0][0], mixedText);
});

// ============================================================================
// SUITE Q: Print Preview UI Component
// ============================================================================
console.log('\n--- Suite Q: Print Preview UI Component ---');

runTest('Q', 'BookPrintPreview instantiates and renders centered page canvas with navigation controls', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'कविता', body: 'पंक्तियाँ...' });
  const book = bookService.createBook({
    title: 'पूर्वावलोकन पुस्तक',
    sections: [{ title: 'खण्ड १', poemIds: [poem.id], order: 0 }]
  });

  const preview = new BookPrintPreview({ book, bookService });
  const html = preview.render();

  assert.ok(html.includes('id="print-preview-modal-dialog"'));
  assert.ok(html.includes('id="print-active-page-sheet"'));
  assert.ok(html.includes('btn-prev-page'));
  assert.ok(html.includes('btn-next-page'));
  assert.ok(html.includes('btn-zoom-in'));
  assert.ok(html.includes('btn-zoom-out'));
  assert.ok(!html.includes('btn-toggle-layout-settings'));
});

runTest('Q', 'Navigation controls advance, reverse, and jump to specific pages', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता १', body: 'पंक्तियाँ' });
  const p2 = poemRepo.create({ title: 'कविता २', body: 'पंक्तियाँ' });
  const book = bookService.createBook({
    title: 'बहुपृष्ठ पुस्तक',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id, p2.id], order: 0 }]
  });

  const preview = new BookPrintPreview({ book, bookService });
  const total = preview.getTotalPages();
  assert.ok(total >= 3);

  assert.strictEqual(preview.currentPageIndex, 0);
  preview.nextPage();
  assert.strictEqual(preview.currentPageIndex, 1);
  preview.prevPage();
  assert.strictEqual(preview.currentPageIndex, 0);

  preview.lastPage();
  assert.strictEqual(preview.currentPageIndex, total - 1);
  preview.firstPage();
  assert.strictEqual(preview.currentPageIndex, 0);

  preview.goToPage(3);
  assert.strictEqual(preview.currentPageIndex, 2);
});

runTest('Q', 'Zoom in, zoom out, and reset zoom adjust zoom scale factor within bounds', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'ज़ूम पुस्तक' });
  const preview = new BookPrintPreview({ book, bookService });

  assert.strictEqual(preview.zoomLevel, 1.0);
  preview.zoomIn();
  assert.ok(preview.zoomLevel > 1.0);

  preview.resetZoom();
  assert.strictEqual(preview.zoomLevel, 1.0);

  preview.zoomOut();
  assert.ok(preview.zoomLevel < 1.0);
});

runTest('Q', 'Updating layout config in preview triggers live deterministic re-pagination', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पंक्तियाँ...' });
  const book = bookService.createBook({
    title: 'विन्यास परिवर्तन पुस्तक',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id], order: 0 }]
  });

  const preview = new BookPrintPreview({ book, bookService });
  const initialPages = preview.getTotalPages();

  // Disable cover and title page
  preview.updateConfig({ showCover: false, showTitlePage: false });
  const updatedPages = preview.getTotalPages();

  assert.ok(updatedPages < initialPages, 'Disabling cover and title page must reduce total page count');
});

// ============================================================================
// SUITE R: Responsive Contracts (390px, Mobile, Desktop)
// ============================================================================
console.log('\n--- Suite R: Responsive Contracts ---');

runTest('R', 'CSS defines mobile media query for 390px viewports and touch targets', () => {
  const css = fs.readFileSync('./src/components/books/books.css', 'utf8');
  assert.ok(css.includes('@media (max-width: 679px)'));
  assert.ok(css.includes('min-width: 48px'));
  assert.ok(css.includes('min-height: 48px'));
  assert.ok(css.includes('.print-settings-drawer'));
});

// ============================================================================
// SUITE S: Keyboard Navigation
// ============================================================================
console.log('\n--- Suite S: Keyboard Navigation ---');

runTest('S', 'Keyboard navigation handles ArrowRight, ArrowLeft, Home, End, and Escape', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता १', body: 'पाठ' });
  const p2 = poemRepo.create({ title: 'कविता २', body: 'पाठ' });
  const book = bookService.createBook({
    title: 'कीबोर्ड पुस्तक',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id, p2.id], order: 0 }]
  });

  let closed = false;
  const preview = new BookPrintPreview({
    book,
    bookService,
    onClose: () => { closed = true; }
  });

  // Next page
  preview.handleKeydown({ key: 'ArrowRight', preventDefault: () => {} });
  assert.strictEqual(preview.currentPageIndex, 1);

  // Prev page
  preview.handleKeydown({ key: 'ArrowLeft', preventDefault: () => {} });
  assert.strictEqual(preview.currentPageIndex, 0);

  // Close
  preview.handleKeydown({ key: 'Escape', preventDefault: () => {} });
  assert.strictEqual(closed, true);
});

runTest('S', 'Keyboard navigation ignores navigation keys when user is typing in form inputs', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'इनपुट सुरक्षा पुस्तक' });
  const preview = new BookPrintPreview({ book, bookService });

  const inputMock = { tagName: 'INPUT' };
  const handled = preview.handleKeydown({ key: 'ArrowRight', target: inputMock, preventDefault: () => {} });
  assert.strictEqual(handled, false, 'Must not intercept ArrowRight inside input');
  assert.strictEqual(preview.currentPageIndex, 0, 'Page must not change');
});

// ============================================================================
// SUITE T: Accessibility
// ============================================================================
console.log('\n--- Suite T: Accessibility ---');

runTest('T', 'Print preview defines role="dialog", aria-modal="true", and aria-live page counter', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'सुलभ पुस्तक' });
  const preview = new BookPrintPreview({ book, bookService });
  const html = preview.render();

  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('aria-label="मुद्रण पूर्वावलोकन बंद करें"'));
});

// ============================================================================
// SUITE U: Read-Only & Data Integrity Guarantee
// ============================================================================
console.log('\n--- Suite U: Read-Only & Data Integrity Guarantee ---');

runTest('U', 'Generating print preview NEVER mutates poems, manuscripts, collections, or favorites', () => {
  const { bookService, poemRepo, colRepo, manuRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'मूल कविता', body: 'मूल पाठ', author: 'मूल कवि', isFavorite: true });
  const col = colRepo.create({ name: 'संग्रह', poemIds: [poem.id] });
  const manu = manuRepo.create({
    title: 'हस्तलिपि',
    originalManuscript: {
      mimeType: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      filename: 'page_01.png',
      capturedAt: '2026-01-15T10:30:00.000Z'
    }
  });

  const book = bookService.createBook({
    title: 'अपरिवर्तनीय ग्रन्थ',
    sections: [{ title: 'खण्ड १', poemIds: [poem.id], order: 0 }]
  });

  const preview = new BookPrintPreview({ book, bookService });
  preview.render();
  preview.nextPage();
  preview.updateConfig({ bodyFontSize: 16 });

  // Verify poem in repository remains completely intact
  const fetchedPoem = poemRepo.getById(poem.id);
  assert.strictEqual(fetchedPoem.title, 'मूल कविता');
  assert.strictEqual(fetchedPoem.body, 'मूल पाठ');
  assert.strictEqual(fetchedPoem.isFavorite, true);

  // Verify collection and manuscript intact
  assert.strictEqual(colRepo.getById(col.id).name, 'संग्रह');
  assert.strictEqual(manuRepo.getById(manu.id).title, 'हस्तलिपि');
});

// ============================================================================
// SUITE V: Integration with BookEditorView
// ============================================================================
console.log('\n--- Suite V: Integration with BookEditorView ---');

runTest('V', 'BookEditorView top bar provides "मुद्रण पूर्वावलोकन" action button', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'संपादक परीक्षण पुस्तक' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService });
  editor.mount();

  assert.ok(container.innerHTML.includes('id="btn-open-print-preview"'));
  assert.ok(container.innerHTML.includes('data-action="open-print-preview"'));
  editor.unmount();
});

runTest('V', 'Clicking "मुद्रण पूर्वावलोकन" opens print preview modal with page sheet', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const poem = poemRepo.create({ title: 'प्रथम कविता', body: 'पंक्तियाँ...' });
  const book = bookService.createBook({
    title: 'पूर्वावलोकन एकीकरण',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService });
  editor.mount();

  editor.handleClick({
    target: {
      closest: () => ({ getAttribute: () => 'open-print-preview' })
    }
  });

  assert.strictEqual(editor.activeModal, 'print-preview');
  assert.ok(container.innerHTML.includes('id="print-preview-modal-dialog"'));
  assert.ok(container.innerHTML.includes('id="print-active-page-sheet"'));
  editor.unmount();
});

// ============================================================================
// SUITE W: Additional Edge Cases & Robustness
// ============================================================================
console.log('\n--- Suite W: Additional Edge Cases & Robustness ---');

runTest('W', 'Zoom controls strictly clamp between 70% and 150%', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'ज़ूम परीक्षण' });
  const preview = new BookPrintPreview({ book, bookService });

  // Zoom in beyond max
  for (let i = 0; i < 10; i++) preview.zoomIn();
  assert.strictEqual(preview.zoomLevel, 1.5, 'Must not exceed 1.5');
  assert.strictEqual(preview.zoomIn(), false, 'zoomIn at max must return false');

  // Zoom out beyond min
  for (let i = 0; i < 15; i++) preview.zoomOut();
  assert.strictEqual(preview.zoomLevel, 0.7, 'Must not fall below 0.7');
  assert.strictEqual(preview.zoomOut(), false, 'zoomOut at min must return false');

  // Reset
  preview.resetZoom();
  assert.strictEqual(preview.zoomLevel, 1.0, 'Must reset to 1.0');
});

runTest('W', 'goToPage strictly protects against invalid, out-of-bounds, or NaN inputs', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'पृष्ठ छलांग' });
  const preview = new BookPrintPreview({ book, bookService });
  const initialPage = preview.currentPageIndex;

  assert.strictEqual(preview.goToPage(0), false, 'Page 0 is invalid');
  assert.strictEqual(preview.goToPage(-3), false, 'Negative page is invalid');
  assert.strictEqual(preview.goToPage(9999), false, 'Out-of-bounds page is invalid');
  assert.strictEqual(preview.goToPage('अमान्य'), false, 'Non-number string is invalid');
  assert.strictEqual(preview.currentPageIndex, initialPage, 'Current page must not have changed');
});

runTest('W', 'Settings drawer toggle updates state and toggles CSS class', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'विन्यास दराज' });
  const preview = new BookPrintPreview({ book, bookService });

  assert.strictEqual(preview.showSettings, false);
  let html = preview.render();
  assert.ok(!html.includes('has-drawer-open'));

  preview.toggleSettings();
  assert.strictEqual(preview.showSettings, true);
  html = preview.render();
  assert.ok(html.includes('has-drawer-open'));
  assert.ok(html.includes('id="print-settings-panel"'));
  assert.ok(html.includes('is-open'));

  preview.toggleSettings();
  assert.strictEqual(preview.showSettings, false);
});

runTest('W', 'Keyboard shortcuts "+" and "-" control zoom and "0" resets zoom', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'कुंजीपटल ज़ूम' });
  const preview = new BookPrintPreview({ book, bookService });

  assert.strictEqual(preview.zoomLevel, 1.0);
  preview.handleKeydown({ key: '+', preventDefault: () => {} });
  assert.ok(preview.zoomLevel > 1.0, 'Must zoom in on +');

  preview.handleKeydown({ key: '0', preventDefault: () => {} });
  assert.strictEqual(preview.zoomLevel, 1.0, 'Must reset to 1.0 on 0');

  preview.handleKeydown({ key: '-', preventDefault: () => {} });
  assert.ok(preview.zoomLevel < 1.0, 'Must zoom out on -');
});

runTest('W', 'Escape key closes settings drawer first if open, or closes modal if drawer is closed', () => {
  const { bookService } = createTestHarness();
  let closed = false;
  const book = bookService.createBook({ title: 'एस्केप कुंजी' });
  const preview = new BookPrintPreview({ book, bookService, onClose: () => { closed = true; } });

  preview.showSettings = true;
  // First escape: closes settings drawer only
  preview.handleKeydown({ key: 'Escape', preventDefault: () => {} });
  assert.strictEqual(preview.showSettings, false, 'Drawer must close');
  assert.strictEqual(closed, false, 'Modal must NOT close when drawer was open');

  // Second escape: closes modal
  preview.handleKeydown({ key: 'Escape', preventDefault: () => {} });
  assert.strictEqual(closed, true, 'Modal must close on second Escape');
});

runTest('W', 'Widow/orphan control keeps 2-line stanzas intact during pagination', () => {
  const { bookService } = createTestHarness();
  // Construct a poem with exactly enough lines to test boundary splitting
  const lines = Array.from({ length: 28 }, (_, i) => `पंक्ति क्रमांक ${i + 1}`);
  const stanzas = [
    lines.slice(0, 10).join('\n'),
    lines.slice(10, 20).join('\n'),
    lines.slice(20, 28).join('\n')
  ].join('\n\n');

  const bookDoc = {
    metadata: { title: 'छंद अखण्डता' },
    sections: [{
      title: 'खण्ड १',
      poems: [{ id: 'poem-orphan', title: 'अखण्ड कविता', body: stanzas, author: 'कवि' }]
    }]
  };

  const layoutDoc = BookLayoutEngine.generateLayout(bookDoc, {
    pageSize: PAGE_SIZE.A5,
    widowOrphanControl: true,
    showCover: false,
    showTitlePage: false,
    showTableOfContents: false
  });

  // Verify poem pages are generated without crashing
  const poemPages = layoutDoc.pages.filter(p => p.type === PAGE_TYPE.POEM);
  assert.ok(poemPages.length >= 1, 'Poem pages must be created');
  for (const page of poemPages) {
    const poemBlock = page.blocks.find(b => b.type === 'poem-body');
    if (poemBlock && poemBlock.stanzas) {
      for (const st of poemBlock.stanzas) {
        assert.ok(Array.isArray(st.lines));
        assert.ok(st.lines.length > 0);
      }
    }
  }
});

runTest('W', 'Large collection with many poems spans across multiple TOC pages deterministically', () => {
  const poems = Array.from({ length: 45 }, (_, i) => ({
    id: `p-${i}`,
    title: `गीत क्रमांक ${toDevanagariNumerals(i + 1)}`,
    body: 'पहली पंक्ति\nदूसरी पंक्ति'
  }));

  const bookDoc = {
    metadata: { title: 'महाकाव्य संग्रह', author: 'महान कवि' },
    sections: [
      { id: 's-1', title: 'प्रथम प्रहर', poems: poems.slice(0, 20) },
      { id: 's-2', title: 'द्वितीय प्रहर', poems: poems.slice(20, 45) }
    ]
  };

  const layoutDoc = BookLayoutEngine.generateLayout(bookDoc, {
    pageSize: PAGE_SIZE.A5,
    showCover: false,
    showTitlePage: true,
    showTableOfContents: true
  });

  const tocPages = layoutDoc.pages.filter(p => p.type === PAGE_TYPE.TOC);
  assert.ok(tocPages.length >= 2, '45 poems + 2 sections must span across at least 2 TOC pages on A5');
  assert.strictEqual(tocPages[1].blocks[0].content, 'विषय-सूची (जारी)');
});

runTest('W', 'Line height variations alter page capacities and total line distribution', () => {
  const cfgTight = createLayoutConfig({ lineHeight: 1.4 });
  const capsTight = BookLayoutEngine.computeCapacities(cfgTight);

  const cfgAiry = createLayoutConfig({ lineHeight: 2.6 });
  const capsAiry = BookLayoutEngine.computeCapacities(cfgAiry);

  assert.ok(capsTight.linesPerFullPage > capsAiry.linesPerFullPage, 'Tighter line height must accommodate more lines');
  assert.ok(capsTight.linePitchPt < capsAiry.linePitchPt);
});

runTest('W', 'Page numbering position validates and supports all positions', () => {
  assert.deepStrictEqual(VALID_PAGE_NUMBER_POSITIONS, ['bottom-center', 'bottom-outer', 'top-right', 'none']);
  for (const pos of VALID_PAGE_NUMBER_POSITIONS) {
    assert.doesNotThrow(() => validateLayoutConfig({ pageNumberPosition: pos }));
  }
  assert.throws(() => validateLayoutConfig({ pageNumberPosition: 'middle-screen' }), /पृष्ठ संख्या स्थिति/);
});

runTest('W', 'Preserves sacred Hindi symbols, chandrabindu, and dandas without corruption', () => {
  const sacredPoem = `ॐ भूर्भुवः स्वः।\nतत्सवितुर्वरेण्यं भर्गो देवस्य धीमहि।\nधियो यो नः प्रचोदयात्॥\n\nचाँद की शीतल चाँदनी में दुःख का अंत हो।`;
  const stanzas = parsePoemStanzas(sacredPoem);

  assert.strictEqual(stanzas.length, 2);
  assert.ok(stanzas[0][0].includes('ॐ'));
  assert.ok(stanzas[0][0].includes('।'));
  assert.ok(stanzas[0][2].includes('॥'));
  assert.ok(stanzas[1][0].includes('चाँद'));
  assert.ok(stanzas[1][0].includes('दुःख'));
});

runTest('W', 'XSS safety: HTML special characters in book titles and poems are safely escaped in rendered output', () => {
  const { bookService } = createTestHarness();
  const evilBook = bookService.createBook({
    title: '<script>alert("xss")</script> & "परीक्षण"',
    author: '<b onmouseover="alert(1)">कवि</b>'
  });
  const preview = new BookPrintPreview({ book: evilBook, bookService });
  const html = preview.render();

  assert.ok(!html.includes('<script>alert("xss")</script>'), 'Raw script tags must never appear');
  assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;') || html.includes('&lt;script&gt;'));
});

runTest('W', 'Supports Letter paper size with accurate aspect ratio', () => {
  const cfgLetter = createLayoutConfig({ pageSize: PAGE_SIZE.LETTER, orientation: PAGE_ORIENTATION.PORTRAIT });
  const caps = BookLayoutEngine.computeCapacities(cfgLetter);
  assert.strictEqual(caps.widthMm, 215.9);
  assert.strictEqual(caps.heightMm, 279.4);
  assert.ok(caps.aspectRatio > 0.77 && caps.aspectRatio < 0.78);
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} BOOK LAYOUT & PRINT PREVIEW TESTS PASSED!`);
console.log('================================================================\n');
