import test from 'node:test';
import assert from 'node:assert/strict';
import { setActiveLibraryUid, scopedStorage } from './src/services/storage/LibraryWorkspace.js';
import { mergeGuestRecords } from './src/components/welcome/GuestMigration.js';
import { profileStats, ageFromBirthDate } from './src/components/profile/profileModel.js';
import { ProfileService } from './src/services/cloud/ProfileService.js';

const memory = () => { const map = new Map(); return { get length() { return map.size; }, key: index => [...map.keys()][index] ?? null,
  getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };

test('guest migration keeps source records and creates a copy for ID collisions', () => {
  const raw = memory();
  raw.setItem('kavyavault:poems', JSON.stringify([{ id: 'same', title: 'Guest', body: 'अतिथि' }, { id: 'new', title: 'New', body: 'गीत' }]));
  setActiveLibraryUid('alice');
  try {
    scopedStorage(raw).setItem('kavyavault:poems', JSON.stringify([{ id: 'same', title: 'Cloud', body: 'कविता' }]));
    mergeGuestRecords(raw, 'alice');
    const rows = JSON.parse(scopedStorage(raw).getItem('kavyavault:poems'));
    assert.equal(rows.length, 3);
    assert.equal(rows.find(row => row.id === 'same').title, 'Cloud');
    assert.ok(rows.some(row => row.id.startsWith('same_guest_')));
    assert.equal(JSON.parse(raw.getItem('kavyavault:poems')).length, 2);
  } finally { setActiveLibraryUid(null); }
});

test('profile keeps private fields locally while offline and statistics use real records', async () => {
  const raw = memory();
  setActiveLibraryUid('alice');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  try {
    const profile = new ProfileService('alice', { database: null, storage: raw });
    await profile.save({ displayName: 'कवयित्री', penName: 'कलम', bio: 'लेखिका', birthDate: '2000-12-25' });
    assert.equal(profile.local.penName, 'कलम');
    assert.equal(ageFromBirthDate('2000-12-25', new Date('2026-11-23')), 25);
    scopedStorage(raw).setItem('kavyavault:poems', JSON.stringify([{ id: 'a', isArchived: false }, { id: 'b', isArchived: true }]));
    scopedStorage(raw).setItem('kavyavault:book_projects', JSON.stringify([{ id: 'book' }]));
    assert.deepEqual({ poems: profileStats(scopedStorage(raw)).poems, archived: profileStats(scopedStorage(raw)).archived, books: profileStats(scopedStorage(raw)).books }, { poems: 2, archived: 1, books: 1 });
  } finally { setActiveLibraryUid(null); if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); }
});
