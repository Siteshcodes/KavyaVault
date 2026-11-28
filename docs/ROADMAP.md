# Roadmap and acceptance status

**Current status (November 2026):** Kavyakalash is public on Firebase Hosting. Guest access, Google Authentication, UID-scoped libraries, optional automatic Firestore sync, private profiles, and manual backup are implemented. The Firestore rules were deployed before Hosting. The owner reports testing live account features; future releases should repeat two-device and offline checks with disposable accounts. See [Firebase rollout](FIREBASE-ROLLOUT.md) and [automatic sync architecture](AUTO-SYNC.md).

The Phase 7 ledger below records the **22 November 2026 local release candidate** and its remaining acceptance items. Historical notes are in `phase-history.md`; they are not evidence that every production integration exists.

| Work | Status and evidence |
|---|---|
| Phases 1–6: library, manuscripts, input, analysis/search foundations, organization | Existing phase tags retained; all existing tests pass. AI is a demo provider, semantic embeddings are unavailable, and transcription is manual. These are disclosed in the app and README. |
| Phase 7.1–7.2: book model and curation UI | Implemented; tested creation, sections, selection, reordering, persistence and source preservation. |
| Phase 7.3: layout and print preview | Implemented; six size/orientation combinations, long stanza pagination, margins, current-page browser print and full-book PDF workflow checked. |
| Phase 7.4: PDF and EPUB export | Rendering, metadata, PDF serialization, font embedding, EPUB validation and blank-page fixes implemented. Actual exports opened in readers. Exact PDF text extraction remains an open defect. |
| Export responsiveness and local fonts | Cancellable worker, progress/status, local font binaries and licenses implemented; browser downloads and cancellation tests pass. |
| Full backup and recovery | Versioned backup, validated replacement restore, durable rollback journal and startup recovery implemented and tested; synthetic UI restore checked. |
| Offline production app | Static cache implemented; reload, book persistence and PDF export succeeded with the server stopped. |
| Release documentation and package | Static app, local launcher, manifest, SHA-256 file, licenses and recovery/verification documentation packaged; extracted launcher and all asset hashes checked. |

## Acceptance items still open

1. **Exact PDF text extraction:** PyMuPDF 1.26.7 changes extracted characters on 48 of 79 sample pages, despite visually correct rendering and correct logical source records. The reproducible diagnostic is `scripts/verify-pdf-text.py`; its nonzero result is recorded, not waived as a pass. EPUB is the verified exact-text interchange format.
2. **Full native-reader clipboard round trip:** only a selected Hindi heading was pasted successfully in Acrobat; the full comparison was interrupted by desktop takeover. Desktop UI tooling subsequently became unavailable.
3. **Final mobile toolbar visual recheck:** the 390/768/1024/1440 layouts were inspected, then small controls were enlarged and the mobile toolbar wrapped. Final CSS/label changes pass build/tests but need one more visual pass.

That Phase 7 package remains a local candidate. The `phase-7-complete` tag is intentionally absent while these acceptance items remain open. **The website was subsequently deployed**; printer hardware checks, a low-memory mobile benchmark and production AI/OCR/embedding providers were not included in the local package.
