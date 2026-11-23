import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { cloudConnection } from './CloudLibraryService.js';

const blank = () => ({ displayName: '', penName: '', bio: '', birthDate: '', updatedAt: '' });
const keyFor = uid => `kavyavault:profile:${uid}`;

export class ProfileService {
  constructor(uid, { database = cloudConnection.database, storage = globalThis.localStorage } = {}) {
    this.uid = uid;
    this.database = database;
    this.storage = storage;
    this.dirtyKey = `${keyFor(uid)}:dirty`;
  }
  get local() {
    try { return { ...blank(), ...JSON.parse(this.storage.getItem(keyFor(this.uid)) || '{}') }; }
    catch { return blank(); }
  }
  async load() {
    if (!this.database || globalThis.navigator?.onLine === false) return this.local;
    try {
      const remote = await getDocFromServer(doc(this.database, 'users', this.uid, 'profile', 'current'));
      if (this.storage.getItem(this.dirtyKey)) return this.local;
      if (remote.exists()) { this.storage.setItem(keyFor(this.uid), JSON.stringify(remote.data())); return this.local; }
    } catch { /* Keep the validated local copy while offline. */ }
    return this.local;
  }
  async save(input) {
    const profile = {
      displayName: String(input.displayName || '').trim().slice(0, 100),
      penName: String(input.penName || '').trim().slice(0, 100),
      bio: String(input.bio || '').trim().slice(0, 1000),
      birthDate: String(input.birthDate || '').slice(0, 10),
      updatedAt: new Date().toISOString()
    };
    if (profile.birthDate) {
      const day = new Date(`${profile.birthDate}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate) || Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== profile.birthDate || day.getTime() > Date.now()) throw new Error('जन्मतिथि अमान्य है। / Invalid birth date.');
    }
    this.storage.setItem(keyFor(this.uid), JSON.stringify(profile));
    this.storage.setItem(this.dirtyKey, '1');
    await this.flush();
    return profile;
  }
  async flush() {
    if (!this.database || !this.storage.getItem(this.dirtyKey) || globalThis.navigator?.onLine === false || this.storage.getItem(`kavyavault:sync:mode:${this.uid}`) === 'off' || this.storage.getItem(`kavyavault:sync:mode:${this.uid}`) === 'paused') return false;
    await setDoc(doc(this.database, 'users', this.uid, 'profile', 'current'), this.local);
    this.storage.removeItem(this.dirtyKey);
    return true;
  }
}
