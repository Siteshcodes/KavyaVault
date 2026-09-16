# KavyaVault (काव्यकलश)

> **A Hindi-first, local-first personal digital poetry library and literary sanctuary.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-802%2F802%20Passing%20(100%25)-brightgreen.svg)]()
[![Architecture](https://img.shields.io/badge/Architecture-Local--First%20Decoupled-blueviolet.svg)]()
[![License](https://img.shields.io/badge/License-Private-lightgrey.svg)]()

---

## 📖 Overview

**KavyaVault (काव्यकलश)** is an elegant, distraction-free digital poetry vault and sanctuary designed specifically for poets, writers, and Hindi literature enthusiasts. It provides a dignified environment to compose, curate, read, and organize poems, ghazals, couplets (*dohas*), and verses.

Built on a **local-first** foundation, KavyaVault ensures that your literary creations remain completely private, durable, and stored exclusively on your own device—with zero cloud lock-in, zero latency, and zero telemetry.

---

## 🏛️ Architecture & Design Tenets

KavyaVault enforces a strictly decoupled, layered domain architecture:

```text
┌──────────────────────────────────────────────────────────┐
│                   Presentation Layer (UI)                │
│  LibraryView | PoetryEditor | PoemReader | SearchView     │
│  CollectionsView | CollectionDetailView | FavoritesView   │
│  ManuscriptGallery | ManuscriptView | ManuscriptTranscription│
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│             Domain Repositories Layer                    │
│  PoemRepository | CollectionRepository | ManuscriptRepository│
│  - CRUD & Validation       │  - Thematic Groupings        │
│  - Draft Autosave/Recovery │  - Referential Integrity     │
│  - Manuscript Preservation │  - Image Immutability        │
│  - Query & Sorting Logic   │  - Cascade Deletion Cleanup  │
│  - Manual Transcription    │  - Verified Status Lifecycle │
│  - Provenance & Archival   │  - Canonical Source Enums    │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│             Storage Abstraction (IStorageAdapter)        │
│  - get(key)      - set(key, val)   - remove(key)         │
│  - clear()       - keys()          - has(key)            │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│             Concrete Storage Driver                      │
│            (LocalStorageAdapter)                         │
│  - JSON Serialization & Safe Deserialization             │
│  - StorageError Taxonomy (Quota, Corrupt, KeyNotFound)   │
│  - Non-destructive Reads & Downgrade Protection          │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│             Browser Storage Engine                       │
│  - 'kavyavault:poems'         - 'kavyavault:drafts'       │
│  - 'kavyavault:collections'   - 'kavyavault:metadata'     │
│  - 'kavyavault:manuscripts'                                │
└──────────────────────────────────────────────────────────┘
```

### Core Architectural Principles:
1. **Domain Isolation**: UI components never interact directly with `localStorage`. All state flows through domain repositories (`PoemRepository`, `CollectionRepository`, `ManuscriptRepository`) and the `IStorageAdapter` contract.
2. **Immutability Guarantee**: Every object returned from or written to repositories is deeply cloned using `structuredClone` (with JSON serialization fallback) to prevent accidental state mutation.
3. **Non-Destructive Reads**: Encountering malformed or corrupted storage data returns safe fallbacks in memory without overwriting raw user storage, preserving recoverable data.
4. **Schema Evolution & Downgrade Protection**: Managed by `MigrationManager`. If an existing installation detects data written by a newer schema version, it safely aborts migration rather than forcing an accidental downgrade.
5. **Strict XSS Sanitization**: Dynamic user input (titles, verse stanzas, author names, tags, search queries, transcriptions, provenance notes) is safely sanitized and escaped across cards, the reader sanctuary, and search highlight marks.

---

## ✨ Phase 1 Feature Suite

### 📚 1. Poetry Library (`/poems`)
- **Dual Presentation Modes**: Seamlessly switch between **Grid** (visual card layout) and **List** (compact poetic verse layout).
- **Live Sorting**: Sort by Newest (*नवीनतम*), Oldest (*प्राचीनतम*), Recently Updated (*अद्यतन*), or Alphabetical Title (*शीर्षक अनुसार*).
- **Poetic Preview Generation**: Automatically generates balanced snippets preserving verse boundaries.
- **Card-Level Quick Actions**: One-click favorite and archive toggles directly from the card.

### ✍️ 2. Poetry Editor & Autosave (`/new`, `/poems/:id/edit`)
- **Devanagari-First Writing Canvas**: Generous line heights, optical sizing, and distraction-free poetic focus.
- **Autosave Engine**: Non-blocking ~750ms debounced autosave guarantees drafts are preserved even across browser refreshes or crashes.
- **Draft Recovery Banner**: Alerts the writer to uncommitted drafts with one-click restore or discard options.
- **Real-Time Literary Metrics**: Live counts for words (*शब्द*), verse lines (*पंक्तियाँ*), and characters (*वर्ण*).
- **Smart Tagging**: Delimited by commas or spaces, with automatic deduplication, sanitization, and trimming.

### 📖 3. Poetry Reader Sanctuary (`/poems/:id`)
- **Contemplative Reading Canvas**: Immersive, typography-centered sanctuary devoid of visual clutter.
- **Stanza & Verse Delineation**: Converts double newlines (`\n\n`) into semantic stanzas and single newlines (`\n`) into verse lines.
- **Literary Ornaments**: Traditional Devanagari dingbats (❦) and poetic metadata (creation date, last updated date).
- **Accessible Delete Modal**: Confirmation dialog with keyboard shortcuts (`Escape` to dismiss) to prevent accidental loss.

### 🔍 4. Deterministic Hindi Search (`/search`)
- **Conservative Unicode NFC Normalization**: Preserves complex Devanagari vowel signs (*matras*), dot diacritics (*nuktas* like ज़, फ़, ख़), *chandrabindu* (ँ), *anusvara* (ं), and *visarga* (ः).
- **Multi-Word Relevance Ranking**:
  1. Exact title match
  2. Partial title match
  3. Tag match
  4. Author match
  5. Verse body match
- **Contextual Match Badges**: Displays where the match was found (*शीर्षक में मिला*, *टैग में मिला*, *कविता में मिला*).
- **Safe Match Highlighting**: Escapes all text before wrapping matching query terms in `<mark class="search-highlight">`.

### 🗃️ 5. Collections Foundation (`/collections`, `/collections/:id`)
- **User-Curated Anthologies**: Group poems by theme (*प्रकृति*, *प्रेम*, *विद्रोह*, *यात्राएँ*).
- **Reference-Only Storage**: Collections store only unique poem IDs, eliminating data duplication.
- **Cascade Cleanup**: Deleting a poem permanently automatically scrubs its reference from all collections.
- **Dedicated Detail View**: Manage collection membership, view member poems, and add/remove items cleanly.

### ⭐ 6. Favorites & Archive (`/favorites`, `/archive`)
- **Favorites Sanctuary (`/favorites`)**: Dedicated view for starred, beloved poems.
- **Poetry Archive (`/archive`)**: Isolated cold storage for completed or resting verses, completely excluded from active library search with one-click restore capabilities.

### 🎨 7. Four Tailored Literary Themes
1. **Bhojpatra (भोजपत्र)**: Warm, parchment-toned manuscript canvas (default light theme).
2. **Syahi (स्याही)**: Crisp obsidian night and deep ink with golden accents (dark theme).
3. **Khaddar (खद्दर)**: Rustic, earthy sepia inspired by traditional hand-spun cloth.
4. **Makhmali Raat (मखमली रात)**: Deep midnight velvet with sapphire accents (indigo dark theme).

---

## 🗂️ Project Directory Structure

```text
KavyaVault/
├── index.html                   # HTML5 entry point, fonts & metadata
├── package.json                 # Project dependencies, build & test scripts
├── vite.config.js               # Vite bundler configuration
├── README.md                    # Project documentation (this file)
│
├── src/
│   ├── main.js                  # Application bootstrap, router & theme init
│   │
│   ├── data/
│   │   ├── navigation.js        # Route paths, localized labels & navigation config
│   │   └── storageKeys.js       # Canonical storage key constants
│   │
│   ├── services/
│   │   ├── PoemRepository.js    # Poem domain repository, CRUD, drafts & lifecycle
│   │   ├── CollectionRepository.js # Collections domain repository & cascade cleanup
│   │   ├── ManuscriptRepository.js # Manuscript preservation, immutability, transcription
│   │   ├── SearchService.js     # Unicode normalization, scoring & highlights
│   │   ├── router.js            # Client-side SPA hash/history router
│   │   ├── theme.js             # 4-theme provider & system preference listener
│   │   ├── manuscripts/
│   │   │   └── ManuscriptImageTransformer.js # Pure canvas non-destructive rotation & crop
│   │   └── storage/
│   │       ├── IStorageAdapter.js    # Abstract storage interface
│   │       ├── LocalStorageAdapter.js# LocalStorage driver implementation
│   │       ├── StorageError.js       # Error taxonomy (Quota, Corrupt, KeyNotFound)
│   │       └── MigrationManager.js   # Schema versioning & migration pipeline
│   │
│   ├── components/
│   │   ├── layout/              # AppShell, PageHeader, EmptyState, etc.
│   │   ├── navigation/          # Sidebar, BottomNav, literary SVG icons
│   │   ├── home/                # Home foyer view, quick stats & actions
│   │   ├── library/             # Library view, grid & list poem cards
│   │   ├── editor/              # Poetry editor canvas, metrics, autosave
│   │   ├── reader/              # Poem reader sanctuary & delete modal
│   │   ├── search/              # Search view, input & result listing
│   │   ├── collections/         # Collections index & collection detail view
│   │   ├── favorites/           # Favorites view
│   │   ├── archive/             # Archive view
│   │   ├── manuscripts/         # Manuscript capture, gallery, reader & transcription workspace
│   │   │   ├── ManuscriptCapture.js      # Intake & lossless byte capture
│   │   │   ├── ManuscriptGallery.js      # Archival gallery & filtering
│   │   │   ├── ManuscriptView.js         # Detail view, transformation & linking
│   │   │   └── ManuscriptTranscription.js # Manual transcription workspace
│   │   └── settings/            # Theme switcher & preferences
│   │
│   ├── styles/
│   │   ├── tokens.css           # Design tokens, color palettes, typographic scale
│   │   └── main.css             # Global layout, resets, accessibility scaffolding
│   │
│   └── utils/
│       ├── date.js              # Devanagari poetic date formatter
│       ├── preview.js           # Multi-line snippet generator
│       └── counters.js          # Devanagari-aware word and character metrics
│
└── tests/ (Automated Node Test Suites)
    ├── test_persistence.js      # Storage adapter, error handling, schema (10 tests)
    ├── test_library.js          # Repository CRUD, filtering, sorting (10 tests)
    ├── test_editor.js           # Autosave, draft recovery, live metrics (10 tests)
    ├── test_reader.js           # Stanza parsing, lifecycle actions, 404 (10 tests)
    ├── test_search.js           # Hindi search, NFC normalization, ranking (20 tests)
    ├── test_favorites_archive.js# Favorites & archive isolation and restore (20 tests)
    ├── test_collections.js      # Collection relationships & cascade cleanup (25 tests)
    ├── test_hardening.js        # Release gate, XSS, quota, non-destructive reads (26 tests)
    ├── test_manuscripts.js      # Manuscript preservation, immutability, migration (34 tests)
    ├── test_manuscripts_capture.js # Capture intake, byte preservation, quota resilience (30 tests)
    ├── test_manuscript_transform.js # Non-destructive rotation, interactive crop, immutability (36 tests)
    ├── test_manuscript_gallery.js # Dedicated gallery route, thumbnails, filtering (26 tests)
    ├── test_manuscript_poem_linking.js # Manuscript ↔ poem linking, referential integrity (26 tests)
    ├── test_manuscript_transcription.js # Manual transcription workspace, status lifecycle (32 tests)
    ├── test_manuscript_versioning.js # Lightweight version history, restore audit trail (40 tests)
    └── test_manuscript_metadata.js # Archival metadata, provenance hardening, migration (37 tests)
```

---

## 🧪 Automated Testing & Reliability

KavyaVault features a 100% reproducible, standalone automated test suite executed directly in Node.js with **zero external test-runner overhead**.

### Run Complete Regression Suite:
```bash
npm test
```

### Test Suite Summary (620 / 620 Tests Passing — 100% Pass Rate):
| Test Suite | Test File | Test Count | Key Verification Areas |
|---|---|:---:|---|
| **Local Persistence** | `test_persistence.js` | **10** | Storage adapter, serialization, error classification |
| **Poetry Library** | `test_library.js` | **10** | Repository CRUD, sorting, snippets, card generation |
| **Poetry Editor** | `test_editor.js` | **10** | Debounced autosave, draft recovery, metrics, Hindi input |
| **Poem Reader** | `test_reader.js` | **10** | Stanza parsing, lifecycle actions, localized 404 state |
| **Hindi Search** | `test_search.js` | **20** | NFC normalization, multi-word scoring, match highlights |
| **Favorites & Archive** | `test_favorites_archive.js` | **20** | Dedicated views, archive isolation, restore flow |
| **Collections Foundation** | `test_collections.js` | **25** | Collection CRUD, duplicate prevention, cascade cleanup |
| **Final Hardening** | `test_hardening.js` | **26** | Quota limits, extreme payloads, Unicode rigor, XSS, downgrade protection |
| **Manuscript Preservation** | `test_manuscripts.js` | **34** | Manuscript creation, immutability, validation, migration, Unicode |
| **Manuscript Capture & Import** | `test_manuscripts_capture.js` | **30** | Intake validation, lossless bytes, quota handling, preview safety |
| **Non-Destructive Transformation** | `test_manuscript_transform.js` | **36** | Rotation (0/90/180/270), crop, coordinate mapping, versioning, tabs |
| **Manuscript Gallery & Reader** | `test_manuscript_gallery.js` | **26** | Dedicated gallery route, thumbnail resolution, filtering, XSS escaping |
| **Manuscript ↔ Poem Linking** | `test_manuscript_poem_linking.js` | **26** | Explicit linking, safe unlinking, validation, cascade cleanup |
| **Manuscript Transcription** | `test_manuscript_transcription.js` | **32** | Manual transcription canvas, status lifecycle, Unicode rigor |
| **Manuscript & Transcription Versioning** | `test_manuscript_versioning.js` | **40** | Version snapshots, restore flow, status preservation, 25-cap |
| **Archival Metadata & Provenance** | `test_manuscript_metadata.js` | **37** | Provenance normalization, canonical source enums, date separation |
| **Modern Input Foundation** | `test_modern_input.js` | **42** | Input selector canvas, draft model, routes, Devanagari fidelity |
| **Scan → Poem Creation** | `test_scan_to_poem.js` | **23** | Scan draft, transcription handoff, bidirectional link, zero OCR leak |
| **Speak → Poem Creation** | `test_speak_to_poem.js` | **67** | Browser speech recognition adapter, Hindi/English, interim merge |
| **Unified Modern Input UX** | `test_modern_input_ux.js` | **17** | Unified `/input` hub, return navigation, lifecycle cleanup, privacy copy |
| **AI Analysis Foundation** | `test_ai_analysis_foundation.js` | **18** | Domain contracts, mock provider, schema validator, zero network |
| **AI Analysis UI** | `test_ai_analysis_ui.js` | **15** | Consent modal, pending spinner, AI suggestions card, error retry |
| **AI Suggestion Review** | `test_ai_analysis_review.js` | **15** | Accept/edit/reject decisions, chip controls, explicit apply, tags merge |
| **AI Provider Hardening** | `test_ai_provider_hardening.js` | **31** | Provider config, external adapter, timeouts, bounded retries, deduplication, injection resistance, secrets & logging audit |
| **TOTAL** | | **620 / 620** | **0 Failures (100% Success)** |

---

## 🚀 Getting Started

### Prerequisites:
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 1. Clone or Open Workspace:
```bash
cd KavyaVault
```

### 2. Install Dependencies:
```bash
npm install
```

### 3. Start Local Development Server:
```bash
npm run dev
```
Open your browser at `http://localhost:5173/`.

### 4. Run Automated Test Suite:
```bash
npm test
```

### 5. Build for Production:
```bash
npm run build
```
Generates an optimized, production-ready static bundle in `dist/` in under 800ms.

### 6. Preview Production Build:
```bash
npm run preview
```

---

## 🗺️ Phase 2: Preserve Old Poems

Phase 2 focuses on **manuscript preservation** — the ability to capture, store, and transcribe handwritten poetry from diaries, notebooks, and family collections.

### Completed:
- ✅ **Task 2.1 — Manuscript Preservation Foundation**: Data model and repository layer for handwritten manuscript records. Enforces immutability of the original manuscript image artifact while allowing independent transcription and metadata updates. Schema upgraded from v1 to v2 with non-destructive migration. 34 dedicated tests passing.
- ✅ **Task 2.2 — Manuscript Capture & Import**: Archival-grade intake workflow (`Photo / File → Original Manuscript Artifact → ManuscriptRepository`). Features dual input mechanisms (file upload + mobile device camera capture via `capture="environment"`), drag-and-drop intake, lossless raw byte preservation with zero compression, cropping, or pixel manipulation, temporary object URL preview with safe lifecycle cleanup, LocalStorage quota-aware error handling preserving user input for retry, and an archival detail view (`/manuscripts/:id`) presenting the original manuscript prominently with complete provenance metadata and `untranscribed` status. 30 dedicated tests passing (195/195 total tests passing: 131 Phase 1 baseline + 34 Task 2.1 + 30 Task 2.2).
- ✅ **Task 2.3 — Non-Destructive Manuscript Image Transformation**: Pure client-side Canvas-based rotation (0°, 90°, 180°, 270°) and interactive user-selectable rectangular cropping (mouse and touch drag with coordinate mapping from display to natural image pixels) without modifying, overwriting, compressing, or replacing the archival `originalManuscript` artifact.
  - **ORIGINAL:** Original captured/imported bytes (JPEG, PNG, WebP) remain completely untouched, immutable, and preserved byte-for-byte.
  - **DERIVED:** Transformed output is saved as a discrete `derivedManuscript` artifact with a brand-new `kv_art_<uuid>` ID and `sourceArtifactId` referencing the original artifact, containing a newly rendered lossless PNG.
  - **UI/UX:** Dual view tabs (`मूल पांडुलिपि (अपरिवर्तित)` vs `संपादित प्रति`), live transformation preview, clear reassurance messaging (*"मूल पांडुलिपि सुरक्षित है"*), transformation version tracking (`transformVersion`), clean reset (`clearDerivedManuscript`), storage quota resilience, and full Devanagari Unicode preservation. 36 dedicated tests passing (231/231 total tests passing: 131 Phase 1 baseline + 34 Task 2.1 + 30 Task 2.2 + 36 Task 2.3).
- ✅ **Task 2.4 — Manuscript Gallery & Reader**: Dedicated gallery route (`/manuscripts`) and archival reading experience for preserved handwritten poetry.
  - **Archival Gallery:** Responsive grid of museum-grade manuscript cards displaying thumbnail previews (`derivedManuscript.data` if present, else falling back to `originalManuscript.data`), poetic capture date, status badge, derived-version indicator, provenance summary, and notes.
  - **Deterministic Filtering:** Real-time search by title, notes, and filename, alongside dropdown filters for transcription status (`अप्रतिलिपिबद्ध`, `प्रारूप`, `प्रमाणित`) and provenance source (`हस्तलिखित पांडुलिपि`, `स्कैन`, `कैमरा`), plus one-click filter reset.
  - **Archival Reader:** Dedicated reader view featuring direct back navigation to the gallery (`/manuscripts`), sequential previous/next manuscript browsing, permanent original vs. derived view tabs with disabled state and reassurance messaging when only the original is available, and dimension badge when safely available.
  - **Integrity & Security:** Strict byte-for-byte immutability of the original artifact, complete XSS sanitization of all user-controlled text, and graceful handling of corrupted or missing records. 26 dedicated tests passing (257/257 total tests passing: 131 Phase 1 baseline + 34 Task 2.1 + 30 Task 2.2 + 36 Task 2.3 + 26 Task 2.4).
- ✅ **Task 2.5 — Manuscript ↔ Poem Linking**: Clean relationship management linking preserved handwritten manuscripts to digital poem records (`manuscript.poemId = poem.id`) without merging data models or duplicating content/bytes.
  - **Data Model & Repository:** Pure ID-based association. Extended `ManuscriptRepository` with `linkToPoem`, `unlinkFromPoem`, `getLinkedPoem`, `getManuscriptsForPoem`, and `unlinkAllFromPoem`. Validates poem existence via `PoemRepository` before linking.
  - **Referential Integrity & Safe Deletion:** Deleting a poem safely clears `poemId` on linked manuscripts without deleting manuscript records or touching image bytes. Deleting a manuscript leaves the poem intact. Archiving poems preserves the relationship.
  - **One-to-Many Architecture:** A manuscript links to at most one poem; a poem can have multiple linked manuscripts.
  - **Manuscript Reader (`ManuscriptView`):** Dedicated "इस पांडुलिपि से संबंधित कविता" section with unlinked state ("कविता से जोड़ें" CTA) and linked state (poem title, date, "कविता पढ़ें" navigation, and "संबंध हटाएँ" action). Accessible poem selection modal with live search.
  - **Poem Reader (`PoemReader`):** Subtle "मूल पांडुलिपि" section at the base of the poem reading sanctuary displaying thumbnail, title, and "पांडुलिपि देखें" link to view historical evidence without cluttering the contemplative reading flow.
  - **Strict Immutability & Security:** Raw image bytes (`originalManuscript.data` and `derivedManuscript.data`) remain 100% byte-for-byte immutable during linking/unlinking. All titles and metadata are fully escaped against XSS. 26 dedicated tests passing (283/283 total tests passing: 131 Phase 1 baseline + 34 Task 2.1 + 30 Task 2.2 + 36 Task 2.3 + 26 Task 2.4 + 26 Task 2.5).
- ✅ **Task 2.6 — Manuscript Transcription Workspace**: Dedicated manual transcription workspace (`/manuscripts/:id/transcribe`) allowing writers to transcribe handwritten poetry into clean Devanagari digital text.
  - **Archival Immutability:** Original manuscript image bytes and derived working versions remain 100% byte-for-byte immutable.
  - **Independent Transcription Model:** Transcription is a separate textual entity stored in `manuscript.transcription = { text, status, verifiedAt }`.
  - **Status Lifecycle:** `untranscribed` (initial) → `draft` (active editing) → `verified` (confirmed with ISO timestamp). Editing a verified transcription automatically drops the status back to `draft` and clears `verifiedAt` to null, requiring deliberate re-verification.
  - **Two-Column Archival Layout:** Side-by-side composition on desktop (left: original/derived image showcase; right: Devanagari writing canvas) and stacked column on mobile (390px) with minimum 48px touch targets and zero horizontal scroll.
  - **Autosave Engine:** Non-blocking ~750ms debounced autosave with live status indicator (*"सहेजा जा रहा है…"*, *"सहेजा गया"*, *"सहेजने में त्रुटि"*), preserving textarea contents during storage quota limits.
  - **Literary Metrics & Hindi Rigor:** Full Unicode preservation (Devanagari conjuncts, matras, nuktas, chandrabindu, danda, double danda, mixed Hindi/English, emojis) with Unicode-safe word, character, and line counters.
  - **Poem Independence Guarantee:** Even if a manuscript is linked to a poem, transcription is completely independent and does NOT overwrite or synchronize with `poem.body`.
  - **Strict Scope Boundaries:** Explicitly operates WITHOUT OCR, AI transcription, or automatic manuscript-to-poem text synchronization. 32 dedicated tests passing (315/315 total tests passing: 131 Phase 1 baseline + 34 Task 2.1 + 30 Task 2.2 + 36 Task 2.3 + 26 Task 2.4 + 26 Task 2.5 + 32 Task 2.6).
- ✅ **Task 2.7 — Manuscript & Transcription Version History**: Lightweight, archival-grade version history foundation for handwritten manuscript transcriptions.
  - **Three-Layer Archival Model:** Strict boundary between (1) Original Manuscript (immutable evidence), (2) Current Transcription (active editable state), and (3) Transcription History (ordered, immutable historical snapshots).
  - **Monotonic Snapshots & Immutability:** Every meaningful save creates an immutable historical snapshot (`id`, `versionNumber`, `text`, `status`, `verifiedAt`, `createdAt`, `source`, `changeNote`). Older snapshots are never mutated in place.
  - **Duplicate Save Protection:** Repeated saves or autosaves with identical text, status, and verification timestamp do NOT generate redundant snapshots.
  - **Non-Destructive Restore Semantics:** Restoring a prior version ($v_k$) does NOT delete that version. It sets the text of $v_k$ as active and generates a new linear audit snapshot ($v_{n+1}$, `source: 'restore'`).
  - **Deterministic History Cap:** Enforces `MAX_TRANSCRIPTION_HISTORY = 25` to prevent unbounded LocalStorage growth while deterministically preserving the newest 25 snapshots and never touching current text or original images.
  - **UI History Panel & Modal Workflows:** Collapsible "प्रतिलिपि इतिहास" panel, read-only version preview dialogs, and explicit restore confirmation dialogs explaining audit guarantees.
  - **Poem Independence:** Creating or restoring versions never alters `poem.title`, `poem.body`, or `manuscript.poemId`.
  - **Strict Boundaries:** Explicitly operates WITHOUT OCR, AI transcription, AI-generated summaries, or cloud sync. 40 dedicated tests passing (355/355 total tests passing: 131 Phase 1 baseline + 34 Task 2.1 + 30 Task 2.2 + 36 Task 2.3 + 26 Task 2.4 + 26 Task 2.5 + 32 Task 2.6 + 40 Task 2.7).
- ✅ **Task 2.8 — Archive Metadata & Provenance Hardening**: Hardened archival metadata and provenance tracking for handwritten manuscripts.
  - **Five-Layer Archival Separation:** Strict domain boundary between (1) Original Artifact (immutable historical evidence bytes), (2) Derived Artifact (non-destructive transformations), (3) Transcription (digital text & verified status lifecycle), (4) History (monotonic snapshots), and (5) Provenance (archival context & origin).
  - **Controlled Provenance Schema:** Standardized canonical kebab-case source enums (`handwritten-manuscript`, `scanned-document`, `camera-capture`, `imported-image`, `other`) and acquisition methods (`notebook-scan`, `mobile-camera`, `desktop-upload`, `imported-file`, `other`) with full backward-compatible support for legacy aliases.
  - **Non-Destructive Migration:** Legacy manuscripts missing provenance fields safely normalize without overwriting raw user records or fabricating artificial dates, locations, or identities.
  - **Semantic Date Separation:** Strict demarcation between `originalManuscript.capturedAt` (photo intake), `provenance.recordedAt` (historical event date), `createdAt` (record inception), `updatedAt` (record modification), `archival.lastVerifiedAt` (verified transcription timestamp), and `archival.lastTranscribedAt` (transcription edit timestamp).
  - **Archival Integrity & Reassurance UI:** Dedicated "अभिलेखीय विवरण" section in `ManuscriptView` featuring museum-grade metadata display, clear reassuring guidance (*"मूल पांडुलिपि सुरक्षित है — अभिलेखीय विवरण बदलने से मूल छवि प्रभावित नहीं होती।"*), linked poem navigation, verified transcription status, and an accessible metadata edit modal dialog (`role="dialog"`, `aria-modal="true"`, Escape dismissal, >=48px touch targets).
  - **Preservation Guarantees:** Metadata edits and provenance updates NEVER touch, compress, or alter raw image artifact bytes (`originalManuscript.data` or `derivedManuscript.data`).
  - **Strict Boundaries:** Zero OCR, zero AI, zero EXIF/GPS scraping, zero cloud sync, and 100% strict XSS escaping. 37 dedicated tests passing (392/392 total tests passing: 131 Phase 1 baseline + 34 Task 2.1 + 30 Task 2.2 + 36 Task 2.3 + 26 Task 2.4 + 26 Task 2.5 + 32 Task 2.6 + 40 Task 2.7 + 37 Task 2.8).

---

## 🚀 Phase 3: Modern Input & Creation Workflows

Phase 3 expands KavyaVault from a typing-only workflow into a multi-modal creation sanctuary:
- **Type → Poem**
- **Scan → Poem**
- **Speak → Poem**

### Completed:
- ✅ **Task 3.1 — Modern Input Foundation**: Clean, unified architecture for multiple poem-input sources that all feed into the existing poem editor and draft workflow without duplicating persistence logic or bypassing user review.
  - **Single Handoff Architecture:** Enforces `Input Source (Type | Scan | Speak) → Input Intent → Poem Draft → Existing Poem Editor → Save Poem`. Centralized poem persistence remains firmly in `PoemRepository`, `PoetryEditor`, and `LocalStorageAdapter`.
  - **Controlled Domain Model:** Minimal, extensible representation for poem-input intents (`source`, `title`, `text/body`, `author`, `tags`, `manuscriptId`, `metadata`). Enforces frozen `INPUT_SOURCES` enums and intent validation.
  - **Type Input Preservation:** Preserves existing direct typing and new poem flows with `source = 'type'`, supporting seamless draft recovery and live Hindi counters.
  - **Scan Input Foundation Contract:** Establishes the exact contract for future Phase 3.2 Scan → Poem flows using the existing Phase 2 manuscript preservation system. Accepts `manuscriptId`, optional transcription text, and provenance metadata while strictly guaranteeing raw manuscript image bytes are NEVER duplicated into poem storage.
  - **Speak (Voice) Input Foundation Contract:** Establishes the contract for future Phase 3.3 Voice → Poem flows. Accepts recognized speech text and language metadata, feeding directly into standard editable drafts.
  - **Input Mode Selector UI (`/input`):** Modern, accessible, responsive card interface featuring the 3 input choices, honest placeholder status for coming-next features (*"स्कैन इनपुट शीघ्र आ रहा है (Phase 3.2)"*, *"वाणी इनपुट शीघ्र आ रहा है (Phase 3.3)"*), contract demonstration and handoff testing buttons, and prominent local-first privacy reassurance (*"100% Local Privacy: No cloud, no external AI, no telemetry"*).
  - **PoetryEditor Integration:** Dynamic source indicator badge (📜 for Scan, 🎙️ for Speak), quick access link to `/input`, draft autosave source preservation, and automated manuscript linking upon final poem save.
  - **Strict Architectural Boundaries:** Zero AI, zero OCR, zero TTS, zero cloud sync, zero vector databases, and zero external APIs.
  - **Comprehensive Verification:** 42 dedicated automated tests covering intent validation, draft creation, editor handoff, immutability, no-premature-persistence guarantees, Unicode Devanagari preservation, and UI accessibility (434/434 total tests passing: 131 Phase 1 baseline + 261 Phase 2 baseline + 42 Task 3.1).

- ✅ **Task 3.2 — Scan → Poem**: Fully implemented the real Scan → Poem creation pipeline utilizing the existing Phase 2 manuscript system without creating duplicate repositories, duplicated image bytes, or external cloud/AI dependencies.
  - **Pipeline Flow:** `Scan / Select Manuscript → ManuscriptCapture (/input/scan) → Preserved ManuscriptRecord (Immutable Original + Derived) → Transcription Workspace (/manuscripts/:id/transcribe) → "कविता के रूप में उपयोग करें" Action → PoemInputService.createScanDraft → PoetryEditor (/poems/new) → User Reviews/Edits → Save Poem → Bidirectional Manuscript ↔ Poem Link`.
  - **Scan Entry Point:** Replaced `/input/scan` placeholder with real `ManuscriptCapture` in `scanToPoemMode: true`. Supports device camera capture (`capture="environment"`) and local file upload (JPEG, PNG, WebP) with literary KavyaVault styling, back navigation to `/input`, and direct one-click handoff to transcription.
  - **Original Byte Immutability:** Original manuscript image data remains 100% byte-for-byte immutable and preserved. Derived crops/rotations remain strictly separated in the Phase 2 derived-artifact mechanism.
  - **Transcription Review & Validation:** Supports manual Devanagari entry and review across `untranscribed`, `draft`, and `verified` statuses without auto-verifying unverified text. Empty or whitespace-only transcriptions are cleanly blocked with honest Hindi guidance (*"कविता के रूप में उपयोग करने हेतु सार्थक प्रतिलिपि पाठ आवश्यक है"*).
  - **"कविता के रूप में उपयोग करें" Action:** Directly available in both `ManuscriptTranscription` workspace and `ManuscriptView` detail reader. Obtains manuscript ID, text, and title, generating a non-persistent scan draft via `PoemInputService.createScanDraft()` and navigating to `PoetryEditor`.
  - **Editor Review & Bidirectional Linking:** `PoetryEditor` hydrates with `source: 'scan'`, displays the manuscript source indicator badge (`📜 स्कैन`), shows the manuscript reference banner, and allows unrestricted editing before explicit persistence. Upon saving, the poem stores `source: 'scan'` and `manuscriptId`, and `manuscriptRepository.linkToPoem` connects both records bidirectionally without duplicating raw image bytes into the poem object.
  - **Duplicate-Save Protection:** Draft creation is completely non-persistent; repeated clicks on "Use as Poem", page reloads, or editor cancellations never produce ghost poem records.
  - **Privacy Guarantee:** 100% local, zero OCR APIs, zero cloud transmission, zero analytics.
  - **Unicode & Devanagari Fidelity:** Complex conjuncts (`क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ`), nuktas, chandrabindu, virama, and punctuation survive the complete pipeline roundtrip.
  - **Comprehensive Verification:** 23 dedicated automated tests added in `test_scan_to_poem.js` (457/457 total tests passing: 131 Phase 1 baseline + 261 Phase 2 baseline + 42 Task 3.1 + 23 Task 3.2).

- ✅ **Task 3.3 — Speak → Poem**: Local-first voice input and speech-to-text drafting using native browser capabilities.
  - **Pipeline Flow:** `Speak → Browser SpeechRecognition / webkitSpeechRecognition → Live Transcription → Review/Edit Transcript → "कविता के रूप में उपयोग करें" Action → PoemInputService.createSpeakDraft → PoetryEditor (/poems/new) → User Reviews/Edits → Explicit Save`.
  - **Browser-Native Isolation (`SpeechRecognitionAdapter`):** Small isolated capability/adapter layer safely detecting standard `window.SpeechRecognition` and vendor-prefixed `window.webkitSpeechRecognition`. Handles complete lifecycle states: `idle`, `starting`, `listening`, `stopping`, `completed`, `error`, `unsupported`.
  - **Bounded Language Support:** Default Hindi (`hi-IN`) and English (`en-IN`) with runtime switching passed directly to the speech engine.
  - **Interim & Final Transcript Merging:** Accurately separates transient interim speech results from final committed chunks, joining poetic phrases by newline and deduplicating identical repeated result events.
  - **Speak Workspace (`/input/speak`):** Accessible, thumb-friendly voice workspace featuring a >=56px microphone button with pulsing listening animation, status indicators, Devanagari character/word/line counters, and manual textarea editing.
  - **Local Privacy Guarantee:** Zero external AI, zero cloud speech services (OpenAI, Google, Azure, AWS), zero telemetry. Audio and transcriptions remain exclusively on the user's browser device.
  - **Validation & Non-Persistent Draft Handoff:** Empty or whitespace transcriptions are blocked with clear Hindi guidance. "कविता के रूप में उपयोग करें" constructs a non-persistent draft (`source: 'speak'`, `metadata: { language }`) and navigates to `PoetryEditor` without premature persistence.
  - **Full Unicode Devanagari Integrity:** Complex conjuncts (`क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ`), nuktas, matras, chandrabindu, virama, and punctuation survive faithfully.
  - **Comprehensive Verification:** 67 dedicated automated tests added in `test_speak_to_poem.js` (524/524 total tests passing: 131 Phase 1 baseline + 261 Phase 2 baseline + 42 Task 3.1 + 23 Task 3.2 + 67 Task 3.3).

- ✅ **Task 3.4 — Unified Modern Input UX**: Seamless integration and hardening uniting the three modern input modes (`Type`, `Scan`, `Speak`) under a single coherent KavyaVault experience.
  - **Canonical `/input` Entry Point:** All modern input flows originate from `/input`, offering clear Hindi-first options: *लिखें (Type)*, *स्कैन करें (Scan)*, and *बोलें (Speak)* with consistent typography, badges, and card geometry.
  - **Bidirectional Navigation:** Every workflow provides immediate and clear return paths to `/input` (*"← अन्य तरीका चुनें"* from Speak, *"काव्य सृजन माध्यम"* from Scan, and *"माध्यम"* from PoetryEditor).
  - **Lifecycle Cleanup & Safety:** Exiting or returning from Speak halts active speech recognition and destroys the adapter immediately; exiting Scan revokes temporary object URLs and detaches file/camera/drag-drop listeners.
  - **Technically Honest Privacy Copy:** Standardized, provable wording across views (*"काव्यकलश इस सुविधा के लिए किसी बाहरी AI या क्लाउड API को सीधे कॉल नहीं करता। आपकी रचनाएँ, पांडुलिपियाँ एवं ध्वनि इनपुट केवल आपके अपने उपकरण में सुरक्षित रहते हैं।"*).
  - **Mobile & Desktop Responsive Design:** Thumb-friendly touch targets ($\ge 48\text{px}$) for all action buttons; single-column stacked layout on 390px mobile, 2-column on 768px tablet, and elegant, spacious 3-column literary grid on 1024px and 1440px desktop displays.
  - **Draft Continuity & Zero Premature Persistence:** Navigating between modes, toggling details, or exiting never writes premature poem records to `PoemRepository`. Final poems are created strictly through the user's explicit "सहेजें" action inside `PoetryEditor`.
  - **Comprehensive Verification:** 17 dedicated automated tests added in `test_modern_input_ux.js` (541/541 total tests passing: 131 Phase 1 baseline + 261 Phase 2 baseline + 42 Task 3.1 + 23 Task 3.2 + 67 Task 3.3 + 17 Task 3.4).

---

## 🤖 Phase 4: AI Poetry Assistant

Phase 4 introduces an AI assistant strictly focused on **organization, classification, and analysis**. The AI assists poets by suggesting categories, moods, themes, keywords, and summaries without rewriting poems, generating replacement verses, altering the author's original words, or establishing historical provenance.

### Completed:
- ✅ **Task 4.1 — AI Analysis Foundation**: Robust, provider-agnostic architecture establishing domain contracts, provider interfaces, consent boundaries, and deterministic mock adapters.
  - **Single Analytical Flow:** `Saved Poem → Analysis Request (with analysisConsent: true) → PoemAnalysisService → Provider Adapter (IAIAnalysisProvider) → Validated Analysis Result → Human Review → Approved Metadata → PoemRepository`.
  - **Controlled Domain Model:** Analysis results encapsulate `poemId`, `requestedAt`, `provider`, `model`, `status` (`idle`, `pending`, `completed`, `failed`), and suggestions: `category`, `mood`, `themes`, `keywords`, `summary`.
  - **Provider Abstraction (`IAIAnalysisProvider`):** Completely decoupled provider interface allowing future pluggable providers without coupling UI components to specific vendor SDKs.
  - **Local Deterministic Mock (`MockAIAnalysisProvider`):** In-memory mock analyzer generating deterministic suggestions from Hindi literary keywords (`प्रकृति एवं सौन्दर्य`, `राष्ट्रभक्ति एवं चेतना`, `प्रेम एवं विरह`, `जीवन संघर्ष`, `आध्यात्म एवं दर्शन`) with ZERO external network calls, zero API keys, and zero external dependencies.
  - **Strict Output Schema Validation:** Validates types, enforces maximum character lengths (summary <= 500, category <= 100, mood <= 50), bounds array counts (themes <= 10, keywords <= 15), and automatically deduplicates keywords and themes.
  - **Human Review Boundary & Immutability:** Running AI analysis does NOT modify poem title, content, author, date, provenance, or storage. Analysis suggestions remain isolated in memory until explicitly approved by the user in future tasks.
  - **Explicit Consent Contract:** Requests require explicit user consent (`analysisConsent: true`). Without explicit consent, the service safely rejects execution, laying a secure privacy foundation before real external providers are introduced.
  - **Comprehensive Verification:** 18 dedicated automated tests in `test_ai_analysis_foundation.js` covering domain models, mock providers, error handling, original-poem immutability, zero storage writes, Unicode Devanagari fidelity, security injection resilience, and static zero-network audits (559/559 total tests passing across 21 test suites).

- ✅ **Task 4.2 — AI Analysis UI**: User-facing AI analysis experience directly inside the poem reader (`PoemReader`).
  - **Single User-Facing Workflow:** `Saved Poem → "AI से विश्लेषण करें" → Explicit Consent Dialog ("क्या आप इस कविता का AI विश्लेषण करना चाहते हैं?") → PoemAnalysisService → MockAIAnalysisProvider → Validated Analysis Result → Literary "AI सुझाव" Panel → Human Review (Task 4.3)`.
  - **Dedicated Entry Point:** Hindi-first action button in the reader top toolbar (`.btn-reader-ai`) labeled *"AI से विश्लेषण करें"*, with clear sparkles icon and busy state handling (`disabled` during analysis).
  - **Accessible Explicit Consent Modal:** A modal dialog requiring informed consent before invoking the service (*"काव्यकलश इस रचना के पाठ के आधार पर उपयुक्त श्रेणी, रस/भाव, विषय, मुख्य शब्द एवं साहित्यिक सारांश का सुझाव देगा। ... परिणाम केवल AI सुझाव हैं — आपकी मूल कविता अथवा मेटाडेटा में कोई स्वतः बदलाव नहीं होगा।"*). Supports Escape key dismissal and cancelation.
  - **Full Lifecycle Management:** Clear representation of `idle`, `consent-required`, `pending` (with accessible spinner and literary status announcement), `completed`, and `failed`. Protects against duplicate concurrent clicks.
  - **Suggestions Visual Language & Distinction:** Suggestions render in a dedicated card below poem verses with an unmistakable `✨ AI सुझाव` badge, clear disclaimer (*"ये सुझाव केवल अवलोकन हेतु हैं। इन्हें कविता में सहेजा नहीं गया है।"*), and field tags on Category (श्रेणी), Mood (मूड / रस), Themes (विषय), Keywords (मुख्य शब्द), and Summary (सारांश).
  - **Poem Immutability & Zero Premature Persistence:** The original poem title, body, author, tags, date, archive state, favorites, and manuscripts remain 100% byte-for-byte immutable in `PoemRepository`. No metadata is written to storage.
  - **Error Resilience & Honest Empty States:** Handled provider failure, malformed output, or empty suggestion results gracefully with clean Hindi messages and retry/re-analyze options without revealing stack traces.
  - **Security & XSS Prevention:** All AI suggestions and user texts are safely escaped, neutralizing script tags and HTML injection vectors.
  - **Full Unicode & Devanagari Integrity:** Devanagari conjuncts (`क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ, ॐ`), matras, nuktas, punctuation (`।, ॥`), and emojis render faithfully.
  - **Comprehensive Verification:** 15 dedicated automated tests in `test_ai_analysis_ui.js` (574/574 total tests passing across 22 test suites).

- ✅ **Task 4.3 — Human Review: Accept / Edit / Reject AI Suggestions**: Full human-review workflow for AI-generated poem metadata in `PoemReader`.
  - **Critical Principle:** AI suggestions are NOT author truth. The user remains the sole final authority.
  - **Independent Review Controls:** Every AI suggestion can be independently reviewed via dedicated controls:
    - **Accept (`स्वीकार करें`):** Approves candidate value without mutating the poem.
    - **Edit (`संपादित करें`):** Allows inline editing of the proposal, storing the human-authored text while preserving the original AI suggestion.
    - **Reject (`अस्वीकार करें`):** Marks candidate rejected with visible strikethrough/badge, guaranteeing it will never be applied to the poem.
    - **Reset (`रीसेट करें`):** Restores candidate to the initial suggested state.
  - **Multi-Value Candidates:** Themes and keywords are reviewed as discrete, independent chips (`✓`, `✎`, `✗`, `↺`).
  - **Existing Metadata Preservation:** Existing poem metadata (category, mood, tags) is shown side-by-side with suggestions. Approved themes/keywords merge safely with existing tags without silent replacement or loss of existing tags.
  - **Explicit Apply Boundary:** Zero storage writes occur during review. Only an explicit user action on **"स्वीकृत सुझाव सहेजें"** commits approved changes to `PoemRepository`.
  - **Author Content Immutability:** Poem body, title, author, dates, and manuscripts are strictly immutable.
  - **Discard / Cancel:** Clicking **"समीक्षा रद्द करें"** exits review state immediately, leaving the poem in storage 100% unaltered.
  - **Comprehensive Verification:** 15 dedicated automated tests in `test_ai_analysis_review.js` (589/589 total tests passing across 23 test suites).

- ✅ **Task 4.4 — AI Provider Integration + Privacy / Failure Hardening**: Production-ready architectural boundary for safe external AI provider integration while preserving the local deterministic mock provider.
  - **Provider Configuration Abstraction (`aiConfig.js`):** Minimal, validated configuration schema (`id`, `name`, `model`, `endpoint`, `timeoutMs`, `enabled`). Bounded timeout bounds (1,000ms to 60,000ms; default 10,000ms).
  - **Zero Client-Side Secret Storage:** Strictly forbids storing API keys, passwords, or tokens in source code, client config, or client-side bundles. Any real production external provider requiring private credentials must operate through a secure server-side boundary or proxy.
  - **External Provider Adapter (`ExternalAIAnalysisProvider.js`):** Implements `IAIAnalysisProvider` with strict request minimization, AbortController timeouts, and normalized error mapping.
  - **Request Minimization:** Only sends strictly necessary poem metadata (`poemId`, `title`, `body`, `author`, `tags`). NEVER transmits manuscript image bytes, library contents, favorites, reading history, or local storage.
  - **Mandatory Explicit Consent:** Zero provider requests without `analysisConsent: true`.
  - **Truthful Privacy Disclosures:** UI discloses active provider name, model, and whether analysis executes locally or transmits text to a configured gateway, without making unverified third-party privacy claims.
  - **Normalized Error Taxonomy:** Maps HTTP 401/403 (unauthorized/forbidden), 429 (rate limit), 500 (server error), network failures, malformed JSON, and timeouts into controlled, dignified Hindi error messages without leaking stack traces or credentials.
  - **Bounded Retries:** Strictly at most 1 automatic retry for transient 5xx or network errors. NEVER retries 401, 403, 400, or consent failures.
  - **In-Flight Request Deduplication:** Coalesces concurrent analysis requests for the same poem in `PoemAnalysisService` to prevent duplicate network calls.
  - **Prompt-Injection Resistance:** Strict role separation. System prompt enforces organizational metadata tasks only (category, mood, themes, keywords, summary) and explicitly forbids poem rewriting, continuations, or altering wording. Poem content is treated strictly as untrusted data.
  - **Complete Immutability & Storage Isolation:** Original poems in memory and storage remain 100% byte-for-byte immutable. Adapter has zero access to `localStorage`, `sessionStorage`, `indexedDB`, or repositories.
  - **Comprehensive Verification:** 31 dedicated automated tests in `test_ai_provider_hardening.js` covering provider contracts, configuration, consent, minimization, timeouts, HTTP errors, schema validation, retries, deduplication, injection resistance, secrets audit, logging audit, and Unicode fidelity (620/620 total tests passing across 24 test suites).


---

## 🔍 Phase 5: Intelligent Search

Phase 5 unifies deterministic exact text matching with future semantic retrieval and natural-language queries across the KavyaVault poetry library, while strictly preserving user privacy, offline local-first operation, and deterministic search behavior.

### Completed:
- ✅ **Task 5.1 — Intelligent Search Foundation**: Core architecture, search domain model, provider strategy abstraction, deterministic text search provider, and truthful future placeholders.
  - **Decoupled Strategy Architecture:** `SearchQuery → SearchService → ISearchProvider (TextSearchProvider | SemanticSearchProvider | HybridSearchProvider) → Normalized SearchResult`. The UI depends on `SearchService` rather than embedding search traversal or scoring algorithms.
  - **Search Domain Models (`src/services/search/searchTypes.js`):**
    - `SearchQuery`: Encapsulates `text`, `mode` (`text`, `semantic`, `hybrid`), and optional `filters` (`category`, `tags`, `mood`, `isFavorite`, `isArchived`).
    - `SearchResult`: Normalized result item containing `poemId`, `poem`, `score`, `source` (`"text"`), `matchedFields` (`['title', 'body', 'tag', 'author']`), and `matchContext`.
  - **Controlled Search Modes (`SEARCH_MODE`):**
    - `text`: Fully operational, deterministic Hindi-first exact, tokenized, and weighted text search.
    - `semantic`: Future-ready contract. Truthfully reports `isAvailable() === false` and returns status `UNSUPPORTED` (`SEMANTIC_SEARCH_UNAVAILABLE`). Does not fake embeddings or perform external API calls.
    - `hybrid`: Future-ready contract. Truthfully reports `isAvailable() === false` and returns status `UNSUPPORTED` (`HYBRID_SEARCH_UNAVAILABLE`).
  - **Search Service Orchestrator (`src/services/SearchService.js`):** Validates and normalizes queries, dispatches to registered providers, and standardizes result envelopes. Retains 100% backward compatibility with all Phase 1 search functions (`normalizeSearchText`, `tokenizeQuery`, `escapeHtml`, `highlightMatches`, `scorePoemMatch`, `searchPoems`).
  - **Deterministic Text Provider (`src/services/search/TextSearchProvider.js`):** Implements `ISearchProvider` using conservative NFC Unicode matching, multi-word conjunction (AND match), title > tag > author > body ranking, and stable multi-tier tie-breaking (`score DESC → updatedAt DESC → poemId ASC`).
  - **Unicode & Devanagari Integrity:** Preserves complex Devanagari ligatures (`क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ, ॐ`), matras, nuktas, halant/virama, chandrabindu, poetic punctuation (`।, ॥`), mixed Hindi/English, and emojis without destructive normalization.
  - **Metadata Filtering Support:** Supports filtering on actual poem attributes (`category`, `tags`, `mood`, `isFavorite`, `isArchived`). Excludes archived poems by default unless explicitly requested.
  - **Privacy & Security Guarantees:** 100% local, read-only operation with zero network calls, zero external embedding APIs, zero telemetry, zero storage writes, and strict XSS query sanitization.
  - **Comprehensive Verification:** 25 dedicated automated tests in `test_intelligent_search_foundation.js` (645/645 total tests passing across 25 test suites).

- ✅ **Task 5.2 — Local Semantic Representation**: Local semantic representation layer, domain models, provider abstraction, text preparation, vector validation, cosine similarity math, and truthful capability boundaries.
  - **Single Representation Pipeline:** `Poem → preparePoemSemanticText → IEmbeddingProvider (LocalEmbeddingProvider) → Normalized Vector → Future Vector Index (Task 5.3)`.
  - **Embedding Domain Model (`src/services/search/semantic/semanticTypes.js`):**
    - `PoemEmbedding`: Encapsulates `poemId`, `model` (e.g. `"kavya-local-v1"`), `dimensions`, `vector` (frozen numerical array), `sourceTextHash`, and `createdAt`.
    - `validateEmbeddingVector`: Enforces numeric, finite, non-empty vectors; rejects NaN, $\pm\infty$, non-number types, and dimension mismatches.
  - **Embedding Provider Abstraction (`src/services/search/semantic/IEmbeddingProvider.js`):**
    - Framework-independent contract defining `getId()`, `getName()`, `getModelVersion()`, `getDimensions()`, `isAvailable()`, `embed(text)`, `embedPoem(poem)`, and `embedQuery(queryText)`. Symmetrically handles both poems and queries.
  - **Truthful Local Provider (`src/services/search/semantic/LocalEmbeddingProvider.js`):**
    - Implements `IEmbeddingProvider`. Truthfully declares `isAvailable() = false` and throws dignified Hindi error if invoked directly.
    - Strictly avoids bundling heavy ML dependencies (>50MB ONNX/Transformers runtimes) or downloading model weights from remote CDNs during build/runtime.
  - **Test Embedding Provider (`src/services/search/semantic/TestEmbeddingProvider.js`):**
    - In-memory deterministic mock provider generating valid unit vectors for test suites to verify math and pipeline contracts without claiming semantic artificial intelligence.
  - **Semantic Text Preparation & Invalidation (`src/services/search/semantic/semanticPreparation.js`):**
    - `preparePoemSemanticText`: Canonical assembly of `title`, `body`, `author`, and `tags`. Excludes manuscript image bytes, storage keys, favorites, reading state, and internal flags.
    - `normalizeSemanticText`: NFC Unicode normalization, collapsing excessive whitespace while preserving line structure and Hindi Devanagari.
    - `computeSourceTextHash`: Deterministic FNV-1a 32-bit hex hash for change detection and cache invalidation without leaking poem content.
  - **Vector Mathematics Foundation (`src/services/search/semantic/vectorMath.js`):**
    - `cosineSimilarity`: Deterministic calculation safely handling zero vectors (returns 0), dimension mismatches (returns 0), and bounding results strictly to $[-1.0, 1.0]$.
    - `normalizeVector`, `dotProduct`, `vectorMagnitude`: Pure vector utility helpers.
  - **Security, Privacy & Read-Only Guarantees:** Zero external network calls, zero embedding API endpoints, zero storage writes, and untrusted poem content treated purely as raw data.
  - **Comprehensive Verification:** 24 dedicated automated tests in `test_local_semantic_representation.js` (669/669 total tests passing across 26 test suites).

- ✅ **Task 5.3 — Local Vector Index + Semantic Retrieval Foundation**: Local vector index, vector persistence abstraction, and semantic retrieval foundation.
  - **Single Retrieval Pipeline:** `Query Text → prepareQuerySemanticText → IEmbeddingProvider → Query Vector → IVectorStore (IndexedDBVectorStore) → Exact Cosine Similarity Scan → Ranked Search Results (SearchResult)`.
  - **Vector Storage Contract (`src/services/search/vector/IVectorStore.js`):**
    - Formal storage abstraction defining `get(id)`, `put(embedding)`, `delete(id)`, `clear()`, `getAll(filter)`, `count(filter)`, `findByPoemId(poemId, model)`, `findByModel(model)`, `findBySourceTextHash(hash)`, and `isAvailable()`.
    - Canonical compound key: `${poemId}::${model}` preventing incompatible model vectors from being conflated.
  - **IndexedDB Vector Store (`src/services/search/vector/IndexedDBVectorStore.js`):**
    - Concrete local store backed by a dedicated IndexedDB database (`kavyavault_vectors_db`) and object store `poem_vectors`.
    - Strictly isolated from `PoemRepository`, `LocalStorageAdapter`, and poem JSON records. Vector records contain only vector metadata without duplicating poem text or manuscript bytes.
    - Deep-cloning and freezing on read to ensure complete domain immutability.
    - Seamless in-memory driver fallback for headless Node.js testing environments.
  - **Semantic Indexing Service (`src/services/search/vector/SemanticIndexService.js`):**
    - Orchestrates indexing lifecycle without polluting `PoemRepository`.
    - Automatic change detection via deterministic source text hash: skips regeneration when text is unchanged, replaces stale vectors when text is edited.
    - Model version isolation: vectors belonging to different model versions are stored independently without cross-corruption.
    - In-flight concurrency deduplication locking per `${poemId}::${model}` to prevent race conditions.
  - **Exact Cosine Retrieval in `SemanticSearchProvider` (`src/services/search/SemanticSearchProvider.js`):**
    - Brute-force exact cosine similarity scan over stored vectors for the active model version.
    - Deterministic tie-breaking: `score DESC` $\rightarrow$ poem `updatedAt DESC` $\rightarrow$ `poemId ASC`.
    - Bounded `topK` (default 20, max 100) and optional `minScore` threshold filtering.
    - Honest capability boundary: returns `SEARCH_STATUS.UNSUPPORTED` in production where `LocalEmbeddingProvider` is not active; fully functional with test-only providers in test environments.
  - **Comprehensive Verification:** 21 dedicated automated tests in `test_vector_index.js` (690/690 total tests passing across 27 test suites).

- ✅ **Task 5.4 — Hybrid Search + Natural-Language Search UX**: Unified hybrid text + semantic retrieval using Reciprocal Rank Fusion (RRF), dignified Hindi-first search mode selector tabs, and graceful degradation.
  - **Hybrid Strategy Provider (`src/services/search/HybridSearchProvider.js`):**
    - Coordinates `TextSearchProvider` and `SemanticSearchProvider` without duplicating underlying search traversal.
    - Implements standard Reciprocal Rank Fusion (RRF):
      $$\text{RRF}(d) = \sum \frac{1}{k + \text{rank}_i(d)}, \quad k = 60$$
      using 1-based ranks. Items appearing in both text and semantic result sets receive combined fused scores; items in a single list retain their individual rank contributions.
    - **Score Normalization Guarantee:** Strictly merges ranked ordinal positions rather than mixing raw BM25/keyword relevance scores with cosine similarities $[-1.0, 1.0]$.
    - **Deduplication by Canonical `poemId`:** Ensures no poem appears twice in search results. Results found in both lists are badged as `मिश्रित` (`शब्द + भावार्थ`) and retain combined ranking evidence.
    - **Deterministic Tie-Breaking:** `fusedScore DESC` $\rightarrow$ `bestRank ASC` $\rightarrow$ poem `updatedAt DESC` $\rightarrow$ `poemId ASC`.
  - **Truthful Degradation & Offline Resilience:**
    - Current production `LocalEmbeddingProvider` is offline by design (zero unauthorized model downloads, zero external API connections).
    - In Semantic Mode: Returns explicit `SEARCH_STATUS.UNSUPPORTED` banner with informative guidance; strictly zero fake results.
    - In Hybrid Mode: Gracefully degrades to text search, returning matches with `status: SEARCH_STATUS.DEGRADED`, honest explanation banner, and badges identifying text matches.
  - **Natural-Language Search UX (`src/components/search/SearchView.js` & `search.css`):**
    - WAI-ARIA accessible segmented control with 3 modes:
      - **पाठ खोज (Text Search):** *"शब्दों और वाक्यांशों में खोजें"*
      - **भावार्थ खोज (Semantic Search):** *"अर्थ के आधार पर खोजें"*
      - **मिश्रित खोज (Hybrid Search):** *"शब्द + अर्थ दोनों से खोजें"*
    - Full keyboard navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`), `role="tablist"`, `role="tab"`, `role="tabpanel"`, and visible focus rings.
    - Natural-language queries (e.g. *"पहाड़ और नदी वाली शांत कविता"*) accepted directly as query text without external LLM rewriting or hallucinated query expansion.
    - Consistent metadata filtering across category, mood, tags, favorites, and archive status.
    - Mobile-responsive layout (390px, 768px, 1024px, 1440px) with touch targets $\ge 44$px.
  - **Security & Privacy:** XSS-safe text escaping, zero telemetry, zero cloud vector databases, and zero storage writes.
---

## 🏛️ Phase 6: Personal Digital Library

Phase 6 enriches KavyaVault with a serene, personal digital library organization layer, elevating the poet's experience through collections, categories, normalized tags, favorites, recent history, and chronological timeline provenance.

### In Progress / Completed:
- ✅ **Task 6.1 — Library Organization Foundation**: Core domain models, service layer, Unicode tag normalization, category slugs, recent poem history, chronological timeline, multi-criteria filtering, and deterministic sorting.
  - **Decoupled Architecture:**
    ```text
    UI (Future Views) → LibraryService (Facade) / Domain Services → Repositories → Storage Adapter → Storage Driver
    ```
  - **Domain Models & Contracts (`src/services/library/libraryTypes.js`):**
    - `Collection`: ID, name, description, `poemIds` list, timestamps. Duplicate poem IDs are strictly prevented; deleting collections strictly preserves poem records.
    - `Category`: ID, name, slug, timestamps. Slugs safely preserve Devanagari vowel marks and combining characters (`\p{L}\p{M}\p{N}`).
    - `Tag`: ID, name, `normalizedName`, timestamps. Preserves author's exact display form while enabling case-, whitespace-, and hash-insensitive matching.
    - `RecentActivity`: Bounded local history (default max 50 items) deduplicated by `poemId`. Viewing poems never mutates `poem.updatedAt` or repository state.
    - `TimelineEntry`: Normalized chronological events (`createdAt`, `updatedAt`, `authoredDate`, manuscript `digitizedDate`). Never fabricates synthetic dates.
    - `LibraryFilter`: Multi-criteria filter query covering collection, category, tags, favorite, archive, and date ranges (`createdDateRange`, `updatedDateRange`, `authoredDateRange`).
  - **Domain Services:**
    - `CollectionService`: CRUD operations, membership management, and poem resolution with safe handling of missing references.
    - `TagService`: NFC Unicode normalization (`normalizeTagName`), multi-tag matching, tag extraction with usage counts.
    - `CategoryService`: Grouping, count aggregation, and Unicode slug matching.
    - `FavoritesService`: High-level operations directly updating `poem.isFavorite` on `PoemRepository` without parallel duplicate storage.
    - `RecentPoemService`: Lightweight local viewing history stored under `kavyavault:recent_poems`.
    - `TimelineService`: Provenance timeline aggregation with deterministic ordering and tie-breaking.
    - `LibraryFilterService`: Organizational query engine with deterministic multi-tier tie-breaking (`primaryField → updatedAt DESC → poemId ASC`).
    - `LibraryService`: Unified facade exposing high-level library operations and aggregated statistics.
  - **Privacy & Security:** 100% local-first, zero remote APIs, zero cloud storage, zero telemetry, zero AI/embeddings, and zero poem body duplication.
  - **Comprehensive Verification:** 37 dedicated automated tests in `test_library_organization.js` (747/747 total tests passing across 29 test suites).
- ✅ **Task 6.2 — Library Organization UI**: User-facing Personal Digital Library experience built on top of Task 6.1 domain services, presenting a warm, calm, quiet, archival digital sanctuary.
  - **Literary Archive Interface (`LibraryView.js` & `LibraryToolbar.js`):**
    - Seamless switching across 8 literary sections:
      1. **सभी कविताएँ (All Poems):** Complete grid/list browsing with sorting and multi-filter criteria.
      2. **पसंदीदा (Favorites):** Instant favorite toggle on poem cards, dedicated curated favorites view.
      3. **हाल में पढ़ी गई (Recently Read):** Dedicated reading history powered by `RecentPoemService`, recorded on `PoemReader` mount while strictly preserving `poem.updatedAt` immutability.
      4. **संग्रह (Collections):** Curated anthologies with modal creation, title/description editing, adding/removing poems, and safe collection deletion that strictly preserves underlying poem records.
      5. **श्रेणियाँ (Categories):** Literary genre browsing cards with Devanagari counts, one-click library filtering.
      6. **टैग (Tags):** Tag cloud displaying author-exact display forms and counts, mixed Hindi/Latin support.
      7. **अभिलेख (Archived):** Peaceful preservation vault for archived compositions with restore capability.
      8. **समयरेखा (Timeline):** Chronological provenance journey (`CREATED`, `UPDATED`, `AUTHORED`, `DIGITIZED`) highlighting authentic literary milestones with zero date invention.
  - **Filter Drawer & Sorting:**
    - Slide-out/expandable filter drawer with collection, category, and tag selectors, active filter chips with one-click removal, and "सभी साफ़ करें" reset button.
    - 5 deterministic sorting options (recently modified, oldest modified, newest created, title alphabetically, authored date).
  - **Accessibility & Design Tokens:**
    - Strict WAI-ARIA tab semantics (`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `tabindex`).
    - Full keyboard navigation (`ArrowRight`, `ArrowLeft`, `ArrowUp`, `ArrowDown`, `Home`, `End`).
    - $\ge 48$px touch targets (`--touch-target-min: 48px`) across tabs, buttons, and view toggles.
    - Responsive across 390px (mobile feed), 768px (tablet), 1024px (laptop), and 1440px (desktop 3-column grid).
  - **Comprehensive Verification:** 55 dedicated automated tests in `test_library_ui.js` (802/802 total tests passing across 30 test suites).

---

## 📜 Literary Dedication

> *"कलम आज उनकी जय बोल...*  
> *जला अस्थियाँ बारी-बारी, चिटकाई जिनमें चिंगारी,*  
> *जो चढ़ गये पुण्यवेदी पर, लिए बिना गर्दन का मोल।*  
> *कलम आज उनकी जय बोल!"*  
> — **Rashtrakavi Ramdhari Singh 'Dinkar'**

---

*KavyaVault (काव्यकलश) — Your personal sanctuary for timeless verse.*
