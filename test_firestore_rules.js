import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

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
