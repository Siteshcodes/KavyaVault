import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { FirestoreRecordTransport, RevisionConflict } from './src/services/cloud/FirestoreRecordTransport.js';
import { deleteCurrentCloudData } from './src/services/cloud/CloudDataDeletion.js';

test('Firestore backups belong only to their signed-in owner', async () => {
  const environment = await initializeTestEnvironment({ projectId: 'kavyavault-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  try {
    const owner = environment.authenticatedContext('poet-a').firestore();
    const other = environment.authenticatedContext('poet-b').firestore();
    const guest = environment.unauthenticatedContext().firestore();
    const manifest = doc(owner, 'users/poet-a/libraries/current');
    const part = doc(owner, 'users/poet-a/snapshots/version-1/parts/0');
    const valid = { version: 'version-1', parts: 1, bytes: 6, updatedAt: '2026-11-23T00:00:00.000Z' };
    await assertSucceeds(setDoc(part, { data: 'YWJjZA==' }));
    await assertSucceeds(setDoc(manifest, valid));
    await assertSucceeds(getDoc(manifest));
    await assertFails(getDoc(doc(other, manifest.path)));
    await assertFails(getDoc(doc(guest, part.path)));
    await assertFails(setDoc(doc(other, manifest.path), valid));
    await assertFails(deleteDoc(doc(other, part.path)));
    await assertFails(setDoc(manifest, { ...valid, extra: true }));
    await assertFails(setDoc(part, { data: 'x'.repeat(600001) }));
    assert.equal((await getDoc(manifest)).data().parts, 1);
  } finally {
    await environment.cleanup();
  }
});

test('Firestore transport commits complete Hindi records with revision checks', async () => {
  const environment = await initializeTestEnvironment({ projectId: 'kavyavault-sync-transport-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  try {
    const database = environment.authenticatedContext('alice').firestore();
    const transport = new FirestoreRecordTransport('alice', database);
    const record = { id: 'poem-1', title: 'कविता', body: 'नदी और शब्द।'.repeat(35000) };
    const first = await transport.write('poems', 'poem-1', record, 0);
    assert.equal(first.revision, 1);
    assert.deepEqual((await transport.read('poems', 'poem-1')).record, record);
    await assert.rejects(() => transport.write('poems', 'poem-1', { ...record, title: 'बदला' }, 0), RevisionConflict);
    const second = await transport.write('poems', 'poem-1', { ...record, title: 'बदला' }, 1);
    assert.equal(second.revision, 2);
  } finally { await environment.cleanup(); }
});

test('incremental records and private profiles reject cross-account access', async () => {
  const environment = await initializeTestEnvironment({ projectId: 'kavyavault-sync-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  try {
    const alice = environment.authenticatedContext('alice').firestore();
    const bob = environment.authenticatedContext('bob').firestore();
    const guest = environment.unauthenticatedContext().firestore();
    const recordPath = 'users/alice/sync/poems/items/poem-1';
    const record = { revision: 1, version: 'version-1', bytes: 20, sha256: 'a'.repeat(64), inline: '{"id":"poem-1"}', parts: 0, deletedAt: '', updatedAt: '2026-11-23T00:00:00.000Z' };
    const profilePath = 'users/alice/profile/current';
    const profile = { displayName: 'A', penName: '', bio: '', birthDate: '2000-01-01', updatedAt: '2026-11-23T00:00:00.000Z' };
    await assertSucceeds(setDoc(doc(alice, recordPath), record));
    await assertSucceeds(setDoc(doc(alice, profilePath), profile));
    await assertFails(getDoc(doc(bob, recordPath)));
    await assertFails(getDocs(collection(bob, 'users/alice/sync/poems/items')));
    await assertFails(getDoc(doc(guest, profilePath)));
    await assertFails(setDoc(doc(bob, profilePath), profile));
    await assertFails(setDoc(doc(alice, recordPath), { ...record, unknown: true }));
    await assertFails(setDoc(doc(alice, 'users/alice/sync/unknown/items/x'), record));
    await assertSucceeds(getDoc(doc(alice, profilePath)));
  } finally { await environment.cleanup(); }
});

test('confirmed account cleanup removes current indexed cloud data without local storage', async () => {
  const environment = await initializeTestEnvironment({ projectId: 'kavyavault-delete-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
  try {
    const database = environment.authenticatedContext('alice').firestore();
    const transport = new FirestoreRecordTransport('alice', database);
    await transport.write('poems', 'p1', { id: 'p1', title: 'गीत' }, 0);
    const profile = doc(database, 'users/alice/profile/current');
    await setDoc(profile, { displayName: 'Alice', penName: '', bio: '', birthDate: '', updatedAt: '2026-11-23T00:00:00.000Z' });
    const backup = doc(database, 'users/alice/libraries/current');
    await setDoc(backup, { version: '12345678-1234-1234-1234-123456789abc', parts: 1, bytes: 4, updatedAt: '2026-11-23T00:00:00.000Z' });
    await setDoc(doc(database, 'users/alice/snapshots/12345678-1234-1234-1234-123456789abc/parts/0'), { data: 'YWJj' });
    const deleted = await deleteCurrentCloudData('alice', { auth: { currentUser: { uid: 'alice' } }, database });
    assert.equal(deleted, 2);
    assert.equal((await getDoc(profile)).exists(), false);
    assert.equal((await getDoc(backup)).exists(), false);
    assert.equal((await transport.read('poems', 'p1')), null);
  } finally { await environment.cleanup(); }
});
