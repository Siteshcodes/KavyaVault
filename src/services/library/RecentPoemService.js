/**
 * काव्यकलश (KavyaVault) — Recent Poems Service (RecentPoemService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Tracks local viewing history for poems:
 * - Records poem views with independent `viewedAt` timestamps.
 * - Strictly avoids mutating `poem.updatedAt` or modifying poem records.
 * - Deduplicates by `poemId`, keeps newest views first.
 * - Bounded to a configurable maximum (default 50).
 * - Decoupled from concrete storage via IStorageAdapter.
 */

import { LocalStorageAdapter } from '../storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';
import { STORAGE_KEYS } from '../../data/storageKeys.js';
import { createRecentActivity, validateRecentActivity } from './libraryTypes.js';
import { poemRepository } from '../PoemRepository.js';

const DEFAULT_MAX_RECENT = 50;

/**
 * Deep clones object
 */
function deepClone(data) {
  if (data === null || data === undefined) return data;
  if (typeof structuredClone === 'function') {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
}

export class RecentPoemService {
  /**
   * @param {Object} [options={}]
   * @param {import('../storage/IStorageAdapter.js').IStorageAdapter} [options.adapter]
   * @param {import('../PoemRepository.js').PoemRepository} [options.poemRepo]
   * @param {number} [options.maxLimit=50]
   */
  constructor(options = {}) {
    this.adapter = options.adapter || options.storageAdapter || new LocalStorageAdapter();
    this.poemRepo = options.poemRepo || poemRepository;
    this.maxLimit = typeof options.maxLimit === 'number' && options.maxLimit > 0
      ? options.maxLimit
      : DEFAULT_MAX_RECENT;
  }

  /**
   * Reads raw recent activities array from storage safely
   * @private
   */
  _readRecent() {
    try {
      const data = this.adapter.get(STORAGE_KEYS.RECENT_POEMS);
      if (!Array.isArray(data)) {
        return [];
      }
      return data.filter(item => item && typeof item === 'object' && typeof item.poemId === 'string');
    } catch (err) {
      if (err instanceof StorageError && err.code === StorageErrorCode.DESERIALIZATION_ERROR) {
        console.error('[RecentPoemService] Corrupted recent poems storage. Returning empty array safely.');
        return [];
      }
      return [];
    }
  }

  /**
   * Writes recent activities array to storage safely
   * @private
   */
  _writeRecent(items) {
    this.adapter.set(STORAGE_KEYS.RECENT_POEMS, deepClone(items));
  }

  /**
   * Records a poem view.
   * Updates `viewedAt`, moves poem to the front, deduplicates, bounds to `maxLimit`.
   * Does NOT modify `poem.updatedAt` or mutate poem records!
   *
   * @param {string} poemId
   * @param {string} [viewedAt] Optional ISO date override
   * @returns {Object} Recorded RecentActivity object
   */
  recordView(poemId, viewedAt = null) {
    if (!poemId || typeof poemId !== 'string' || !poemId.trim()) {
      throw new StorageError('कविता आईडी अनिवार्य है।', StorageErrorCode.VALIDATION_ERROR);
    }

    const cleanPoemId = poemId.trim();
    const now = viewedAt && !isNaN(Date.parse(viewedAt))
      ? new Date(viewedAt).toISOString()
      : new Date().toISOString();

    const activity = createRecentActivity({
      poemId: cleanPoemId,
      viewedAt: now
    });

    const currentList = this._readRecent();

    // Deduplicate: remove any existing entry for this poemId
    const filtered = currentList.filter(item => item.poemId !== cleanPoemId);

    // Prepend newest view
    filtered.unshift({
      poemId: activity.poemId,
      viewedAt: activity.viewedAt
    });

    // Bound to maxLimit
    const bounded = filtered.slice(0, this.maxLimit);

    this._writeRecent(bounded);
    return activity;
  }

  /**
   * Retrieves raw recent viewing activities, newest first
   * @param {number} [limit=50]
   * @returns {Array<{ poemId: string, viewedAt: string }>}
   */
  getRecent(limit = DEFAULT_MAX_RECENT) {
    const safeLimit = typeof limit === 'number' && limit > 0 ? limit : this.maxLimit;
    const items = this._readRecent();

    // Ensure sorted newest first
    items.sort((a, b) => {
      const ta = new Date(a.viewedAt).getTime();
      const tb = new Date(b.viewedAt).getTime();
      return tb - ta;
    });

    return deepClone(items.slice(0, safeLimit));
  }

  /**
   * Retrieves recent viewing activities enriched with poem records
   * Automatically drops entries whose poems have been permanently deleted.
   *
   * @param {Object} [options={}]
   * @param {number} [options.limit=50]
   * @param {boolean} [options.includeArchived=false]
   * @returns {Array<{ poemId: string, viewedAt: string, poem: Object }>}
   */
  getRecentWithPoems({ limit = DEFAULT_MAX_RECENT, includeArchived = false } = {}) {
    const recentItems = this.getRecent(limit);
    const enriched = [];

    for (const item of recentItems) {
      const poem = this.poemRepo.getById(item.poemId);
      if (!poem) {
        // Poem was deleted from repository, skip
        continue;
      }
      if (!includeArchived && poem.isArchived) {
        continue;
      }

      enriched.push({
        poemId: item.poemId,
        viewedAt: item.viewedAt,
        poem
      });
    }

    return enriched;
  }

  /**
   * Removes a specific poem from recent history
   * @param {string} poemId
   * @returns {boolean} True if removed
   */
  removePoem(poemId) {
    if (!poemId || typeof poemId !== 'string') return false;
    const cleanId = poemId.trim();
    const current = this._readRecent();
    const filtered = current.filter(i => i.poemId !== cleanId);

    if (filtered.length !== current.length) {
      this._writeRecent(filtered);
      return true;
    }
    return false;
  }

  /**
   * Clears all recent viewing history
   */
  clearRecent() {
    this.adapter.remove(STORAGE_KEYS.RECENT_POEMS);
  }

  /**
   * Returns current count of recorded recent poems
   * @returns {number}
   */
  count() {
    return this._readRecent().length;
  }
}

export const recentPoemService = new RecentPoemService();
