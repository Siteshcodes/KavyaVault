/**
 * काव्यकलश (KavyaVault) — Book Layout & Page Models (bookLayoutTypes.js)
 * Phase 7 / Task 7.3: Book Layout Engine & Print Preview
 *
 * Defines explicit domain models, enums, validators, and layout contracts for:
 * - LayoutConfig: User-controlled page size, margins, orientation, and typography settings
 * - Page: Ephemeral page model representing printed pages (cover, title, dedication, TOC, section, poem)
 * - PageBlock: Individual content blocks within a page (stanzas, headers, titles, ornaments)
 * - BookLayoutDocument: Ephemeral layout representation holding paginated pages and TOC
 */

import { StorageError, StorageErrorCode } from '../storage/StorageError.js';
import { normalizeString } from './bookTypes.js';

/**
 * Supported page sizes for print-oriented layout
 */
export const PAGE_SIZE = Object.freeze({
  A5: 'a5',       // 148 x 210 mm — Literary poetry standard
  A4: 'a4',       // 210 x 297 mm — Standard folio
  LETTER: 'letter' // 215.9 x 279.4 mm (8.5 x 11 in)
});

export const VALID_PAGE_SIZES = Object.freeze(Object.values(PAGE_SIZE));

/**
 * Physical page dimensions in millimeters and typographic points (1 mm = 2.83465 pt)
 */
export const PAGE_DIMENSIONS = Object.freeze({
  [PAGE_SIZE.A5]: Object.freeze({
    widthMm: 148,
    heightMm: 210,
    widthPt: 419.53,
    heightPt: 595.28,
    aspectRatio: 148 / 210,
    label: 'A5 (१४८ × २१० मिमी)'
  }),
  [PAGE_SIZE.A4]: Object.freeze({
    widthMm: 210,
    heightMm: 297,
    widthPt: 595.28,
    heightPt: 841.89,
    aspectRatio: 210 / 297,
    label: 'A4 (२१० × २९७ मिमी)'
  }),
  [PAGE_SIZE.LETTER]: Object.freeze({
    widthMm: 215.9,
    heightMm: 279.4,
    widthPt: 612.0,
    heightPt: 792.0,
    aspectRatio: 215.9 / 279.4,
    label: 'Letter (२१६ × २७९ मिमी)'
  })
});

/**
 * Page orientation
 */
export const PAGE_ORIENTATION = Object.freeze({
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape'
});

export const VALID_PAGE_ORIENTATIONS = Object.freeze(Object.values(PAGE_ORIENTATION));

/**
 * Text alignment within poem and prose blocks
 */
export const TEXT_ALIGNMENT = Object.freeze({
  CENTER: 'center',
  LEFT: 'left',
  JUSTIFY: 'justify'
});

export const VALID_TEXT_ALIGNMENTS = Object.freeze(Object.values(TEXT_ALIGNMENT));

/**
 * Devanagari typography families
 */
export const BODY_FONT = Object.freeze({
  MARTEL: 'martel',       // High legibility Devanagari book serif (default)
  ROZHA_ONE: 'rozha-one', // Classic headline display
  YATRA_ONE: 'yatra-one', // Handcrafted calligraphic woodblock
  MUKTA: 'mukta'          // Contemporary legible sans-serif
});

export const VALID_BODY_FONTS = Object.freeze(Object.values(BODY_FONT));

/**
 * Page numbering positions
 */
export const PAGE_NUMBER_POSITION = Object.freeze({
  BOTTOM_CENTER: 'bottom-center',
  BOTTOM_OUTER: 'bottom-outer',
  TOP_RIGHT: 'top-right',
  NONE: 'none'
});

export const VALID_PAGE_NUMBER_POSITIONS = Object.freeze(Object.values(PAGE_NUMBER_POSITION));

/**
 * Ephemeral page types
 */
export const PAGE_TYPE = Object.freeze({
  COVER: 'cover',
  TITLE: 'title',
  DEDICATION: 'dedication',
  TOC: 'toc',
  SECTION: 'section',
  POEM: 'poem',
  BLANK: 'blank'
});

export const VALID_PAGE_TYPES = Object.freeze(Object.values(PAGE_TYPE));

/**
 * Title and section presentation styles
 */
export const TITLE_STYLE = Object.freeze({
  CLASSIC: 'classic',
  SIMPLE: 'simple',
  ORNATE: 'ornate'
});

export const VALID_TITLE_STYLES = Object.freeze(Object.values(TITLE_STYLE));

/**
 * Default margins in millimeters
 */
export const DEFAULT_MARGINS = Object.freeze({
  top: 20,
  right: 18,
  bottom: 20,
  left: 18
});

/**
 * Margin bounds in millimeters
 */
export const MARGIN_BOUNDS = Object.freeze({
  MIN: 5,
  MAX: 50
});

/**
 * Converts Western digits to Devanagari numerals
 * @param {number|string} num
 * @returns {string}
 */
export function toDevanagariNumerals(num) {
  if (num === null || num === undefined) return '';
  const digits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(num).replace(/[0-9]/g, d => digits[Number(d)]);
}

/**
 * Validates margins object
 * @param {Object} margins
 * @param {string} pageSize
 * @param {string} orientation
 * @throws {StorageError} If margins are invalid or impossible
 */
export function validateMargins(margins, pageSize = PAGE_SIZE.A5, orientation = PAGE_ORIENTATION.PORTRAIT) {
  if (!margins || typeof margins !== 'object') {
    throw new StorageError('हाशिये (Margins) एक मान्य ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }

  const sides = ['top', 'right', 'bottom', 'left'];
  for (const side of sides) {
    const val = margins[side];
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new StorageError(`हाशिया "${side}" एक संख्या होना चाहिए।`, StorageErrorCode.VALIDATION_ERROR);
    }
    if (val < MARGIN_BOUNDS.MIN) {
      throw new StorageError(`हाशिया "${side}" कम से कम ${MARGIN_BOUNDS.MIN} मिमी होना चाहिए।`, StorageErrorCode.VALIDATION_ERROR);
    }
    if (val > MARGIN_BOUNDS.MAX) {
      throw new StorageError(`हाशिया "${side}" अधिकतम ${MARGIN_BOUNDS.MAX} मिमी हो सकता है।`, StorageErrorCode.VALIDATION_ERROR);
    }
  }

  // Verify page geometry has positive printable area
  const dims = PAGE_DIMENSIONS[pageSize] || PAGE_DIMENSIONS[PAGE_SIZE.A5];
  const widthMm = orientation === PAGE_ORIENTATION.LANDSCAPE ? dims.heightMm : dims.widthMm;
  const heightMm = orientation === PAGE_ORIENTATION.LANDSCAPE ? dims.widthMm : dims.heightMm;

  if (margins.left + margins.right >= widthMm - 50) {
    throw new StorageError('दायाँ और बायाँ हाशिया पृष्ठ की कुल चौड़ाई से अधिक या लगभग बराबर है।', StorageErrorCode.VALIDATION_ERROR);
  }

  if (margins.top + margins.bottom >= heightMm - 50) {
    throw new StorageError('ऊपरी और निचला हाशिया पृष्ठ की कुल ऊँचाई से अधिक या लगभग बराबर है।', StorageErrorCode.VALIDATION_ERROR);
  }
}

/**
 * Validates LayoutConfig contract
 * @param {Object} config
 * @throws {StorageError} If validation fails
 */
export function validateLayoutConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new StorageError('लेआउट विन्यास (LayoutConfig) एक ऑब्जेक्ट होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
  }
  for (const field of ['bodyFontSize', 'titleFontSize', 'sectionFontSize', 'lineHeight', 'stanzaSpacing', 'paragraphSpacing']) {
    if (config[field] !== undefined && !Number.isFinite(config[field])) {
      throw new StorageError('लेआउट में एक अमान्य संख्या है।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (config.pageSize && !VALID_PAGE_SIZES.includes(config.pageSize)) {
    throw new StorageError(`अमान्य पृष्ठ आकार: "${config.pageSize}"`, StorageErrorCode.VALIDATION_ERROR);
  }

  if (config.orientation && !VALID_PAGE_ORIENTATIONS.includes(config.orientation)) {
    throw new StorageError(`अमान्य अभिविन्यास: "${config.orientation}"`, StorageErrorCode.VALIDATION_ERROR);
  }

  if (config.margins) {
    validateMargins(config.margins, config.pageSize || PAGE_SIZE.A5, config.orientation || PAGE_ORIENTATION.PORTRAIT);
  }

  if (config.bodyFont && !VALID_BODY_FONTS.includes(config.bodyFont)) {
    throw new StorageError(`अमान्य फ़ॉन्ट: "${config.bodyFont}"`, StorageErrorCode.VALIDATION_ERROR);
  }

  if (config.bodyFontSize !== undefined) {
    if (typeof config.bodyFontSize !== 'number' || config.bodyFontSize < 8 || config.bodyFontSize > 24) {
      throw new StorageError('फ़ॉन्ट आकार 8pt से 24pt के बीच होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (config.titleFontSize !== undefined) {
    if (typeof config.titleFontSize !== 'number' || config.titleFontSize < 12 || config.titleFontSize > 40) {
      throw new StorageError('शीर्षक आकार 12pt से 40pt के बीच होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (config.sectionFontSize !== undefined) {
    if (typeof config.sectionFontSize !== 'number' || config.sectionFontSize < 10 || config.sectionFontSize > 32) {
      throw new StorageError('खण्ड शीर्षक आकार 10pt से 32pt के बीच होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (config.lineHeight !== undefined) {
    if (typeof config.lineHeight !== 'number' || config.lineHeight < 1.2 || config.lineHeight > 3.0) {
      throw new StorageError('पंक्ति ऊँचाई 1.2 से 3.0 के बीच होनी चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (config.stanzaSpacing !== undefined) {
    if (typeof config.stanzaSpacing !== 'number' || config.stanzaSpacing < 4 || config.stanzaSpacing > 48) {
      throw new StorageError('छंद अंतराल 4pt से 48pt के बीच होना चाहिए।', StorageErrorCode.VALIDATION_ERROR);
    }
  }

  if (config.alignment && !VALID_TEXT_ALIGNMENTS.includes(config.alignment)) {
    throw new StorageError(`अमान्य संरेखण: "${config.alignment}"`, StorageErrorCode.VALIDATION_ERROR);
  }

  const pageNumPos = config.pageNumbering || config.pageNumberPosition;
  if (pageNumPos && !VALID_PAGE_NUMBER_POSITIONS.includes(pageNumPos)) {
    throw new StorageError(`अमान्य पृष्ठ संख्या स्थिति: "${pageNumPos}"`, StorageErrorCode.VALIDATION_ERROR);
  }

  if (config.titleStyle && !VALID_TITLE_STYLES.includes(config.titleStyle)) {
    throw new StorageError(`अमान्य शीर्षक शैली: "${config.titleStyle}"`, StorageErrorCode.VALIDATION_ERROR);
  }

  if (config.sectionStyle && !VALID_TITLE_STYLES.includes(config.sectionStyle)) {
    throw new StorageError(`अमान्य खण्ड शैली: "${config.sectionStyle}"`, StorageErrorCode.VALIDATION_ERROR);
  }
}

/**
 * Creates a validated LayoutConfig object with literary defaults
 * @param {Object} [data={}]
 * @returns {Object}
 */
export function createLayoutConfig(data = {}) {
  validateLayoutConfig(data);

  const pageSize = (typeof data.pageSize === 'string' && VALID_PAGE_SIZES.includes(data.pageSize))
    ? data.pageSize
    : PAGE_SIZE.A5;

  const orientation = (typeof data.orientation === 'string' && VALID_PAGE_ORIENTATIONS.includes(data.orientation))
    ? data.orientation
    : PAGE_ORIENTATION.PORTRAIT;

  const rawMargins = data.margins || {};
  const margins = {
    top: typeof rawMargins.top === 'number' ? rawMargins.top : DEFAULT_MARGINS.top,
    right: typeof rawMargins.right === 'number' ? rawMargins.right : DEFAULT_MARGINS.right,
    bottom: typeof rawMargins.bottom === 'number' ? rawMargins.bottom : DEFAULT_MARGINS.bottom,
    left: typeof rawMargins.left === 'number' ? rawMargins.left : DEFAULT_MARGINS.left
  };

  return {
    pageSize,
    orientation,
    margins,
    bodyFont: (typeof data.bodyFont === 'string' && VALID_BODY_FONTS.includes(data.bodyFont))
      ? data.bodyFont
      : BODY_FONT.MARTEL,
    bodyFontSize: typeof data.bodyFontSize === 'number' ? data.bodyFontSize : 12,
    titleFontSize: typeof data.titleFontSize === 'number' ? data.titleFontSize : 18,
    sectionFontSize: typeof data.sectionFontSize === 'number' ? data.sectionFontSize : 16,
    lineHeight: typeof data.lineHeight === 'number' ? data.lineHeight : 1.95,
    stanzaSpacing: typeof data.stanzaSpacing === 'number' ? data.stanzaSpacing : 16,
    paragraphSpacing: typeof data.paragraphSpacing === 'number' ? data.paragraphSpacing : 12,
    alignment: (typeof data.alignment === 'string' && VALID_TEXT_ALIGNMENTS.includes(data.alignment))
      ? data.alignment
      : TEXT_ALIGNMENT.CENTER,
    pageNumbering: (typeof (data.pageNumbering || data.pageNumberPosition) === 'string' && VALID_PAGE_NUMBER_POSITIONS.includes(data.pageNumbering || data.pageNumberPosition))
      ? (data.pageNumbering || data.pageNumberPosition)
      : PAGE_NUMBER_POSITION.BOTTOM_CENTER,
    showCover: data.showCover !== false,
    showTitlePage: data.showTitlePage !== false,
    showDedication: data.showDedication !== false,
    showTableOfContents: data.showTableOfContents !== false,
    showAuthor: data.showAuthor !== false,
    widowOrphanControl: data.widowOrphanControl !== false,
    titleStyle: (typeof data.titleStyle === 'string' && VALID_TITLE_STYLES.includes(data.titleStyle))
      ? data.titleStyle
      : TITLE_STYLE.CLASSIC,
    sectionStyle: (typeof data.sectionStyle === 'string' && VALID_TITLE_STYLES.includes(data.sectionStyle))
      ? data.sectionStyle
      : TITLE_STYLE.CLASSIC
  };
}

/**
 * Creates an ephemeral PageBlock object
 * @param {string} type - Block type (e.g. 'cover-title', 'poem-title', 'stanza', 'toc-item')
 * @param {*} content - Text or array of line strings
 * @param {Object} [meta={}] - Optional metadata
 * @returns {Object}
 */
export function createPageBlock(type, content, meta = {}) {
  return {
    type,
    content,
    meta: { ...meta }
  };
}

/**
 * Creates an ephemeral Page model
 * @param {Object} [data={}]
 * @returns {Object}
 */
export function createPage(data = {}) {
  const type = (typeof data.type === 'string' && VALID_PAGE_TYPES.includes(data.type))
    ? data.type
    : PAGE_TYPE.BLANK;

  const pageNumber = typeof data.pageNumber === 'number' ? data.pageNumber : null;
  const displayPageNumber = pageNumber !== null ? toDevanagariNumerals(pageNumber) : '';

  return {
    pageNumber,
    displayPageNumber,
    type,
    sectionId: data.sectionId || null,
    sectionTitle: data.sectionTitle || null,
    poemId: data.poemId || null,
    poemTitle: data.poemTitle || null,
    poemAuthor: data.poemAuthor || null,
    isContinuation: Boolean(data.isContinuation),
    continuationPart: typeof data.continuationPart === 'number' ? data.continuationPart : null,
    totalParts: typeof data.totalParts === 'number' ? data.totalParts : null,
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    header: data.header || { left: '', center: '', right: '' },
    footer: data.footer || { left: '', center: '', right: '' }
  };
}

/**
 * Creates an ephemeral BookLayoutDocument holding the complete rendered pagination
 * Note: Never persisted to disk or storage driver.
 * @param {Object} [data={}]
 * @returns {Object}
 */
export function createBookLayoutDocument(data = {}) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const toc = Array.isArray(data.toc) ? data.toc : [];
  const config = data.config ? createLayoutConfig(data.config) : createLayoutConfig();
  const metadata = data.metadata || {};

  return {
    bookId: data.bookId || null,
    metadata: {
      title: metadata.title || '',
      subtitle: metadata.subtitle || null,
      author: metadata.author || 'अज्ञात',
      dedication: metadata.dedication || null,
      description: metadata.description || null,
      language: metadata.language || 'hi',
      cover: metadata.cover || null
    },
    config,
    pages,
    toc,
    stats: data.stats || {
      totalPages: pages.length,
      contentPages: pages.filter(p => p.type === PAGE_TYPE.POEM || p.type === PAGE_TYPE.SECTION).length,
      frontMatterPages: pages.filter(p => p.type !== PAGE_TYPE.POEM && p.type !== PAGE_TYPE.SECTION).length,
      sectionsCount: 0,
      poemsCount: 0
    },
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    generatedAt: data.generatedAt || new Date().toISOString()
  };
}
