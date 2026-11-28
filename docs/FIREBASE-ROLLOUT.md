# Firebase rollout — current production status

The public app is **काव्यकलश (Kavyakalash)** at [kavyavault-1a3ce.web.app](https://kavyavault-1a3ce.web.app). The technical Firebase project is `kavyavault-1a3ce`. In November 2026, the owner approved a public deployment; the reviewed Firestore rules were deployed first, followed by the Hosting build. This document supersedes the earlier manual-copy-only rollout checklist. The manual backup remains available alongside optional automatic account sync.

## Configuration and Console checks

1. In Firebase Console, select `kavyavault-1a3ce` and check that the plan remains **Spark**. Cloud Storage and billing are not needed.
2. Under **Authentication → Sign-in method**, enable Google and select a project support email.
3. Under **Authentication → Settings → Authorized domains**, include the Hosting domain `kavyavault-1a3ce.web.app` and any custom domain you actually use. If configuring a custom auth domain, follow [Firebase's Google OAuth redirect guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices) and register its `/__/auth/handler` URI with the Google OAuth client as required.
4. In **Firestore Database → Rules**, compare the deployed rules with [`firestore.rules`](../firestore.rules). They restrict sync records, private profiles, and existing manual snapshots to their authenticated owner.
5. Provide all six `VITE_FIREBASE_*` variables from [`.env.example`](../.env.example) at build time. `.env.local` stays out of Git. The Hosting domain uses its own `/__/auth/handler` route for Google sign-in; do not let the app's offline worker intercept it.

## Data model and recovery

Guest writing stays under the browser's guest keys. Google users have UID-scoped local keys. The app offers a choice before merging guest writing, and a recovery-backup download is required for merge. Each account's poems, collections, manuscripts, books, drafts, theme, categories, and tags use incremental Firestore records under `users/<uid>/sync/<kind>/items/<id>`. Profile details use `users/<uid>/profile/current` and are owner-only. Sync can be on, paused, or off.

The older manual backup remains under `users/<uid>/libraries/current`, with parts under `users/<uid>/snapshots/<version>/parts/<index>`. It is not silently restored over an account library. The account can still download a JSON library backup. Review [automatic sync design and limits](AUTO-SYNC.md) and [recovery instructions](RECOVERY.md) before migration or deletion.

Large synced records use versioned Firestore chunks, and record manifests use revision checks. Offline edits remain in local storage until sync resumes. Competing edits can create a recoverable conflict copy. Browser storage can be evicted and Spark quotas apply, so download independent backups regularly.

## Future release checklist

Run `npm test`, `npm run build`, and `npm run test:rules` before publishing. `test:rules` uses a Firestore emulator with synthetic users; it does not touch production. This workstation pins Firebase CLI 13 for its Java 17 emulator. Repeat live checks with **disposable** accounts and records: Google sign-in and sign-out, persistence preference, guest and account separation, two-device sync, offline reconnection, conflict copies, profile editing, manual backup review, and cross-account denial. Test cloud-data deletion only with disposable records.

With explicit project-owner approval, deploy rules before Hosting:

```sh
npm run build
npx firebase-tools@13.35.1 deploy --only firestore:rules --project kavyavault-1a3ce
npx firebase-tools@13.35.1 deploy --only hosting --project kavyavault-1a3ce
```

The November 2026 deployment passed the full test suite, build, and Firestore emulator checks. The live welcome and guest profile routes were observed after release. The owner reports testing live account features; a separate disposable-account, two-device check should still be repeated for future releases. The previous local-release verification is preserved in [VERIFICATION.md](VERIFICATION.md).

## Android later

A Play Store package still needs separate device checks for Google redirect, offline use, downloads, file picking, and current Play requirements. This web deployment does not create an Android app.
