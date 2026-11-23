import test from 'node:test';
import assert from 'node:assert/strict';
import { scopedStorage, setActiveLibraryUid, guestHasLibrary } from './src/services/storage/LibraryWorkspace.js';

const memory = () => {
  const map = new Map();
  return { get length() { return map.size; }, key: index => [...map.keys()][index] ?? null,
    getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
};

test('guest and Google account workspaces remain separate', () => {
  const raw = memory();
  setActiveLibraryUid(null);
  scopedStorage(raw).setItem('kavyavault:poems', '[{"id":"guest"}]');
  assert.equal(guestHasLibrary(raw), true);
  setActiveLibraryUid('alice');
  scopedStorage(raw).setItem('kavyavault:poems', '[{"id":"alice"}]');
  setActiveLibraryUid('bob');
  assert.equal(scopedStorage(raw).getItem('kavyavault:poems'), null);
  setActiveLibraryUid('alice');
  assert.match(scopedStorage(raw).getItem('kavyavault:poems'), /alice/);
  setActiveLibraryUid(null);
  assert.match(scopedStorage(raw).getItem('kavyavault:poems'), /guest/);
});

test('a removed account poem is recoverable without exposing it to another account', () => {
  const raw = memory();
  setActiveLibraryUid('alice');
  const storage = scopedStorage(raw);
  storage.setItem('kavyavault:poems', JSON.stringify([{ id: 'p1', title: 'कविता' }]));
  storage.setItem('kavyavault:poems', '[]');
  assert.match(raw.getItem('kavyavault:trash:alice:poems:p1'), /कविता/);
  setActiveLibraryUid('bob');
  assert.equal(scopedStorage(raw).getItem('kavyavault:poems'), null);
  assert.equal(raw.getItem('kavyavault:trash:bob:poems:p1'), null);
});
