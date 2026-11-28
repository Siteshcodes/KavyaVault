# Automatic sync architecture and release checks

Account-scoped, per-record Firestore sync is deployed on the public Kavyakalash site. Its owner-only rules were deployed before the Hosting build in November 2026. Keep the project on Spark and do not enable Cloud Storage. This document records the design and the checks to repeat for future releases.

## Data boundaries and migration

- Existing `kavyavault:*` local records remain the guest library. They are not renamed, cleared, or uploaded at sign-in.
- A signed-in Firebase UID uses separate local keys under `kavyavault:account:<uid>:*`. Signing out returns to the untouched guest library. Switching UIDs switches local namespaces.
- On first account entry with guest content, the app offers **merge**, **keep separate**, or **cancel**. Merge first requires downloading a validated JSON recovery backup. It keeps the guest originals and skips identical IDs; different records with the same ID become separate guest copies. The merge decision is remembered per UID.
- Existing manual cloud backups remain at their old paths. The new record collections start empty. Users may review and restore an old manual backup into the account workspace, then let the new sync upload records. No automatic replacement of an existing local library occurs.
- JSON export and the recovery journal remain available for guests and accounts. The account export in Settings bundles the current local library backup and locally cached profile in one JSON file. Restore the nested `library` object through the existing backup importer; the profile is included for personal records and is not automatically imported. Offline account changes stay in UID-scoped local storage and a persistent pending-ID queue until reconnection.

## Incremental record model

The sync kinds are poems, collections, manuscripts, books, drafts, theme, categories, and tags. Each record has a stable ID and lives at `users/<uid>/sync/<kind>/items/<id>`. Small records are inline. Large manuscripts are split into 400 KB parts under a unique version path; SHA-256 and byte count are checked before applying them. A transaction publishes the manifest only if its expected revision still matches. A 1.2-second debounce groups rapid local edits for the same record. The client watches the eight owner-only collections and reacts to changed documents. No full-library backup is written per keystroke.

If the cloud revision changes while a local record is edited, the local version becomes a separately named conflict copy, then the cloud version is applied to the original ID. Deleted records become tombstones and are kept in a recoverable local trash view. Sync can be paused or disabled in Settings. Sync statuses report local save, syncing, synced, offline, conflict, and error. The existing manual backup can still be downloaded and restored separately.

## Quotas and limits

For the standard Firestore free database, current published quotas are **1 GiB stored**, **50,000 reads/day**, **20,000 writes/day**, and **20,000 deletes/day**. See [Firebase's current quota page](https://firebase.google.com/docs/firestore/quotas) before release. These limits are shared across the project, not per user. Opening a library reads approximately one document per existing small record plus a small number of empty collection queries. One small-record edit writes one document after debounce and the transaction reads its prior revision. A 1 MB manuscript uses about three part writes plus one manifest write, and several reads on another device. Multiple devices and reconnects increase reads. Trash and old versions consume storage; there is no unlimited free capacity. Browser localStorage is often much smaller than Firestore, so large image libraries may need downloaded backups and may exceed the browser's local quota.

## Deletion and privacy

The account controls can remove currently indexed synced records, the current manual backup, and the private profile after a typed confirmation. Local browser records remain and sync is switched off so they are not immediately uploaded again. Older orphaned manual snapshot versions or large-record parts left by interrupted cleanup cannot be exhaustively enumerated by a web client; a project owner must inspect and delete those paths in Firebase Console if a full historical purge is required. The control therefore says **current cloud data**. Birth date is owner-only and optional; email and Google photo come from Authentication, and custom photo uploads are deferred.

## Release verification

1. Run `npm test`, `npm run build`, and `npm run test:rules`. The rules emulator uses synthetic users and records only.
2. In an isolated staging Firebase project, verify Google persistence preference, first-time guest access, returning guest, profile editing, account switching, manual backup compatibility, offline reconnection, two-device edits, conflicts, and deletion. Use disposable records only.
3. Check Firestore Usage before and after a measured 100-record session and a large manuscript; confirm Spark quotas are acceptable.
4. Review migration and security rules, then request explicit approval before any further production Hosting or rules deployment. Do not test deletion with the owner's actual poetry collection.
