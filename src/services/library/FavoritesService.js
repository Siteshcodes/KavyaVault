/**
 * काव्यकलश (KavyaVault) — Favorites Service (FavoritesService.js)
 * Phase 6 / Task 6.1: Library Organization Foundation
 *
 * Provides service-level operations for poem favorites.
 * Strictly reuses existing PoemRepository `isFavorite` state as single source of truth.
 * Zero duplicate storage keys or parallel state caches.
 */

import { poemRepository } from '../PoemRepository.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

export class FavoritesService {
  /**
   * @param {Object} [options={}]
   * @param {PoemRepository} [options.poemRepo]
   */
  constructor(options = {}) {
    this.poemRepo = options.poemRepo || poemRepository;
  }

  /**
   * Marks a poem as favorite
   * @param {string} poemId
   * @returns {Object} Updated poem record
   */
  favoritePoem(poemId) {
    if (!poemId || typeof poemId !== 'string' || !poemId.trim()) {
      throw new StorageError('कविता आईडी मान्य स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
    return this.poemRepo.setFavorite(poemId.trim(), true);
  }

  /**
   * Unmarks a poem from favorites
   * @param {string} poemId
   * @returns {Object} Updated poem record
   */
  unfavoritePoem(poemId) {
    if (!poemId || typeof poemId !== 'string' || !poemId.trim()) {
      throw new StorageError('कविता आईडी मान्य स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
    return this.poemRepo.setFavorite(poemId.trim(), false);
  }

  /**
   * Toggles favorite status of a poem
   * @param {string} poemId
   * @returns {Object} Updated poem record
   */
  toggleFavorite(poemId) {
    if (!poemId || typeof poemId !== 'string' || !poemId.trim()) {
      throw new StorageError('कविता आईडी मान्य स्ट्रिंग होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
    const cleanId = poemId.trim();
    const poem = this.poemRepo.getById(cleanId);
    if (!poem) {
      throw new StorageError(
        `आईडी "${cleanId}" वाली कविता नहीं मिली।`,
        StorageErrorCode.KEY_NOT_FOUND,
        null,
        { id: cleanId }
      );
    }
    return this.poemRepo.setFavorite(cleanId, !poem.isFavorite);
  }

  /**
   * Checks if a poem is favorite
   * @param {string} poemId
   * @returns {boolean}
   */
  isFavorite(poemId) {
    if (!poemId || typeof poemId !== 'string') return false;
    const poem = this.poemRepo.getById(poemId.trim());
    return Boolean(poem && poem.isFavorite);
  }

  /**
   * Lists all favorite poems, sorted newest updated first
   * @param {Object} [options={}]
   * @param {boolean} [options.includeArchived=false]
   * @returns {Array<Object>}
   */
  listFavorites({ includeArchived = false } = {}) {
    return this.poemRepo.getAll({
      includeArchived,
      onlyFavorites: true
    });
  }

  /**
   * Returns total count of favorite poems
   * @param {Object} [options={}]
   * @param {boolean} [options.includeArchived=false]
   * @returns {number}
   */
  countFavorites({ includeArchived = false } = {}) {
    return this.listFavorites({ includeArchived }).length;
  }
}

export const favoritesService = new FavoritesService();
