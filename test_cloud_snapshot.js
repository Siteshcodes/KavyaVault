import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSnapshot, joinSnapshot, PART_BYTES } from './src/services/cloud/cloudSnapshotCodec.js';

test('large Hindi archive survives Firestore-sized chunks and exact reconstruction', () => {
  const source = 'कविता की किरणें खिलीं। 🌙\n'.repeat(30000);
  const snapshot = splitSnapshot(source);
  assert.ok(snapshot.parts.length > 1);
  assert.ok(snapshot.parts.every(part => part.length < 600000));
  assert.ok(snapshot.parts.length === Math.ceil(snapshot.bytes / PART_BYTES));
  assert.equal(joinSnapshot(snapshot.parts, snapshot.bytes), source);
  assert.throws(() => joinSnapshot(snapshot.parts.slice(1), snapshot.bytes), /अधूरी/);
  assert.throws(() => joinSnapshot([...snapshot.parts, snapshot.parts[0]], snapshot.bytes), /आकार/);
});
