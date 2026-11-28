# काव्यकलश (Kavyakalash)

**साहित्यिक धरोहर व पुस्तकालय**

*A Hindi-first digital poetry library, manuscript archive, and book creation platform.*

काव्यकलश helps writers compose and organize Hindi poetry, preserve manuscripts, assemble books, and export their work. The repository and Firebase project are technically named **KavyaVault**.

**[Open the live website](https://kavyavault-1a3ce.web.app)** · Deployed on Firebase Hosting.

## Features available now

| Area | Supported behavior |
| --- | --- |
| Poetry | Write, edit, read, and locally autosave drafts; use favorites and archive. |
| Access | Continue as a local guest or sign in with Google Authentication. Each Google UID has a separate local library and private Firestore records. |
| Sync | Signed-in users can enable, pause, or disable incremental Firestore sync for poems, collections, manuscripts, books, drafts, theme, categories, and tags. Offline changes queue locally and sync when connectivity returns. |
| Migration | On first account entry with guest writing, choose to merge after downloading a recovery backup, keep libraries separate, or cancel sign-in. Guest originals remain. |
| Profile | View Google photo or initials, read-only account email, optional display name, pen name, birth date, age and biography, account creation date, sync status, and library counts. Birth date stays private to the account. |
| Manuscripts | Keep original images, derived versions, provenance, manual transcription, and history. |
| Organization | Use collections, categories, tags, recent reading, timeline, and text search. |
| Books | Arrange poem references into sections, preview layouts, and download PDF or EPUB with bundled Hindi fonts. Export runs locally without network calls. |
| Recovery | Download a versioned JSON library backup; validate and review a backup before replacement restore. The restore journal supports rollback and interrupted-restore recovery. Account settings also offer a manual cloud copy and an account-data JSON export. |

Concurrent edits use record revisions. If two devices change the same record, the local version is preserved as a conflict copy before the cloud version is applied. Deleted account records have a local recovery view. These safeguards do not replace regular downloaded backups.

The app also includes browser speech recognition where supported; a browser vendor may process microphone audio online. AI analysis uses a demonstration provider. Production AI analysis, semantic embeddings, automatic OCR, custom profile-image uploads, and a Play Store app are **not** shipped.

## Getting started

1. Open the [website](https://kavyavault-1a3ce.web.app).
2. Choose **Continue as Guest** to write on this device, or **Continue with Google** for a private account and optional automatic sync. The sign-in screen offers a session-persistence choice.
3. Open **My Poems → New Poem** to write your first poem. Drafts save locally while you work.
4. Signed-in users can open **My Profile** to edit optional details and see library statistics. Guest users can write without a profile.
5. To use another device, sign in with the **same Google account**, keep automatic sync enabled in **Settings**, and wait for **Synced** before relying on the other device's copy.
6. In **Settings**, download a full JSON backup and keep it outside the browser profile. Review a backup carefully before restoring: restore replaces the destination library rather than merging it.

Guest writing stays on that browser and is not automatically uploaded. Signing in does not silently merge it into an account.

## Local development

Use **Node.js 22 or newer** and npm. The local release was checked with Node 24.19.0.

```sh
git clone https://github.com/Siteshcodes/KavyaVault.git
cd KavyaVault
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with your own Firebase web-app configuration if you need Google sign-in or cloud features. The app's local writing features still work without Firebase configuration. Open the URL printed by Vite; use HTTP on localhost or HTTPS, not `file://`.

```sh
npm test           # application, persistence, exports, backup, and sync regression checks
npm run test:sync  # scoped storage, sync, profile, and migration checks
npm run test:rules # Firestore emulator ownership and record-security checks
npm run build      # Vite production build and offline worker
npm run preview    # serve the built app locally
```

The rules test uses the pinned Firebase CLI 13 emulator. Development mode does not install the offline worker. After a production build's first successful load, the worker caches static app assets and fonts; user records remain in browser storage.

## Firebase setup

Create a Firebase web app and copy these **six** values into `.env.local` or a private CI build environment. `.env.example` lists the names; never commit `.env.local`, private keys, or service-account credentials.

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

These are Firebase web-app identifiers embedded in the client build; **Firestore Security Rules**, not secrecy of the web config, enforce record access. In Firebase Console, enable **Authentication → Sign-in method → Google**, select a support email, create a **Cloud Firestore** database, and add every deployed web domain under **Authentication → Settings → Authorized domains**. For a custom domain or custom `authDomain`, follow [Firebase's OAuth redirect-domain setup](https://firebase.google.com/docs/auth/web/redirect-best-practices) and allow the matching Firebase auth-handler URI in the Google OAuth client. The standard Firebase Hosting domain uses its `/__/auth/handler` route. See [Firebase rollout](docs/FIREBASE-ROLLOUT.md) and [automatic sync design](docs/AUTO-SYNC.md).

The current public project is `kavyavault-1a3ce` on the Spark plan. Cloud Storage, Blaze billing, and paid services are not required for this release.

## Deployment

Build with the intended Firebase configuration and deploy the reviewed ownership rules **before** the Hosting build:

```sh
npm ci
npm test
npm run test:rules
npm run build
npx firebase-tools@13.35.1 deploy --only firestore:rules --project kavyavault-1a3ce
npx firebase-tools@13.35.1 deploy --only hosting --project kavyavault-1a3ce
```

Deploy only with project-owner authorization. `firebase.json` points Hosting at `dist` and Firestore at `firestore.rules`. Check the live guest flow, Google sign-in, sync, backup, and account isolation with **disposable** records after a release. Documentation-only changes do not require another website deployment.

## Privacy, recovery, and limits

- Guest libraries live in that browser's local storage. Signed-in libraries use UID-scoped local keys and owner-only Firestore paths; switching accounts switches local workspaces.
- Offline account changes can synchronize after reconnection when sync is enabled. The status indicator reports local save, syncing, synced, offline, errors, and conflicts.
- Manual JSON backups are still important. Browser storage can be cleared or evicted, network writes can fail, and sync is not a guarantee against data loss. Changing the hostname or port creates a different browser library.
- Firestore's Spark quotas are shared by all users. Large manuscript images can also exceed browser local-storage capacity or increase Firestore reads, writes, and storage. See [Firebase's current quotas](https://firebase.google.com/docs/firestore/quotas).
- The account-data export contains a nested library backup and locally cached profile. The existing backup importer accepts the nested `library` object; profile fields are not automatically imported. Cloud-data deletion removes **currently indexed** cloud records, current manual backup, and private profile, while leaving local writing intact; historical orphaned parts may need owner cleanup.
- PDF Hindi text **renders** with bundled Indic fonts in tested readers, but some extractors can split or duplicate matras when copying text. Use EPUB or the original library for exact text interchange. Large bundled font assets cause a build-size warning and may load slowly on low-memory devices.

Read [recovery instructions](docs/RECOVERY.md) before moving a library. [Roadmap](docs/ROADMAP.md) tracks remaining acceptance work, while [verification](docs/VERIFICATION.md) and [local release notes](docs/RELEASE.md) retain historical evidence. Font sources and licenses are in [font notices](docs/FONTS.md).

## Verification record

Before the November 2026 public release, `npm test`, `npm run build`, and `npm run test:rules` passed. Emulator tests include cross-account denial, Hindi record transport, and current-cloud-data deletion. The deployed site served the new build, and its guest welcome and guest profile route were checked. The project owner reports testing the live account features; this repository's automated checks do **not** substitute for repeating Google sign-in, two-device sync, offline reconnection, and restoration with disposable accounts before future deployments.

For book-export diagnostics, run `npm run verify:exports`. The older portable local package can be made with `npm run release`; its historical scope is documented in [release notes](docs/RELEASE.md).

## Repository structure

`src/components` contains UI views; `src/services` contains repositories, storage, sync, and export services. Storage keys are centralized in `src/data/storageKeys.js`. `firestore.rules` owns cloud access checks; tests live in the root `test_*.js` files. Third-party fonts and dependencies retain their licenses.
