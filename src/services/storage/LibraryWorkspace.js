import { STORAGE_KEYS, STORAGE_PREFIX } from '../../data/storageKeys.js';

const libraryKeys = new Set([...Object.values(STORAGE_KEYS), 'kavyavault:restore_journal']);
const arrayKinds = new Map([[STORAGE_KEYS.POEMS, 'poems'], [STORAGE_KEYS.COLLECTIONS, 'collections'],
  [STORAGE_KEYS.MANUSCRIPTS, 'manuscripts'], [STORAGE_KEYS.BOOK_PROJECTS, 'books']]);
let activeUid = null;
let notificationsPaused = 0;
const listeners = new Set();

export const getActiveLibraryUid = () => activeUid;
export function setActiveLibraryUid(uid) { activeUid = uid || null; }
export function onLibraryChange(callback) { listeners.add(callback); return () => listeners.delete(callback); }
export function withoutLibraryNotifications(action) {
  notificationsPaused++;
  try { return action(); } finally { notificationsPaused--; }
}

export function guestHasLibrary(storage = globalThis.localStorage) {
  return [...libraryKeys].some(key => key !== 'kavyavault:restore_journal' && storage.getItem(key) !== null);
}

export function scopedStorage(storage = globalThis.localStorage) {
  const physicalKey = key => activeUid && key.startsWith(STORAGE_PREFIX)
    ? `${STORAGE_PREFIX}account:${activeUid}:${key.slice(STORAGE_PREFIX.length)}` : key;
  const visibleKeys = () => {
    const prefix = activeUid ? `${STORAGE_PREFIX}account:${activeUid}:` : STORAGE_PREFIX;
    const keys = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      if (!activeUid && (key.startsWith(`${STORAGE_PREFIX}account:`) || key.startsWith(`${STORAGE_PREFIX}sync:`) || key.startsWith(`${STORAGE_PREFIX}profile:`))) continue;
      keys.push(activeUid ? STORAGE_PREFIX + key.slice(prefix.length) : key);
    }
    return keys;
  };
  return {
    getItem: key => storage.getItem(physicalKey(key)),
    setItem(key, value) {
      const before = storage.getItem(physicalKey(key));
      if (activeUid && !notificationsPaused && before && arrayKinds.has(key)) {
        const oldRows = JSON.parse(before), newRows = JSON.parse(value);
        if (Array.isArray(oldRows) && Array.isArray(newRows)) {
          const nextIds = new Set(newRows.map(row => row.id));
          for (const row of oldRows) if (row?.id && !nextIds.has(row.id)) {
            storage.setItem(`kavyavault:trash:${activeUid}:${arrayKinds.get(key)}:${encodeURIComponent(row.id)}`, JSON.stringify(row));
          }
        }
      }
      storage.setItem(physicalKey(key), value);
      if (!notificationsPaused && activeUid && libraryKeys.has(key) && before !== String(value)) for (const listener of listeners) {
        try { listener({ uid: activeUid, key, before, after: String(value) }); } catch (error) { console.error('[Kavyakalash] Sync notification failed:', error); }
      }
    },
    removeItem(key) {
      const before = storage.getItem(physicalKey(key));
      if (activeUid && !notificationsPaused && before && arrayKinds.has(key)) {
        for (const row of JSON.parse(before)) if (row?.id) storage.setItem(`kavyavault:trash:${activeUid}:${arrayKinds.get(key)}:${encodeURIComponent(row.id)}`, JSON.stringify(row));
      }
      storage.removeItem(physicalKey(key));
      if (!notificationsPaused && activeUid && libraryKeys.has(key) && before !== null) for (const listener of listeners) {
        try { listener({ uid: activeUid, key, before, after: null }); } catch (error) { console.error('[Kavyakalash] Sync notification failed:', error); }
      }
    },
    key: index => visibleKeys()[index] ?? null,
    get length() { return visibleKeys().length; }
  };
}
