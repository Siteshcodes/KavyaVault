import { STORAGE_KEYS } from '../../data/storageKeys.js';
import { CURRENT_SCHEMA_VERSION } from './MigrationManager.js';

export const BACKUP_KEYS = Object.freeze(Object.values(STORAGE_KEYS));
export const RESTORE_JOURNAL = 'kavyavault:restore_journal';
export const MAX_BACKUP_BYTES = 40 * 1024 * 1024;
const recordKeys = [STORAGE_KEYS.POEMS, STORAGE_KEYS.COLLECTIONS, STORAGE_KEYS.MANUSCRIPTS, STORAGE_KEYS.BOOK_PROJECTS];
const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

async function checksum(records) {
  const canonical = JSON.stringify(BACKUP_KEYS.map(key => [key, records[key]]));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}

function validateRecords(records) {
  if (!object(records) || Object.keys(records).length !== BACKUP_KEYS.length || Object.keys(records).some(k => !BACKUP_KEYS.includes(k))) fail('बैकअप में अमान्य भंडारण कुंजियाँ हैं।');
  const parsed = {};
  for (const key of BACKUP_KEYS) {
    const raw = records[key];
    if (raw === null) { parsed[key] = null; continue; }
    if (typeof raw !== 'string') fail('बैकअप का डेटा प्रारूप अमान्य है।');
    if (key === STORAGE_KEYS.THEME) {
      if (!['bhojpatra', 'syahi', 'khaddar', 'velvet-night'].includes(raw)) fail('बैकअप में अमान्य विषय-रंग है।');
      continue;
    }
    try { parsed[key] = JSON.parse(raw); } catch { fail('बैकअप में दूषित JSON डेटा है।'); }
  }
  const metadata = parsed[STORAGE_KEYS.METADATA];
  if (metadata && (!object(metadata) || !Number.isInteger(metadata.schemaVersion) || metadata.schemaVersion < 1 || metadata.schemaVersion > CURRENT_SCHEMA_VERSION)) fail('यह बैकअप किसी असमर्थित ऐप संस्करण का है।');
  for (const key of recordKeys) {
    const rows = parsed[key];
    if (rows === null) continue;
    if (!Array.isArray(rows) || rows.length > 50000) fail('बैकअप में अमान्य या बहुत बड़ा संग्रह है।');
    const ids = new Set();
    for (const row of rows) {
      if (!object(row) || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) fail('बैकअप में अमान्य या दोहराई गई आईडी है।');
      ids.add(row.id);
      if (key === STORAGE_KEYS.POEMS && (typeof row.title !== 'string' || typeof row.body !== 'string')) fail('बैकअप में अमान्य कविता है।');
      if (key === STORAGE_KEYS.MANUSCRIPTS && (!object(row.originalManuscript) || !['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp'].includes(row.originalManuscript.mimeType) || typeof row.originalManuscript.data !== 'string' || !row.originalManuscript.data.trim())) fail('बैकअप में अमान्य मूल पांडुलिपि है।');
      if (key === STORAGE_KEYS.COLLECTIONS && (typeof row.name !== 'string' || !Array.isArray(row.poemIds) || row.poemIds.some(id => typeof id !== 'string'))) fail('बैकअप में अमान्य संग्रह है।');
      if (key === STORAGE_KEYS.BOOK_PROJECTS && (typeof row.title !== 'string' || !Array.isArray(row.sections) || row.sections.some(s => !object(s) || typeof s.title !== 'string' || !Array.isArray(s.poemIds) || s.poemIds.some(id => typeof id !== 'string')))) fail('बैकअप में अमान्य पुस्तक है।');
    }
  }
  // Image references may never cause an imported archive to fetch external URLs.
  const inspect = (value, depth = 0) => {
    if (depth > 40) fail('बैकअप का डेटा बहुत जटिल है।');
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('बैकअप में असुरक्षित डेटा संरचना है।');
      if ((/dataurl$/i.test(key) || (key === 'data' && typeof value.mimeType === 'string')) && typeof child === 'string' && child && !/^(data:image\/(png|jpeg|webp|tiff|bmp);base64,)?[a-z0-9+/=\s]+$/i.test(child)) fail('बैकअप में अमान्य पांडुलिपि चित्र है।');
      inspect(child, depth + 1);
    }
  };
  inspect(parsed);
  const draft = parsed[STORAGE_KEYS.DRAFTS];
  if (draft !== null && (!object(draft) || typeof draft.body !== 'string')) fail('बैकअप में अमान्य प्रारूप है।');
  const recent = parsed[STORAGE_KEYS.RECENT_POEMS];
  if (recent !== null && (!Array.isArray(recent) || recent.some(r => !object(r) || typeof r.poemId !== 'string'))) fail('बैकअप में अमान्य पठन इतिहास है।');
  return parsed;
}

export class BackupService {
  constructor(storage = null) { this.driver = storage; }
  get storage() { return this.driver || globalThis.localStorage; }
  snapshot() { return Object.fromEntries(BACKUP_KEYS.map(key => [key, this.storage.getItem(key)])); }

  async exportBackup() {
    if (this.storage.getItem(RESTORE_JOURNAL)) fail('अधूरी पुनर्स्थापना पहले पूरी करें।');
    const records = this.snapshot();
    // Always allow a raw rescue copy, including records that need manual recovery.
    return JSON.stringify({ format: 'kavyavault-backup', version: 1, schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: new Date().toISOString(), checksum: await checksum(records), records }, null, 2);
  }

  async inspectBackup(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) fail('बैकअप 40 MB से छोटा होना चाहिए।');
    let backup;
    try { backup = JSON.parse(text); } catch { fail('बैकअप फ़ाइल वैध JSON नहीं है।'); }
    if (!object(backup) || backup.format !== 'kavyavault-backup' || backup.version !== 1 || !Number.isInteger(backup.schemaVersion) || backup.schemaVersion < 1 || backup.schemaVersion > CURRENT_SCHEMA_VERSION) fail('यह बैकअप प्रारूप समर्थित नहीं है।');
    const parsed = validateRecords(backup.records);
    if (await checksum(backup.records) !== backup.checksum) fail('बैकअप की अखंडता जाँच विफल हुई। मूल फ़ाइल फिर चुनें।');
    return { backup, counts: { poems: (parsed[STORAGE_KEYS.POEMS] || []).length, manuscripts: (parsed[STORAGE_KEYS.MANUSCRIPTS] || []).length,
      collections: (parsed[STORAGE_KEYS.COLLECTIONS] || []).length, books: (parsed[STORAGE_KEYS.BOOK_PROJECTS] || []).length } };
  }

  writeSnapshot(records) {
    for (const key of BACKUP_KEYS) this.storage.removeItem(key);
    for (const key of BACKUP_KEYS) if (records[key] !== null) this.storage.setItem(key, records[key]);
  }

  recoverInterruptedRestore() {
    const raw = this.storage.getItem(RESTORE_JOURNAL);
    if (!raw) return false;
    let journal;
    try { journal = JSON.parse(raw); } catch { fail('पुनर्स्थापना सुरक्षा रिकॉर्ड दूषित है। मूल डेटा न बदलें।'); }
    // Journal may contain corrupted old user data. Preserve it byte for byte.
    if (!object(journal) || !object(journal.previous) || BACKUP_KEYS.some(k => journal.previous[k] !== null && typeof journal.previous[k] !== 'string')) fail('पुनर्स्थापना सुरक्षा रिकॉर्ड अमान्य है।');
    this.writeSnapshot(journal.previous);
    this.storage.removeItem(RESTORE_JOURNAL);
    return true;
  }

  async restoreBackup(text) {
    const { backup, counts } = await this.inspectBackup(text);
    const execute = async () => {
      this.recoverInterruptedRestore();
      const previous = this.snapshot();
      // The durable journal must fit BEFORE modifying any source record.
      try { this.storage.setItem(RESTORE_JOURNAL, JSON.stringify({ previous })); }
      catch { fail('सुरक्षित पुनर्स्थापना के लिए पर्याप्त स्थान नहीं है। नया ब्राउज़र प्रोफ़ाइल उपयोग करें। आपका डेटा नहीं बदला।'); }
      try {
        this.writeSnapshot(backup.records);
        this.storage.removeItem(RESTORE_JOURNAL);
      } catch {
        this.recoverInterruptedRestore();
        fail('पुनर्स्थापना विफल हुई। पुराना डेटा सुरक्षित वापस रखा गया है।');
      }
      return counts;
    };
    return globalThis.navigator?.locks ? navigator.locks.request('kavyavault-restore', execute) : execute();
  }
}

export const backupService = new BackupService();
