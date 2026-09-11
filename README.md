# KavyaVault (काव्यकलश)

> **A Hindi-first, local-first personal digital poetry library and literary sanctuary.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-355%2F355%20Passing%20(100%25)-brightgreen.svg)]()
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
5. **Strict XSS Sanitization**: Dynamic user input (titles, verse stanzas, author names, tags, search queries, transcriptions) is safely sanitized and escaped across cards, the reader sanctuary, and search highlight marks.

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
    └── test_manuscript_versioning.js # Lightweight version history, restore audit trail (40 tests)
```

---

## 🧪 Automated Testing & Reliability

KavyaVault features a 100% reproducible, standalone automated test suite executed directly in Node.js with **zero external test-runner overhead**.

### Run Complete Regression Suite:
```bash
npm test
```

### Test Suite Summary (355 / 355 Tests Passing — 100% Pass Rate):
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
| **Non-Destructive Transformation** | `test_manuscript_transform.js` | **36** | Rotation (0/90/180/270), user-selectable mouse/touch crop, coordinate mapping, byte immutability, versioning, tabs, reset |
| **Manuscript Gallery & Reader** | `test_manuscript_gallery.js` | **26** | Dedicated gallery route (`/manuscripts`), thumbnail resolution (derived prioritized over original), deterministic title/status/source filtering, XSS escaping, prev/next sequential navigation, image dimensions |
| **Manuscript ↔ Poem Linking** | `test_manuscript_poem_linking.js` | **26** | Explicit linking (`manuscript.poemId`), safe unlinking, poem existence validation, one-to-many relationship, cascade cleanup on poem delete, archival byte immutability, reader UI integration |
| **Manuscript Transcription Workspace** | `test_manuscript_transcription.js` | **32** | Manual transcription canvas (`/manuscripts/:id/transcribe`), status lifecycle (`untranscribed` → `draft` → `verified`), text edit downgrade, verifiedAt clearing, quota resilience, Unicode/Devanagari rigor, reader preview, linked poem independence |
| **Manuscript & Transcription Version History** | `test_manuscript_versioning.js` | **40** | Lightweight version snapshots, restore flow creating new versions, status lifecycle preservation, duplicate save protection, 25-version cap, immutability, quota resilience |
| **TOTAL** | | **355 / 355** | **0 Failures (100% Success)** |

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

### Upcoming:
- **Chhand & Metre Analysis**: Automated Devanagari syllable and matra analysis for classical metres (*Doha, Chaupai, Rola, Soratha*).
- **Import & Export Engine**: Clean data export and backup in JSON, Markdown, and formatted Plain Text.

---

## 📜 Literary Dedication

> *"कलम आज उनकी जय बोल...*  
> *जला अस्थियाँ बारी-बारी, चिटकाई जिनमें चिंगारी,*  
> *जो चढ़ गये पुण्यवेदी पर, लिए बिना गर्दन का मोल।*  
> *कलम आज उनकी जय बोल!"*  
> — **Rashtrakavi Ramdhari Singh 'Dinkar'**

---

*KavyaVault (काव्यकलश) — Your personal sanctuary for timeless verse.*
