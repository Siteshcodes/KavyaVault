/**
 * काव्यकलश (KavyaVault) — Storage Adapter Interface (IStorageAdapter)
 * Abstract contract defining persistence capabilities.
 * Concrete adapters (LocalStorageAdapter, IndexedDbAdapter, CloudAdapter) must implement this.
 */

export class IStorageAdapter {
  /**
   * Retrieves deserialized value for the given key.
   * Returns null if key does not exist.
   * @param {string} key
   * @returns {Promise<any>|any}
   */
  get(key) {
    throw new Error('Method "get(key)" must be implemented by concrete StorageAdapter.');
  }

  /**
   * Serializes and stores value for the given key.
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>|void}
   */
  set(key, value) {
    throw new Error('Method "set(key, value)" must be implemented by concrete StorageAdapter.');
  }

  /**
   * Removes item associated with the given key.
   * @param {string} key
   * @returns {Promise<void>|void}
   */
  remove(key) {
    throw new Error('Method "remove(key)" must be implemented by concrete StorageAdapter.');
  }

  /**
   * Checks whether the given key exists in storage.
   * @param {string} key
   * @returns {Promise<boolean>|boolean}
   */
  has(key) {
    throw new Error('Method "has(key)" must be implemented by concrete StorageAdapter.');
  }

  /**
   * Clears all storage keys managed by this adapter.
   * @returns {Promise<void>|void}
   */
  clear() {
    throw new Error('Method "clear()" must be implemented by concrete StorageAdapter.');
  }

  /**
   * Checks if the underlying storage driver is available and accessible.
   * @returns {boolean}
   */
  isAvailable() {
    throw new Error('Method "isAvailable()" must be implemented by concrete StorageAdapter.');
  }
}
