# Release verification — 22 November 2026

This report concerns the local release branch `codex/complete-local-release`. Synthetic fixtures were used; the user's existing library was not imported or changed.

**Release assessment:** the local release candidate is packaged and its launcher works. This is not an unconditional Phase 7 completion sign-off: PDF text extraction has a confirmed compatibility defect, and the full native-reader clipboard comparison remains unverified. No `phase-7-complete` tag is created.

## Confirmed defects and repairs

| Finding | Repair and evidence |
|---|---|
| Original PDF displayed boxes and wrong glyphs for Hindi | Embedded licensed Noto fonts with Fontkit shaping; inspected the repaired cover and Hindi poem in SumatraPDF 3.6.1 and Poppler renders |
| Hindi PDF metadata decoded incorrectly; xref offsets were invalid | UTF-16BE metadata with BOM and byte-counted object/stream serialization; independent `pdf-lib` and `pypdf` parsing |
| Relative text coordinates accumulated, moving later lines outside the page | Absolute shaped glyph positioning; explicit width and lower-margin guards |
| A very long stanza could exceed its second page | Iterative pagination; independent 200-line fidelity test and large-type landscape check |
| EPUB OPF and NCX identifiers differed; CSS `direction` failed validation | Matching identifiers and EPUB-safe CSS; EPUBCheck 5.4.0 reports zero errors/warnings |
| EPUB created blank pages after chapters in a real reader | Removed redundant trailing page breaks; same fixture changed from 19 to 11 Sumatra pages, with the title page directly after the cover |
| Exports could block the editor and used a mismatched service instance | Worker-based UI generation, progress, cancellation, duplicate-click guard, injected book service |
| Speech privacy copy promised device-only audio | Explicitly states that browser recognition can send audio online |

## Automated and file checks

- `npm test` passes 1,169 checks across 37 test files: 1,150 existing checks plus 19 release regressions. These cover persistence, editor recovery, manuscripts, relationships, search, collections, books, exports, backup round trips, quota failure, mid-restore rollback, interrupted restoration, worker cancellation, and unsafe input rejection.
- `npm run verify:exports` produces six PDFs (A5, A4, Letter; portrait and landscape), an EPUB, the source fixture, layout JSON, and a synthetic library backup in `artifacts/verification/`.
- The fixture covers क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ, nuktas, chandrabindu, vowels and matras, ॐ, दुःख, danda/double danda, English, numbers, and monochrome emoji. A second poem has 20 four-line stanzas.
- Source records remain byte-for-byte unchanged and generation makes zero fetch calls.
- An independent PDF parser checks all six dimensions, page trees, readable Hindi metadata, embedded font streams, and Unicode maps. Logical line text is also encoded using PDF `ActualText`.
- Poppler renders all 79 pages across the six configurations without warnings. Contact sheets were inspected for cover/front matter, contents, section starts, poem continuations, margins and clipping. All 91 nonblank source poem lines are present exactly once in the appropriate logical text records in every PDF; EPUB preserves their complete order.
- Rendered and visually inspected all four cover palettes: bhojpatra, khaddar, makhmali-raat, and syahi. Hindi title/subtitle/author, contrast, borders and alignment are clear.
- EPUB ZIP CRC/XML/spine and stanza fidelity were checked; official EPUBCheck 5.4.0 passes. Reader chapter links open the intended poems.
- Adobe Acrobat Reader also displayed the downloaded PDF's section page and Hindi fixture correctly. A copied selection pasted the first Hindi heading correctly into Acrobat Find. The full clipboard round-trip comparison was interrupted when the desktop browser was taken over; it is not recorded as passed.
- `npm audit` reports zero known vulnerabilities at verification time. Build succeeds with the documented bundle-size warning.
- The separate `scripts/verify-pdf-text.py` diagnostic **fails** with PyMuPDF 1.26.7: 48 of 79 pages have different extracted characters after whitespace normalization, including duplicated text and misplaced matras. Changing paint order did not eliminate duplication, so that experiment was reverted. This is separate from the passing structural/rendering checks and is not counted as a passing test.

## Release package checks

- ZIP CRC, SHA-256 sidecar, and every file's size/hash in `manifest.json` pass.
- Repeated packaging of unchanged build files and documentation produces an identical ZIP hash.
- The archive includes the production app, local launcher, verification/recovery/font documentation, and runtime/font license notices.
- The extracted launcher serves the home page, deep book routes, every static asset and correct MIME/cache headers. HEAD works; missing files, unsupported methods and encoded traversal requests receive the expected rejection. The test launcher is stopped afterward.
- Reproduce package checks with `python scripts/verify-release.py` after `npm run release`. It uses Python's standard library and Node.js; it writes `artifacts/verification/release-validation.json`.

## Production UI checks

- Fresh test origin `127.0.0.1:4177`: downloaded the empty backup, selected and reviewed a synthetic backup, confirmed restoration, then verified two poems and their book appeared after reload.
- Downloaded the generated PDF and EPUB through the book editor; success status appeared and actual files were created.
- Created a second book through the UI, selected two existing poems, reordered them, opened print preview, and confirmed order survived reload.
- Checked book layouts at 390, 768, 1024, and 1440 CSS pixels. Measured no document-level horizontal overflow. Enlarged secondary book controls discovered at 36px to a minimum 48px and wrapped the mobile toolbar. These final CSS/label changes passed build/tests but were not re-inspected in the browser after desktop tooling became unavailable.
- With no local server listening on port 4177, reloaded the book, retained its content and order, and downloaded a PDF successfully. No console errors/warnings appeared during that check.
- Screenshots and validator/build logs are retained in `artifacts/verification/` (not committed). Native-reader observations were captured in the task's tool record.

## Supported limits

- AI analysis is a demonstration provider by default. A production AI backend, semantic embedding model, and automatic OCR are not shipped. Manual transcription and ordinary text search are supported.
- Microphone audio was not recorded during verification. Browser speech support and remote processing vary; there is no offline recognition guarantee.
- HTML preview fonts/ornaments and exported Noto typography differ. Browser Print prints the current preview page; open the PDF to print the complete book.
- PDF source verses stay on one line and may shrink to fit. Excessively long lines or unsupported glyphs fail explicitly. Long navigation labels can be shortened with a warning; complete poem titles remain on their content pages. Extreme metadata/page combinations may require a larger page.
- PDF extraction behavior varies: Sumatra finds Hindi text, but `pypdf` and PyMuPDF can split or duplicate visually positioned Hindi text despite the correct logical `ActualText`. Use EPUB or the original library for exact text interchange. Full native clipboard fidelity and PDF/UA accessibility certification are not claimed.
- EPUB pagination and user font overrides depend on the reader. Verification is not a claim of identical appearance across every e-reader.
- Browser storage/cache can be evicted and is not a backup. Restore requires space for a rollback journal and other app tabs must be closed.
- No public deployment, real printer output, or low-memory mobile-device benchmark is included in this local release.
