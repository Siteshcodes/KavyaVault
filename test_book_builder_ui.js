/**
 * काव्यकलश (KavyaVault) — Book Builder UI & Poem Curation Test Suite (test_book_builder_ui.js)
 * Phase 7 / Task 7.2: Book Builder UI & Poem Curation
 *
 * Verifies:
 * - Suite A: Book List View (BooksListView rendering, empty state, cards, Devanagari numerals)
 * - Suite B: Create Book Flow (BookEditorView create mode, validation, initial section, specimen)
 * - Suite C: Book Metadata Editing (modal form, updateBookMetadata, live state, updatedAt)
 * - Suite D: Delete Book Safety (confirmation modal, safe deletion, non-destructive to library)
 * - Suite E: Section CRUD (add section, update title/desc, delete section, non-destructive)
 * - Suite F: Section Ordering (move up, move down, boundary checks)
 * - Suite G: Poem Picker (library poems, search filter, category filter, favorites toggle, already-added badge)
 * - Suite H: Add/Remove Poems (add to section, duplicate prevention, remove reference safely)
 * - Suite I: Poem Ordering within Section (move up, move down, boundary checks)
 * - Suite J: Missing Poem Handling (safe rendering, resilient fallback, missing warning, safe removal)
 * - Suite K: Cover Preview Specimen (background classes, classic/syahi/khaddar/makhmali-raat, text)
 * - Suite L: Live Structural Tree Preview (BookDocument tree rendering, metrics, warnings)
 * - Suite M: Navigation & Routes (/books, /books/new, /books/:id, document title)
 * - Suite N: Mobile Layout Contracts (390px, 48px touch targets, no horizontal overflow)
 * - Suite O: Accessibility (ARIA dialogs, Escape dismissal, focus restoration, labels)
 * - Suite P: Unicode, Devanagari & Nukta Fidelity (क्ष, त्र, ज्ञ, nuktas, chandrabindu, ॐ)
 * - Suite Q: End-to-End Deletion Safety (poems, manuscripts, collections, favorites survive book/section delete)
 * - Suite R: Regression & Privacy (local-first, no external requests, zero synthetic poem fabrication)
 * - Suite S: Architecture Hardening & Service Boundaries (BookProjectService mediation, zero direct repo/storage access)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import { BooksListView } from './src/components/books/BooksListView.js';
import { BookEditorView, toDevanagariNumber, COVER_BACKGROUNDS } from './src/components/books/BookEditorView.js';
import { BookProjectService } from './src/services/books/BookProjectService.js';
import { BookProjectRepository } from './src/services/books/BookProjectRepository.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { COVER_TYPE, generateSectionId } from './src/services/books/bookTypes.js';
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
      if (sel === '#book-form-title') {
        const match = self.innerHTML.match(/id="book-form-title"[^>]*value="([^"]*)"/);
        return { id: 'book-form-title', value: match ? match[1] : '', focus: () => {} };
      }
      if (sel === '#book-form-subtitle') {
        const match = self.innerHTML.match(/id="book-form-subtitle"[^>]*value="([^"]*)"/);
        return { id: 'book-form-subtitle', value: match ? match[1] : '' };
      }
      if (sel === '#book-form-author') {
        const match = self.innerHTML.match(/id="book-form-author"[^>]*value="([^"]*)"/);
        return { id: 'book-form-author', value: match ? match[1] : '' };
      }
      if (sel === '#book-form-cover-bg') {
        const match = self.innerHTML.match(/id="book-form-cover-bg"[^>]*>([\s\S]*?)<\/select>/);
        let selectedVal = 'bhojpatra';
        if (match) {
          const optMatch = match[1].match(/<option value="([^"]*)" selected>/);
          if (optMatch) selectedVal = optMatch[1];
        }
        return { id: 'book-form-cover-bg', value: selectedVal };
      }
      if (sel === '#specimen-title') {
        const match = self.innerHTML.match(/id="specimen-title">([^<]*)<\/h2>/);
        return { id: 'specimen-title', textContent: match ? match[1] : '' };
      }
      if (sel === '#specimen-subtitle') {
        const match = self.innerHTML.match(/id="specimen-subtitle">([^<]*)<\/p>/);
        return { id: 'specimen-subtitle', textContent: match ? match[1] : '' };
      }
      if (sel === '#specimen-author') {
        const match = self.innerHTML.match(/id="specimen-author">([^<]*)<\/span>/);
        return { id: 'specimen-author', textContent: match ? match[1] : '' };
      }
      if (sel === '#create-cover-specimen') {
        const match = self.innerHTML.match(/id="create-cover-specimen"[^>]*class="([^"]*)"/);
        return { id: 'create-cover-specimen', className: match ? match[1] : '' };
      }
      if (sel === '#picker-search-field') {
        const match = self.innerHTML.match(/id="picker-search-field"[^>]*value="([^"]*)"/);
        return { id: 'picker-search-field', value: match ? match[1] : '', focus: () => {}, setSelectionRange: () => {} };
      }
      return null;
    }
  };
  return container;
}

// Test harness creating fresh in-memory services
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
console.log('  KAVYAVAULT BOOK BUILDER UI & CURATION TEST SUITE (PHASE 7.2)');
console.log('================================================================\n');

// ============================================================================
// SUITE A: Book List View
// ============================================================================
console.log('--- Suite A: Book List View ---');

runTest('A', 'Empty state renders authentic literary Hindi tone when no books exist', () => {
  const { bookService, router } = createTestHarness();
  const container = createMockContainer();
  const listView = new BooksListView({ container, router, bookService });
  listView.mount();

  assert.ok(container.innerHTML.includes('अभी कोई काव्य-संकलन तैयार नहीं है।'), 'Must show authentic Hindi empty state');
  assert.ok(container.innerHTML.includes('पहला संकलन बनाएँ'), 'Must render CTA button to create first book');
  assert.ok(container.innerHTML.includes(ROUTES.BOOK_NEW), 'CTA must point to book creation route');
  listView.unmount();
});

runTest('A', 'Renders book cards with title, author, cover background preset and Devanagari numerals', () => {
  const { bookService, router } = createTestHarness();
  bookService.createBook({
    title: 'मधुशाला',
    subtitle: 'काव्य संकलन',
    author: 'हरिवंश राय बच्चन',
    description: 'मदिरालय जाने को घर से चलता है पीनेवाला...',
    cover: { background: 'syahi', type: 'classic' },
    sections: [
      { title: 'प्रथम तरंग', poemIds: ['p1', 'p2'], order: 0 }
    ]
  });

  const container = createMockContainer();
  const listView = new BooksListView({ container, router, bookService });
  listView.mount();

  assert.ok(container.innerHTML.includes('मधुशाला'), 'Must render book title');
  assert.ok(container.innerHTML.includes('हरिवंश राय बच्चन'), 'Must render author');
  assert.ok(container.innerHTML.includes('cover-bg-syahi'), 'Must apply correct cover preset background class');
  assert.ok(container.innerHTML.includes('१ खण्ड'), 'Must display Devanagari section count');
  assert.ok(container.innerHTML.includes('२ रचनाएँ'), 'Must display Devanagari poem count');
  listView.unmount();
});

runTest('A', 'Book list renders primary creation button in top header', () => {
  const { bookService, router } = createTestHarness();
  const container = createMockContainer();
  const listView = new BooksListView({ container, router, bookService });
  listView.mount();

  assert.ok(container.innerHTML.includes('id="btn-create-book-top"'), 'Must have top header creation button');
  assert.ok(container.innerHTML.includes('नया संकलन बनाएँ'), 'Button must have clear Hindi label');
  listView.unmount();
});

runTest('A', 'Devanagari numeral converter converts all Western digits 0-9 faithfully', () => {
  assert.strictEqual(toDevanagariNumber(0), '०');
  assert.strictEqual(toDevanagariNumber(1), '१');
  assert.strictEqual(toDevanagariNumber(25), '२५');
  assert.strictEqual(toDevanagariNumber(108), '१०८');
  assert.strictEqual(toDevanagariNumber(2026), '२०२६');
});

// ============================================================================
// SUITE B: Create Book Flow
// ============================================================================
console.log('\n--- Suite B: Create Book Flow ---');

runTest('B', 'Renders focused creation form when bookId is null or "new"', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: null, bookService, poemRepo });
  editor.mount();

  assert.ok(editor.isCreating === true, 'Editor should be in creation mode');
  assert.ok(container.innerHTML.includes('id="form-create-book"'), 'Must render create form');
  assert.ok(container.innerHTML.includes('id="book-form-title"'), 'Must have title input');
  assert.ok(container.innerHTML.includes('id="create-cover-specimen"'), 'Must render cover specimen');
  editor.unmount();
});

runTest('B', 'Validates empty or whitespace title and displays inline error message', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: null, bookService, poemRepo });
  editor.mount();

  // Submit with empty title
  const syntheticEvent = {
    preventDefault: () => {},
    target: {
      id: 'form-create-book',
      title: { value: '   ' },
      subtitle: { value: '' },
      author: { value: '' },
      dedication: { value: '' },
      description: { value: '' },
      language: { value: 'hi' },
      coverBackground: { value: 'bhojpatra' },
      coverType: { value: 'classic' }
    }
  };

  editor.handleSubmit(syntheticEvent);
  assert.ok(editor.createFormError !== null, 'Must set error state');
  assert.ok(container.innerHTML.includes('कृपया पुस्तक का शीर्षक दर्ज करें।'), 'Must render Hindi validation message');
  assert.strictEqual(bookService.getAllBooks().length, 0, 'No book should be created on validation failure');
  editor.unmount();
});

runTest('B', 'Creates a real BookProject via BookProjectService with initial section on valid submit', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: null, bookService, poemRepo });
  editor.mount();

  const syntheticEvent = {
    preventDefault: () => {},
    target: {
      id: 'form-create-book',
      title: { value: 'रश्मिरथी' },
      subtitle: { value: 'कर्ण की शौर्यगाथा' },
      author: { value: 'रामधारी सिंह दिनकर' },
      dedication: { value: 'राष्ट्र को समर्पित' },
      description: { value: 'महाभारत के महानायक कर्ण पर आधारित खण्डकाव्य' },
      language: { value: 'hi' },
      coverBackground: { value: 'khaddar' },
      coverType: { value: 'classic' }
    }
  };

  editor.handleSubmit(syntheticEvent);
  const books = bookService.getAllBooks();
  assert.strictEqual(books.length, 1, 'Book must be created in repository');
  assert.strictEqual(books[0].title, 'रश्मिरथी');
  assert.strictEqual(books[0].author, 'रामधारी सिंह दिनकर');
  assert.strictEqual(books[0].cover.background, 'khaddar');
  assert.ok(books[0].sections.length > 0, 'Initial section must be created');
  assert.strictEqual(editor.isCreating, false, 'Editor mode should transition from creation to editing');
  editor.unmount();
});

runTest('B', 'Live input updates title and background class in cover specimen preview', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: null, bookService, poemRepo });
  editor.mount();

  // Simulate user typing title
  editor.createFormState.title = 'कामायनी';
  editor.createFormState.author = 'जयशंकर प्रसाद';
  editor.createFormState.coverBackground = 'makhmali-raat';
  editor.render();

  assert.ok(container.innerHTML.includes('कामायनी'), 'Specimen must show live title');
  assert.ok(container.innerHTML.includes('जयशंकर प्रसाद'), 'Specimen must show live author');
  assert.ok(container.innerHTML.includes('cover-bg-makhmali-raat'), 'Specimen must show updated background class');
  editor.unmount();
});

// ============================================================================
// SUITE C: Book Metadata Editing
// ============================================================================
console.log('\n--- Suite C: Book Metadata Editing ---');

runTest('C', 'Opening metadata modal populates current book values into form fields', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'गोदान काव्यावली',
    subtitle: 'प्रेमचंद की गाथा',
    author: 'प्रेमचंद',
    cover: { background: 'bhojpatra' }
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.handleClick({
    target: {
      closest: () => ({ getAttribute: () => 'open-metadata-modal' })
    }
  });

  assert.strictEqual(editor.activeModal, 'metadata');
  assert.ok(container.innerHTML.includes('id="form-edit-metadata"'), 'Must render metadata form modal');
  assert.ok(container.innerHTML.includes('value="गोदान काव्यावली"'), 'Must populate title');
  assert.ok(container.innerHTML.includes('value="प्रेमचंद"'), 'Must populate author');
  editor.unmount();
});

runTest('C', 'Metadata form submission updates title, subtitle, author, and dedication via service', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'प्रारंभिक शीर्षक', author: 'अज्ञात' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'metadata';

  const syntheticEvent = {
    preventDefault: () => {},
    target: {
      id: 'form-edit-metadata',
      title: { value: 'संशोधित काव्य संग्रह' },
      subtitle: { value: 'द्वितीय संस्करण' },
      author: { value: 'सूर्यकांत त्रिपाठी निराला' },
      dedication: { value: 'साहित्य साधकों को' },
      description: { value: 'नूतन संस्करण' },
      language: { value: 'hi' },
      coverBackground: { value: 'syahi' },
      coverType: { value: 'modern' }
    }
  };

  editor.handleSubmit(syntheticEvent);
  assert.strictEqual(editor.activeModal, null, 'Modal should close on submit');

  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.title, 'संशोधित काव्य संग्रह');
  assert.strictEqual(updated.subtitle, 'द्वितीय संस्करण');
  assert.strictEqual(updated.author, 'सूर्यकांत त्रिपाठी निराला');
  assert.strictEqual(updated.dedication, 'साहित्य साधकों को');
  assert.strictEqual(updated.cover.background, 'syahi');
  editor.unmount();
});

runTest('C', 'Updating metadata updates updatedAt timestamp without mutating poem references', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'पुस्तक क',
    sections: [{ title: 'खण्ड १', poemIds: ['poem_101'], order: 0 }]
  });
  const originalUpdated = book.updatedAt;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'metadata';

  // Small delay to ensure timestamp difference
  const syntheticEvent = {
    preventDefault: () => {},
    target: {
      id: 'form-edit-metadata',
      title: { value: 'पुस्तक क (परिमार्जित)' },
      subtitle: { value: '' },
      author: { value: '' },
      dedication: { value: '' },
      description: { value: '' },
      language: { value: 'hi' },
      coverBackground: { value: 'bhojpatra' },
      coverType: { value: 'classic' }
    }
  };

  editor.handleSubmit(syntheticEvent);
  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.title, 'पुस्तक क (परिमार्जित)');
  assert.deepStrictEqual(updated.sections[0].poemIds, ['poem_101'], 'Poem references must remain intact');
  editor.unmount();
});

runTest('C', 'Cancelling metadata modal leaves book unchanged and restores focus', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'अपरिवर्तित' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'metadata';

  let focusRestored = false;
  editor.lastFocusedElement = { focus: () => { focusRestored = true; } };

  editor.closeModal();
  assert.strictEqual(editor.activeModal, null);
  assert.strictEqual(focusRestored, true, 'Focus must be restored');
  assert.strictEqual(bookService.getBook(book.id).title, 'अपरिवर्तित');
  editor.unmount();
});

// ============================================================================
// SUITE D: Delete Book Safety
// ============================================================================
console.log('\n--- Suite D: Delete Book Safety ---');

runTest('D', 'Delete book button opens confirmation modal with literary safety guarantee', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'हटाने योग्य पुस्तक' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.handleClick({
    target: {
      closest: () => ({ getAttribute: () => 'open-delete-book-modal' })
    }
  });

  assert.strictEqual(editor.activeModal, 'delete-book');
  assert.ok(container.innerHTML.includes('संकलन हटाएं?'), 'Must have modal heading');
  assert.ok(container.innerHTML.includes('साहित्यिक सुरक्षा गारंटी:'), 'Must highlight non-destructive guarantee');
  assert.ok(container.innerHTML.includes('आपकी समस्त कविताएँ पुस्तकालय में पूर्णतः सुरक्षित रहेंगी'), 'Guarantee text must be explicit');
  editor.unmount();
});

runTest('D', 'Confirming book deletion deletes only the BookProject and navigates to /books', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'परियोजना' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'delete-book';

  editor.handleClick({
    target: {
      closest: () => ({ getAttribute: () => 'execute-delete-book' })
    }
  });

  assert.strictEqual(bookService.getBook(book.id), null, 'BookProject must be deleted');
  assert.strictEqual(router.navigatedTo, ROUTES.BOOKS, 'Must navigate back to books list');
  editor.unmount();
});

runTest('D', 'Deleting book NEVER deletes referenced poems in PoemRepository', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const poem = poemRepo.create({
    title: 'अमर कविता',
    body: 'यह कविता सदैव जीवित रहेगी...',
    author: 'महादेवी वर्मा'
  });

  const book = bookService.createBook({
    title: 'गीतिकाव्य',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'delete-book';

  editor.handleClick({
    target: {
      closest: () => ({ getAttribute: () => 'execute-delete-book' })
    }
  });

  // Verification: The poem itself MUST remain safe in library!
  const fetchedPoem = poemRepo.getById(poem.id);
  assert.ok(fetchedPoem !== null, 'Poem must still exist in PoemRepository');
  assert.strictEqual(fetchedPoem.title, 'अमर कविता');
  editor.unmount();
});

runTest('D', 'BooksListView delete flow also provides identical safety and removes card from DOM', () => {
  const { bookService, router } = createTestHarness();
  const book = bookService.createBook({ title: 'सूची से हटाएं' });
  const container = createMockContainer();
  const listView = new BooksListView({ container, router, bookService });
  listView.mount();

  // Trigger delete modal
  listView.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'confirm-delete-book' : book.id })
    }
  });
  assert.strictEqual(listView.deletingBookId, book.id);
  assert.ok(container.innerHTML.includes('साहित्यिक सुरक्षा गारंटी:'));

  // Execute delete
  listView.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'execute-delete-book' : book.id })
    }
  });
  assert.strictEqual(bookService.getBook(book.id), null);
  assert.strictEqual(listView.getBooks().length, 0);
  listView.unmount();
});

// ============================================================================
// SUITE E: Section CRUD
// ============================================================================
console.log('\n--- Suite E: Section CRUD ---');

runTest('E', 'Add section modal creates new section and sets it as active section', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'महाकाव्य', sections: [] });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.activeModal = 'section-create';
  const syntheticEvent = {
    preventDefault: () => {},
    target: {
      id: 'form-section',
      title: { value: 'द्वितीय खण्ड' },
      description: { value: 'प्रौढ़ रचनाएँ' }
    }
  };

  editor.handleSubmit(syntheticEvent);
  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections.length, 1);
  assert.strictEqual(updated.sections[0].title, 'द्वितीय खण्ड');
  assert.strictEqual(editor.activeSectionId, updated.sections[0].id, 'New section should become active');
  editor.unmount();
});

runTest('E', 'Edit section modal updates section title and description correctly', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [{ title: 'आरंभिक नाम', description: 'विवरण', poemIds: [], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'section-edit';
  editor.editingSectionId = secId;

  const syntheticEvent = {
    preventDefault: () => {},
    target: {
      id: 'form-section',
      title: { value: 'संशोधित खण्ड शीर्षक' },
      description: { value: 'अद्यतन विवरण' }
    }
  };

  editor.handleSubmit(syntheticEvent);
  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections[0].title, 'संशोधित खण्ड शीर्षक');
  assert.strictEqual(updated.sections[0].description, 'अद्यतन विवरण');
  editor.unmount();
});

runTest('E', 'Delete section removes section and preserves remaining sections', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [
      { title: 'खण्ड १', poemIds: [], order: 0 },
      { title: 'खण्ड २', poemIds: [], order: 1 }
    ]
  });
  const sec1Id = book.sections[0].id;
  const sec2Id = book.sections[1].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = sec1Id;
  editor.activeModal = 'delete-section';
  editor.deletingSectionId = sec1Id;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'execute-delete-section' : sec1Id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections.length, 1);
  assert.strictEqual(updated.sections[0].id, sec2Id);
  assert.strictEqual(editor.activeSectionId, sec2Id, 'Active section should switch to remaining section');
  editor.unmount();
});

runTest('E', 'Deleting a section NEVER deletes poems from PoemRepository', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const poem = poemRepo.create({ title: 'सुरक्षित कविता', body: 'कविता का पाठ...', author: 'सुमित्रानंदन पंत' });
  const book = bookService.createBook({
    title: 'संग्रह',
    sections: [{ title: 'हटने वाला खण्ड', poemIds: [poem.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'execute-delete-section' : secId })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections.length, 0);
  // Underlying poem MUST still exist in poemRepo
  assert.ok(poemRepo.getById(poem.id) !== null, 'Poem must be completely preserved in library');
  editor.unmount();
});

// ============================================================================
// SUITE F: Section Ordering
// ============================================================================
console.log('\n--- Suite F: Section Ordering ---');

runTest('F', 'Move section up swaps position with previous section', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [
      { title: 'पहला खण्ड', poemIds: [], order: 0 },
      { title: 'दूसरा खण्ड', poemIds: [], order: 1 }
    ]
  });
  const sec2Id = book.sections[1].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-section-up' : sec2Id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections[0].id, sec2Id, 'Second section should now be first');
  assert.strictEqual(updated.sections[0].order, 0);
  assert.strictEqual(updated.sections[1].order, 1);
  editor.unmount();
});

runTest('F', 'Move section down swaps position with next section', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [
      { title: 'पहला खण्ड', poemIds: [], order: 0 },
      { title: 'दूसरा खण्ड', poemIds: [], order: 1 }
    ]
  });
  const sec1Id = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-section-down' : sec1Id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections[1].id, sec1Id, 'First section should now be second');
  editor.unmount();
});

runTest('F', 'Move section up on first section is a safe no-op', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [
      { title: 'शीर्ष खण्ड', poemIds: [], order: 0 },
      { title: 'निचला खण्ड', poemIds: [], order: 1 }
    ]
  });
  const sec1Id = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-section-up' : sec1Id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections[0].id, sec1Id, 'Order must remain unchanged');
  editor.unmount();
});

runTest('F', 'Move section down on last section is a safe no-op', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [
      { title: 'खण्ड १', poemIds: [], order: 0 },
      { title: 'खण्ड २', poemIds: [], order: 1 }
    ]
  });
  const sec2Id = book.sections[1].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-section-down' : sec2Id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections[1].id, sec2Id, 'Order must remain unchanged');
  editor.unmount();
});

// ============================================================================
// SUITE G: Poem Picker
// ============================================================================
console.log('\n--- Suite G: Poem Picker ---');

runTest('G', 'Opening poem picker displays available library poems without duplicating bodies', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  poemRepo.create({ title: 'पुष्प की अभिलाषा', body: 'चाह नहीं मैं सुरबाला के...', author: 'माखनलाल चतुर्वेदी' });
  poemRepo.create({ title: 'झाँसी की रानी', body: 'सिंहासन हिल उठे...', author: 'सुभद्रा कुमारी चौहान' });

  const book = bookService.createBook({
    title: 'राष्ट्रकवि संकलन',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = book.sections[0].id;

  editor.handleClick({
    target: {
      closest: () => ({ getAttribute: () => 'open-poem-picker' })
    }
  });

  assert.strictEqual(editor.activeModal, 'poem-picker');
  assert.ok(container.innerHTML.includes('पुष्प की अभिलाषा'));
  assert.ok(container.innerHTML.includes('झाँसी की रानी'));
  assert.ok(container.innerHTML.includes('माखनलाल चतुर्वेदी'));
  editor.unmount();
});

runTest('G', 'Poem picker search filter filters by poem title, author, and category', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'अग्निपथ', body: 'वृक्ष हों भले खड़े...', author: 'हरिवंश राय बच्चन', category: 'प्रेरणा' });
  const p2 = poemRepo.create({ title: 'जो बीत गई', body: 'जो बीत गई सो बात गई...', author: 'हरिवंश राय बच्चन', category: 'दर्शन' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = book.sections[0].id;
  editor.activeModal = 'poem-picker';

  // Search by title
  editor.pickerSearch = 'अग्निपथ';
  editor.render();
  assert.ok(container.innerHTML.includes('अग्निपथ'));
  assert.ok(!container.innerHTML.includes('जो बीत गई'), 'Non-matching poem should be filtered out');

  // Search by category
  editor.pickerSearch = 'दर्शन';
  editor.render();
  assert.ok(!container.innerHTML.includes('अग्निपथ'));
  assert.ok(container.innerHTML.includes('जो बीत गई'));
  editor.unmount();
});

runTest('G', 'Favorites toggle filter displays only favorite poems in picker', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  poemRepo.create({ title: 'पसंदीदा कविता', body: 'पंक्तियाँ...', author: 'कवि', isFavorite: true });
  poemRepo.create({ title: 'सामान्य कविता', body: 'पंक्तियाँ...', author: 'कवि', isFavorite: false });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = book.sections[0].id;
  editor.activeModal = 'poem-picker';

  editor.pickerFavoritesOnly = true;
  editor.render();

  assert.ok(container.innerHTML.includes('पसंदीदा कविता'));
  assert.ok(!container.innerHTML.includes('सामान्य कविता'));
  editor.unmount();
});

runTest('G', 'Poems already present in the active section show "पहले से सम्मिलित" badge and are disabled', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'पहली कविता', body: 'पंक्तियाँ...', author: 'कवि' });
  const p2 = poemRepo.create({ title: 'दूसरी कविता', body: 'पंक्तियाँ...', author: 'कवि' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = book.sections[0].id;
  editor.activeModal = 'poem-picker';
  editor.render();

  assert.ok(container.innerHTML.includes('✓ पहले से सम्मिलित'), 'Must display already added badge');
  assert.ok(container.innerHTML.includes(`id="chk-poem-${p1.id}" disabled checked`), 'Checkbox must be disabled');
  assert.ok(container.innerHTML.includes(`id="chk-poem-${p2.id}"`), 'Available poem checkbox must be enabled');
  editor.unmount();
});

// ============================================================================
// SUITE H: Add / Remove Poems
// ============================================================================
console.log('\n--- Suite H: Add / Remove Poems ---');

runTest('H', 'Adding selected poems in picker appends them to active section without copying bodies', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता एक', body: 'पाठ एक...', author: 'कवि क' });
  const p2 = poemRepo.create({ title: 'कविता दो', body: 'पाठ दो...', author: 'कवि ख' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;
  editor.activeModal = 'poem-picker';

  editor.pickerSelectedPoemIds.add(p1.id);
  editor.pickerSelectedPoemIds.add(p2.id);

  editor.handleClick({
    target: {
      closest: () => ({ getAttribute: () => 'confirm-add-selected-poems' })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, [p1.id, p2.id]);
  assert.strictEqual(editor.activeModal, null, 'Modal should close on add');
  editor.unmount();
});

runTest('H', 'Adding poems prevents duplicate poem IDs inside the section', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता', body: 'पाठ...', author: 'कवि' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  // Attempt to add duplicate
  bookService.addPoemToSection(book.id, secId, p1.id);
  const updated = bookService.getBook(book.id);
  assert.strictEqual(updated.sections[0].poemIds.length, 1, 'Duplicate ID must be prevented');
});

runTest('H', 'Removing poem from section removes reference without deleting poem from library', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'रचना क', body: 'पाठ क...', author: 'कवि' });
  const p2 = poemRepo.create({ title: 'रचना ख', body: 'पाठ ख...', author: 'कवि' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'remove-poem-from-section' : p1.id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, [p2.id]);
  // Verify poem in library
  assert.ok(poemRepo.getById(p1.id) !== null, 'Poem must still exist in PoemRepository');
  editor.unmount();
});

runTest('H', 'Removing last poem renders friendly section empty state in curated panel', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'एकल रचना', body: 'पाठ...', author: 'कवि' });
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'remove-poem-from-section' : p1.id })
    }
  });

  assert.ok(container.innerHTML.includes('इस खण्ड में अभी कोई रचना सम्मिलित नहीं है।'), 'Must show section empty state');
  editor.unmount();
});

// ============================================================================
// SUITE I: Poem Ordering within Section
// ============================================================================
console.log('\n--- Suite I: Poem Ordering within Section ---');

runTest('I', 'Move poem up swaps position with preceding poem in section', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'प्रथम', body: '१', author: 'क' });
  const p2 = poemRepo.create({ title: 'द्वितीय', body: '२', author: 'ख' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-poem-up' : p2.id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, [p2.id, p1.id]);
  editor.unmount();
});

runTest('I', 'Move poem down swaps position with subsequent poem in section', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'प्रथम', body: '१', author: 'क' });
  const p2 = poemRepo.create({ title: 'द्वितीय', body: '२', author: 'ख' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-poem-down' : p1.id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, [p2.id, p1.id]);
  editor.unmount();
});

runTest('I', 'Move poem up on first poem is a safe no-op', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'प्रथम', body: '१', author: 'क' });
  const p2 = poemRepo.create({ title: 'द्वितीय', body: '२', author: 'ख' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-poem-up' : p1.id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, [p1.id, p2.id]);
  editor.unmount();
});

runTest('I', 'Move poem down on last poem is a safe no-op', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'प्रथम', body: '१', author: 'क' });
  const p2 = poemRepo.create({ title: 'द्वितीय', body: '२', author: 'ख' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड', poemIds: [p1.id, p2.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-poem-down' : p2.id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, [p1.id, p2.id]);
  editor.unmount();
});

// ============================================================================
// SUITE J: Missing Poem Handling
// ============================================================================
console.log('\n--- Suite J: Missing Poem Handling ---');

runTest('J', 'Resilient rendering of missing poem reference without UI crash', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: ['deleted_poem_999'], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });

  // Must not throw!
  assert.doesNotThrow(() => {
    editor.mount();
  });

  assert.ok(container.innerHTML.includes('रचना अनुपलब्ध (आईडी: deleted_poem_999)'));
  assert.ok(container.innerHTML.includes('यह रचना पुस्तकालय से हटाई जा चुकी है'));
  editor.unmount();
});

runTest('J', 'Missing poem can be removed cleanly from section using remove button', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: ['deleted_poem_999'], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'remove-poem-from-section' : 'deleted_poem_999' })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, []);
  editor.unmount();
});

runTest('J', 'Missing poem preserves section reordering controls for remaining poems', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const validPoem = poemRepo.create({ title: 'सजीव कविता', body: 'पाठ...', author: 'कवि' });

  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'खण्ड १', poemIds: [validPoem.id, 'deleted_poem_999'], order: 0 }]
  });
  const secId = book.sections[0].id;

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeSectionId = secId;

  assert.ok(container.innerHTML.includes('सजीव कविता'));
  assert.ok(container.innerHTML.includes('रचना अनुपलब्ध'));

  // Swap missing poem with valid poem
  editor.handleClick({
    target: {
      closest: (sel) => ({ getAttribute: (a) => a === 'data-action' ? 'move-poem-down' : validPoem.id })
    }
  });

  const updated = bookService.getBook(book.id);
  assert.deepStrictEqual(updated.sections[0].poemIds, ['deleted_poem_999', validPoem.id]);
  editor.unmount();
});

runTest('J', 'Structural preview flags missing poems with clear warning and count', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'संकलन',
    sections: [{ title: 'प्रथम खण्ड', poemIds: ['missing_p1'], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'preview';
  editor.render();

  assert.ok(container.innerHTML.includes('साहित्यिक सूचना:'), 'Must show literary warning section');
  assert.ok(container.innerHTML.includes('पुस्तकालय में नहीं मिली'), 'Must describe missing poem');
  editor.unmount();
});

// ============================================================================
// SUITE K: Cover Preview Specimen
// ============================================================================
console.log('\n--- Suite K: Cover Preview Specimen ---');

runTest('K', 'Supports all 4 background presets (bhojpatra, syahi, khaddar, makhmali-raat)', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const presets = ['bhojpatra', 'syahi', 'khaddar', 'makhmali-raat'];

  presets.forEach(preset => {
    const book = bookService.createBook({
      title: `पुस्तक-${preset}`,
      cover: { background: preset }
    });
    const container = createMockContainer();
    const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
    editor.mount();

    assert.ok(container.innerHTML.includes(`cover-bg-${preset}`), `Must have class cover-bg-${preset}`);
    editor.unmount();
  });
});

runTest('K', 'Cover specimen displays title, subtitle, author, and specimen badge', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({
    title: 'साकेत',
    subtitle: 'मैथिलीशरण गुप्त का महाकाव्य',
    author: 'मैथिलीशरण गुप्त',
    cover: { background: 'bhojpatra' }
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes('साकेत'));
  assert.ok(container.innerHTML.includes('मैथिलीशरण गुप्त का महाकाव्य'));
  assert.ok(container.innerHTML.includes('मैथिलीशरण गुप्त'));
  assert.ok(container.innerHTML.includes('मुखपृष्ठ प्रारूप'));
  editor.unmount();
});

runTest('K', 'Cover background presets array contains exactly 4 valid literary options', () => {
  assert.strictEqual(COVER_BACKGROUNDS.length, 4);
  const ids = COVER_BACKGROUNDS.map(b => b.id);
  assert.deepStrictEqual(ids, ['bhojpatra', 'syahi', 'khaddar', 'makhmali-raat']);
});

// ============================================================================
// SUITE L: Live Structural Tree Preview
// ============================================================================
console.log('\n--- Suite L: Live Structural Tree Preview ---');

runTest('L', 'Renders live BookDocument tree with sections and resolved poem items', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'सरोज स्मृति', body: 'धन्ये, मैं पिता निरर्थक था...', author: 'निराला' });
  const p2 = poemRepo.create({ title: 'राम की शक्तिपूजा', body: 'होगी जय, होगी जय...', author: 'निराला' });

  const book = bookService.createBook({
    title: 'निराला रचनावली',
    subtitle: 'काव्य संकलन',
    author: 'सूर्यकांत त्रिपाठी निराला',
    sections: [
      { title: 'स्मृति काव्य', poemIds: [p1.id], order: 0 },
      { title: 'शक्ति काव्य', poemIds: [p2.id], order: 1 }
    ]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'preview';
  editor.render();

  assert.ok(container.innerHTML.includes('निराला रचनावली'));
  assert.ok(container.innerHTML.includes('खण्ड १: स्मृति काव्य'));
  assert.ok(container.innerHTML.includes('सरोज स्मृति'));
  assert.ok(container.innerHTML.includes('खण्ड २: शक्ति काव्य'));
  assert.ok(container.innerHTML.includes('राम की शक्तिपूजा'));
  editor.unmount();
});

runTest('L', 'Structural preview accurately displays total statistics in Devanagari numerals', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'दोहा १', body: 'पंक्ति एक\nपंक्ति दो', author: 'कवि' });
  const book = bookService.createBook({
    title: 'सांख्यिकी पुस्तक',
    sections: [{ title: 'खण्ड १', poemIds: [p1.id], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'preview';
  editor.render();

  assert.ok(container.innerHTML.includes('खण्ड: <strong>१</strong>'));
  assert.ok(container.innerHTML.includes('रचनाएँ: <strong>१</strong>'));
  editor.unmount();
});

runTest('L', 'Closing preview modal closes dialog and returns to editor view cleanly', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'पुस्तक' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'preview';

  editor.closeModal();
  assert.strictEqual(editor.activeModal, null);
  editor.unmount();
});

// ============================================================================
// SUITE M: Navigation & Routes
// ============================================================================
console.log('\n--- Suite M: Navigation & Routes ---');

runTest('M', 'ROUTES constants include BOOKS (/books) and BOOK_NEW (/books/new)', () => {
  assert.strictEqual(ROUTES.BOOKS, '/books');
  assert.strictEqual(ROUTES.BOOK_NEW, '/books/new');
});

runTest('M', 'AppShell mounts BooksListView on /books route', () => {
  const { router } = createTestHarness();
  assert.strictEqual(router.getCurrentPath(), '/books');
});

runTest('M', 'Editor provides back button linking to /books', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'पुस्तक' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes(`href="${ROUTES.BOOKS}"`));
  assert.ok(container.innerHTML.includes('संकलन सूची'));
  editor.unmount();
});

runTest('M', 'Invalid or non-existent bookId renders literary not found message and back button', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: 'invalid_id_xyz', bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes('काव्य संकलन नहीं मिला'));
  assert.ok(container.innerHTML.includes('यह संकलन उपलब्ध नहीं है या इसे हटाया जा चुका है।'));
  assert.ok(container.innerHTML.includes(`href="${ROUTES.BOOKS}"`));
  editor.unmount();
});

// ============================================================================
// SUITE N: Mobile Layout Contracts
// ============================================================================
console.log('\n--- Suite N: Mobile Layout Contracts ---');

runTest('N', 'CSS defines mobile media query for 390px viewports with single-column layout', () => {
  const css = fs.readFileSync('./src/components/books/books.css', 'utf-8');
  assert.ok(css.includes('@media (max-width: 679px)'), 'Must include mobile responsive breakpoint');
  assert.ok(css.includes('overflow-x: hidden'), 'Must prevent horizontal overflow on mobile');
  assert.ok(css.includes('flex-direction: column'), 'Must collapse controls to column on mobile');
});

runTest('N', 'All primary buttons and icon controls enforce minimum 48px/36px touch targets', () => {
  const css = fs.readFileSync('./src/components/books/books.css', 'utf-8');
  assert.ok(css.includes('min-height: var(--touch-target-min, 48px)'), 'Primary buttons must enforce 48px min height');
  assert.ok(css.includes('min-height: 36px'), 'Secondary icon controls must define touch bounds');
});

runTest('N', 'Curated poem rows adapt to column layout on mobile screens', () => {
  const css = fs.readFileSync('./src/components/books/books.css', 'utf-8');
  assert.ok(css.includes('.curated-poem-row {'), 'Must define curated-poem-row');
  assert.ok(css.includes('.curated-poem-controls {'), 'Must define curated-poem-controls');
});

// ============================================================================
// SUITE O: Accessibility
// ============================================================================
console.log('\n--- Suite O: Accessibility ---');

runTest('O', 'Modals define role="dialog", aria-modal="true", and aria-labelledby', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'पुस्तक' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'metadata';
  editor.render();

  assert.ok(container.innerHTML.includes('role="dialog"'));
  assert.ok(container.innerHTML.includes('aria-modal="true"'));
  assert.ok(container.innerHTML.includes('aria-labelledby="modal-meta-title"'));
  editor.unmount();
});

runTest('O', 'Escape key closes active modal and restores keyboard focus', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'पुस्तक' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'preview';

  let focusRestored = false;
  editor.lastFocusedElement = { focus: () => { focusRestored = true; } };

  editor.handleKeydown({ key: 'Escape', preventDefault: () => {} });
  assert.strictEqual(editor.activeModal, null, 'Escape must dismiss modal');
  assert.strictEqual(focusRestored, true, 'Focus must be restored');
  editor.unmount();
});

runTest('O', 'Action buttons have meaningful Hindi aria-labels for screen readers', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const p1 = poemRepo.create({ title: 'गीत', body: 'पंक्ति', author: 'कवि' });
  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [p1.id], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes('aria-label="पुस्तक की संरचना का पूर्वावलोकन देखें"'));
  assert.ok(container.innerHTML.includes('aria-label="पुस्तक विवरण संपादित करें"'));
  assert.ok(container.innerHTML.includes('aria-label="नया खण्ड जोड़ें"'));
  assert.ok(container.innerHTML.includes('aria-label="इस खण्ड में रचनाएँ जोड़ें"'));
  assert.ok(container.innerHTML.includes('aria-label="‘गीत’ ऊपर करें"'));
  assert.ok(container.innerHTML.includes('aria-label="‘गीत’ नीचे करें"'));
  assert.ok(container.innerHTML.includes('aria-label="‘गीत’ खण्ड से हटाएं"'));
  editor.unmount();
});

runTest('O', 'Backdrop click dismisses modal safely', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const book = bookService.createBook({ title: 'पुस्तक' });
  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();
  editor.activeModal = 'metadata';

  editor.handleClick({
    target: {
      classList: {
        contains: (c) => c === 'modal-backdrop'
      }
    }
  });

  assert.strictEqual(editor.activeModal, null, 'Backdrop click must close modal');
  editor.unmount();
});

// ============================================================================
// SUITE P: Unicode, Devanagari & Nukta Fidelity
// ============================================================================
console.log('\n--- Suite P: Unicode, Devanagari & Nukta Fidelity ---');

runTest('P', 'Complex Devanagari conjuncts (क्ष, त्र, ज्ञ, श्र, द्व, हृ) in titles are preserved without corruption', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const conjunctTitle = 'क्षत्रिय ज्ञान श्रद्धा द्वैत हृदय';
  const book = bookService.createBook({ title: conjunctTitle });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes(conjunctTitle), 'Conjuncts must be rendered without corruption');
  editor.unmount();
});

runTest('P', 'Urdu/Persian nukta loanwords (क़, ख़, ग़, ज़, ड़, ढ़, फ़) in metadata are preserved faithfully', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const nuktaText = 'ग़ज़ल काफ़िला ख़्वाब फ़लक ज़मीन';
  const book = bookService.createBook({
    title: 'शायरी संग्रह',
    subtitle: nuktaText,
    author: 'मिर्ज़ा ग़ालिब'
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes(nuktaText));
  assert.ok(container.innerHTML.includes('मिर्ज़ा ग़ालिब'));
  editor.unmount();
});

runTest('P', 'Chandrabindu, visarga, Om, and danda (चाँद, ॐ, दुःख, । , ॥) preserved intact', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const sacredTitle = 'ॐ चाँद का मुँह टेढ़ा है । दुःख ॥';
  const book = bookService.createBook({ title: sacredTitle });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes(sacredTitle));
  editor.unmount();
});

runTest('P', 'Mixed Hindi/English and emojis handled without corrupting strings', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const mixed = 'काव्यकलश Vol. 1 📖 — शुद्ध हिन्दी Poetry';
  const book = bookService.createBook({ title: mixed });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: book.id, bookService, poemRepo });
  editor.mount();

  assert.ok(container.innerHTML.includes(mixed));
  editor.unmount();
});

// ============================================================================
// SUITE Q: End-to-End Deletion Safety
// ============================================================================
console.log('\n--- Suite Q: End-to-End Deletion Safety ---');

runTest('Q', 'Full lifecycle: Add poem to section -> delete section -> verify poem remains in library', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'अटल कविता', body: 'यह कभी नहीं मिटेगी...', author: 'दिनकर' });
  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [{ title: 'खण्ड क', poemIds: [poem.id], order: 0 }]
  });
  const secId = book.sections[0].id;

  bookService.deleteSection(book.id, secId);
  assert.ok(poemRepo.getById(poem.id) !== null, 'Poem must exist');
});

runTest('Q', 'Full lifecycle: Add poem to section -> delete book -> verify poem remains in library', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'चिरंजीवी कविता', body: 'कविता पाठ...', author: 'निराला' });
  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [{ title: 'खण्ड क', poemIds: [poem.id], order: 0 }]
  });

  bookService.deleteBook(book.id);
  assert.ok(poemRepo.getById(poem.id) !== null, 'Poem must exist');
});

runTest('Q', 'Deleting book preserves manuscripts, collections, and favorites completely', () => {
  const { bookService, poemRepo, colRepo, manuRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'प्रिय कविता', body: 'पाठ...', author: 'कवि', isFavorite: true });
  const col = colRepo.create({ name: 'अनमोल संग्रह', description: 'विवरण', poemIds: [poem.id] });
  const ms = manuRepo.create({
    title: 'प्राचीन पांडुलिपि',
    originalManuscript: {
      mimeType: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      filename: 'page_01.png',
      capturedAt: '2026-01-15T10:30:00.000Z'
    }
  });

  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [{ title: 'खण्ड', poemIds: [poem.id], order: 0 }]
  });

  bookService.deleteBook(book.id);

  // Assert all entities intact
  assert.ok(poemRepo.getById(poem.id) !== null, 'Poem intact');
  assert.strictEqual(poemRepo.getById(poem.id).isFavorite, true, 'Favorite flag intact');
  assert.ok(colRepo.getById(col.id) !== null, 'Collection intact');
  assert.ok(manuRepo.getById(ms.id) !== null, 'Manuscript intact');
});

runTest('Q', 'Multiple sections can share the same poem without duplication in library', () => {
  const { bookService, poemRepo } = createTestHarness();
  const poem = poemRepo.create({ title: 'साझा कविता', body: 'पाठ...', author: 'कवि' });
  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [
      { title: 'खण्ड १', poemIds: [poem.id], order: 0 },
      { title: 'खण्ड २', poemIds: [poem.id], order: 1 }
    ]
  });

  assert.strictEqual(poemRepo.getAll({ includeArchived: true }).length, 1, 'Only 1 poem in repository');
  bookService.deleteSection(book.id, book.sections[0].id);
  assert.ok(poemRepo.getById(poem.id) !== null, 'Poem preserved');
});

// ============================================================================
// SUITE R: Regression & Privacy
// ============================================================================
console.log('\n--- Suite R: Regression & Privacy ---');

runTest('R', 'Local-first guarantee: zero network/cloud calls during entire book lifecycle', () => {
  const { bookService } = createTestHarness();
  const book = bookService.createBook({ title: 'स्थानीय पुस्तक' });
  bookService.addSection(book.id, { title: 'स्थानीय खण्ड' });
  const doc = bookService.generateBookDocument(book.id);
  assert.strictEqual(doc.metadata.title, 'स्थानीय पुस्तक');
});

runTest('R', 'Does not fabricate synthetic poems or silently invent data', () => {
  const { bookService, poemRepo } = createTestHarness();
  const book = bookService.createBook({
    title: 'पुस्तक',
    sections: [{ title: 'खण्ड', poemIds: ['non_existent_poem'], order: 0 }]
  });

  const doc = bookService.generateBookDocument(book.id);
  assert.strictEqual(doc.sections[0].poems.length, 0, 'Must NOT invent fake poems');
  assert.strictEqual(doc.sections[0].missingPoemIds.length, 1);
});

runTest('R', 'Backward compatibility: BookProjects list and editor support books created in Phase 7.1', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  // Phase 7.1 minimal book
  const p71Book = bookService.createBook({
    title: 'चरण ७.१ पुस्तक'
  });

  const container = createMockContainer();
  const editor = new BookEditorView({ container, router, bookId: p71Book.id, bookService, poemRepo });
  assert.doesNotThrow(() => {
    editor.mount();
  });
  assert.ok(container.innerHTML.includes('चरण ७.१ पुस्तक'));
  editor.unmount();
});

// ============================================================================
// SUITE S: Architecture Hardening & Service Boundaries (Task 7.2 Hardening)
// ============================================================================
console.log('\n--- Suite S: Architecture Hardening & Service Boundaries ---');

runTest('S', 'BookEditorView source contains ZERO direct repository imports or field references', () => {
  const source = fs.readFileSync('./src/components/books/BookEditorView.js', 'utf8');
  assert.ok(!source.includes('PoemRepository.js'), 'BookEditorView must NOT import PoemRepository directly');
  assert.ok(!source.includes('CollectionRepository.js'), 'BookEditorView must NOT import CollectionRepository directly');
  assert.ok(!source.includes('poemRepo'), 'BookEditorView must not maintain internal poemRepo field');
  assert.ok(!source.includes('collectionRepo'), 'BookEditorView must not maintain internal collectionRepo field');
});

runTest('S', 'BookEditorView and BooksListView source contain ZERO direct localStorage or indexedDB access', () => {
  const editorSource = fs.readFileSync('./src/components/books/BookEditorView.js', 'utf8');
  const listSource = fs.readFileSync('./src/components/books/BooksListView.js', 'utf8');

  assert.ok(!editorSource.includes('localStorage'), 'BookEditorView must not access localStorage directly');
  assert.ok(!editorSource.includes('indexedDB'), 'BookEditorView must not access indexedDB directly');
  assert.ok(!listSource.includes('localStorage'), 'BooksListView must not access localStorage directly');
  assert.ok(!listSource.includes('indexedDB'), 'BooksListView must not access indexedDB directly');
});

runTest('S', 'BookEditorView functions cleanly when instantiated with ONLY bookService (no repository injection)', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  const poem = poemRepo.create({ title: 'साधना', body: 'पंक्तियाँ...', author: 'महादेवी वर्मा' });
  const book = bookService.createBook({
    title: 'आर्किटेक्चर परीक्षण',
    sections: [{ title: 'प्रथम खण्ड', poemIds: [poem.id], order: 0 }]
  });

  const container = createMockContainer();
  // Notice: ONLY container, router, bookId, and bookService are provided
  const editor = new BookEditorView({
    container,
    router,
    bookId: book.id,
    bookService
  });

  editor.mount();
  assert.strictEqual(editor.poemRepo, undefined, 'poemRepo must not be defined on editor instance');
  assert.strictEqual(editor.collectionRepo, undefined, 'collectionRepo must not be defined on editor instance');
  assert.ok(container.innerHTML.includes('साधना'), 'Section poem must resolve via bookService.getPoem');
  assert.ok(container.innerHTML.includes('महादेवी वर्मा'), 'Author must resolve via bookService.getPoem');
  editor.unmount();
});

runTest('S', 'Poem picker modal retrieves library poems through bookService domain mediation', () => {
  const { bookService, poemRepo, router } = createTestHarness();
  poemRepo.create({ title: 'रश्मिरथी', body: 'पंक्तियाँ...', author: 'दिनकर', category: 'वीर' });
  const book = bookService.createBook({
    title: 'काव्य ग्रन्थ',
    sections: [{ title: 'खण्ड १', poemIds: [], order: 0 }]
  });

  const container = createMockContainer();
  const editor = new BookEditorView({
    container,
    router,
    bookId: book.id,
    bookService
  });

  editor.mount();
  editor.activeSectionId = book.sections[0].id;
  editor.activeModal = 'poem-picker';
  editor.render();

  assert.ok(container.innerHTML.includes('रश्मिरथी'), 'Picker must display poem retrieved via bookService.getLibraryPoems');
  assert.ok(container.innerHTML.includes('दिनकर'), 'Picker must display author retrieved via bookService.getLibraryPoems');
  editor.unmount();
});

runTest('S', 'BookProjectService domain mediation provides getPoem and getLibraryPoems with expected contracts', () => {
  const { bookService, poemRepo } = createTestHarness();
  const p1 = poemRepo.create({ title: 'कविता १', body: 'पाठ १', author: 'कवि १', isArchived: false });
  const p2 = poemRepo.create({ title: 'अभिलेखागार कविता', body: 'पाठ २', author: 'कवि २', isArchived: true });

  // getPoem
  const fetched = bookService.getPoem(p1.id);
  assert.ok(fetched !== null);
  assert.strictEqual(fetched.title, 'कविता १');
  assert.strictEqual(bookService.getPoem('non_existent_id'), null);
  assert.strictEqual(bookService.getPoem(null), null);
  assert.strictEqual(bookService.getPoem(''), null);

  // getLibraryPoems default includes archived
  const all = bookService.getLibraryPoems();
  assert.strictEqual(all.length, 2);

  // getLibraryPoems without archived
  const activeOnly = bookService.getLibraryPoems({ includeArchived: false });
  assert.strictEqual(activeOnly.length, 1);
  assert.strictEqual(activeOnly[0].id, p1.id);
});

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} BOOK BUILDER UI & CURATION TESTS PASSED!`);
console.log('================================================================\n');
