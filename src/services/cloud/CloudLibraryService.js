import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, deleteDoc } from 'firebase/firestore';
import { backupService, MAX_BACKUP_BYTES } from '../storage/BackupService.js';
import { splitSnapshot, joinSnapshot } from './cloudSnapshotCodec.js';

const env = import.meta.env || {};
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: typeof window !== 'undefined' && window.location.hostname === 'kavyavault-1a3ce.web.app'
    ? window.location.hostname : env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};
const configured = Object.values(config).every(Boolean);
const app = configured ? initializeApp(config) : null;
const auth = app ? getAuth(app) : null;
const database = app ? getFirestore(app) : null;
const provider = new GoogleAuthProvider();
const manifestRef = uid => doc(database, 'users', uid, 'libraries', 'current');
const partRef = (uid, version, index) => doc(database, 'users', uid, 'snapshots', version, 'parts', String(index));

export const cloudLibraryService = {
  get configured() { return configured; },
  observe(callback) { return auth ? onAuthStateChanged(auth, callback) : (queueMicrotask(() => callback(null)), () => {}); },
  get user() { return auth?.currentUser || null; },
  async signIn() {
    if (!auth) throw new Error('Google सेवा अभी कॉन्फ़िगर नहीं है।');
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) return signInWithRedirect(auth, provider);
    return signInWithPopup(auth, provider);
  },
  signOut() { return auth ? signOut(auth) : Promise.resolve(); },
  async cloudInfo() {
    const user = auth?.currentUser;
    if (!user) throw new Error('पहले Google खाते में प्रवेश करें।');
    const snapshot = await getDocFromServer(manifestRef(user.uid));
    return snapshot.exists() ? { exists: true, ...snapshot.data() } : { exists: false };
  },
  async upload() {
    const user = auth?.currentUser;
    if (!user) throw new Error('पहले Google खाते में प्रवेश करें।');
    const text = await backupService.exportBackup();
    await backupService.inspectBackup(text);
    const snapshot = splitSnapshot(text);
    if (snapshot.bytes > MAX_BACKUP_BYTES) throw new Error('क्लाउड प्रति 40 MB से बड़ी है।');
    const previous = await this.cloudInfo();
    const version = crypto.randomUUID();
    const parts = snapshot.parts.length;
    const updatedAt = new Date().toISOString();
    let written = 0;
    try {
      for (let index = 0; index < parts; index++) {
        if (auth.currentUser?.uid !== user.uid) throw new Error('खाता बदल गया है। अपलोड रोका गया।');
        await setDoc(partRef(user.uid, version, index), { data: snapshot.parts[index] });
        written++;
      }
      if (auth.currentUser?.uid !== user.uid) throw new Error('खाता बदल गया है। क्लाउड स्थिति फिर जाँचें।');
      await setDoc(manifestRef(user.uid), { version, parts, bytes: snapshot.bytes, updatedAt });
    } catch (error) {
      // The previous manifest still points to the complete previous snapshot.
      // Orphan cleanup is best effort: network failure may also prevent deletes.
      if (auth.currentUser?.uid === user.uid) {
        for (let index = 0; index < written; index++) {
          try { await deleteDoc(partRef(user.uid, version, index)); } catch { /* Retry by uploading again later. */ }
        }
      }
      throw error;
    }
    if (previous.exists && /^[0-9a-f-]{36}$/.test(previous.version) && Number.isInteger(previous.parts) && previous.parts <= 110) {
      for (let index = 0; index < previous.parts; index++) {
        try { await deleteDoc(partRef(user.uid, previous.version, index)); } catch { /* Old copy can be cleaned later. */ }
      }
    }
    return { exists: true, version, parts, bytes: snapshot.bytes, updatedAt };
  },
  async download() {
    const user = auth?.currentUser;
    if (!user) throw new Error('पहले Google खाते में प्रवेश करें।');
    const info = await this.cloudInfo();
    if (!info.exists) throw new Error('इस खाते में कोई क्लाउड प्रति नहीं है।');
    if (!/^[0-9a-f-]{36}$/.test(info.version) || !Number.isInteger(info.parts) || info.parts < 1 || info.parts > 110 || !Number.isInteger(info.bytes) || info.bytes < 1 || info.bytes > MAX_BACKUP_BYTES) throw new Error('क्लाउड प्रति का विवरण अमान्य है।');
    const chunks = [];
    for (let index = 0; index < info.parts; index++) {
      const part = await getDocFromServer(partRef(user.uid, info.version, index));
      if (!part.exists() || typeof part.data().data !== 'string') throw new Error('क्लाउड प्रति अधूरी है।');
      chunks.push(part.data().data);
    }
    if (auth.currentUser?.uid !== user.uid) throw new Error('खाता बदल गया है। दोबारा प्रवेश करें।');
    const text = joinSnapshot(chunks, info.bytes);
    const { counts } = await backupService.inspectBackup(text);
    return { text, counts };
  }
};
