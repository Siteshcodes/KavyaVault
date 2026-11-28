# KavyaVault 1.0.0 historical local release candidate

Packaged locally for verification on 22 November 2026. This package contains the production static app and a small local server. It does not publish the archive or connect it to a cloud account. **The website was subsequently deployed** with Firebase account features; see [current rollout status](FIREBASE-ROLLOUT.md). Instructions and "no public hosting" statements below describe only this historical portable package.

Known acceptance issue: PDF pages render Hindi correctly in the tested readers, but exact text extraction can split or duplicate matras. Use EPUB or the original library for exact text interchange. The full native clipboard comparison and final mobile toolbar visual recheck remain unverified; this candidate does not claim a completed Phase 7 sign-off. See `docs/ROADMAP.md` and `docs/VERIFICATION.md`.

1. Extract the ZIP to a folder you control.
2. Install Node.js 22 or newer if it is not available.
3. Run `node serve.mjs` in the extracted folder.
4. Open `http://127.0.0.1:8080` in a current desktop browser.
5. Let the initial app and font cache finish loading. Subsequent reloads and core book exports can work while the local server is stopped.

Keep the same host and port to retain the same browser library. `KAVYAVAULT_PORT` can change the port, but a new port has separate browser storage. Do not double-click `app/index.html`: the app needs HTTP on localhost or HTTPS, including for worker and offline-cache support.

For hosting, publish the contents of `app/` at the origin root over HTTPS. Serve JavaScript with a JavaScript MIME type and route extensionless application paths to `index.html`. Serve `sw.js` and `index.html` with revalidation; hashed assets may be cached permanently. No public hosting destination has been configured or deployed by this release.

New in this release:

- Embedded Hindi fonts, OpenType shaping, correct PDF metadata and byte offsets, reliable long-stanza pagination, and export workers with cancellation.
- EPUB font embedding, valid identifier linkage, and removal of blank inter-chapter pages.
- Full archive backup/restore with validation and rollback recovery.
- Bundled UI fonts and a versioned static offline cache.
- Accurate disclosure of browser speech privacy, mock AI analysis, unavailable semantic embeddings, and manual transcription.
- Larger book controls on mobile and clear distinction between printing the current preview page and printing the downloaded full PDF.

Read `docs/RECOVERY.md` before moving your library. Read `docs/VERIFICATION.md` for acceptance evidence and limits. Validate the archive against the separately supplied `.sha256` file; `manifest.json` records the hash and size of each included file.

The production build still reports a size warning. The app includes licensed font binaries for offline use, and the complete uncompressed static distribution is about 8 MB. Worker and main-thread exports share the large font-data chunk. Initial installation needs time and browser cache space; this has not been benchmarked on low-memory phones.
