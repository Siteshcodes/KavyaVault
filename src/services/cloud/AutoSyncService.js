import { scopedStorage, getActiveLibraryUid, onLibraryChange, withoutLibraryNotifications } from '../storage/LibraryWorkspace.js';
import { RECORD_KINDS, ARRAY_KINDS, kindForKey } from './recordKinds.js';
import { digestText } from './recordCodec.js';
import { FirestoreRecordTransport, RevisionConflict } from './FirestoreRecordTransport.js';

const itemKey = (kind, id) => `${kind}:${id}`;
const parse = raw => raw === null ? null : JSON.parse(raw);
const trashKey = (uid, kind, id) => `kavyavault:trash:${uid}:${kind}:${encodeURIComponent(id)}`;

export class AutoSyncService {
  constructor(uid, { transport = new FirestoreRecordTransport(uid), rawStorage = globalThis.localStorage } = {}) {
    this.uid = uid;
    this.transport = transport;
    this.rawStorage = rawStorage;
    this.storage = scopedStorage(rawStorage);
    this.baseKey = `kavyavault:sync:state:${uid}`;
    this.queueKey = `kavyavault:sync:queue:${uid}`;
    this.modeKey = `kavyavault:sync:mode:${uid}`;
    this.base = parse(rawStorage.getItem(this.baseKey)) || {};
    this.pending = new Set(parse(rawStorage.getItem(this.queueKey)) || []);
    this.mode = rawStorage.getItem(this.modeKey) || 'on';
    this.status = 'Saved locally';
    this.listeners = new Set();
    this.ready = new Set();
    this.unsubscribers = [];
    this.inflight = new Set();
    this.running = false;
    this.lastSync = rawStorage.getItem(`kavyavault:sync:last:${uid}`);
    this.stopped = false;
  }
  subscribe(callback) { this.listeners.add(callback); callback(this.snapshot()); return () => this.listeners.delete(callback); }
  snapshot() { return { status: this.status, mode: this.mode, lastSync: this.lastSync, pending: this.pending.size,
    ready: this.ready.size === Object.keys(RECORD_KINDS).length }; }
  setStatus(status) { this.status = status; for (const callback of this.listeners) callback(this.snapshot()); }
  setMode(mode) {
    if (!['on', 'paused', 'off'].includes(mode)) throw new Error('Invalid sync mode');
    this.mode = mode;
    this.rawStorage.setItem(this.modeKey, mode);
    this.setStatus(mode === 'on' ? 'Saved locally' : mode === 'paused' ? 'Paused' : 'Disabled');
    if (mode === 'on') { this.startWatchers(); this.schedule(0); }
    else this.stopWatchers();
  }
  async waitForIdle() {
    for (let attempt = 0; this.running && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    if (this.running) throw new Error('सिंक अभी चल रहा है। बाद में फिर प्रयास करें। / Sync is still active.');
  }
  persist() {
    this.rawStorage.setItem(this.baseKey, JSON.stringify(this.base));
    this.rawStorage.setItem(this.queueKey, JSON.stringify([...this.pending]));
  }
  read(kind, id) {
    const raw = this.storage.getItem(RECORD_KINDS[kind]);
    if (ARRAY_KINDS.has(kind)) return (parse(raw) || []).find(row => row.id === id) || null;
    return raw === null ? null : { id: 'current', value: raw };
  }
  allIds(kind) {
    const raw = this.storage.getItem(RECORD_KINDS[kind]);
    if (ARRAY_KINDS.has(kind)) return (parse(raw) || []).map(row => row.id);
    return raw === null ? [] : ['current'];
  }
  apply(kind, id, record) {
    withoutLibraryNotifications(() => {
      const key = RECORD_KINDS[kind];
      if (!ARRAY_KINDS.has(kind)) {
        if (record) this.storage.setItem(key, record.value); else this.storage.removeItem(key);
        return;
      }
      const rows = parse(this.storage.getItem(key)) || [];
      const index = rows.findIndex(row => row.id === id);
      if (index >= 0) rows.splice(index, 1);
      if (record) rows.push(record);
      this.storage.setItem(key, JSON.stringify(rows));
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('kavyakalash:library-updated', { detail: { kind, id } }));
  }
  enqueue(kind, id) {
    this.pending.add(itemKey(kind, id));
    this.persist();
    this.setStatus(navigator.onLine === false ? 'Offline' : 'Saved locally');
    this.schedule();
  }
  onLocalChange({ uid, key, before, after }) {
    if (uid !== this.uid || this.stopped) return;
    const kind = kindForKey(key);
    if (!kind) return;
    if (!ARRAY_KINDS.has(kind)) { this.enqueue(kind, 'current'); return; }
    const oldRows = new Map((parse(before) || []).map(row => [row.id, row]));
    const newRows = new Map((parse(after) || []).map(row => [row.id, row]));
    for (const [id, oldRecord] of oldRows) {
      if (!newRows.has(id)) {
        this.enqueue(kind, id);
      }
    }
    for (const [id, record] of newRows) {
      if (JSON.stringify(record) !== JSON.stringify(oldRows.get(id))) this.enqueue(kind, id);
    }
  }
  start() {
    if (this.stopped) return;
    this.unsubscribeLocal = onLibraryChange(change => this.onLocalChange(change));
    this.onlineHandler = () => { this.startWatchers(); this.schedule(0); };
    this.offlineHandler = () => this.setStatus('Offline');
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    if (this.mode === 'on') this.startWatchers();
    else this.setStatus(this.mode === 'paused' ? 'Paused' : 'Disabled');
  }
  startWatchers() {
    if (this.unsubscribers.length || this.stopped || this.mode !== 'on' || navigator.onLine === false) return;
    for (const kind of Object.keys(RECORD_KINDS)) {
      let sequence = Promise.resolve();
      this.unsubscribers.push(this.transport.watch(kind, event => {
        sequence = sequence.then(() => this.onRemote(kind, event)).catch(error => this.setStatus(`Error: ${error.message}`));
      }, error => this.setStatus(`Error: ${error.message}`)));
    }
  }
  stopWatchers() { for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe(); this.ready.clear(); }
  async onRemote(kind, event) {
    if (this.stopped || this.mode !== 'on' || getActiveLibraryUid() !== this.uid) return;
    for (const entry of event.changed) {
      const key = itemKey(kind, entry.id);
      if (this.inflight.has(key)) continue;
      const remote = await this.transport.read(kind, entry.id, entry.data);
      await this.reconcile(kind, remote);
    }
    if (event.initial) {
      for (const id of this.allIds(kind)) {
        if (!event.allIds.includes(id)) this.enqueue(kind, id);
      }
      this.ready.add(kind);
      this.setStatus(this.status);
      this.schedule(0);
    }
  }
  async reconcile(kind, remote) {
    if (!remote) return;
    const key = itemKey(kind, remote.id);
    const local = this.read(kind, remote.id);
    const localHash = local ? await digestText(JSON.stringify(local)) : null;
    const remoteHash = await digestText(JSON.stringify(remote.record));
    const base = this.base[key];
    if (base?.revision === remote.revision && base.hash === remoteHash) return;
    const conflicted = !!(local && localHash !== remoteHash && (!base || localHash !== base.hash));
    if (conflicted) await this.preserveConflict(kind, remote.id, local);
    if (remote.deletedAt) {
      this.rawStorage.setItem(trashKey(this.uid, kind, remote.id), JSON.stringify(remote.record));
      this.apply(kind, remote.id, null);
    } else if (localHash !== remoteHash) this.apply(kind, remote.id, remote.record);
    this.base[key] = { revision: remote.revision, hash: remoteHash };
    this.pending.delete(key);
    this.persist();
    this.lastSync = new Date().toISOString();
    this.rawStorage.setItem(`kavyavault:sync:last:${this.uid}`, this.lastSync);
    this.setStatus(conflicted ? 'Conflict' : 'Synced');
  }
  async preserveConflict(kind, id, local) {
    if (ARRAY_KINDS.has(kind)) {
      const copyId = `${id}_conflict_${crypto.randomUUID()}`;
      const copy = { ...local, id: copyId };
      if (typeof copy.title === 'string') copy.title += ' (संघर्ष प्रति / Conflict copy)';
      else if (typeof copy.name === 'string') copy.name += ' (संघर्ष प्रति / Conflict copy)';
      this.apply(kind, copyId, copy);
      this.enqueue(kind, copyId);
    } else {
      this.rawStorage.setItem(`kavyavault:conflict:${this.uid}:${kind}:${Date.now()}`, JSON.stringify(local));
    }
    this.setStatus('Conflict');
  }
  schedule(delay = 1200) {
    if (this.timer) clearTimeout(this.timer);
    if (this.mode !== 'on' || this.stopped) return;
    this.timer = setTimeout(() => this.flush(), delay);
  }
  async flush() {
    if (this.running || this.mode !== 'on' || this.stopped || getActiveLibraryUid() !== this.uid) return;
    if (navigator.onLine === false) { this.setStatus('Offline'); return; }
    if (this.ready.size !== Object.keys(RECORD_KINDS).length) return;
    this.running = true;
    try {
      for (const key of [...this.pending]) {
        if (this.mode !== 'on' || getActiveLibraryUid() !== this.uid) break;
        const split = key.indexOf(':');
        const kind = key.slice(0, split), id = key.slice(split + 1);
        if (!RECORD_KINDS[kind]) { this.pending.delete(key); continue; }
        const current = this.read(kind, id);
        const deletedAt = current ? '' : new Date().toISOString();
        const record = current || parse(this.rawStorage.getItem(trashKey(this.uid, kind, id)));
        if (!record) { this.pending.delete(key); continue; }
        this.inflight.add(key);
        this.setStatus('Syncing');
        try {
          const saved = await this.transport.write(kind, id, record, this.base[key]?.revision || 0, deletedAt);
          this.base[key] = { revision: saved.revision, hash: saved.hash };
          const latest = this.read(kind, id);
          const latestHash = latest ? await digestText(JSON.stringify(latest)) : saved.hash;
          if (latestHash === saved.hash) this.pending.delete(key);
          this.lastSync = new Date().toISOString();
          this.rawStorage.setItem(`kavyavault:sync:last:${this.uid}`, this.lastSync);
          this.persist();
          this.retryMs = 0;
          this.setStatus('Synced');
        } catch (error) {
          if (error instanceof RevisionConflict) {
            const remote = await this.transport.read(kind, id);
            await this.reconcile(kind, remote);
          } else {
            this.setStatus(navigator.onLine === false ? 'Offline' : `Error: ${error.message}`);
            if (navigator.onLine !== false && !['permission-denied', 'resource-exhausted'].includes(error.code)) {
              this.retryMs = Math.min((this.retryMs || 1000) * 2, 60000);
              this.schedule(this.retryMs);
            }
            break;
          }
        } finally { this.inflight.delete(key); }
      }
    } finally { this.running = false; if (this.pending.size && this.status === 'Synced') this.schedule(); }
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.stopWatchers();
    this.unsubscribeLocal?.();
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }
}

let activeSync = null;
export const getAutoSync = () => activeSync;
export function startAutoSync(uid) {
  activeSync?.stop();
  activeSync = uid ? new AutoSyncService(uid) : null;
  activeSync?.start();
  return activeSync;
}
