/**
 * काव्यकलश (KavyaVault) — Custom Storage Error
 * Encapsulates persistence errors with structured categories.
 */

export const StorageErrorCode = {
  SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR: 'DESERIALIZATION_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CORRUPTED_DATA: 'CORRUPTED_DATA',
  DUPLICATE_ID: 'DUPLICATE_ID',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export class StorageError extends Error {
  constructor(message, code = StorageErrorCode.UNKNOWN_ERROR, originalError = null, details = null) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.originalError = originalError;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Preserve stack trace where available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StorageError);
    }
  }
}
