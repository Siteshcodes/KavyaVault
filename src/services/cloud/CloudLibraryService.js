import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getStorage, ref, getBytes, getMetadata, uploadBytes } from 'firebase/storage';
import { backupService, MAX_BACKUP_BYTES } from '../storage/BackupService.js';

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
const storage = app ? getStorage(app) : null;
const provider = new GoogleAuthProvider();
const cloudRef = uid => ref(storage, `users/${uid}/library.json`);

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
    try {
      const metadata = await getMetadata(cloudRef(user.uid));
      return { exists: true, updatedAt: metadata.updated, bytes: metadata.size };
    } catch (error) {
      if (error.code === 'storage/object-not-found') return { exists: false };
      throw error;
    }
  },
  async upload() {
    const user = auth?.currentUser;
    if (!user) throw new Error('पहले Google खाते में प्रवेश करें।');
    const text = await backupService.exportBackup();
    await backupService.inspectBackup(text);
    const bytes = new TextEncoder().encode(text);
    if (bytes.length > MAX_BACKUP_BYTES) throw new Error('क्लाउड प्रति 40 MB से बड़ी है।');
    await uploadBytes(cloudRef(user.uid), bytes, { contentType: 'application/json' });
    if (auth.currentUser?.uid !== user.uid) throw new Error('खाता बदल गया है। क्लाउड स्थिति फिर जाँचें।');
    return this.cloudInfo();
  },
  async download() {
    const user = auth?.currentUser;
    if (!user) throw new Error('पहले Google खाते में प्रवेश करें।');
    const bytes = await getBytes(cloudRef(user.uid), MAX_BACKUP_BYTES);
    if (auth.currentUser?.uid !== user.uid) throw new Error('खाता बदल गया है। दोबारा प्रवेश करें।');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const { counts } = await backupService.inspectBackup(text);
    return { text, counts };
  }
};
