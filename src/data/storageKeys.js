/**
 * काव्यकलश (KavyaVault) — Central Storage Keys
 * Single source of truth for all namespaced persistence keys.
 */

export const STORAGE_PREFIX = 'kavyavault:';

export const STORAGE_KEYS = {
  POEMS: `${STORAGE_PREFIX}poems`,
  DRAFTS: `${STORAGE_PREFIX}drafts`,
  METADATA: `${STORAGE_PREFIX}metadata`,
  THEME: `${STORAGE_PREFIX}theme`,
  COLLECTIONS: `${STORAGE_PREFIX}collections`
};
