# Firebase release checklist

The public app is **काव्यकलश (Kavyakalash)**. The technical Firebase project and hosting URL remain `kavyavault-1a3ce`. Writing, reading, book export, and JSON backup work locally without signing in. Google sign-in adds an optional **manual** Firestore copy; it never uploads or replaces the browser library automatically.

## Configuration and Console actions

1. In Firebase Console, select project `kavyavault-1a3ce` and confirm the plan is **Spark**. Do not enable billing or Cloud Storage.
2. Open **Authentication → Sign-in method → Google**. Confirm Google is enabled and the project support email is set.
3. Open **Authentication → Settings → Authorized domains**. Confirm `kavyavault-1a3ce.web.app` and `kavyavault-1a3ce.firebaseapp.com` appear. Add the Hosting domain there if absent. No custom domain is required.
4. Open **Firestore Database → Rules**. Compare the published rules with `firestore.rules` in this repository. Publish the reviewed rules if they differ; test with two accounts before allowing real backups.
5. Keep all six `VITE_FIREBASE_*` entries from `.env.example` in the local or CI build environment. The local `.env.local` is ignored by Git and must never be committed. The app uses `kavyavault-1a3ce.web.app` as its auth helper domain when hosted there; its `/__/auth/handler` request must reach Firebase Hosting without service-worker interception.

## Safe release and live checks

Run `npm test`, `npm run build`, `node --test test_offline_worker.js`, and `npm run test:rules`. The rules test uses the Firestore emulator and a throwaway project ID; it does not touch production. The emulator runner is pinned to Firebase CLI 13 because this workstation has Java 17; Firebase CLI 15's emulator needs Java 21.

After explicit approval for public deployment, deploy the reviewed Hosting build and rules to the named project. Then use a fresh browser profile at `https://kavyavault-1a3ce.web.app/settings`:

1. Confirm Google sign-in reaches Google's account chooser, signs in, survives a refresh, and signs out. Check a mobile browser too; mobile uses redirect.
2. Create only disposable sample data in that fresh profile. Download a JSON backup, upload a manual cloud copy, inspect its timestamp, download and review it, and restore it only in that disposable profile.
3. Sign in as a second test account in a separate fresh profile. Verify it cannot see the first account's cloud copy. Never test restore against an existing personal library.
4. Go offline after the first load. Confirm poem reading and editing still work and that a cloud operation shows an error without altering local records. Reconnect and refresh.

Snapshots live under `users/<uid>/snapshots/<version>/parts/<index>` with the current manifest under `users/<uid>/libraries/current`. Owner-only rules limit document access. A snapshot is split into 400 KB parts, capped at 40 MB, and contains an archive SHA-256 checksum checked before restore. The manifest is written only after all parts. Restore validates the archive, requires a local backup confirmation, journals the old records, and rolls back if a write fails. Failed uploads leave the previous manifest in place; incomplete new parts are cleaned up when possible. Firestore's Spark quotas still apply, especially for image-heavy manuscripts.

## Android later

A Play Store package needs separate device checks for Google redirect, offline use, downloads, file picking, and current Play requirements. The web release does not change that scope.
