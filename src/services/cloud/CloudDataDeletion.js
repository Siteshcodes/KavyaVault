import { collection, doc, getDocsFromServer, getDocFromServer, deleteDoc } from 'firebase/firestore';
import { cloudConnection } from './CloudLibraryService.js';
import { RECORD_KINDS } from './recordKinds.js';

// Deletes all currently indexed cloud records and the current manual backup.
// Legacy orphaned snapshot versions require project-owner cleanup in Firestore Console.
export async function deleteCurrentCloudData(uid, { auth = cloudConnection.auth, database = cloudConnection.database } = {}) {
  if (!uid || auth?.currentUser?.uid !== uid) throw new Error('खाता बदल गया है। / Account changed.');
  let deleted = 0;
  for (const kind of Object.keys(RECORD_KINDS)) {
    const items = await getDocsFromServer(collection(database, 'users', uid, 'sync', kind, 'items'));
    for (const item of items.docs) {
      if (auth.currentUser?.uid !== uid) throw new Error('खाता बदल गया है। / Account changed.');
      const data = item.data();
      for (let index = 0; index < (data.parts || 0); index++) {
        await deleteDoc(doc(item.ref, 'versions', data.version, 'parts', String(index)));
      }
      await deleteDoc(item.ref);
      deleted++;
    }
  }
  const manifest = doc(database, 'users', uid, 'libraries', 'current');
  const backup = await getDocFromServer(manifest);
  if (backup.exists()) {
    const data = backup.data();
    for (let index = 0; index < (data.parts || 0); index++) {
      await deleteDoc(doc(database, 'users', uid, 'snapshots', data.version, 'parts', String(index)));
    }
    await deleteDoc(manifest);
    deleted++;
  }
  await deleteDoc(doc(database, 'users', uid, 'profile', 'current'));
  return deleted;
}
