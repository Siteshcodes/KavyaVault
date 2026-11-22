import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, PDFDict, PDFRawStream } from 'pdf-lib';
import { BackupService, BACKUP_KEYS, RESTORE_JOURNAL } from './src/services/storage/BackupService.js';
import { STORAGE_KEYS as K } from './src/data/storageKeys.js';
import { BookLayoutEngine } from './src/services/books/BookLayoutEngine.js';
import { BookPdfGenerator } from './src/services/books/export/BookPdfGenerator.js';
import { BookEpubGenerator } from './src/services/books/export/BookEpubGenerator.js';
import { BookExportService } from './src/services/books/export/BookExportService.js';
import { SimpleZip } from './src/services/books/export/SimpleZip.js';
import { createLayoutConfig } from './src/services/books/bookLayoutTypes.js';
import { utf16Hex } from './src/services/books/export/PdfFontRegistry.js';

class Storage {
  constructor(records = {}) { this.data = new Map(Object.entries(records)); this.failOnce = null; }
  getItem(key) { return this.data.get(key) ?? null; }
  removeItem(key) { this.data.delete(key); }
  setItem(key, value) {
    if (this.failOnce === key) { this.failOnce = null; throw new Error('QuotaExceededError'); }
    this.data.set(key, value);
  }
}
const records = () => ({
  [K.POEMS]: JSON.stringify([{ id: 'poem1', title: 'चाँद', body: 'कविता की किरणें खिलीं।\n\nक्ष त्र ज्ञ श्र हृ क़ ग़ ॐ दुःख ॥ 🌙 ✨', manuscriptId: 'ms1' }]),
  [K.MANUSCRIPTS]: JSON.stringify([{ id: 'ms1', originalManuscript: { id: 'image1', mimeType: 'image/png', data: 'data:image/png;base64,aGVsbG8=' }, transcriptionHistory: [{ id: 'version1', text: 'अक्षर' }] }]),
  [K.DRAFTS]: JSON.stringify({ id: 'draft1', body: 'अधूरी कविता' }),
  [K.COLLECTIONS]: JSON.stringify([{ id: 'col1', name: 'संग्रह', poemIds: ['poem1'] }]),
  [K.BOOK_PROJECTS]: JSON.stringify([{ id: 'book1', title: 'संकलन', sections: [{ title: 'खण्ड', poemIds: ['poem1'] }] }]),
  [K.RECENT_POEMS]: JSON.stringify([{ poemId: 'poem1', viewedAt: '2026-11-22T00:00:00Z' }]),
  [K.THEME]: 'velvet-night', [K.METADATA]: JSON.stringify({ schemaVersion: 2 })
});
const backupFor = async changes => new BackupService(new Storage({ ...records(), ...changes })).exportBackup();
const document = (body = 'कविता की किरणें खिलीं।\nक्ष त्र ज्ञ श्र हृ क़ ग़ चाँद ॐ दुःख । ॥ 🌙 ✨') => ({
  id: 'kv_book_test', metadata: { title: 'काव्य परीक्षण', author: 'परीक्षण कवि' },
  sections: [{ id: 'sec1', title: 'अक्षर', poems: [{ id: 'poem1', title: 'चाँद', author: 'परीक्षण कवि', body }] }],
  stats: { totalPoems: 1 }, warnings: []
});

test('Full backup preserves every raw record, IDs, image bytes, draft and theme', async () => {
  const source = new BackupService(new Storage(records()));
  const targetStorage = new Storage({ foreign: 'keep', [K.POEMS]: 'old' });
  const target = new BackupService(targetStorage);
  const backup = await source.exportBackup();
  assert.deepEqual((await target.inspectBackup(backup)).counts, { poems: 1, manuscripts: 1, collections: 1, books: 1 });
  await target.restoreBackup(backup);
  assert.deepEqual(target.snapshot(), source.snapshot());
  assert.equal(targetStorage.getItem('foreign'), 'keep');
  assert.equal(targetStorage.getItem(RESTORE_JOURNAL), null);
});
test('Checksum failure refuses restore before writing anything', async () => {
  const backup = JSON.parse(await backupFor());
  backup.records[K.POEMS] = backup.records[K.POEMS].replace('चाँद', 'सूरज');
  const service = new BackupService(new Storage(records()));
  const before = service.snapshot();
  await assert.rejects(service.restoreBackup(JSON.stringify(backup)), /अखंडता/);
  assert.deepEqual(service.snapshot(), before);
});
test('Future or missing schema and foreign record keys are rejected', async () => {
  for (const mutate of [b => { b.schemaVersion = 999; }, b => { delete b.schemaVersion; }, b => { b.records.foreign = 'bad'; }]) {
    const b = JSON.parse(await backupFor()); mutate(b);
    await assert.rejects(new BackupService(new Storage()).inspectBackup(JSON.stringify(b)));
  }
});
test('Duplicate record IDs and invalid manuscripts are rejected', async () => {
  for (const changes of [{ [K.POEMS]: JSON.stringify([{ id: 'x', title: 'x', body: 'x' }, { id: 'x', title: 'x', body: 'x' }]) }, { [K.MANUSCRIPTS]: '[{"id":"x"}]' }]) {
    await assert.rejects(new BackupService(new Storage()).inspectBackup(await backupFor(changes)));
  }
});
test('Imported archives cannot reference network images or inject prototypes', async () => {
  for (const original of [{ mimeType: 'image/png', data: 'https://example.org/image.png' }, { mimeType: 'image/png', data: 'javascript:alert(1)' }]) {
    await assert.rejects(new BackupService(new Storage()).inspectBackup(await backupFor({ [K.MANUSCRIPTS]: JSON.stringify([{ id: 'ms', originalManuscript: original }]) })), /चित्र/);
  }
  await assert.rejects(new BackupService(new Storage()).inspectBackup(await backupFor({ [K.DRAFTS]: '{"body":"x","__proto__":{"admin":true}}' })), /असुरक्षित/);
});
test('Journal quota failure leaves original library untouched', async () => {
  const storage = new Storage(records()); const service = new BackupService(storage);
  const before = service.snapshot(); storage.failOnce = RESTORE_JOURNAL;
  await assert.rejects(service.restoreBackup(await backupFor({ [K.POEMS]: '[]' })), /पर्याप्त स्थान/);
  assert.deepEqual(service.snapshot(), before);
});
test('Mid-restore write failure rolls back every record', async () => {
  const storage = new Storage(records()); const service = new BackupService(storage);
  const before = service.snapshot(); storage.failOnce = K.MANUSCRIPTS;
  await assert.rejects(service.restoreBackup(await backupFor({ [K.POEMS]: '[]' })), /पुराना डेटा/);
  assert.deepEqual(service.snapshot(), before);
  assert.equal(storage.getItem(RESTORE_JOURNAL), null);
});
test('Interrupted restore recovers the previous snapshot on startup', () => {
  const storage = new Storage(records()); const service = new BackupService(storage);
  const before = service.snapshot();
  storage.setItem(RESTORE_JOURNAL, JSON.stringify({ previous: before }));
  storage.setItem(K.POEMS, '[]'); storage.removeItem(K.BOOK_PROJECTS);
  assert.equal(service.recoverInterruptedRestore(), true);
  assert.deepEqual(service.snapshot(), before);
  assert.equal(service.recoverInterruptedRestore(), false);
});
test('Corrupted records can still be downloaded as a rescue copy', async () => {
  const service = new BackupService(new Storage({ [K.POEMS]: '{corrupt' }));
  const backup = await service.exportBackup();
  assert.equal(JSON.parse(backup).records[K.POEMS], '{corrupt');
  await assert.rejects(service.inspectBackup(backup), /दूषित/);
});
test('All allowed manuscript formats round-trip without changing bytes', async () => {
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp']) {
    const data = 'data:' + mimeType + ';base64,aGVsbG8=';
    const text = await backupFor({ [K.MANUSCRIPTS]: JSON.stringify([{ id: 'ms1', originalManuscript: { mimeType, data } }]) });
    const target = new BackupService(new Storage()); await target.restoreBackup(text);
    assert.equal(JSON.parse(target.storage.getItem(K.MANUSCRIPTS))[0].originalManuscript.data, data);
  }
});
test('One 200-line stanza paginates without loss, duplication or overflow', async () => {
  const lines = Array.from({ length: 200 }, (_, i) => `पंक्ति ${i + 1}: चाँद`);
  const layout = BookLayoutEngine.generateLayout(document(lines.join('\n')));
  const actual = layout.pages.flatMap(p => p.blocks.filter(b => b.type === 'stanza').flatMap(b => b.content));
  assert.deepEqual(actual, lines);
  const pdf = await PDFDocument.load(BookPdfGenerator.generatePdf(layout).data);
  assert.equal(pdf.getPageCount(), layout.pages.length);
});
test('Independent PDF parser resolves Hindi metadata, page tree and embedded fonts', async () => {
  const source = document(); const before = JSON.stringify(source);
  const result = BookPdfGenerator.generatePdf(BookLayoutEngine.generateLayout(source));
  const pdf = await PDFDocument.load(result.data);
  assert.equal(pdf.getTitle(), 'काव्य परीक्षण'); assert.equal(pdf.getAuthor(), 'परीक्षण कवि');
  assert.equal(pdf.getCreator(), 'काव्यकलश KavyaVault');
  assert.equal(pdf.getPageCount(), result.pageCount);
  const fonts = pdf.getPages()[0].node.Resources().lookup(PDFName.of('Font'), PDFDict);
  assert.ok(fonts.entries().length >= 2, 'Devanagari and symbol/emoji fallbacks are embedded');
  for (const [, ref] of fonts.entries()) {
    const font = pdf.context.lookup(ref, PDFDict);
    const descendant = font.lookup(PDFName.of('DescendantFonts')).lookup(0, PDFDict);
    const descriptor = descendant.lookup(PDFName.of('FontDescriptor'), PDFDict);
    assert.ok(descriptor.lookup(PDFName.of('FontFile2'), PDFRawStream).getContents().length > 200000);
    assert.ok(font.lookup(PDFName.of('ToUnicode'), PDFRawStream).getContents().length > 100);
  }
  assert.ok(new TextDecoder().decode(result.data).includes('/ActualText <FEFF' + utf16Hex('कविता की किरणें खिलीं।') + '>'));
  assert.equal(JSON.stringify(source), before);
});
test('All six PDF page dimensions match independent parser measurements', async () => {
  for (const [pageSize, width, height] of [['a5', 148, 210], ['a4', 210, 297], ['letter', 215.9, 279.4]]) {
    for (const orientation of ['portrait', 'landscape']) {
      const result = BookPdfGenerator.generatePdf(BookLayoutEngine.generateLayout(document(), { pageSize, orientation }));
      const pdf = await PDFDocument.load(result.data); const dims = pdf.getPages()[0].getSize();
      const [w, h] = orientation === 'portrait' ? [width, height] : [height, width];
      assert.ok(Math.abs(dims.width - w * 72 / 25.4) < .02);
      assert.ok(Math.abs(dims.height - h * 72 / 25.4) < .02);
    }
  }
});
test('Large type on short pages preserves text or rejects impossible geometry safely', () => {
  const body = Array.from({ length: 40 }, () => 'चाँद').join('\n');
  const layout = BookLayoutEngine.generateLayout(document(body), { orientation: 'landscape', bodyFontSize: 24, lineHeight: 3 });
  assert.doesNotThrow(() => BookPdfGenerator.generatePdf(layout));
  assert.throws(() => BookLayoutEngine.generateLayout(document(body), { orientation: 'landscape', bodyFontSize: 24, titleFontSize: 40, stanzaSpacing: 48, margins: { top: 48, bottom: 48, left: 18, right: 18 } }), /पर्याप्त स्थान/);
});
test('Unsupported glyphs and impossibly long verses fail without silent clipping', () => {
  assert.throws(() => BookPdfGenerator.generatePdf(BookLayoutEngine.generateLayout(document('字'))), /U\+5B57/);
  assert.throws(() => BookPdfGenerator.generatePdf(BookLayoutEngine.generateLayout(document('कविता '.repeat(500)))), /बहुत लंबी/);
});
test('EPUB has embedded fonts, matching IDs, complete source lines and no blank chapter breaks', () => {
  const book = document(); const result = BookEpubGenerator.generateEpub(book);
  const entries = SimpleZip.readEntries(result.data); const get = name => entries.find(e => e.name === name).text;
  assert.equal(entries[0].name, 'mimetype');
  const opf = get('OEBPS/package.opf'), ncx = get('OEBPS/toc.ncx');
  assert.ok(opf.includes('urn:kavyavault:kv_book_test')); assert.ok(ncx.includes('urn:kavyavault:kv_book_test'));
  assert.equal(entries.filter(e => e.name.endsWith('.ttf')).length, 4);
  assert.ok(!get('OEBPS/styles.css').includes('page-break-after: always'));
  const poem = entries.find(e => e.name.includes('poem-')).text;
  for (const line of book.sections[0].poems[0].body.split('\n')) assert.ok(poem.includes(line));
});
test('Export rejects non-finite numbers and CSS injection through layout configuration', () => {
  for (const value of [NaN, Infinity, '12; background: url(https://example.org)']) {
    assert.throws(() => BookEpubGenerator.generateEpub(document(), { bodyFontSize: value }));
    assert.throws(() => createLayoutConfig({ lineHeight: value }));
  }
});
test('Local synchronous fallback exports and aborts correctly', async () => {
  const service = new BookExportService({ bookService: { generateBookDocument: () => document() } });
  assert.equal((await service.generateAsync('x', 'pdf')).mimeType, 'application/pdf');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(service.generateAsync('x', 'pdf', {}, controller.signal), /रद्द/);
  await assert.rejects(service.generateAsync('x', 'html'), /असमर्थित/);
});
test('Worker export success and cancellation terminate the worker', async () => {
  const original = globalThis.Worker; let instance;
  class FakeWorker {
    constructor() { instance = this; }
    terminate() { this.terminated = true; }
    postMessage(message) { this.message = message; }
  }
  globalThis.Worker = FakeWorker;
  try {
    const service = new BookExportService({ bookService: { generateBookDocument: () => document() } });
    const pending = service.generateAsync('x', 'epub');
    const first = instance; first.onmessage({ data: { result: { size: 7 } } });
    assert.equal((await pending).size, 7); assert.ok(first.terminated);
    const controller = new AbortController();
    const aborting = service.generateAsync('x', 'pdf', {}, controller.signal); controller.abort();
    await assert.rejects(aborting, /रद्द/); assert.ok(instance.terminated);
  } finally { globalThis.Worker = original; }
});
