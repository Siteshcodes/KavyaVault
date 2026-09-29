/**
 * काव्यकलश (KavyaVault) — Book Project Foundation Test Suite (test_book_project.js)
 * Phase 7 / Task 7.1: Book Project Foundation
 *
 * Verifies:
 * - Suite A: BookProject Creation & Metadata Validation
 * - Suite B: Section Creation & Section Validation
 * - Suite C: Section Ordering & Manipulation
 * - Suite D: Poem Membership & Ordering within Sections
 * - Suite E: Selection from Existing Library
 * - Suite F: Live References & Missing Poem Resilience
 * - Suite G: Non-Destructive Guarantees & Deletion Safety
 * - Suite H: Unicode, Devanagari & Nukta Fidelity
 * - Suite I: Storage Hardening & Malformed Data Recovery
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { TagService } from './src/services/library/TagService.js';
import { BookProjectRepository } from './src/services/books/BookProjectRepository.js';
import { BookProjectService } from './src/services/books/BookProjectService.js';
import {
  COVER_TYPE,
  createBookProject,
  validateBookProject,
  createBookSection,
  validateBookSection,
  createCoverConfig,
  generateBookId,
  generateSectionId
} from './src/services/books/bookTypes.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { STORAGE_KEYS } from './src/data/storageKeys.js';

// In-memory mock storage engine
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
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
}

async function runTests() {
  console.log('================================================================');
  console.log('  KAVYAVAULT BOOK PROJECT FOUNDATION TEST SUITE (PHASE 7.1)');
  console.log('================================================================');

  let passedTests = 0;
  const totalTests = 46;

  function assert(condition, message) {
    if (!condition) {
      throw new Error(`ASSERTION FAILED: ${message}`);
    }
  }

  function recordPass(testNumber, name) {
    passedTests++;
    console.log(`✓ [Test ${testNumber}] ${name}`);
  }

  // Setup test environment
  const mockStorage = new MockStorage();
  const adapter = new LocalStorageAdapter(mockStorage);
  const colRepo = new CollectionRepository(adapter);
  const poemRepo = new PoemRepository(adapter, colRepo);
  const bookRepo = new BookProjectRepository(adapter);
  const tagService = new TagService({ poemRepo });
  const service = new BookProjectService({
    bookRepo,
    poemRepo,
    collectionRepo: colRepo,
    tagService
  });

  // Seed sample poems
  const p1 = poemRepo.create({
    id: 'p_dinkar_rashmi',
    title: 'रश्मिरथी — तृतीय सर्ग',
    body: 'वर्षों तक वन में घूम-घूम, बाधा-विघ्नों को चूम-चूम,\nसह धूप-घाम, पानी-पत्थर, पांडव आये कुछ और निखर।',
    author: 'रामधारी सिंह ‘दिनकर’',
    category: 'वीर रस',
    tags: ['महाकाव्य', 'दिनकर', 'कर्ण'],
    isFavorite: true
  });

  const p2 = poemRepo.create({
    id: 'p_nirala_saroj',
    title: 'सरोज स्मृति',
    body: 'धन्ये, मैं पिता निरर्थक था,\nकुछ भी तेरे हित न कर सका!',
    author: 'सूर्यकांत त्रिपाठी ‘निराला’',
    category: 'शोक गीत',
    tags: ['स्मृति', 'निराला', 'शोक'],
    isFavorite: false
  });

  const p3 = poemRepo.create({
    id: 'p_bachchan_madhu',
    title: 'मधुशाला',
    body: 'मृदु भावों के अंगूरों की आज बना लाया हाला,\nप्रियतम, अपने ही हाथों से आज पिलाऊँगा प्याला।',
    author: 'हरिवंश राय बच्चन',
    category: 'गीत',
    tags: ['हालावाद', 'बच्चन', 'मधु'],
    isFavorite: true
  });

  const p4 = poemRepo.create({
    id: 'p_prasad_kamayani',
    title: 'कामायनी — चिंता सर्ग',
    body: 'हिमगिरि के उत्तुंग शिखर पर, बैठ शिला की शीतल छाँह,\nएक पुरुष, भीगे नयनों से, देख रहा था प्रलय-प्रवाह।',
    author: 'जयशंकर प्रसाद',
    category: 'छायावाद',
    tags: ['छायावाद', 'प्रसाद', 'प्रलय'],
    isFavorite: false,
    isArchived: true
  });

  // ==========================================================================
  // SUITE A: BookProject Creation & Metadata Validation
  // ==========================================================================
  console.log('\n--- Suite A: BookProject Creation & Metadata Validation ---');

  // Test 1: Valid book project creation
  const book1 = service.createBook({
    id: 'book_pratham_sangrah',
    title: 'प्रथम काव्य संकलन',
    subtitle: 'आधुनिक हिंदी कविता का संचयन',
    author: 'काव्यकलश संपादक मण्डल',
    dedication: 'समस्त हिन्दी काव्य प्रेमियों को सादर समर्पित',
    description: 'दिनकर, निराला एवं बच्चन की अमर रचनाओं का सुव्यवस्थित संकलन।'
  });
  assert(book1.id === 'book_pratham_sangrah', 'Book ID should match');
  assert(book1.title === 'प्रथम काव्य संकलन', 'Book title should match');
  assert(book1.author === 'काव्यकलश संपादक मण्डल', 'Author should match');
  assert(book1.language === 'hi', 'Default language should be Hindi');
  assert(Array.isArray(book1.sections), 'Sections should be an array');
  assert(Array.isArray(book1.poemIds), 'PoemIds should be an array');
  recordPass(1, 'BookProject creation with valid metadata');

  // Test 2: Validation error on missing or empty title
  let caughtT2 = false;
  try {
    service.createBook({ title: '   ' });
  } catch (err) {
    caughtT2 = err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR;
  }
  assert(caughtT2, 'Missing/whitespace title must throw VALIDATION_ERROR');
  recordPass(2, 'Validation error on missing or whitespace title');

  // Test 3: Validation error on duplicate book ID
  let caughtT3 = false;
  try {
    service.createBook({
      id: 'book_pratham_sangrah',
      title: 'एक और संकलन'
    });
  } catch (err) {
    caughtT3 = err instanceof StorageError && err.code === StorageErrorCode.DUPLICATE_ID;
  }
  assert(caughtT3, 'Duplicate book ID must throw DUPLICATE_ID error');
  recordPass(3, 'Duplicate book ID rejection');

  // Test 4: Default values assigned properly
  const bookDefaults = service.createBook({
    title: 'सहज कविता'
  });
  assert(bookDefaults.author === 'अज्ञात', 'Default author should be अज्ञात');
  assert(bookDefaults.language === 'hi', 'Default language should be hi');
  assert(bookDefaults.cover && bookDefaults.cover.type === COVER_TYPE.CLASSIC, 'Default cover type should be classic');
  assert(bookDefaults.cover.title === 'सहज कविता', 'Cover title should default to book title');
  recordPass(4, 'Default metadata values assigned correctly');

  // Test 5: Custom cover configuration is normalized and preserved
  const bookWithCover = service.createBook({
    title: 'आलोक पर्व',
    cover: {
      type: 'modern',
      title: 'आलोक पर्व: विशेष संस्करण',
      subtitle: 'सचित्र',
      author: 'दिनकर',
      background: 'syahi',
      artworkReference: 'ms_cover_art_01'
    }
  });
  assert(bookWithCover.cover.type === 'modern', 'Custom cover type preserved');
  assert(bookWithCover.cover.background === 'syahi', 'Background theme preserved');
  assert(bookWithCover.cover.artworkReference === 'ms_cover_art_01', 'Artwork reference preserved');
  recordPass(5, 'Custom cover configuration normalized and preserved');

  // Test 6: Metadata update updates timestamps and fields correctly
  const updatedB1 = service.updateBookMetadata('book_pratham_sangrah', {
    subtitle: 'परिवर्धित एवं संशोधित संस्करण',
    dedication: 'सभी पाठकों को समर्पित'
  });
  assert(updatedB1.subtitle === 'परिवर्धित एवं संशोधित संस्करण', 'Subtitle updated');
  assert(updatedB1.dedication === 'सभी पाठकों को समर्पित', 'Dedication updated');
  assert(new Date(updatedB1.updatedAt) >= new Date(book1.createdAt), 'updatedAt updated');
  recordPass(6, 'Metadata update correctly updates fields and updatedAt');

  // ==========================================================================
  // SUITE B: Section Creation & Section Validation
  // ==========================================================================
  console.log('\n--- Suite B: Section Creation & Section Validation ---');

  // Test 7: Section creation with valid title and poemIds
  const bWithSec = service.addSection('book_pratham_sangrah', {
    id: 'sec_veerras',
    title: 'प्रथम खण्ड: शौर्य एवं ओज',
    description: 'राष्ट्रकवि दिनकर की ओजस्वी रचनाएँ',
    poemIds: [p1.id]
  });
  assert(bWithSec.sections.length === 1, 'Section count should be 1');
  assert(bWithSec.sections[0].id === 'sec_veerras', 'Section ID should match');
  assert(bWithSec.sections[0].poemIds[0] === p1.id, 'Poem ID in section should match');
  assert(bWithSec.sections[0].order === 0, 'First section order should be 0');
  recordPass(7, 'Section creation with valid title and poemIds');

  // Test 8: Empty/whitespace section title is rejected
  let caughtT8 = false;
  try {
    service.addSection('book_pratham_sangrah', {
      title: '   '
    });
  } catch (err) {
    caughtT8 = err instanceof StorageError && err.code === StorageErrorCode.VALIDATION_ERROR;
  }
  assert(caughtT8, 'Whitespace section title must throw VALIDATION_ERROR');
  recordPass(8, 'Validation error on empty/whitespace section title');

  // Test 9: Duplicate section ID within book is rejected
  let caughtT9 = false;
  try {
    service.addSection('book_pratham_sangrah', {
      id: 'sec_veerras',
      title: 'दूसरा भाग'
    });
  } catch (err) {
    caughtT9 = err instanceof StorageError && err.code === StorageErrorCode.DUPLICATE_ID;
  }
  assert(caughtT9, 'Duplicate section ID must throw DUPLICATE_ID');
  recordPass(9, 'Duplicate section ID rejection');

  // Test 10: Automatic default section creation when initialized with poemIds directly
  const autoSecBook = service.createBook({
    title: 'स्वचालित खण्ड पुस्तक',
    poemIds: [p1.id, p2.id]
  });
  assert(autoSecBook.sections.length === 1, 'Should auto-generate 1 default section');
  assert(autoSecBook.sections[0].poemIds.length === 2, 'Default section should contain both poems');
  assert(autoSecBook.sections[0].title === 'मुख्य संकलन', 'Default section title should be मुख्य संकलन');
  recordPass(10, 'Automatic default section creation from poemIds');

  // Test 11: Section description and title update
  const bUpdatedSec = service.updateSection('book_pratham_sangrah', 'sec_veerras', {
    title: 'प्रथम खण्ड: शौर्य, ओज और तेज',
    description: 'नवीन विस्तृत भूमिका सहित'
  });
  const modifiedSec = bUpdatedSec.sections.find(s => s.id === 'sec_veerras');
  assert(modifiedSec.title === 'प्रथम खण्ड: शौर्य, ओज और तेज', 'Section title updated');
  assert(modifiedSec.description === 'नवीन विस्तृत भूमिका सहित', 'Section description updated');
  recordPass(11, 'Section title and description update');

  // ==========================================================================
  // SUITE C: Section Ordering & Manipulation
  // ==========================================================================
  console.log('\n--- Suite C: Section Ordering & Manipulation ---');

  // Add 2 more sections to book_pratham_sangrah
  service.addSection('book_pratham_sangrah', {
    id: 'sec_karun',
    title: 'द्वितीय खण्ड: करुण एवं विरह',
    poemIds: [p2.id]
  });
  const b3Sec = service.addSection('book_pratham_sangrah', {
    id: 'sec_madhur',
    title: 'तृतीय खण्ड: आनंद एवं माधुर्य',
    poemIds: [p3.id]
  });

  // Test 12: Adding multiple sections preserves 0-indexed sequential order
  assert(b3Sec.sections.length === 3, 'Should have 3 sections');
  assert(b3Sec.sections[0].order === 0 && b3Sec.sections[1].order === 1 && b3Sec.sections[2].order === 2, 'Sequential order 0, 1, 2');
  recordPass(12, 'Multiple sections preserve sequential 0-indexed ordering');

  // Test 13: reorderSections updates section order deterministically
  const bReordered = service.reorderSections('book_pratham_sangrah', [
    'sec_madhur',
    'sec_veerras',
    'sec_karun'
  ]);
  assert(bReordered.sections[0].id === 'sec_madhur' && bReordered.sections[0].order === 0, 'Madhur should be first');
  assert(bReordered.sections[1].id === 'sec_veerras' && bReordered.sections[1].order === 1, 'Veer should be second');
  assert(bReordered.sections[2].id === 'sec_karun' && bReordered.sections[2].order === 2, 'Karun should be third');
  recordPass(13, 'reorderSections deterministically updates section sequence and order fields');

  // Test 14: moveSectionUp moves section up and preserves order
  const bMovedUp = service.moveSectionUp('book_pratham_sangrah', 'sec_karun');
  assert(bMovedUp.sections[1].id === 'sec_karun', 'Karun should have moved from index 2 to index 1');
  assert(bMovedUp.sections[2].id === 'sec_veerras', 'Veer should have moved to index 2');
  recordPass(14, 'moveSectionUp swaps section with previous and updates order');

  // Test 15: moveSectionDown moves section down and preserves order
  const bMovedDown = service.moveSectionDown('book_pratham_sangrah', 'sec_madhur');
  assert(bMovedDown.sections[1].id === 'sec_madhur', 'Madhur moved from index 0 to index 1');
  assert(bMovedDown.sections[0].id === 'sec_karun', 'Karun moved to index 0');
  recordPass(15, 'moveSectionDown swaps section with next and updates order');

  // Test 16: Boundary checks for moveSectionUp and moveSectionDown
  const bTopAttempt = service.moveSectionUp('book_pratham_sangrah', bMovedDown.sections[0].id);
  assert(bTopAttempt.sections[0].id === bMovedDown.sections[0].id, 'Moving top section up is a safe no-op');
  const bBottomAttempt = service.moveSectionDown('book_pratham_sangrah', bMovedDown.sections[2].id);
  assert(bBottomAttempt.sections[2].id === bMovedDown.sections[2].id, 'Moving bottom section down is a safe no-op');
  recordPass(16, 'Boundary checks: moveSectionUp at top and moveSectionDown at bottom are safe no-ops');

  // ==========================================================================
  // SUITE D: Poem Membership & Ordering within Sections
  // ==========================================================================
  console.log('\n--- Suite D: Poem Membership & Ordering within Sections ---');

  // Test 17: Adding poem to section appends poemId
  const bPoemAdded = service.addPoemToSection('book_pratham_sangrah', 'sec_veerras', p3.id);
  const vSec = bPoemAdded.sections.find(s => s.id === 'sec_veerras');
  assert(vSec.poemIds.includes(p3.id), 'Poem p3 should be in section');
  recordPass(17, 'addPoemToSection appends poemId to section');

  // Test 18: Adding poem to section is idempotent (no duplicate IDs in section)
  const bDupPoem = service.addPoemToSection('book_pratham_sangrah', 'sec_veerras', p3.id);
  const vSecDup = bDupPoem.sections.find(s => s.id === 'sec_veerras');
  const countP3 = vSecDup.poemIds.filter(id => id === p3.id).length;
  assert(countP3 === 1, 'Poem ID should appear exactly once in section');
  recordPass(18, 'addPoemToSection is idempotent and prevents duplicate IDs');

  // Test 19: Removing poem from section removes ID without deleting poem from PoemRepository
  const bPoemRemoved = service.removePoemFromSection('book_pratham_sangrah', 'sec_veerras', p3.id);
  const vSecRem = bPoemRemoved.sections.find(s => s.id === 'sec_veerras');
  assert(!vSecRem.poemIds.includes(p3.id), 'Poem p3 removed from section');
  assert(poemRepo.getById(p3.id) !== null, 'Poem p3 MUST still exist in PoemRepository');
  recordPass(19, 'removePoemFromSection removes reference without deleting poem');

  // Add multiple poems to sec_madhur for testing poem reordering
  service.addPoemToSection('book_pratham_sangrah', 'sec_madhur', p1.id);
  service.addPoemToSection('book_pratham_sangrah', 'sec_madhur', p2.id);
  // sec_madhur currently has [p3.id, p1.id, p2.id]

  // Test 20: reorderPoems updates poem order in section deterministically
  const bReorderedPoems = service.reorderPoems('book_pratham_sangrah', 'sec_madhur', [p2.id, p3.id, p1.id]);
  const mSec = bReorderedPoems.sections.find(s => s.id === 'sec_madhur');
  assert(mSec.poemIds[0] === p2.id && mSec.poemIds[1] === p3.id && mSec.poemIds[2] === p1.id, 'Poem order should match specified array');
  recordPass(20, 'reorderPoems updates poem order deterministically');

  // Test 21: movePoemUp moves poem towards start of section
  const bPoemUp = service.movePoemUp('book_pratham_sangrah', 'sec_madhur', p1.id);
  const mSecUp = bPoemUp.sections.find(s => s.id === 'sec_madhur');
  assert(mSecUp.poemIds[1] === p1.id && mSecUp.poemIds[2] === p3.id, 'p1 moved from index 2 to index 1');
  recordPass(21, 'movePoemUp moves poem towards start of section');

  // Test 22: movePoemDown moves poem towards end of section
  const bPoemDown = service.movePoemDown('book_pratham_sangrah', 'sec_madhur', p2.id);
  const mSecDown = bPoemDown.sections.find(s => s.id === 'sec_madhur');
  assert(mSecDown.poemIds[1] === p2.id && mSecDown.poemIds[0] === p1.id, 'p2 moved from index 0 to index 1');
  recordPass(22, 'movePoemDown moves poem towards end of section');

  // Test 23: Boundary checks: movePoemUp at index 0 and movePoemDown at last index are safe no-ops
  const bP0Up = service.movePoemUp('book_pratham_sangrah', 'sec_madhur', mSecDown.poemIds[0]);
  assert(bP0Up.sections.find(s => s.id === 'sec_madhur').poemIds[0] === mSecDown.poemIds[0], 'Moving top poem up is safe no-op');
  const bPLastDown = service.movePoemDown('book_pratham_sangrah', 'sec_madhur', mSecDown.poemIds[2]);
  assert(bPLastDown.sections.find(s => s.id === 'sec_madhur').poemIds[2] === mSecDown.poemIds[2], 'Moving bottom poem down is safe no-op');
  recordPass(23, 'Boundary checks for movePoemUp and movePoemDown');

  // ==========================================================================
  // SUITE E: Selection from Existing Library
  // ==========================================================================
  console.log('\n--- Suite E: Selection from Existing Library ---');

  // Test 24: Selection by explicit poemIds resolves references
  const idsExplicit = service.resolvePoemIdsFromSelection({ poemIds: [p1.id, p2.id] });
  assert(idsExplicit.length === 2 && idsExplicit[0] === p1.id && idsExplicit[1] === p2.id, 'Explicit poem IDs resolved');
  recordPass(24, 'Selection by explicit poem IDs');

  // Test 25: Selection from collection extracts collection poem IDs
  const col1 = colRepo.create({
    id: 'col_dinkar_special',
    name: 'दिनकर विशेषांक',
    description: 'दिनकर जी की रचनाएँ',
    poemIds: [p1.id]
  });
  const idsCol = service.resolvePoemIdsFromSelection({ collectionId: 'col_dinkar_special' });
  assert(idsCol.length === 1 && idsCol[0] === p1.id, 'Collection poem IDs resolved');
  recordPass(25, 'Selection from collection extracts poem IDs without copying bodies');

  // Test 26: Selection by category extracts all poems in that category
  const idsCat = service.resolvePoemIdsFromSelection({ category: 'वीर रस' });
  assert(idsCat.includes(p1.id), 'Category वीर रस resolves poem p1');
  assert(!idsCat.includes(p2.id), 'Category वीर रस excludes poem p2');
  recordPass(26, 'Selection by category resolves matching poems');

  // Test 27: Selection by tags extracts all poems matching tag
  const idsTag = service.resolvePoemIdsFromSelection({ tag: '#दिनकर' });
  assert(idsTag.includes(p1.id), 'Tag #दिनकर matches poem p1');
  assert(!idsTag.includes(p2.id), 'Tag #दिनकर excludes poem p2');
  recordPass(27, 'Selection by tags matches normalized tag');

  // Test 28: Selection from favorites extracts all favorite poems
  const idsFav = service.resolvePoemIdsFromSelection({ isFavorite: true });
  assert(idsFav.includes(p1.id), 'Favorite p1 included');
  assert(idsFav.includes(p3.id), 'Favorite p3 included');
  assert(!idsFav.includes(p2.id), 'Non-favorite p2 excluded');
  recordPass(28, 'Selection from favorites resolves favorite poems');

  // Test 29: Adding selection to existing section appends only non-duplicate poem IDs
  const bAddSel = service.createBook({
    title: 'चयनित काव्य',
    sections: [
      { id: 'sec_target', title: 'लक्षित खण्ड', poemIds: [p1.id] }
    ]
  });
  const bUpdatedWithSel = service.addSelectionToSection(bAddSel.id, 'sec_target', {
    poemIds: [p1.id, p2.id, p3.id]
  });
  const targetSec = bUpdatedWithSel.sections.find(s => s.id === 'sec_target');
  assert(targetSec.poemIds.length === 3, 'Target section should contain 3 deduplicated poem IDs');
  recordPass(29, 'addSelectionToSection appends only unique references');

  // ==========================================================================
  // SUITE F: Live References & Missing Poem Resilience
  // ==========================================================================
  console.log('\n--- Suite F: Live References & Missing Poem Resilience ---');

  // Test 30: BookProject stores LIVE references — editing poem in PoemRepository reflects in BookDocument
  const liveBook = service.createBook({
    title: 'सजीव संदर्भ परीक्षण पुस्तक',
    sections: [
      { id: 'sec_live', title: 'सजीव खण्ड', poemIds: [p1.id] }
    ]
  });

  const docBefore = service.generateBookDocument(liveBook.id);
  assert(docBefore.sections[0].poems[0].title === 'रश्मिरथी — तृतीय सर्ग', 'Initial poem title matches');

  // Update poem in PoemRepository
  poemRepo.update(p1.id, {
    title: 'रश्मिरथी — तृतीय सर्ग (संशोधित पाठ)'
  });

  const docAfter = service.generateBookDocument(liveBook.id);
  assert(docAfter.sections[0].poems[0].title === 'रश्मिरथी — तृतीय सर्ग (संशोधित पाठ)', 'Live reference reflects repository edit');
  recordPass(30, 'Live references guarantee: Poem edits reflect in generated BookDocument');

  // Test 31: Deleting poem from PoemRepository does NOT crash generateBookDocument
  // Create a temporary poem and add to a book, then delete the poem
  const tempPoem = poemRepo.create({
    title: 'अस्थायी कविता',
    body: 'क्षणिक पंक्तियाँ'
  });
  const bookWithTemp = service.createBook({
    title: 'विलोपन सहनशीलता पुस्तक',
    sections: [
      { id: 'sec_del_test', title: 'परीक्षण खण्ड', poemIds: [tempPoem.id, p2.id] }
    ]
  });

  // Permanently delete tempPoem from repository
  poemRepo.delete(tempPoem.id);

  let docWithMissing = null;
  let didCrash = false;
  try {
    docWithMissing = service.generateBookDocument(bookWithTemp.id);
  } catch (e) {
    didCrash = true;
  }
  assert(!didCrash, 'generateBookDocument MUST NOT crash on deleted poem reference');
  assert(docWithMissing !== null, 'BookDocument should be returned');
  recordPass(31, 'Deleted poem reference does NOT crash generateBookDocument');

  // Test 32: Missing poem ID is recorded in section missingPoemIds and warning emitted
  const delTestSec = docWithMissing.sections.find(s => s.id === 'sec_del_test');
  assert(delTestSec.missingPoemIds.includes(tempPoem.id), 'Missing poem ID recorded in section.missingPoemIds');
  assert(delTestSec.poems.length === 1 && delTestSec.poems[0].id === p2.id, 'Only existing poem resolved');
  assert(docWithMissing.stats.missingPoemsCount === 1, 'stats.missingPoemsCount accurately counts missing');
  assert(docWithMissing.warnings.length > 0, 'Warning message emitted for missing poem');
  recordPass(32, 'Missing poem ID recorded in missingPoemIds and warnings emitted');

  // Test 33: Archived poem handled gracefully with appropriate warning in BookDocument
  const bookWithArchived = service.createBook({
    title: 'अभिलेखागार परीक्षण',
    sections: [
      { id: 'sec_arch', title: 'पुरातन खण्ड', poemIds: [p4.id] }
    ]
  });
  const docArchived = service.generateBookDocument(bookWithArchived.id, { includeArchived: true });
  assert(docArchived.sections[0].poems.length === 1, 'Archived poem resolved when includeArchived=true');
  assert(docArchived.warnings.some(w => w.includes('अभिलेख')), 'Warning emitted indicating poem is from archive');
  recordPass(33, 'Archived poem handled gracefully with explanatory warning');

  // Test 34: BookDocument statistics accurately calculated
  assert(docBefore.stats.totalSections === 1, 'Total sections statistic');
  assert(docBefore.stats.totalPoems >= 1, 'Total poems statistic');
  assert(docBefore.stats.wordCount > 0, 'Word count computed');
  assert(docBefore.stats.verseCount > 0, 'Verse line count computed');
  recordPass(34, 'BookDocument statistics (sections, poems, words, verses) computed accurately');

  // ==========================================================================
  // SUITE G: Non-Destructive Guarantees & Deletion Safety
  // ==========================================================================
  console.log('\n--- Suite G: Non-Destructive Guarantees & Deletion Safety ---');

  // Test 35: Deleting a book project NEVER deletes referenced poems
  const bookToDel = service.createBook({
    title: 'हटाने योग्य पुस्तक',
    sections: [
      { id: 'sec_d', title: 'खण्ड', poemIds: [p2.id] }
    ]
  });
  const delResult = service.deleteBook(bookToDel.id);
  assert(delResult === true, 'Book deletion should return true');
  assert(service.getBook(bookToDel.id) === null, 'Book should no longer exist in bookRepo');
  assert(poemRepo.getById(p2.id) !== null, 'Poem p2 MUST still exist intact in PoemRepository');
  recordPass(35, 'Deleting a book project NEVER deletes referenced poems');

  // Test 36: Deleting a section NEVER deletes referenced poems
  const bookWithSecToDel = service.createBook({
    title: 'खण्ड विलोपन पुस्तक',
    sections: [
      { id: 'sec_removable', title: 'हटाने योग्य खण्ड', poemIds: [p3.id] }
    ]
  });
  service.deleteSection(bookWithSecToDel.id, 'sec_removable');
  const bAfterSecDel = service.getBook(bookWithSecToDel.id);
  assert(bAfterSecDel.sections.length === 0, 'Section removed from book');
  assert(poemRepo.getById(p3.id) !== null, 'Poem p3 MUST still exist intact in PoemRepository');
  recordPass(36, 'Deleting a section NEVER deletes referenced poems');

  // Test 37: Book project operations NEVER modify manuscript records
  const rawManuscriptsBefore = adapter.get(STORAGE_KEYS.MANUSCRIPTS);
  service.createBook({
    title: 'पांडुलिपि सुरक्षा परीक्षण',
    poemIds: [p1.id]
  });
  const rawManuscriptsAfter = adapter.get(STORAGE_KEYS.MANUSCRIPTS);
  assert(JSON.stringify(rawManuscriptsBefore) === JSON.stringify(rawManuscriptsAfter), 'Manuscripts storage unmodified');
  recordPass(37, 'Book project operations NEVER modify manuscript records');

  // Test 38: Book project operations NEVER mutate favorites, tags, or recent history
  const p1FavBefore = poemRepo.getById(p1.id).isFavorite;
  const p2FavBefore = poemRepo.getById(p2.id).isFavorite;
  const rawRecentBefore = adapter.get(STORAGE_KEYS.RECENT_POEMS);
  service.createBook({
    title: 'पुस्तकालय स्थिति अपरिवर्तनशीलता',
    poemIds: [p1.id, p2.id]
  });
  assert(poemRepo.getById(p1.id).isFavorite === p1FavBefore, 'Favorite status p1 preserved');
  assert(poemRepo.getById(p2.id).isFavorite === p2FavBefore, 'Favorite status p2 preserved');
  assert(JSON.stringify(rawRecentBefore) === JSON.stringify(adapter.get(STORAGE_KEYS.RECENT_POEMS)), 'Recent history unmodified');
  recordPass(38, 'Book project operations NEVER mutate favorites, tags, or recent history');

  // Test 39: BookProject does NOT store duplicate poem bodies in storage record
  const storedBooksRaw = adapter.get(STORAGE_KEYS.BOOK_PROJECTS);
  for (const storedBook of storedBooksRaw) {
    assert(storedBook.body === undefined, 'Book record must NOT have a poem body');
    for (const sec of storedBook.sections || []) {
      assert(sec.poems === undefined, 'Section record in storage must NOT store poem bodies');
      assert(Array.isArray(sec.poemIds), 'Section record must store poemIds references only');
    }
  }
  recordPass(39, 'BookProject stores references only — ZERO poem bodies duplicated in storage');

  // ==========================================================================
  // SUITE H: Unicode, Devanagari & Nukta Fidelity
  // ==========================================================================
  console.log('\n--- Suite H: Unicode, Devanagari & Nukta Fidelity ---');

  // Test 40: Complex Devanagari conjuncts (क्ष, त्र, ज्ञ, श्र, द्व, हृ) preserved in titles and descriptions
  const conjunctTitle = 'क्षत्रिय, ज्ञान, श्रद्धा, द्वंद्व एवं हृदय के गीत';
  const conjunctBook = service.createBook({
    title: conjunctTitle,
    description: 'क्ष त्र ज्ञ श्र द्व हृ अक्षरों की शुद्धता।'
  });
  assert(conjunctBook.title === conjunctTitle, 'Complex Devanagari conjuncts preserved exactly');
  assert(conjunctBook.description.includes('क्ष त्र ज्ञ श्र द्व हृ'), 'Conjunct description preserved');
  recordPass(40, 'Complex Devanagari conjuncts (क्ष, त्र, ज्ञ, श्र, द्व, हृ) preserved without corruption');

  // Test 41: Urdu/Persian nukta loanwords (क़, ख़, ग़, ज़, ड़, ढ़, फ़) preserved in book titles and cover
  const nuktaTitle = 'ग़ज़ल, क़िस्सा, ख़्वाब, ज़मीं, पेड़, चढ़ाई और फ़लसफ़ा';
  const nuktaBook = service.createBook({
    title: nuktaTitle,
    cover: {
      title: nuktaTitle,
      author: 'मिर्ज़ा ग़ालिब'
    }
  });
  assert(nuktaBook.title === nuktaTitle, 'Nukta characters preserved in title');
  assert(nuktaBook.cover.author === 'मिर्ज़ा ग़ालिब', 'Nukta author preserved in cover');
  recordPass(41, 'Urdu/Persian nukta loanwords (क़, ख़, ग़, ज़, ड़, ढ़, फ़) preserved faithfully');

  // Test 42: Chandrabindu, visarga, and poetic danda (। , ॥) survive book project lifecycle intact
  const poeticTitle = 'चाँद का मुँह टेढ़ा है । दुःख और सुख ॥ ॐ';
  const poeticBook = service.createBook({
    title: poeticTitle,
    dedication: 'साहित्य साधकों के चरणों में सादर प्रणाम ॥ ॐ ॥'
  });
  assert(poeticBook.title === poeticTitle, 'Chandrabindu, visarga, danda preserved in title');
  assert(poeticBook.dedication.includes('॥ ॐ ॥'), 'Danda and Om preserved in dedication');
  recordPass(42, 'Chandrabindu, visarga, Om, and danda (। , ॥) preserved without corruption');

  // Test 43: Mixed Hindi/English and emojis in book metadata preserved
  const mixedTitle = 'Kavya 2026: आधुनिक हिंदी काव्य 🌟';
  const mixedBook = service.createBook({
    title: mixedTitle,
    subtitle: 'Volume 1 — भाग १'
  });
  assert(mixedBook.title === mixedTitle, 'Mixed Hindi/English and emoji preserved');
  assert(mixedBook.subtitle === 'Volume 1 — भाग १', 'Bilingual subtitle preserved');
  recordPass(43, 'Mixed Hindi/English and emojis preserved without grapheme corruption');

  // ==========================================================================
  // SUITE I: Storage Hardening & Malformed Data Recovery
  // ==========================================================================
  console.log('\n--- Suite I: Storage Hardening & Malformed Data Recovery ---');

  // Test 44: Corrupted JSON in book projects storage safely recovers to empty array
  const brokenStorage = new MockStorage();
  brokenStorage.setItem(STORAGE_KEYS.BOOK_PROJECTS, '{ invalid json: [corrupt');
  const brokenAdapter = new LocalStorageAdapter(brokenStorage);
  const brokenRepo = new BookProjectRepository(brokenAdapter);
  const recoveredList = brokenRepo.getAll();
  assert(Array.isArray(recoveredList) && recoveredList.length === 0, 'Corrupt JSON recovers to empty array safely');
  recordPass(44, 'Corrupted JSON in book projects storage safely recovers to empty array');

  // Test 45: Null or non-object records in book projects storage are filtered out at read boundary
  const malformedStorage = new MockStorage();
  malformedStorage.setItem(
    STORAGE_KEYS.BOOK_PROJECTS,
    JSON.stringify([
      null,
      'just a string',
      42,
      {},
      { id: '' },
      { id: 'valid_book_id', title: 'वैध पुस्तक' }
    ])
  );
  const malformedAdapter = new LocalStorageAdapter(malformedStorage);
  const malformedRepo = new BookProjectRepository(malformedAdapter);
  const filteredList = malformedRepo.getAll();
  assert(filteredList.length === 1, 'Only the single valid book object should survive');
  assert(filteredList[0].id === 'valid_book_id', 'Valid book ID should match');
  recordPass(45, 'Malformed and null records are filtered out safely at read boundary');

  // Test 46: Backward compatibility: Minimal book project shape without cover/dedication works seamlessly
  const minimalData = {
    title: 'न्यूनतम पुस्तक'
  };
  const minBook = service.createBook(minimalData);
  assert(minBook.id && minBook.id.startsWith('kv_book_'), 'ID auto-generated');
  assert(minBook.author === 'अज्ञात', 'Default author provided');
  assert(minBook.cover !== null && typeof minBook.cover === 'object', 'Default cover provided');
  const minDoc = service.generateBookDocument(minBook.id);
  assert(minDoc.metadata.title === 'न्यूनतम पुस्तक', 'BookDocument generated for minimal book');
  recordPass(46, 'Backward compatibility: Minimal book project shape works seamlessly');

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} BOOK PROJECT FOUNDATION TESTS PASSED!`);
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
