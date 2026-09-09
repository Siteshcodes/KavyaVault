/**
 * काव्यकलश (KavyaVault) — Schema Migration Manager (MigrationManager.js)
 * Manages storage schema versioning, new installation initialization, and data upgrades.
 */

import { STORAGE_KEYS } from '../../data/storageKeys.js';
import { StorageError, StorageErrorCode } from './StorageError.js';

export const CURRENT_SCHEMA_VERSION = 2;

export class MigrationManager {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Reads metadata and executes any required migration steps
   */
  async initialize() {
    let metadata = null;

    try {
      metadata = this.adapter.get(STORAGE_KEYS.METADATA);
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.DESERIALIZATION_ERROR) {
        console.warn('[KavyaVault Migration] Metadata corrupted. Re-initializing metadata safely.');
        metadata = null;
      } else {
        throw err;
      }
    }

    const now = new Date().toISOString();

    // 1. Fresh installation initialization
    if (!metadata) {
      const freshMetadata = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        initializedAt: now,
        lastMigratedAt: now
      };

      this.adapter.set(STORAGE_KEYS.METADATA, freshMetadata);

      // Ensure empty arrays exist for primary collections if not already present
      if (!this.adapter.has(STORAGE_KEYS.POEMS)) {
        this.adapter.set(STORAGE_KEYS.POEMS, []);
      }
      if (!this.adapter.has(STORAGE_KEYS.DRAFTS)) {
        this.adapter.set(STORAGE_KEYS.DRAFTS, null);
      }
      if (!this.adapter.has(STORAGE_KEYS.MANUSCRIPTS)) {
        this.adapter.set(STORAGE_KEYS.MANUSCRIPTS, []);
      }

      return {
        status: 'INITIALIZED',
        previousVersion: 0,
        currentVersion: CURRENT_SCHEMA_VERSION
      };
    }

    // 2. Validate existing schema version
    const version = typeof metadata.schemaVersion === 'number' ? metadata.schemaVersion : 0;

    if (version === CURRENT_SCHEMA_VERSION) {
      return {
        status: 'UP_TO_DATE',
        version: CURRENT_SCHEMA_VERSION
      };
    }

    // Protection against downgrading data from a newer release
    if (version > CURRENT_SCHEMA_VERSION) {
      console.warn(`[KavyaVault Migration] Detected newer schema version (${version}) than current supported (${CURRENT_SCHEMA_VERSION}). Preserving without downgrade.`);
      return {
        status: 'NEWER_VERSION_DETECTED',
        version
      };
    }

    // 3. Stepwise upgrade pipeline
    let currentV = version;

    if (currentV === 1) {
      this._migrateV1ToV2();
      currentV = 2;
    }

    metadata.schemaVersion = CURRENT_SCHEMA_VERSION;
    metadata.lastMigratedAt = now;
    this.adapter.set(STORAGE_KEYS.METADATA, metadata);

    return {
      status: 'MIGRATED',
      previousVersion: version,
      currentVersion: CURRENT_SCHEMA_VERSION
    };
  }

  /**
   * V1 → V2: Initialize manuscripts storage for Phase 2 preservation foundation.
   * Non-destructive: only creates the manuscripts key if it does not already exist.
   */
  _migrateV1ToV2() {
    if (!this.adapter.has(STORAGE_KEYS.MANUSCRIPTS)) {
      this.adapter.set(STORAGE_KEYS.MANUSCRIPTS, []);
    }
  }

  /**
   * Retrieves current active schema version
   */
  getSchemaVersion() {
    try {
      const metadata = this.adapter.get(STORAGE_KEYS.METADATA);
      return metadata ? metadata.schemaVersion : 0;
    } catch {
      return 0;
    }
  }
}
