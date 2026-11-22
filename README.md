# KavyaVault — काव्यकलश

A Hindi-first personal poetry library. Write and recover drafts, preserve manuscripts, organize poems, curate books, and export PDF/EPUB files. The core archive stays in this browser's local storage.

## Run from source

Use Node.js 22 or newer and npm. The release was checked with Node 24.19.0.

```sh
npm ci
npm run dev
```

For the production app:

```sh
npm test
npm run build
npm run preview
```

Open the local URL printed by Vite. Use HTTP on localhost or HTTPS, not `file://`. Development mode does not install the offline worker. Production builds cache the static app and bundled fonts after the first successful load. Allow the cache to finish before disconnecting.

## Available features

| Area | Supported behavior |
|---|---|
| Writing and reading | Hindi editor, draft autosave/recovery, poem reader, themes, favorites and archive |
| Manuscripts | Preserve original images, derived versions, provenance, manual transcription and history |
| Organization | Collections, categories, tags, timeline, recent reading and ordinary text search |
| Books | Metadata, ordered sections and poem references, print preview, local PDF and EPUB downloads |
| Exports | Embedded Noto Hindi fonts, Indic shaping, Unicode metadata, poetry line/stanza structure, A5/A4/Letter in both orientations |
| Data protection | Full versioned JSON backups, validated replacement restore, rollback and interrupted-restore recovery |
| Offline use | Production static cache; local writing, reading, organization, backup and export after initial installation |
| Voice input | Browser speech recognition where supported; it may send audio to the browser vendor's online service |
| AI/semantic search/OCR | AI analysis defaults to a demo provider; production AI, semantic embeddings and automatic OCR are not included |

PDF/EPUB export makes no network calls. Fonts are bundled with their licenses. Preview font selection affects the HTML preview; exports use embedded Noto families. Print the downloaded PDF for the full book; the preview's print button prints its current page.

## Protect your archive

Settings → **पूरा बैकअप डाउनलोड करें** saves poems, drafts, manuscripts, collections, books and relationships. Keep that file outside the browser profile. Restore replaces the destination library after review and confirmation; it does not merge archives. Close other app tabs before restoring.

Browser storage can be cleared or evicted. Changing the hostname or port creates a separate library. There is no cloud synchronization. Read [recovery instructions](docs/RECOVERY.md) before moving data.

## Verification and release

```sh
npm run verify:exports  # synthetic PDF/EPUB files and restore fixture
npm run release         # production build and portable local-release ZIP
```

The local release candidate ZIP and SHA-256 file are written to `artifacts/releases/`. Extract the ZIP and run `node serve.mjs`; open `http://127.0.0.1:8080`. The archive includes per-file hashes, font notices, and recovery instructions. See [release instructions](docs/RELEASE.md) and [remaining acceptance items](docs/ROADMAP.md).

PDF text-copy fidelity remains an open compatibility issue: some extractors split or duplicate Hindi matras despite correct visual rendering. Use EPUB or the original library for exact text interchange.

The 36 existing suites are supplemented by independent PDF parsing and release regression checks in `test_release.js`. See [verification findings and limits](docs/VERIFICATION.md) for real-reader, EPUBCheck, UI, offline and safety evidence. Tests, generated files and logs are under `artifacts/verification/` locally.

The build still emits a size warning because it includes offline typography assets. The static distribution is about 8 MB uncompressed. No public hosting deployment or low-memory phone benchmark is claimed.

Historical Phase 1–7.2 notes are retained in [phase history](docs/phase-history.md); current capability statements above take precedence. Font sources and licenses are listed in [font notices](docs/FONTS.md).

## Code structure

`src/components` contains the UI; `src/services` contains domain services and repositories. Storage keys are centralized in `src/data/storageKeys.js`. Book generation resolves live poem references into an ephemeral document; generation does not change source records. Browser export runs in a cancellable worker. Backup covers the allowlisted persistent records and keeps a durable restore journal.

The app remains private project code. Third-party fonts and dependencies retain their respective licenses.
