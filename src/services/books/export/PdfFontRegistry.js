import { create } from 'fontkit';
import { fontSources } from './bundledFonts.js';

export const utf16Hex = text => Array.from({ length: String(text).length }, (_, i) =>
  String(text).charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join('');
export const pdfString = text => `<FEFF${utf16Hex(text)}>`;
const num = n => Number(n.toFixed(4));
let loaded;

export function getExportFonts() {
  if (!loaded) loaded = fontSources.map(source => {
    const bytes = Uint8Array.from(atob(source.base64), c => c.charCodeAt(0));
    return { name: source.name, bytes, font: create(bytes) };
  });
  return loaded;
}

/** Embedded TrueType fonts with real GSUB/GPOS shaping and explicit glyph positions. */
export class PdfFontRegistry {
  constructor() {
    this.fonts = getExportFonts().map((f, i) => ({ ...f, resource: `F${i + 1}`, cids: new Map(), glyphs: [] }));
  }

  shape(text) {
    const runs = [];
    let current;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      // Keep joiners and selectors with their preceding script/emoji run.
      const ignorable = /[\u200c\u200d\ufe0e\ufe0f]/u.test(ch);
      const font = ignorable && current ? current.font : this.fonts.find(f => f.font.hasGlyphForCodePoint(cp));
      if (!font) throw new Error(`इस अक्षर के लिए स्थानीय फ़ॉन्ट उपलब्ध नहीं है: U+${cp.toString(16).toUpperCase()}।`);
      if (!current || current.font !== font) {
        current = { font, text: '' };
        runs.push(current);
      }
      current.text += ch;
    }
    return runs.map(run => ({ ...run, layout: run.font.font.layout(run.text) }));
  }

  draw(text, x, y, size, maxWidth, align = 'left') {
    if (!text) return '';
    const runs = this.shape(text);
    const width = runs.reduce((sum, r) => sum + r.layout.positions.reduce((v, p) => v + p.xAdvance, 0) * size / r.font.font.unitsPerEm, 0);
    const scale = width > maxWidth ? maxWidth / width : 1;
    // Preserve a source verse on one line. Never silently clip or split graphemes.
    if (size * scale < 5) throw new Error('एक पंक्ति पृष्ठ से बहुत लंबी है। बड़ा पृष्ठ या छोटा फ़ॉन्ट चुनें।');
    const actualSize = size * scale;
    let cursor = x + (align === 'center' ? (maxWidth - width * scale) / 2 : align === 'right' ? maxWidth - width * scale : 0);
    const commands = [`/Span << /ActualText ${pdfString(text)} >> BDC`];
    for (const run of runs) {
      const record = run.font;
      const factor = actualSize / record.font.unitsPerEm;
      commands.push(`/${record.resource} ${num(actualSize)} Tf`);
      const source = Array.from(run.text, (ch, index) => ({ cp: ch.codePointAt(0), index, used: false }));
      const positioned = [];
      run.layout.glyphs.forEach((glyph, index) => {
        const position = run.layout.positions[index];
        const unicode = glyph.codePoints.length ? String.fromCodePoint(...glyph.codePoints) : '\u200b';
        const key = `${glyph.id}:${utf16Hex(unicode)}`;
        if (!record.cids.has(key)) {
          if (record.glyphs.length >= 65534) throw new Error('पुस्तक में बहुत अधिक अलग अक्षर हैं। पुस्तक को भागों में बाँटें।');
          record.cids.set(key, record.glyphs.length + 1);
          record.glyphs.push({ gid: glyph.id, unicode, width: glyph.advanceWidth * 1000 / record.font.unitsPerEm });
        }
        const cid = record.cids.get(key).toString(16).padStart(4, '0');
        const sourceIndices = glyph.codePoints.map(cp => {
          const item = source.find(item => !item.used && item.cp === cp);
          if (item) item.used = true;
          return item ? item.index : source.length + index;
        });
        positioned.push({ order: Math.min(...sourceIndices), command: `1 0 0 1 ${num(cursor + position.xOffset * factor)} ${num(y + position.yOffset * factor)} Tm <${cid}> Tj` });
        cursor += position.xAdvance * factor;
      });
      // Paint in logical source order at the already-shaped absolute positions.
      // This also supports extractors that do not implement ActualText.
      positioned.sort((a, b) => a.order - b.order).forEach(item => commands.push(item.command));
    }
    commands.push('EMC');
    return commands.join('\n');
  }

  measure(text, size) {
    return this.shape(text).reduce((sum, r) => sum + r.layout.positions.reduce((v, p) => v + p.xAdvance, 0) * size / r.font.font.unitsPerEm, 0);
  }

  fitLabel(text, size, maxWidth) {
    if (this.measure(text, size) <= maxWidth) return text;
    const graphemes = Array.from(new Intl.Segmenter('hi', { granularity: 'grapheme' }).segment(text), item => item.segment);
    let low = 0, high = graphemes.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.measure(graphemes.slice(0, mid).join('') + '…', size) <= maxWidth) low = mid;
      else high = mid - 1;
    }
    return graphemes.slice(0, low).join('') + '…';
  }

  embed(add, stream) {
    const refs = [];
    for (const record of this.fonts.filter(f => f.glyphs.length)) {
      const fontFile = add(stream(`/Length1 ${record.bytes.length}`, record.bytes));
      const f = record.font;
      const metric = n => Math.round(n * 1000 / f.unitsPerEm);
      const descriptor = add(`<< /Type /FontDescriptor /FontName /${f.postscriptName} /Flags 4 /FontBBox [${[f.bbox.minX, f.bbox.minY, f.bbox.maxX, f.bbox.maxY].map(metric).join(' ')}] /ItalicAngle 0 /Ascent ${metric(f.ascent)} /Descent ${metric(f.descent)} /CapHeight ${metric(f.capHeight || f.ascent)} /StemV 80 /FontFile2 ${fontFile} 0 R >>`);
      const gids = new Uint8Array((record.glyphs.length + 1) * 2);
      record.glyphs.forEach((g, i) => { gids[(i + 1) * 2] = g.gid >> 8; gids[(i + 1) * 2 + 1] = g.gid & 255; });
      const mapping = add(stream('', gids));
      const descendant = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${f.postscriptName} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap ${mapping} 0 R /DW 1000 /W [1 [${record.glyphs.map(g => num(g.width)).join(' ')}]] >>`);
      const entries = record.glyphs.map((g, i) => `<${(i + 1).toString(16).padStart(4, '0')}> <${utf16Hex(g.unicode)}>`);
      let chunks = '';
      for (let i = 0; i < entries.length; i += 100) {
        const group = entries.slice(i, i + 100);
        chunks += `${group.length} beginbfchar\n${group.join('\n')}\nendbfchar\n`;
      }
      const cmap = add(stream('', `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Kavya-ToUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks}endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`));
      const ref = add(`<<\n  /Type /Font\n  /Subtype /Type0\n  /BaseFont /${f.postscriptName}\n  /Encoding /Identity-H\n  /DescendantFonts [${descendant} 0 R]\n  /ToUnicode ${cmap} 0 R\n>>`);
      refs.push(`/${record.resource} ${ref} 0 R`);
    }
    return refs.join(' ');
  }
}
