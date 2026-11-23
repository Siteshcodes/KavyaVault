import test from 'node:test';
import assert from 'node:assert/strict';
import { AutoSyncService } from './src/services/cloud/AutoSyncService.js';
import { scopedStorage, setActiveLibraryUid } from './src/services/storage/LibraryWorkspace.js';
import { digestText } from './src/services/cloud/recordCodec.js';

const memory = () => { const map = new Map(); return { get length() { return map.size; }, key: index => [...map.keys()][index] ?? null,
  getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };
class FakeTransport {
  constructor() { this.rows = new Map(); this.watchers = new Map(); }
  watch(kind, callback) {
    this.watchers.set(kind, callback);
    queueMicrotask(() => { const changed = [...this.rows.entries()].filter(([key]) => key.startsWith(`${kind}:`)).map(([key, row]) => ({ id: key.slice(kind.length + 1), data: row }));
      callback({ changed, initial: true, allIds: changed.map(row => row.id) }); });
    return () => this.watchers.delete(kind);
  }
  async read(kind, id) { const row = this.rows.get(`${kind}:${id}`); return row ? { id, ...row } : null; }
  async write(kind, id, record, expectedRevision, deletedAt) {
    const key = `${kind}:${id}`, previous = this.rows.get(key);
    if ((previous?.revision || 0) !== expectedRevision) throw new Error('Unexpected revision');
    const revision = expectedRevision + 1;
    this.rows.set(key, { record, revision, deletedAt });
    return { revision, hash: await digestText(JSON.stringify(record)) };
  }
  emit(kind, id) { this.watchers.get(kind)?.({ changed: [{ id, data: this.rows.get(`${kind}:${id}`) }], initial: false, allIds: [] }); }
}
const waitReady = service => new Promise(resolve => { const stop = service.subscribe(state => { if (state.ready) { stop(); resolve(); } }); });
const waitFor = async predicate => { for (let attempt = 0; attempt < 50; attempt++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Condition not reached'); };

test('account sync downloads remote data without touching guest and uploads local edits by record', async () => {
  const previousWindow = globalThis.window, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
  const raw = memory(), transport = new FakeTransport();
  raw.setItem('kavyavault:poems', '[{"id":"guest","title":"Guest"}]');
  transport.rows.set('poems:cloud', { record: { id: 'cloud', title: 'Cloud' }, revision: 1, deletedAt: '' });
  setActiveLibraryUid('alice');
  const service = new AutoSyncService('alice', { transport, rawStorage: raw });
  try {
    service.start(); await waitReady(service);
    assert.deepEqual(JSON.parse(scopedStorage(raw).getItem('kavyavault:poems')).map(p => p.id), ['cloud']);
    scopedStorage(raw).setItem('kavyavault:poems', JSON.stringify([{ id: 'cloud', title: 'Cloud' }, { id: 'new', title: 'नयी कविता' }]));
    await service.flush();
    assert.equal(transport.rows.get('poems:new').record.title, 'नयी कविता');
    assert.match(raw.getItem('kavyavault:poems'), /guest/);
  } finally { service.stop(); setActiveLibraryUid(null); globalThis.window = previousWindow;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); }
});

test('offline changes wait, then a competing edit preserves a conflict copy', async () => {
  const previousWindow = globalThis.window, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  const network = { onLine: true };
  Object.defineProperty(globalThis, 'navigator', { value: network, configurable: true });
  const raw = memory(), transport = new FakeTransport();
  transport.rows.set('poems:p1', { record: { id: 'p1', title: 'Original' }, revision: 1, deletedAt: '' });
  setActiveLibraryUid('alice');
  const service = new AutoSyncService('alice', { transport, rawStorage: raw });
  try {
    service.start(); await waitReady(service);
    network.onLine = false;
    scopedStorage(raw).setItem('kavyavault:poems', JSON.stringify([{ id: 'p1', title: 'My offline edit' }]));
    await service.flush();
    assert.equal(service.status, 'Offline');
    network.onLine = true;
    transport.rows.set('poems:p1', { record: { id: 'p1', title: 'Other device edit' }, revision: 2, deletedAt: '' });
    transport.emit('poems', 'p1');
    await waitFor(() => JSON.parse(scopedStorage(raw).getItem('kavyavault:poems')).length === 2);
    const poems = JSON.parse(scopedStorage(raw).getItem('kavyavault:poems'));
    assert.equal(poems.find(poem => poem.id === 'p1').title, 'Other device edit');
    assert.equal(poems.find(poem => poem.id.startsWith('p1_conflict_')).title, 'My offline edit (संघर्ष प्रति / Conflict copy)');
    await service.flush();
    assert.ok([...transport.rows.keys()].some(key => key.startsWith('poems:p1_conflict_')));
  } finally { service.stop(); setActiveLibraryUid(null); globalThis.window = previousWindow;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); }
});
