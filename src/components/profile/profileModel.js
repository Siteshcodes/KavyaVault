import { scopedStorage } from '../../services/storage/LibraryWorkspace.js';
import { STORAGE_KEYS } from '../../data/storageKeys.js';

export const readRows = (storage, key) => { try { const value = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
export function profileStats(storage = scopedStorage()) {
  const poems = readRows(storage, STORAGE_KEYS.POEMS);
  const drafts = (() => { try { return JSON.parse(storage.getItem(STORAGE_KEYS.DRAFTS) || 'null'); } catch { return null; } })();
  return { poems: poems.length, archived: poems.filter(poem => poem.isArchived).length,
    manuscripts: readRows(storage, STORAGE_KEYS.MANUSCRIPTS).length,
    books: readRows(storage, STORAGE_KEYS.BOOK_PROJECTS).length,
    collections: readRows(storage, STORAGE_KEYS.COLLECTIONS).length,
    drafts: drafts?.body?.trim() ? 1 : 0 };
}
export function ageFromBirthDate(value, today = new Date()) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}
