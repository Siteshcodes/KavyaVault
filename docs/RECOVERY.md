# Backup and recovery

Open Settings → **पूरा बैकअप डाउनलोड करें**. Keep the JSON file outside the browser profile, and preferably keep another copy on a device you control. A PDF or EPUB is a publication, not a complete library backup.

The backup contains poems, drafts, original and derived manuscript images, transcription history, collections, book references, recent reading history, metadata, and theme. It is plaintext and includes the complete archive; store it privately. It does not contain browser permission grants or temporary search indexes.

To restore, open Settings in the destination browser, select the backup, and review the counts. Download a backup of the destination library first, close other KavyaVault tabs, tick the acknowledgement, and confirm restoration. Restore **replaces**, rather than merges, the destination library. IDs and relationships are preserved exactly. The app reloads after success.

The importer checks the format version, SHA-256 integrity, supported record shapes, duplicate IDs, and image references before writing. SHA-256 detects accidental changes; it is not an authenticity signature or encryption. Import only your own trusted backup files.

Restore writes a durable rollback journal before replacing records. If a write fails, the old snapshot is restored. After an interrupted restore, the next launch recovers that snapshot before mounting the app. If the browser cannot complete recovery, the app stops instead of resetting the library. Do not clear site data in that situation; retain the backup and browser profile for recovery.

The rollback journal needs additional browser storage. If there is insufficient space, restore refuses before changing records. Use a fresh browser profile or a fresh local origin and restore there. Browsers set their own storage limits; large manuscript images can exhaust them.

A raw backup can still be downloaded when existing records are corrupt, for manual recovery. Such a rescue file may fail normal restoration. Do not edit the only copy.

Data belongs to the exact origin (scheme, host, and port). `localhost`, `127.0.0.1`, and different ports have separate libraries. Export before changing hosting addresses, clearing browser data, or removing a browser profile. Private browsing and cache eviction do not provide durable archival storage.
