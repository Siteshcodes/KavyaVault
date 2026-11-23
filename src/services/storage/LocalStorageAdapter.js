/**
 * काव्यकलश (KavyaVault) — LocalStorage Adapter (LocalStorageAdapter.js)
 * Concrete implementation of IStorageAdapter utilizing browser localStorage.
 */

import { IStorageAdapter } from './IStorageAdapter.js';
import { StorageError, StorageErrorCode } from './StorageError.js';
import { STORAGE_PREFIX } from '../../data/storageKeys.js';
import { scopedStorage } from './LibraryWorkspace.js';

export class LocalStorageAdapter extends IStorageAdapter {
  constructor(storage = null) {
    super();
    // Allow custom storage driver injection (useful for tests or custom wrappers)
    this.storage = storage;
  }

  /**
   * Resolves the active storage instance safely
   */
  getStorage() {
    if (this.storage) return this.storage;
    if (typeof window !== 'undefined' && window.localStorage) {
      return scopedStorage(window.localStorage);
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return scopedStorage(globalThis.localStorage);
    }
    return null;
  }

  /**
   * Verifies if localStorage is fully operational
   */
  isAvailable() {
    try {
      const storage = this.getStorage();
      if (!storage) return false;
      const testKey = `__kavyavault_probe_${Date.now()}__`;
      storage.setItem(testKey, 'probe');
      storage.removeItem(testKey);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Retrieves and parses stored JSON data
   */
  get(key) {
    const storage = this.getStorage();
    if (!storage) {
      throw new StorageError(
        'स्थानीय भंडारण (LocalStorage) उपलब्ध नहीं है।',
        StorageErrorCode.STORAGE_UNAVAILABLE
      );
    }

    try {
      const raw = storage.getItem(key);
      if (raw === null || raw === undefined) {
        return null;
      }

      return JSON.parse(raw);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new StorageError(
          `की "${key}" के लिए संचित डेटा दूषित (Malformed JSON) है।`,
          StorageErrorCode.DESERIALIZATION_ERROR,
          err,
          { key }
        );
      }
      throw new StorageError(
        `डेटा पढ़ने में त्रुटि: ${err.message}`,
        StorageErrorCode.UNKNOWN_ERROR,
        err,
        { key }
      );
    }
  }

  /**
   * Serializes and stores value as JSON
   */
  set(key, value) {
    const storage = this.getStorage();
    if (!storage) {
      throw new StorageError(
        'स्थानीय भंडारण (LocalStorage) उपलब्ध नहीं है।',
        StorageErrorCode.STORAGE_UNAVAILABLE
      );
    }

    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch (err) {
      throw new StorageError(
        `डेटा को JSON में बदलने में विफलता: ${err.message}`,
        StorageErrorCode.SERIALIZATION_ERROR,
        err,
        { key }
      );
    }

    try {
      storage.setItem(key, serialized);
    } catch (err) {
      // Check for browser quota exceeded error
      if (
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014
      ) {
        throw new StorageError(
          'ब्राउज़र मेमोरी सीमा (Storage Quota) पूर्ण हो चुकी है। कृपया कुछ पुरानी रचनाओं को निर्यात कर स्थान रिक्त करें।',
          StorageErrorCode.QUOTA_EXCEEDED,
          err,
          { key }
        );
      }

      throw new StorageError(
        `डेटा सहेजने में विफलता: ${err.message}`,
        StorageErrorCode.UNKNOWN_ERROR,
        err,
        { key }
      );
    }
  }

  /**
   * Removes item from storage
   */
  remove(key) {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.removeItem(key);
    } catch (err) {
      throw new StorageError(
        `डेटा हटाने में विफलता: ${err.message}`,
        StorageErrorCode.UNKNOWN_ERROR,
        err,
        { key }
      );
    }
  }

  /**
   * Checks if key exists
   */
  has(key) {
    const storage = this.getStorage();
    if (!storage) return false;

    try {
      return storage.getItem(key) !== null;
    } catch (err) {
      return false;
    }
  }

  /**
   * Clears only KavyaVault namespaced keys, preserving third-party keys
   */
  clear(prefix = STORAGE_PREFIX) {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      for (const k of keysToRemove) {
        storage.removeItem(k);
      }
    } catch (err) {
      throw new StorageError(
        `डेटा साफ़ करने में विफलता: ${err.message}`,
        StorageErrorCode.UNKNOWN_ERROR,
        err
      );
    }
  }
}
