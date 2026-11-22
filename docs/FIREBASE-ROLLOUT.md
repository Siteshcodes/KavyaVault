# Google sign-in, cloud sync, and Android rollout

The current app stores one library per browser origin in localStorage. Google sign-in and manual account-scoped cloud backup are now implemented using Cloud Firestore's no-billing Spark tier. Signing in does not replace or upload that library. The existing JSON backup remains the recovery format throughout the migration. Continuous two-way sync is not yet implemented.

## Firebase project setup needed

The supplied web config is loaded from Vite environment variables (see `.env.example`). The local `.env.local` is ignored by Git. Firebase web API keys are public client identifiers, not service-account keys. In Firebase Console, enable Authentication → Google, authorize the final Hosting domain, create one Firestore database on the Spark plan, and publish `firestore.rules` before allowing uploads. `firebase.json` prepares Hosting and Firestore Rules, but neither is deployed automatically. The final public domain and live sign-in/database checks are still pending.

The owner chose **no billing**. Cloud Storage was removed. Firestore's free tier includes one free database and has daily read/write and storage limits. A JSON backup is split into 400 KB chunks because a Firestore document is limited to 1 MiB; a manifest is written only after every chunk. The UI limits a snapshot to 40 MB. The browser continues to work without cloud setup. The built-in mobile redirect uses the Hosting site's own auth domain for `kavyavault-1a3ce.web.app`; a different domain needs its corresponding Firebase Auth redirect configuration and device testing. A local `.env.local` is not uploaded by `firebase deploy`: set the same `VITE_FIREBASE_*` build variables in the release environment before building.

## Web rollout

1. Register the production web origin in Firebase Authentication and enable the Google provider. Never commit a service-account key.
2. Optional Google sign-in lives in Settings. The app remains usable without an account. The mobile web flow uses redirect; verify it on the final Hosting domain.
3. Manual full-library snapshots live under `users/<uid>/snapshots/<version>/parts/<index>` in Firestore, with the current manifest under `users/<uid>/libraries/current`. Rules deny access without the matching authenticated `uid`. The snapshot includes manuscript images and has a 40 MB limit. Large images use more Firestore document writes, so users should keep independent downloaded backups.
4. After sign-in, users can inspect cloud presence, explicitly upload the current browser library, or download and review a cloud snapshot before replacing the browser library. Never silently replace, merge, or delete either copy. Download a JSON backup before the first migration.
5. Introduce per-record revisions, deletion tombstones, and conflict handling before continuous bidirectional sync. Show sync status and errors. An offline edit must remain local until acknowledged by the server; sign-out must not clear the local library.
6. Test two accounts, two devices, offline edits, reconnect, conflicts, quota failures, large manuscript images, account switching, and backup/restore. Validate Firestore and Storage rules in Firebase emulators before deployment.

## Android after web sync is reliable

Host the PWA on a stable HTTPS domain. A Trusted Web Activity can package that PWA for Google Play, but its sign-in redirect, offline behavior, downloads, and file picking need Android-device checks. A native wrapper or native app may be preferable if those flows are unreliable. Meet the Play Console's current target API, privacy, data-safety, signing, and testing requirements at submission time.

The final Hosting domain and live Firebase services are still needed for end-to-end verification. This is manual cloud backup, not automatic sync.
