# Google sign-in, cloud sync, and Android rollout

The current app stores one library per browser origin in localStorage. Google sign-in and manual account-scoped cloud backup are now implemented. Signing in does not replace or upload that library. The existing JSON backup remains the recovery format throughout the migration. Continuous two-way sync is not yet implemented.

## Firebase project setup needed

The supplied web config is loaded from Vite environment variables (see `.env.example`). The local `.env.local` is ignored by Git. Firebase web API keys are public client identifiers, not service-account keys. In Firebase Console, enable Authentication → Google, authorize the final Hosting domain, enable Cloud Storage, and publish `storage.rules` before allowing uploads. `firebase.json` prepares Hosting and Storage Rules, but neither is deployed automatically. The final public domain and live sign-in/storage checks are still pending.

Cloud Storage for Firebase requires the **Blaze pay-as-you-go plan** as of 2026. Do not enable billing or deploy Storage rules until the project owner has chosen that cost model. The browser continues to work without cloud setup. The built-in mobile redirect uses the Hosting site's own auth domain for `kavyavault-1a3ce.web.app`; a different domain needs its corresponding Firebase Auth redirect configuration and device testing. A local `.env.local` is not uploaded by `firebase deploy`: set the same `VITE_FIREBASE_*` build variables in the release environment before building.

## Web rollout

1. Register the production web origin in Firebase Authentication and enable the Google provider. Never commit a service-account key.
2. Optional Google sign-in lives in Settings. The app remains usable without an account. The mobile web flow uses redirect; verify it on the final Hosting domain.
3. Manual full-library snapshots live at `users/<uid>/library.json` in Cloud Storage. Rules deny access without the matching authenticated `uid`. The snapshot includes manuscript images and has a 40 MB limit.
4. After sign-in, users can inspect cloud presence, explicitly upload the current browser library, or download and review a cloud snapshot before replacing the browser library. Never silently replace, merge, or delete either copy. Download a JSON backup before the first migration.
5. Introduce per-record revisions, deletion tombstones, and conflict handling before continuous bidirectional sync. Show sync status and errors. An offline edit must remain local until acknowledged by the server; sign-out must not clear the local library.
6. Test two accounts, two devices, offline edits, reconnect, conflicts, quota failures, large manuscript images, account switching, and backup/restore. Validate Firestore and Storage rules in Firebase emulators before deployment.

## Android after web sync is reliable

Host the PWA on a stable HTTPS domain. A Trusted Web Activity can package that PWA for Google Play, but its sign-in redirect, offline behavior, downloads, and file picking need Android-device checks. A native wrapper or native app may be preferable if those flows are unreliable. Meet the Play Console's current target API, privacy, data-safety, signing, and testing requirements at submission time.

The final Hosting domain and live Firebase services are still needed for end-to-end verification. This is manual cloud backup, not automatic sync.
