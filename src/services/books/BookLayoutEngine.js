/**
 * काव्यकलश (KavyaVault) — Book Layout Engine (BookLayoutEngine.js)
 * Phase 7 / Task 7.3: Book Layout Engine & Print Preview
 *
 * Deterministic pagination engine transforming a BookDocument and LayoutConfig
 * into an ephemeral, print-accurate BookLayoutDocument.
 *
 * Guarantees:
 * - 100% Deterministic: identical inputs always produce identical pages and TOC numbers.
 * - Stanza & Line Integrity: line breaks are preserved faithfully, never collapsed into prose.
 * - Devanagari & Unicode Safety: zero grapheme splitting, zero nukta/conjunct corruption.
 * - Read-only: never modifies the underlying BookProject, poems, or repositories.
 * - Ephemeral: never persists generated HTML or pages to disk.
 * - Resilient: missing poems are cleanly surfaced with warning flags without crashing.
 */

import {
  PAGE_SIZE,
  PAGE_ORIENTATION,
  PAGE_DIMENSIONS,
  PAGE_TYPE,
  PAGE_NUMBER_POSITION,
  TEXT_ALIGNMENT,
  toDevanagariNumerals,
  createLayoutConfig,
  createPage,
  createPageBlock,
  createBookLayoutDocument
} from './bookLayoutTypes.js';
import { normalizeString } from './bookTypes.js';
import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

/**
 * Splits a raw poem body text into structured stanzas (arrays of lines)
 * Preserves every line, indentation, and Unicode grapheme verbatim.
 * @param {string} body
 * @returns {Array<Array<string>>} Array of stanzas, each being an array of line strings
 */
export function parsePoemStanzas(body) {
  if (typeof body !== 'string' || body.trim() === '') {
    return [];
  }

  // Normalize line endings to \n
  const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');

  const stanzas = [];
  let currentStanza = [];

  for (const line of rawLines) {
    if (line.trim() === '') {
      if (currentStanza.length > 0) {
        stanzas.push(currentStanza);
        currentStanza = [];
      }
    } else {
      currentStanza.push(line);
    }
  }

  if (currentStanza.length > 0) {
    stanzas.push(currentStanza);
  }

  return stanzas;
}

export class BookLayoutEngine {
  /**
   * Calculates pagination capacities and geometry from layout configuration
   * @param {Object} config Validated LayoutConfig
   * @returns {Object} Metric capacities
   */
  static computeCapacities(config) {
    const dims = PAGE_DIMENSIONS[config.pageSize] || PAGE_DIMENSIONS[PAGE_SIZE.A5];
    const widthMm = config.orientation === PAGE_ORIENTATION.LANDSCAPE ? dims.heightMm : dims.widthMm;
    const heightMm = config.orientation === PAGE_ORIENTATION.LANDSCAPE ? dims.widthMm : dims.heightMm;

    // Convert mm to points (1 mm = 2.83465 pt)
    const MM_TO_PT = 2.83465;
    const pageHeightPt = heightMm * MM_TO_PT;
    const pageWidthPt = widthMm * MM_TO_PT;

    const topMarginPt = Math.max(52, config.margins.top * MM_TO_PT);
    const bottomMarginPt = config.margins.bottom * MM_TO_PT;
    const leftMarginPt = config.margins.left * MM_TO_PT;
    const rightMarginPt = config.margins.right * MM_TO_PT;

    // Running header/footer reserve (~36pt total)
    const headerFooterReservePt = 36;
    const availableHeightPt = pageHeightPt - (topMarginPt + bottomMarginPt) - headerFooterReservePt;
    const availableWidthPt = Math.max(100, pageWidthPt - (leftMarginPt + rightMarginPt));

    const linePitchPt = config.bodyFontSize * config.lineHeight;

    // Total lines that fit on a standard content page
    const linesPerFullPage = Math.max(1, Math.floor(availableHeightPt / linePitchPt));

    // Available lines on first page of a poem
    const firstTop = 15 + config.titleFontSize * 1.5 + (config.showAuthor ? 18 : 0) + config.stanzaSpacing;
    const capacity = overhead => Math.floor((pageHeightPt - topMarginPt - bottomMarginPt - overhead - config.bodyFontSize * 1.4) / linePitchPt) + 1;
    const linesOnFirstPoemPage = capacity(firstTop);
    if (linesOnFirstPoemPage < 1) throw new StorageError('इस पृष्ठ पर पाठ के लिए पर्याप्त स्थान नहीं है। हाशिये या फ़ॉन्ट आकार घटाएँ।', StorageErrorCode.VALIDATION_ERROR);

    // Available lines on poem continuation pages (with minimal "(क्रमशः)" continuation marker)
    const linesOnContinuationPage = Math.max(1, capacity(39));

    // TOC items per page capacity
    const tocItemHeightPt = 22;
    const itemsPerTocPage = Math.max(1, Math.floor((availableHeightPt - 40) / tocItemHeightPt));

    return {
      widthMm,
      heightMm,
      aspectRatio: widthMm / heightMm,
      pageWidthPt,
      pageHeightPt,
      availableWidthPt,
      availableHeightPt,
      linePitchPt,
      linesPerFullPage,
      linesOnFirstPoemPage,
      linesOnContinuationPage,
      itemsPerTocPage
    };
  }

  /**
   * Generates a complete BookLayoutDocument from a BookDocument and LayoutConfig
   * @param {Object} bookDoc BookDocument from BookProjectService
   * @param {Object} [layoutConfigInput={}] User layout options
   * @returns {Object} Ephemeral BookLayoutDocument
   */
  static generateLayout(bookDoc, layoutConfigInput = {}) {
    if (!bookDoc || typeof bookDoc !== 'object') {
      throw new StorageError('पुस्तक दस्तावेज़ (BookDocument) आवश्यक है।', StorageErrorCode.VALIDATION_ERROR);
    }

    const config = createLayoutConfig(layoutConfigInput);
    const capacities = BookLayoutEngine.computeCapacities(config);
    const meta = bookDoc.metadata || {};
    const sections = Array.isArray(bookDoc.sections) ? bookDoc.sections : [];

    // Pre-calculate TOC count to allocate TOC pages
    let totalTocItems = 0;
    for (const sec of sections) {
      totalTocItems++; // Section header entry
      totalTocItems += Array.isArray(sec.poems) ? sec.poems.length : 0;
    }

    const numTocPages = config.showTableOfContents
      ? Math.max(1, Math.ceil(totalTocItems / capacities.itemsPerTocPage))
      : 0;

    // Two-pass generation:
    // Pass 1: Layout pages and record exact page numbers for TOC targets
    // Pass 2: Fill TOC entries with exact resolved page numbers

    const pages = [];
    let currentPageNum = 1;
    const tocEntries = [];

    // 1. Cover Page (Unnumbered by default)
    if (config.showCover) {
      const cover = meta.cover || {};
      const coverPage = createPage({
        pageNumber: null,
        type: PAGE_TYPE.COVER,
        blocks: [
          createPageBlock('cover-background', cover.background || 'bhojpatra'),
          createPageBlock('cover-style', cover.type || config.titleStyle || 'classic'),
          createPageBlock('cover-title', meta.title || 'काव्य संकलन'),
          createPageBlock('cover-subtitle', meta.subtitle || null),
          createPageBlock('cover-author', meta.author || 'अज्ञात'),
          createPageBlock('cover-imprint', 'काव्यकलश साहित्यिक धरोहर')
        ]
      });
      pages.push(coverPage);
    }

    // 2. Title Page (Inner formal literary title page)
    if (config.showTitlePage) {
      const titlePage = createPage({
        pageNumber: currentPageNum,
        type: PAGE_TYPE.TITLE,
        blocks: [
          createPageBlock('title-heading', meta.title || 'काव्य संकलन'),
          createPageBlock('title-subtitle', meta.subtitle || null),
          createPageBlock('title-author', meta.author || 'अज्ञात'),
          createPageBlock('title-dedication-note', meta.dedication ? `समर्पण: ${meta.dedication}` : null),
          createPageBlock('title-imprint', 'काव्यकलश निजी साहित्यिक संस्करण • मुद्रण पूर्वावलोकन')
        ],
        footer: {
          center: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_CENTER ? toDevanagariNumerals(currentPageNum) : '',
          right: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_OUTER ? toDevanagariNumerals(currentPageNum) : ''
        }
      });
      pages.push(titlePage);
      currentPageNum++;
    }

    // 3. Dedication Page
    if (config.showDedication && meta.dedication && meta.dedication.trim() !== '') {
      const dedPage = createPage({
        pageNumber: currentPageNum,
        type: PAGE_TYPE.DEDICATION,
        blocks: [
          createPageBlock('dedication-heading', 'समर्पण'),
          createPageBlock('dedication-body', meta.dedication),
          createPageBlock('dedication-author', meta.author || null)
        ],
        footer: {
          center: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_CENTER ? toDevanagariNumerals(currentPageNum) : '',
          right: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_OUTER ? toDevanagariNumerals(currentPageNum) : ''
        }
      });
      pages.push(dedPage);
      currentPageNum++;
    }

    // 4. Reserve TOC placeholder pages
    const tocPageIndexStart = pages.length;
    for (let t = 0; t < numTocPages; t++) {
      const tocPage = createPage({
        pageNumber: currentPageNum,
        type: PAGE_TYPE.TOC,
        blocks: [
          createPageBlock('toc-heading', t === 0 ? 'विषय-सूची' : 'विषय-सूची (जारी)'),
          createPageBlock('toc-entries-placeholder', [])
        ],
        header: {
          left: meta.title || '',
          right: 'विषय-सूची'
        },
        footer: {
          center: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_CENTER ? toDevanagariNumerals(currentPageNum) : '',
          right: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_OUTER ? toDevanagariNumerals(currentPageNum) : ''
        }
      });
      pages.push(tocPage);
      currentPageNum++;
    }

    // 5. Section & Poem Pages
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const section = sections[sIdx];
      const sectionNumberFormatted = toDevanagariNumerals(sIdx + 1);

      // Section divider page (always starts on a new page)
      const sectionStartPageNum = currentPageNum;
      tocEntries.push({
        title: `खण्ड ${sectionNumberFormatted}: ${section.title}`,
        author: null,
        type: 'section',
        sectionId: section.id,
        poemId: null,
        pageNumber: sectionStartPageNum,
        pageNumberFormatted: toDevanagariNumerals(sectionStartPageNum)
      });

      const sectionPage = createPage({
        pageNumber: currentPageNum,
        type: PAGE_TYPE.SECTION,
        sectionId: section.id,
        sectionTitle: section.title,
        blocks: [
          createPageBlock('section-divider-number', `खण्ड ${sectionNumberFormatted}`),
          createPageBlock('section-divider-title', section.title),
          createPageBlock('section-divider-desc', section.description || null),
          createPageBlock('section-divider-poem-count', `${toDevanagariNumerals((section.poems || []).length)} रचनाएँ`)
        ],
        header: {
          left: meta.title || '',
          right: section.title
        },
        footer: {
          center: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_CENTER ? toDevanagariNumerals(currentPageNum) : '',
          right: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_OUTER ? toDevanagariNumerals(currentPageNum) : ''
        }
      });
      pages.push(sectionPage);
      currentPageNum++;

      // Lay out poems within section
      const poems = Array.isArray(section.poems) ? section.poems : [];
      for (const poem of poems) {
        const poemStartPageNum = currentPageNum;
        tocEntries.push({
          title: poem.title,
          author: poem.author || null,
          type: 'poem',
          sectionId: section.id,
          poemId: poem.id,
          pageNumber: poemStartPageNum,
          pageNumberFormatted: toDevanagariNumerals(poemStartPageNum)
        });

        const stanzas = parsePoemStanzas(poem.body || '');

        // Determine poem pagination across pages
        const poemPagesBlocks = BookLayoutEngine.paginatePoemStanzas(stanzas, capacities, config);
        const totalParts = poemPagesBlocks.length;

        poemPagesBlocks.forEach((pageContent, partIdx) => {
          const isContinuation = partIdx > 0;
          const blocks = [];

          if (!isContinuation) {
            // First page of poem has title and author
            blocks.push(createPageBlock('poem-title', poem.title));
            if (config.showAuthor && poem.author) {
              blocks.push(createPageBlock('poem-author', poem.author));
            }
          } else {
            // Continuation page has continuation note
            blocks.push(createPageBlock('poem-continuation-header', `${poem.title} (क्रमशः)`));
          }

          // Add stanzas allocated to this page
          for (const stanza of pageContent.stanzas) {
            blocks.push(createPageBlock('stanza', stanza));
          }

          const poemPage = createPage({
            pageNumber: currentPageNum,
            type: PAGE_TYPE.POEM,
            sectionId: section.id,
            sectionTitle: section.title,
            poemId: poem.id,
            poemTitle: poem.title,
            poemAuthor: poem.author || null,
            isContinuation,
            continuationPart: partIdx + 1,
            totalParts,
            blocks,
            header: {
              left: section.title,
              right: poem.title
            },
            footer: {
              center: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_CENTER ? toDevanagariNumerals(currentPageNum) : '',
              right: config.pageNumbering === PAGE_NUMBER_POSITION.BOTTOM_OUTER ? toDevanagariNumerals(currentPageNum) : ''
            }
          });

          pages.push(poemPage);
          currentPageNum++;
        });
      }
    }

    // Pass 2: Populate reserved TOC pages with resolved TOC entries
    if (config.showTableOfContents && numTocPages > 0) {
      for (let t = 0; t < numTocPages; t++) {
        const startIdx = t * capacities.itemsPerTocPage;
        const pageTocEntries = tocEntries.slice(startIdx, startIdx + capacities.itemsPerTocPage);
        const targetPage = pages[tocPageIndexStart + t];

        if (targetPage) {
          targetPage.blocks = [
            createPageBlock('toc-heading', t === 0 ? 'विषय-सूची' : 'विषय-सूची (जारी)'),
            createPageBlock('toc-entries', pageTocEntries)
          ];
        }
      }
    }

    const contentPages = pages.filter(p => p.type === PAGE_TYPE.POEM || p.type === PAGE_TYPE.SECTION).length;
    const frontMatterPages = pages.length - contentPages;

    const stats = {
      totalPages: pages.length,
      contentPages,
      frontMatterPages,
      sectionsCount: sections.length,
      poemsCount: bookDoc.stats?.totalPoems || tocEntries.filter(e => e.type === 'poem').length
    };

    return createBookLayoutDocument({
      bookId: bookDoc.id,
      metadata: meta,
      config,
      pages,
      toc: tocEntries,
      stats,
      warnings: bookDoc.warnings || []
    });
  }

  /**
   * Deterministically splits poem stanzas into pages respecting line capacity and widow/orphan rules
   * @param {Array<Array<string>>} stanzas Array of stanza arrays
   * @param {Object} capacities Capacity measurements
   * @param {Object} config LayoutConfig
   * @returns {Array<{ stanzas: Array<Array<string>> }>} Array of pages with stanzas
   */
  static paginatePoemStanzas(stanzas, capacities, config) {
    if (!Array.isArray(stanzas) || !stanzas.length) return [{ stanzas: [[]] }];
    const pages = [];
    let current = [], used = 0, capacity = capacities.linesOnFirstPoemPage;
    const gap = Math.ceil(config.stanzaSpacing / capacities.linePitchPt) || 0;
    const flush = () => {
      if (current.length) pages.push({ stanzas: current });
      current = []; used = 0; capacity = capacities.linesOnContinuationPage;
    };
    for (const stanza of stanzas) {
      let offset = 0;
      while (offset < stanza.length) {
        const space = current.length ? gap : 0;
        const free = capacity - used - space;
        const remaining = stanza.length - offset;
        if (free <= 0 || (current.length && remaining > free && config.widowOrphanControl && free < 2)) { flush(); continue; }
        if (current.length && remaining > free && remaining <= capacities.linesOnContinuationPage && (!config.widowOrphanControl || remaining - free < 2)) { flush(); continue; }
        let count = Math.min(free, remaining);
        if (config.widowOrphanControl && remaining - count === 1 && count > 2) count--;
        current.push(stanza.slice(offset, offset + count));
        used += space + count; offset += count;
        if (offset < stanza.length) flush();
      }
    }
    flush();
    return pages.length ? pages : [{ stanzas: [[]] }];
  }
}
