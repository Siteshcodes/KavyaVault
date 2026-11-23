import { collection, doc, onSnapshot, getDocFromServer, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { cloudConnection } from './CloudLibraryService.js';
import { encodeRecord, decodeRecord } from './recordCodec.js';

export class RevisionConflict extends Error {}

export class FirestoreRecordTransport {
  constructor(uid, database = cloudConnection.database) { this.uid = uid; this.database = database; }
  items(kind) { return collection(this.database, 'users', this.uid, 'sync', kind, 'items'); }
  item(kind, id) { return doc(this.items(kind), encodeURIComponent(id)); }
  part(kind, id, version, index) { return doc(this.item(kind, id), 'versions', version, 'parts', String(index)); }

  async read(kind, id, data = null) {
    const meta = data || (await getDocFromServer(this.item(kind, id))).data();
    if (!meta) return null;
    const chunks = [];
    for (let index = 0; index < meta.parts; index++) {
      const part = await getDocFromServer(this.part(kind, id, meta.version, index));
      if (!part.exists() || typeof part.data().data !== 'string') throw new Error('क्लाउड अभिलेख अधूरा है। / Cloud record is incomplete.');
      chunks.push(part.data().data);
    }
    return { id, revision: meta.revision, deletedAt: meta.deletedAt || '', updatedAt: meta.updatedAt,
      record: await decodeRecord(meta, chunks) };
  }

  watch(kind, onChange, onError) {
    let initialized = false;
    return onSnapshot(this.items(kind), { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache) return;
      const initial = !initialized;
      initialized = true;
      const changed = snapshot.docChanges().filter(change => change.type !== 'removed').map(change => ({
        id: decodeURIComponent(change.doc.id), data: change.doc.data()
      }));
      onChange({ changed, initial, allIds: initial ? snapshot.docs.map(item => decodeURIComponent(item.id)) : [] });
    }, onError);
  }

  async write(kind, id, record, expectedRevision, deletedAt = '') {
    const encoded = await encodeRecord(record);
    const version = crypto.randomUUID();
    for (let index = 0; index < encoded.parts.length; index++) {
      await setDoc(this.part(kind, id, version, index), { data: encoded.parts[index] });
    }
    const ref = this.item(kind, id);
    let result;
    try {
      result = await runTransaction(this.database, async transaction => {
        const current = await transaction.get(ref);
        const actual = current.exists() ? current.data().revision : 0;
        if (actual !== expectedRevision) throw new RevisionConflict('Cloud revision changed.');
        const next = actual + 1;
        transaction.set(ref, { revision: next, version, bytes: encoded.bytes, sha256: encoded.sha256,
          inline: encoded.inline, parts: encoded.parts.length, deletedAt, updatedAt: new Date().toISOString() });
        return { revision: next, previous: current.exists() ? current.data() : null };
      });
    } catch (error) {
      for (let index = 0; index < encoded.parts.length; index++) {
        try { await deleteDoc(this.part(kind, id, version, index)); } catch { /* An offline orphan can be cleaned later. */ }
      }
      throw error;
    }
    if (result.previous?.version && Number.isInteger(result.previous.parts) && result.previous.parts <= 110) {
      for (let index = 0; index < result.previous.parts; index++) {
        try { await deleteDoc(this.part(kind, id, result.previous.version, index)); }
        catch { /* The new manifest is complete; orphan cleanup is best effort. */ }
      }
    }
    return { revision: result.revision, hash: encoded.sha256 };
  }
}
