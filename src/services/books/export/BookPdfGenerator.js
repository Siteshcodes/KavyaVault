/**
 * काव्यकलश (KavyaVault) — Local PDF Generator (BookPdfGenerator.js)
 * Phase 7 / Task 7.4: Local PDF & EPUB Export
 *
 * Generates an authentic, specification-compliant PDF 1.4 binary document
 * directly from an ephemeral BookLayoutDocument:
 * - 100% deterministic pure-JavaScript PDF generation
 * - Preserves exact page count, page sizes (A5, A4, Letter), and orientations (portrait/landscape)
 * - Embeds licensed Noto fonts, shapes Indic text with Fontkit, and preserves logical text with ActualText
 * - Preserves all Devanagari conjuncts, nuktas, sacred marks (ॐ, चाँद, दुःख, ।, ॥), and emojis
 * - Preserves poem line breaks and stanza structure without collapsing into prose
 * - Real binary validation: inspectable %PDF-1.4 header, xref table, trailer, and %%EOF
 * - Local-first, zero network calls, zero external font downloads, read-only
 */

import {
  PAGE_SIZE,
  PAGE_ORIENTATION,
  PAGE_DIMENSIONS,
  PAGE_TYPE,
  toDevanagariNumerals
} from '../bookLayoutTypes.js';
import { generateSafeExportFilename, sanitizeText } from './exportUtils.js';
import { PdfFontRegistry, pdfString } from './PdfFontRegistry.js';
import { createLayoutConfig, validateLayoutConfig } from '../bookLayoutTypes.js';

// Metric points conversion: 1 mm = 72 / 25.4 = 2.83464567 pt
const MM_TO_PT = 2.83464567;

/**
 * Escapes characters for PDF literal strings in ASCII
 * @param {string} str
 * @returns {string}
 */
function escapePdfLiteral(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Encodes a Unicode string as UTF-16BE hex string for PDF
 * Example: 'क' (U+0915) -> '<0915>'
 * @param {string} str
 * @returns {string} Hex string enclosed in angle brackets
 */
function toPdfHex(str) {
  if (!str) return '<>';
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hex += code.toString(16).toUpperCase().padStart(4, '0');
  }
  return `<${hex}>`;
}

/**
 * Cover Theme Color Palettes (RGB 0.0 - 1.0)
 */
const COVER_COLORS = {
  bhojpatra: {
    bg: [0.98, 0.96, 0.93],      // #FAF6EE Parchment
    text: [0.17, 0.13, 0.12],    // #2C221E Deep Umber
    accent: [0.55, 0.33, 0.24],  // #8C533E Terracotta
    border: [0.77, 0.71, 0.65]   // #C4B5A5 Muted Border
  },
  syahi: {
    bg: [0.10, 0.09, 0.08],      // #1A1615 Charcoal Ink
    text: [0.94, 0.91, 0.86],    // #F0E8DC Warm White
    accent: [0.85, 0.65, 0.40],  // #D9A666 Gold Leaf
    border: [0.30, 0.26, 0.24]
  },
  khaddar: {
    bg: [0.96, 0.94, 0.90],      // #F4EFE6 Cotton Khaddar
    text: [0.20, 0.17, 0.15],
    accent: [0.45, 0.35, 0.28],
    border: [0.80, 0.76, 0.70]
  },
  'makhmali-raat': {
    bg: [0.06, 0.09, 0.16],      // #0F172A Midnight Blue
    text: [0.95, 0.96, 0.98],
    accent: [0.75, 0.60, 0.90],  // Soft Lilac
    border: [0.20, 0.25, 0.35]
  }
};

export class BookPdfGenerator {
  /**
   * Generates a complete binary PDF from a BookLayoutDocument
   * @param {Object} layoutDoc - Ephemeral BookLayoutDocument from BookLayoutEngine
   * @param {Object} [options={}]
   * @returns {{ filename: string, mimeType: string, data: Uint8Array, size: number, pageCount: number, warnings: Array<string> }}
   */
  static generatePdf(layoutDoc, options = {}) {
    if (!layoutDoc || !Array.isArray(layoutDoc.pages)) throw new Error('अमान्य लेआउट दस्तावेज़ (BookLayoutDocument आवश्यक है)।');
    if (layoutDoc.pages.length > 1000) throw new Error('एक बार में अधिकतम 1000 पृष्ठ निर्यात करें।');
    const config = createLayoutConfig(layoutDoc.config || {});
    validateLayoutConfig(config);
    const meta = layoutDoc.metadata || {};
    const dims = PAGE_DIMENSIONS[config.pageSize];
    const landscape = config.orientation === PAGE_ORIENTATION.LANDSCAPE;
    const widthPt = Math.round((landscape ? dims.heightMm : dims.widthMm) * MM_TO_PT * 100) / 100;
    const heightPt = Math.round((landscape ? dims.widthMm : dims.heightMm) * MM_TO_PT * 100) / 100;
    const fontRegistry = new PdfFontRegistry();
    const warnings = [...(layoutDoc.warnings || [])];
    const env = {widthPt, heightPt, config, meta, fontRegistry, warnings,
      leftMarginPt: config.margins.left * MM_TO_PT, rightMarginPt: config.margins.right * MM_TO_PT,
      topMarginPt: Math.max(52, config.margins.top * MM_TO_PT), bottomMarginPt: config.margins.bottom * MM_TO_PT,
      printableWidthPt: widthPt - (config.margins.left + config.margins.right) * MM_TO_PT};
    const date = new Date(options.date || Date.now()).toISOString().replace(/[-:T]/g, '').slice(0,14);
    const objects = [
      '<< /Title ' + pdfString(meta.title || 'अनाम पुस्तक') + ' /Author ' + pdfString(meta.author || 'काव्यकलश') +
      ' /Creator ' + pdfString('काव्यकलश KavyaVault') + ' /Producer (KavyaVault Local Print Engine) /CreationDate (D:' + date + 'Z) >>',
      '<< /Type /Catalog /Pages 3 0 R /Lang (hi-IN) >>', null
    ];
    const add = content => (objects.push(content), objects.length);
    const streams = layoutDoc.pages.map(page => BookPdfGenerator.renderPageStream(page, env));
    const resources = fontRegistry.embed(add, BookPdfGenerator.streamObject);
    const pages = streams.map(content => {
      const contentRef = add(BookPdfGenerator.streamObject('', content));
      return add('<< /Type /Page /Parent 3 0 R /MediaBox [0 0 ' + widthPt + ' ' + heightPt + '] /Resources << /Font << ' + resources + ' >> >> /Contents ' + contentRef + ' 0 R >>');
    });
    objects[2] = '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pages.map(id => id + ' 0 R').join(' ') + '] >>';
    const data = BookPdfGenerator.assemblePdfFile(objects);
    return {filename: generateSafeExportFilename(meta.title || 'अनाम पुस्तक', 'pdf'), mimeType: 'application/pdf', data,
      size: data.length, pageCount: pages.length, warnings};
  }

  static streamObject(dictionary, content) {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    return BookPdfGenerator.concat([new TextEncoder().encode('<< /Length ' + data.length + ' ' + dictionary + ' >>\nstream\n'), data,
      new TextEncoder().encode('\nendstream')]);
  }

  static concat(parts) {
    const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }

  /**
   * Renders PDF drawing and text operators for an individual page
   */
  static renderPageStream(page, env) {
    const { widthPt, heightPt, leftMarginPt, rightMarginPt, topMarginPt, bottomMarginPt, printableWidthPt, config, meta } = env;
    const stream = [];

    // Helper: translate top-down Y (layout) to bottom-up Y (PDF)
    const pdfY = (topY) => heightPt - topY;

    const themeKey = (meta.cover && (meta.cover.background || meta.cover.theme)) || 'bhojpatra';
    const palette = COVER_COLORS[themeKey] || COVER_COLORS.bhojpatra;

    switch (page.type) {
      case PAGE_TYPE.COVER: {
        // 1. Fill entire cover page with theme background
        const [r, g, b] = palette.bg;
        stream.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
        stream.push(`0 0 ${widthPt} ${heightPt} re f`);

        // 2. Draw ornate double decorative border
        const [br, bg, bb] = palette.border;
        stream.push(`${br.toFixed(3)} ${bg.toFixed(3)} ${bb.toFixed(3)} RG`);
        stream.push(`1.5 w`);
        // Outer border
        stream.push(`${leftMarginPt * 0.6} ${bottomMarginPt * 0.6} ${widthPt - leftMarginPt * 1.2} ${heightPt - bottomMarginPt * 1.2} re s`);
        // Inner border
        stream.push(`0.75 w`);
        stream.push(`${leftMarginPt * 0.6 + 4} ${bottomMarginPt * 0.6 + 4} ${widthPt - leftMarginPt * 1.2 - 8} ${heightPt - bottomMarginPt * 1.2 - 8} re s`);

        // 3. Cover Text
        const [tr, tg, tb] = palette.text;
        const [ar, ag, ab] = palette.accent;

        // Badge: काव्यकलश संकलन
        stream.push(`BT /F1 10 Tf ${ar.toFixed(3)} ${ag.toFixed(3)} ${ab.toFixed(3)} rg`);
        const badgeText = 'काव्यकलश संकलन';
        stream.push(`${widthPt / 2 - 40} ${pdfY(heightPt * 0.3)} Td ${toPdfHex(badgeText)} Tj ET`);

        // Book Title
        const titleBlock = page.blocks.find(b => b.type === 'cover-title');
        const titleText = titleBlock ? titleBlock.content : meta.title || '';
        stream.push(`BT /F1 24 Tf ${tr.toFixed(3)} ${tg.toFixed(3)} ${tb.toFixed(3)} rg`);
        stream.push(`${leftMarginPt} ${pdfY(heightPt * 0.42)} Td ${toPdfHex(titleText)} Tj ET`);

        // Subtitle
        const subBlock = page.blocks.find(b => b.type === 'cover-subtitle');
        if (subBlock && subBlock.content) {
          stream.push(`BT /F1 12 Tf ${ar.toFixed(3)} ${ag.toFixed(3)} ${ab.toFixed(3)} rg`);
          stream.push(`${leftMarginPt} ${pdfY(heightPt * 0.5)} Td ${toPdfHex(subBlock.content)} Tj ET`);
        }

        // Ornamental rule
        stream.push(`${ar.toFixed(3)} ${ag.toFixed(3)} ${ab.toFixed(3)} RG 1.5 w`);
        const midY = pdfY(heightPt * 0.58);
        stream.push(`${widthPt / 2 - 30} ${midY} m ${widthPt / 2 + 30} ${midY} l s`);

        // Author
        const authorBlock = page.blocks.find(b => b.type === 'cover-author');
        const authorText = authorBlock ? authorBlock.content : meta.author || '';
        if (authorText) {
          stream.push(`BT /F1 14 Tf ${tr.toFixed(3)} ${tg.toFixed(3)} ${tb.toFixed(3)} rg`);
          stream.push(`${leftMarginPt} ${pdfY(heightPt * 0.7)} Td ${toPdfHex(authorText)} Tj ET`);
        }
        break;
      }

      case PAGE_TYPE.TITLE: {
        // Inner Title Page
        const titleBlock = page.blocks.find(b => b.type === 'title-heading');
        const titleText = titleBlock ? titleBlock.content : meta.title || '';
        const authorBlock = page.blocks.find(b => b.type === 'title-author');
        const authorText = authorBlock ? authorBlock.content : meta.author || '';
        const subBlock = page.blocks.find(b => b.type === 'title-subtitle');

        stream.push(`BT /F1 20 Tf 0.15 0.12 0.10 rg`);
        stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 80)} Td ${toPdfHex(titleText)} Tj ET`);

        if (subBlock && subBlock.content) {
          stream.push(`BT /F1 11 Tf 0.45 0.35 0.28 rg`);
          stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 115)} Td ${toPdfHex(subBlock.content)} Tj ET`);
        }

        // Divider rule
        stream.push(`0.7 0.6 0.5 RG 1 w`);
        const rY = pdfY(topMarginPt + 140);
        stream.push(`${leftMarginPt} ${rY} m ${leftMarginPt + 60} ${rY} l s`);

        if (authorText) {
          stream.push(`BT /F1 13 Tf 0.25 0.20 0.18 rg`);
          stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 175)} Td ${toPdfHex(authorText)} Tj ET`);
        }

        // Colophon at bottom
        stream.push(`BT /F1 9 Tf 0.5 0.45 0.40 rg`);
        stream.push(`${leftMarginPt} ${bottomMarginPt + 40} Td ${toPdfHex('काव्यकलश साहित्यिक संकलन')} Tj ET`);
        stream.push(`BT /F1 8 Tf 0.6 0.55 0.50 rg`);
        stream.push(`${leftMarginPt} ${bottomMarginPt + 24} Td ${toPdfHex('डिजिटल मुद्रण व निजी काव्य धरोहर')} Tj ET`);
        break;
      }

      case PAGE_TYPE.DEDICATION: {
        // Dedication Page
        const dedBody = page.blocks.find(b => b.type === 'dedication-body');
        const dedAuthor = page.blocks.find(b => b.type === 'dedication-author');

        stream.push(`BT /F1 13 Tf 0.55 0.33 0.24 rg`);
        stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 100)} Td ${toPdfHex('समर्पण')} Tj ET`);

        if (dedBody && dedBody.content) {
          stream.push(`BT /F1 12 Tf 0.2 0.15 0.12 rg`);
          stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 140)} Td ${toPdfHex(dedBody.content)} Tj ET`);
        }

        if (dedAuthor && dedAuthor.content) {
          stream.push(`BT /F1 10 Tf 0.4 0.3 0.25 rg`);
          stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 180)} Td ${toPdfHex(`— ${dedAuthor.content}`)} Tj ET`);
        }
        break;
      }

      case PAGE_TYPE.TOC: {
        // Table of Contents Page
        const headingBlock = page.blocks.find(b => b.type === 'toc-heading');
        const headingText = headingBlock ? headingBlock.content : 'विषय-सूची';

        stream.push(`BT /F1 16 Tf 0.15 0.12 0.1 rg`);
        stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 20)} Td ${toPdfHex(headingText)} Tj ET`);

        // Rule under TOC heading
        stream.push(`0.7 0.6 0.5 RG 0.75 w`);
        const tocRuleY = pdfY(topMarginPt + 32);
        stream.push(`${leftMarginPt} ${tocRuleY} m ${widthPt - rightMarginPt} ${tocRuleY} l s`);

        // Render TOC rows
        const entriesBlock = page.blocks.find(b => b.type === 'toc-entries');
        if (entriesBlock && Array.isArray(entriesBlock.content)) {
          let rowY = topMarginPt + 55;
          for (const item of entriesBlock.content) {
            const isSection = item.type === 'section';
            const fontSize = isSection ? 11 : 10;
            const fontColor = isSection ? '0.2 0.15 0.12' : '0.3 0.25 0.22';

            stream.push(`BT /F1 ${fontSize} Tf ${fontColor} rg`);
            const titleX = isSection ? leftMarginPt : leftMarginPt + 15;
            stream.push(`${titleX} ${pdfY(rowY)} Td ${toPdfHex(item.title)} Tj ET`);

            // Page Number on right
            const pageNumStr = item.pageNumberFormatted || toDevanagariNumerals(item.pageNumber);
            stream.push(`BT /F1 ${fontSize} Tf ${fontColor} rg`);
            stream.push(`${widthPt - rightMarginPt - 25} ${pdfY(rowY)} Td ${toPdfHex(pageNumStr)} Tj ET`);

            rowY += 22;
          }
        }
        break;
      }

      case PAGE_TYPE.SECTION: {
        // Section Divider Page
        const secNumBlock = page.blocks.find(b => b.type === 'section-divider-number');
        const secTitleBlock = page.blocks.find(b => b.type === 'section-divider-title');
        const secDescBlock = page.blocks.find(b => b.type === 'section-divider-desc');

        const secNum = secNumBlock ? secNumBlock.content : '';
        const secTitle = secTitleBlock ? secTitleBlock.content : '';

        stream.push(`BT /F1 11 Tf 0.55 0.33 0.24 rg`);
        stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 120)} Td ${toPdfHex(secNum)} Tj ET`);

        stream.push(`BT /F1 20 Tf 0.15 0.12 0.10 rg`);
        stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 155)} Td ${toPdfHex(secTitle)} Tj ET`);

        // Divider rule
        stream.push(`0.7 0.6 0.5 RG 1 w`);
        const sY = pdfY(topMarginPt + 175);
        stream.push(`${leftMarginPt} ${sY} m ${leftMarginPt + 60} ${sY} l s`);

        if (secDescBlock && secDescBlock.content) {
          stream.push(`BT /F1 11 Tf 0.4 0.32 0.26 rg`);
          stream.push(`${leftMarginPt} ${pdfY(topMarginPt + 205)} Td ${toPdfHex(secDescBlock.content)} Tj ET`);
        }
        break;
      }

      case PAGE_TYPE.POEM: {
        // Poem Content Page
        let currentY = topMarginPt + 15;

        // Continuation marker or Header
        if (page.isContinuation) {
          const contBlock = page.blocks.find(b => b.type === 'poem-continuation-header');
          const contText = contBlock ? contBlock.content : '(क्रमशः)';
          stream.push(`BT /F1 9 Tf 0.5 0.45 0.4 rg`);
          stream.push(`${leftMarginPt} ${pdfY(currentY)} Td ${toPdfHex(contText)} Tj ET`);
          currentY += 24;
        } else {
          // Poem Title
          const titleBlock = page.blocks.find(b => b.type === 'poem-title');
          if (titleBlock && titleBlock.content) {
            const titleSize = config.titleFontSize || 18;
            stream.push(`BT /F1 ${titleSize} Tf 0.12 0.10 0.08 rg`);
            stream.push(`${leftMarginPt} ${pdfY(currentY + titleSize)} Td ${toPdfHex(titleBlock.content)} Tj ET`);
            currentY += titleSize * 1.5;
          }

          // Author
          const authorBlock = page.blocks.find(b => b.type === 'poem-author');
          if (authorBlock && authorBlock.content) {
            stream.push(`BT /F1 10 Tf 0.45 0.38 0.32 rg`);
            stream.push(`${leftMarginPt} ${pdfY(currentY + 10)} Td ${toPdfHex(authorBlock.content)} Tj ET`);
            currentY += 18;
          }

          // Ornamental rule under title
          stream.push(`0.75 0.68 0.62 RG 0.5 w`);
          const ruleY = pdfY(currentY + 4);
          stream.push(`${leftMarginPt} ${ruleY} m ${leftMarginPt + 40} ${ruleY} l s`);
          currentY += (config.stanzaSpacing || 16);
        }

        // Poem Stanzas & Lines (CRITICAL: LINES ARE NEVER COLLAPSED)
        const stanzaBlocks = page.blocks.filter(b => b.type === 'stanza');
        const poemBodyBlock = page.blocks.find(b => b.type === 'poem-body');
        const bodyFontSize = config.bodyFontSize || 12;
        const linePitch = bodyFontSize * (config.lineHeight || 1.95);

        if (stanzaBlocks.length > 0) {
          stream.push(`BT /F1 ${bodyFontSize} Tf 0.12 0.10 0.08 rg`);
          for (const sb of stanzaBlocks) {
            const lines = Array.isArray(sb.content) ? sb.content : [sb.content];
            for (const line of lines) {
              if (typeof line === 'string') {
                stream.push(`${leftMarginPt} ${pdfY(currentY + bodyFontSize)} Td ${toPdfHex(line)} Tj`);
                currentY += linePitch;
              }
            }
            currentY += (config.stanzaSpacing || 16);
          }
          stream.push(`ET`);
        } else if (poemBodyBlock && Array.isArray(poemBodyBlock.stanzas)) {
          stream.push(`BT /F1 ${bodyFontSize} Tf 0.12 0.10 0.08 rg`);
          for (const stanza of poemBodyBlock.stanzas) {
            if (Array.isArray(stanza.lines)) {
              for (const line of stanza.lines) {
                if (typeof line === 'string') {
                  stream.push(`${leftMarginPt} ${pdfY(currentY + bodyFontSize)} Td ${toPdfHex(line)} Tj`);
                  currentY += linePitch;
                }
              }
              currentY += (config.stanzaSpacing || 16);
            }
          }
          stream.push(`ET`);
        }
        break;
      }

      default:
        break;
    }

    // Running Header (for Content Pages)
    if (page.type === PAGE_TYPE.POEM || page.type === PAGE_TYPE.SECTION || page.type === PAGE_TYPE.TOC) {
      if (page.header && (page.header.left || page.header.right)) {
        stream.push(`BT /F1 8 Tf 0.5 0.45 0.40 rg`);
        if (page.header.left) {
          stream.push(`${leftMarginPt} ${heightPt - 22} Td ${toPdfHex(page.header.left)} Tj`);
        }
        if (page.header.right) {
          stream.push(`${widthPt / 2 + 8} ${heightPt - 22} Td ${toPdfHex(page.header.right)} Tj`);
        }
        stream.push(`ET`);
        // Subtle header hairline
        stream.push(`0.85 0.82 0.78 RG 0.5 w`);
        stream.push(`${leftMarginPt} ${heightPt - 26} m ${widthPt - rightMarginPt} ${heightPt - 26} l s`);
      }
    }

    // Running Footer / Folio (Page Number in Devanagari)
    if (config.pageNumbering !== 'none' && page.pageNumber !== null && page.pageNumber !== undefined) {
      const folioStr = page.displayPageNumberFormatted || toDevanagariNumerals(page.pageNumber);
      stream.push(`BT /F1 9 Tf 0.4 0.35 0.30 rg`);
      // Center folio
      const folioX = config.pageNumbering === 'bottom-outer' ? (page.pageNumber % 2 ? widthPt - rightMarginPt - 18 : leftMarginPt) : config.pageNumbering === 'top-right' ? widthPt - rightMarginPt - 18 : widthPt / 2 - 6;
      const folioY = config.pageNumbering === 'top-right' ? heightPt - 38 : bottomMarginPt * 0.6;
      stream.push(`${folioX} ${folioY} Td ${toPdfHex(folioStr)} Tj ET`);
    }

    let fontSize = 12;
    return stream.join('\n').replace(/\/F1 ([\d.]+) Tf|(-?[\d.]+) (-?[\d.]+) Td <([0-9A-F]*)> Tj/g, (match, size, sx, sy, hex) => {
      if (size) { fontSize = Number(size); return ''; }
      let text = hex.match(/.{4}/g)?.map(h => String.fromCharCode(parseInt(h,16))).join('') || '';
      let x = Number(sx), y = Number(sy), maxWidth = widthPt - rightMarginPt - x, align = 'left';
      if (['cover', 'title', 'section', 'dedication'].includes(page.type) && y > bottomMarginPt && y < heightPt - 40) {
        x = leftMarginPt; maxWidth = printableWidthPt; align = 'center';
      } else if (Math.abs(y - (heightPt - 22)) < 1) {
        maxWidth = printableWidthPt / 2 - 8;
        align = x > widthPt / 2 ? 'right' : 'left';
      } else if (page.type === 'toc' && x < widthPt / 2 && fontSize <= 12) maxWidth -= 42;
      else if (page.type === 'poem' && fontSize === config.bodyFontSize && y > bottomMarginPt && y < heightPt - topMarginPt) align = config.alignment === 'center' ? 'center' : 'left';
      if (y < bottomMarginPt && fontSize > 9) throw new Error('पाठ पृष्ठ से बाहर जा रहा है। लेआउट जाँचें।');
      if (Math.abs(y - (heightPt - 22)) < 1 || (page.type === 'toc' && x < widthPt / 2 && fontSize <= 12)) {
        const label = env.fontRegistry.fitLabel(text, fontSize, maxWidth);
        if (label !== text) {
          const warning = 'लंबे शीर्षक विषय-सूची और पृष्ठ शीर्ष में संक्षिप्त हैं; रचना पृष्ठ पर पूरा शीर्षक है।';
          if (!env.warnings.includes(warning)) env.warnings.push(warning);
          text = label;
        }
      }
      return env.fontRegistry.draw(text, x, y, fontSize, Math.max(18, maxWidth), align);
    });
  }

  /**
   * Assembles indirect PDF objects into a complete binary buffer with xref table and trailer
   */
  static assemblePdfFile(objects) {
    const encode = text => new TextEncoder().encode(text);
    const parts = [encode('%PDF-1.4\n%KavyaVault\n')];
    const offsets = [0];
    let offset = parts[0].length;
    objects.forEach((object, i) => {
      offsets.push(offset);
      const part = BookPdfGenerator.concat([encode((i + 1) + ' 0 obj\n'), typeof object === 'string' ? encode(object) : object, encode('\nendobj\n')]);
      parts.push(part); offset += part.length;
    });
    const xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n' + offsets.slice(1).map(o => String(o).padStart(10,'0') + ' 00000 n \n').join('');
    parts.push(encode(xref + 'trailer\n<<\n /Size ' + (objects.length + 1) + '\n /Root 2 0 R\n /Info 1 0 R\n>>\nstartxref\n' + offset + '\n%%EOF\n'));
    return BookPdfGenerator.concat(parts);
  }
}
