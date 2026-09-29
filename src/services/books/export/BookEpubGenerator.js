/**
 * काव्यकलश (KavyaVault) — EPUB 3 Book Generator (BookEpubGenerator.js)
 * Phase 7 / Task 7.4: Local PDF & EPUB Export
 *
 * Generates an EPUB 3 specification-compliant digital book container:
 * - Uncompressed mimetype entry at offset 0
 * - META-INF/container.xml
 * - OEBPS/package.opf with full Dublin Core metadata, manifest, and spine
 * - OEBPS/nav.xhtml (EPUB 3 Navigation Document)
 * - OEBPS/toc.ncx (EPUB 2 NCX compatibility)
 * - OEBPS/styles.css (EPUB-safe poetry stylesheet)
 * - Distinct, modular XHTML files for cover, title, dedication, TOC, sections, and poems
 * - 100% preservation of poem lines, stanzas, and Devanagari typography
 * - Strict XML/XHTML escaping preventing script and attribute injection
 * - 100% local, zero network requests, read-only
 */

import { SimpleZip } from './SimpleZip.js';
import { xmlEscape, xmlAttributeEscape, generateSafeExportFilename, toDevanagariNumerals, sanitizeText } from './exportUtils.js';
import { parsePoemStanzas } from '../BookLayoutEngine.js';

export class BookEpubGenerator {
  /**
   * Generates a complete EPUB 3 binary archive from a BookDocument
   * @param {Object} bookDoc - BookDocument from BookProjectService
   * @param {Object} [layoutConfig={}] - Optional layout configuration overrides
   * @returns {{ filename: string, mimeType: string, data: Uint8Array, size: number, sectionCount: number, poemCount: number, warnings: Array<string> }}
   */
  static generateEpub(bookDoc, layoutConfig = {}) {
    if (!bookDoc || typeof bookDoc !== 'object') {
      throw new Error('अमान्य पुस्तक दस्तावेज़ (BookDocument आवश्यक है)।');
    }

    const warnings = Array.isArray(bookDoc.warnings) ? [...bookDoc.warnings] : [];
    const meta = bookDoc.metadata || {};
    const rawTitle = meta.title || 'अनाम संकलन';
    const cleanTitle = sanitizeText(rawTitle);
    const author = sanitizeText(meta.author || 'काव्यकलश लेखक');
    const subtitle = sanitizeText(meta.subtitle || '');
    const dedication = sanitizeText(meta.dedication || '');
    const description = sanitizeText(meta.description || '');
    const bookId = bookDoc.id || 'kavyavault-book';
    const filename = generateSafeExportFilename(cleanTitle, 'epub');

    const sections = Array.isArray(bookDoc.sections) ? bookDoc.sections : [];
    const showCover = layoutConfig.showCover !== false;
    const showTitlePage = layoutConfig.showTitlePage !== false;
    const showDedication = layoutConfig.showDedication !== false && dedication.trim() !== '';
    const showToc = layoutConfig.showTableOfContents !== false;

    const zip = new SimpleZip();

    // 1. mimetype (MUST be first, uncompressed)
    zip.addFile('mimetype', 'application/epub+zip', { store: true });

    // 2. META-INF/container.xml
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.addFile('META-INF/container.xml', containerXml);

    // 3. OEBPS/styles.css
    const stylesCss = BookEpubGenerator.generateStylesheet(layoutConfig);
    zip.addFile('OEBPS/styles.css', stylesCss);

    // Track manifest items and spine itemrefs
    const manifestItems = [
      { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: 'nav' },
      { id: 'ncx', href: 'toc.ncx', mediaType: 'application/x-dtbncx+xml' },
      { id: 'css', href: 'styles.css', mediaType: 'text/css' }
    ];
    const spineItems = [];
    const navEntries = [];

    // 4. Cover Page (if enabled)
    if (showCover) {
      const coverHtml = BookEpubGenerator.generateCoverXhtml(cleanTitle, subtitle, author, meta.cover);
      zip.addFile('OEBPS/cover.xhtml', coverHtml);
      manifestItems.push({ id: 'cover', href: 'cover.xhtml', mediaType: 'application/xhtml+xml' });
      spineItems.push({ idref: 'cover' });
      navEntries.push({ title: 'मुखपृष्ठ (Cover)', href: 'cover.xhtml' });
    }

    // 5. Title Page (if enabled)
    if (showTitlePage) {
      const titleHtml = BookEpubGenerator.generateTitlePageXhtml(cleanTitle, subtitle, author);
      zip.addFile('OEBPS/title.xhtml', titleHtml);
      manifestItems.push({ id: 'titlepage', href: 'title.xhtml', mediaType: 'application/xhtml+xml' });
      spineItems.push({ idref: 'titlepage' });
      navEntries.push({ title: 'आंतरिक शीर्षक पृष्ठ', href: 'title.xhtml' });
    }

    // 6. Dedication Page (if enabled & present)
    if (showDedication) {
      const dedHtml = BookEpubGenerator.generateDedicationXhtml(dedication, author);
      zip.addFile('OEBPS/dedication.xhtml', dedHtml);
      manifestItems.push({ id: 'dedication', href: 'dedication.xhtml', mediaType: 'application/xhtml+xml' });
      spineItems.push({ idref: 'dedication' });
      navEntries.push({ title: 'समर्पण', href: 'dedication.xhtml' });
    }

    // Prepare sections and poems data
    let totalPoemCount = 0;
    const tocTree = [];

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const secNum = toDevanagariNumerals(sIdx + 1);
      const secTitle = sanitizeText(sec.title || `खण्ड ${secNum}`);
      const secDesc = sanitizeText(sec.description || '');
      const secFile = `section-${sIdx + 1}.xhtml`;
      const secId = `sec-${sIdx + 1}`;

      const secEntry = {
        title: `खण्ड ${secNum}: ${secTitle}`,
        href: secFile,
        poems: []
      };

      // Generate section divider page
      const secHtml = BookEpubGenerator.generateSectionXhtml(secNum, secTitle, secDesc);
      zip.addFile(`OEBPS/${secFile}`, secHtml);
      manifestItems.push({ id: secId, href: secFile, mediaType: 'application/xhtml+xml' });
      spineItems.push({ idref: secId });

      const secPoems = Array.isArray(sec.poems) ? sec.poems : [];
      for (let pIdx = 0; pIdx < secPoems.length; pIdx++) {
        const poem = secPoems[pIdx];

        if (!poem || !poem.body) {
          warnings.push(`खण्ड "${secTitle}" में कविता संदर्भ अनुपलब्ध या रिक्त है (छोड़ा गया)।`);
          continue;
        }

        totalPoemCount++;
        const poemNum = toDevanagariNumerals(totalPoemCount);
        const poemTitle = sanitizeText(poem.title || `कविता ${poemNum}`);
        const poemAuthor = sanitizeText(poem.author || author);
        const poemFile = `poem-${sIdx + 1}-${pIdx + 1}.xhtml`;
        const poemId = `poem-${sIdx + 1}-${pIdx + 1}`;

        const poemHtml = BookEpubGenerator.generatePoemXhtml(poemTitle, poemAuthor, poem.body, poemNum);
        zip.addFile(`OEBPS/${poemFile}`, poemHtml);
        manifestItems.push({ id: poemId, href: poemFile, mediaType: 'application/xhtml+xml' });
        spineItems.push({ idref: poemId });

        secEntry.poems.push({
          title: poemTitle,
          href: poemFile
        });
      }

      tocTree.push(secEntry);
    }

    // 7. Visual Table of Contents XHTML (if enabled)
    if (showToc) {
      const tocHtml = BookEpubGenerator.generateVisualTocXhtml(cleanTitle, tocTree);
      zip.addFile('OEBPS/toc.xhtml', tocHtml);
      manifestItems.push({ id: 'toc', href: 'toc.xhtml', mediaType: 'application/xhtml+xml' });
      // Insert TOC right after dedication or titlepage
      const tocInsertIdx = Math.min(spineItems.length, (showCover ? 1 : 0) + (showTitlePage ? 1 : 0) + (showDedication ? 1 : 0));
      spineItems.splice(tocInsertIdx, 0, { idref: 'toc' });
      navEntries.push({ title: 'विषय-सूची', href: 'toc.xhtml' });
    }

    // 8. OEBPS/nav.xhtml (EPUB 3 Navigation Document)
    const navXhtml = BookEpubGenerator.generateNavXhtml(cleanTitle, navEntries, tocTree);
    zip.addFile('OEBPS/nav.xhtml', navXhtml);

    // 9. OEBPS/toc.ncx (EPUB 2 NCX for backward compatibility)
    const ncxXml = BookEpubGenerator.generateNcx(bookId, cleanTitle, author, navEntries, tocTree);
    zip.addFile('OEBPS/toc.ncx', ncxXml);

    // 10. OEBPS/package.opf
    const packageOpf = BookEpubGenerator.generatePackageOpf({
      bookId,
      title: cleanTitle,
      author,
      description,
      manifestItems,
      spineItems
    });
    zip.addFile('OEBPS/package.opf', packageOpf);

    // Generate ZIP
    const binaryData = zip.generate();

    return {
      filename,
      mimeType: 'application/epub+zip',
      data: binaryData,
      size: binaryData.length,
      sectionCount: sections.length,
      poemCount: totalPoemCount,
      warnings
    };
  }

  /**
   * Generates EPUB-safe CSS stylesheet
   */
  static generateStylesheet(layoutConfig) {
    const fontFamily = "'Martel', 'Noto Serif Devanagari', 'Devanagari Sangam MN', serif";
    const lineHeight = layoutConfig.lineHeight || 1.95;
    const bodySize = layoutConfig.bodyFontSize || 12;

    return `/* काव्यकलश (KavyaVault) — EPUB 3 Typography Stylesheet */
@charset "UTF-8";

body {
  margin: 5% 8%;
  padding: 0;
  font-family: ${fontFamily};
  font-size: ${bodySize}pt;
  line-height: ${lineHeight};
  color: #1A1615;
  background-color: transparent;
  direction: ltr;
}

h1, h2, h3, h4 {
  font-family: ${fontFamily};
  font-weight: 700;
  line-height: 1.3;
  margin-top: 1.5em;
  margin-bottom: 0.6em;
  text-align: center;
}

p {
  margin: 0.5em 0;
  line-height: ${lineHeight};
}

/* Cover Styling */
.epub-cover {
  text-align: center;
  margin-top: 25%;
  page-break-after: always;
}

.epub-cover-badge {
  font-size: 0.85em;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #8C533E;
  margin-bottom: 1.5em;
}

.epub-cover-title {
  font-size: 2.2em;
  margin: 0.3em 0;
  color: #2C221E;
}

.epub-cover-subtitle {
  font-size: 1.1em;
  font-style: italic;
  color: #5C4A42;
  margin-bottom: 2em;
}

.epub-cover-rule {
  width: 60px;
  height: 2px;
  background-color: #8C533E;
  margin: 1.5em auto;
}

.epub-cover-author {
  font-size: 1.2em;
  color: #3C302A;
}

/* Title Page */
.epub-titlepage {
  text-align: center;
  margin-top: 20%;
  page-break-after: always;
}

.epub-titlepage-title {
  font-size: 1.8em;
  margin-bottom: 0.3em;
}

.epub-titlepage-subtitle {
  font-size: 1em;
  color: #6C5B53;
  margin-bottom: 1.5em;
}

.epub-titlepage-author {
  font-size: 1.15em;
  margin-bottom: 3em;
}

.epub-titlepage-colophon {
  margin-top: 4em;
  font-size: 0.85em;
  color: #8C786E;
  border-top: 1px solid #D8CFC4;
  padding-top: 1.5em;
}

/* Dedication */
.epub-dedication {
  text-align: center;
  margin-top: 30%;
  page-break-after: always;
}

.epub-dedication-heading {
  font-size: 1.2em;
  color: #8C533E;
  margin-bottom: 1.5em;
}

.epub-dedication-body {
  font-style: italic;
  font-size: 1.1em;
  line-height: 2;
  margin: 0 10%;
  color: #2C221E;
}

.epub-dedication-author {
  margin-top: 1.5em;
  font-size: 0.95em;
  color: #5C4A42;
}

/* Table of Contents */
.epub-toc-container {
  page-break-after: always;
}

.epub-toc-title {
  text-align: center;
  margin-bottom: 1.5em;
}

.epub-toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.epub-toc-section-item {
  font-weight: 700;
  margin-top: 1.2em;
  margin-bottom: 0.4em;
  border-bottom: 1px solid #E5DFD5;
  padding-bottom: 0.2em;
}

.epub-toc-poem-item {
  margin-left: 1.5em;
  margin-top: 0.3em;
  margin-bottom: 0.3em;
}

.epub-toc-poem-item a, .epub-toc-section-item a {
  color: #2C221E;
  text-decoration: none;
}

/* Section Divider */
.epub-section-divider {
  text-align: center;
  margin-top: 30%;
  page-break-after: always;
}

.epub-section-num {
  font-size: 0.9em;
  color: #8C533E;
  letter-spacing: 0.1em;
}

.epub-section-title {
  font-size: 1.8em;
  margin-top: 0.3em;
  margin-bottom: 0.6em;
}

.epub-section-desc {
  font-size: 1em;
  color: #5C4A42;
  max-width: 80%;
  margin: 0 auto;
}

/* Poem Styling (POETRY INTEGRITY: LINES MUST NEVER COLLAPSE) */
.epub-poem-page {
  page-break-after: always;
}

.epub-poem-header {
  text-align: center;
  margin-bottom: 2em;
}

.epub-poem-title {
  font-size: 1.5em;
  margin-bottom: 0.2em;
  color: #1A1615;
}

.epub-poem-author {
  font-size: 0.95em;
  color: #6C5B53;
  margin-top: 0;
}

.epub-poem-rule {
  width: 40px;
  height: 1px;
  background-color: #C4B5A5;
  margin: 1em auto;
}

.epub-poem-body {
  text-align: center;
  margin: 1.5em 0;
}

.epub-poem-stanza {
  margin-top: 1.4em;
  margin-bottom: 1.4em;
  page-break-inside: avoid;
}

.epub-poem-line {
  margin: 0;
  padding: 0;
  line-height: ${lineHeight};
  white-space: pre-wrap;
  word-wrap: break-word;
}
`;
  }

  /**
   * Generates XHTML wrapper with strict XML declaration
   */
  static wrapXhtml(title, bodyHtml) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="hi" lang="hi">
<head>
  <meta charset="UTF-8"/>
  <title>${xmlEscape(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  /**
   * Generates cover.xhtml
   */
  static generateCoverXhtml(title, subtitle, author, coverConfig) {
    const bg = (coverConfig && (coverConfig.background || coverConfig.theme))
      ? (coverConfig.background || coverConfig.theme)
      : 'bhojpatra';
    const body = `
  <div class="epub-cover bg-${xmlAttributeEscape(bg)} theme-${xmlAttributeEscape(bg)}">
    <div class="epub-cover-badge">काव्यकलश संकलन</div>
    <h1 class="epub-cover-title">${xmlEscape(title)}</h1>
    ${subtitle ? `<p class="epub-cover-subtitle">${xmlEscape(subtitle)}</p>` : ''}
    <div class="epub-cover-rule"></div>
    <p class="epub-cover-author">${xmlEscape(author)}</p>
  </div>`;
    return BookEpubGenerator.wrapXhtml(title, body);
  }

  /**
   * Generates title.xhtml
   */
  static generateTitlePageXhtml(title, subtitle, author) {
    const body = `
  <div class="epub-titlepage">
    <h1 class="epub-titlepage-title">${xmlEscape(title)}</h1>
    ${subtitle ? `<p class="epub-titlepage-subtitle">${xmlEscape(subtitle)}</p>` : ''}
    <div class="epub-cover-rule"></div>
    <p class="epub-titlepage-author">${xmlEscape(author)}</p>
    <div class="epub-titlepage-colophon">
      <p>काव्यकलश साहित्यिक संकलन</p>
      <p>सर्वाधिकार सुरक्षित © ${new Date().getFullYear()}</p>
    </div>
  </div>`;
    return BookEpubGenerator.wrapXhtml(`आंतरिक पृष्ठ: ${title}`, body);
  }

  /**
   * Generates dedication.xhtml
   */
  static generateDedicationXhtml(dedication, author) {
    const body = `
  <div class="epub-dedication">
    <h2 class="epub-dedication-heading">समर्पण</h2>
    <blockquote class="epub-dedication-body">
      <p>${xmlEscape(dedication)}</p>
    </blockquote>
    ${author ? `<p class="epub-dedication-author">— ${xmlEscape(author)}</p>` : ''}
  </div>`;
    return BookEpubGenerator.wrapXhtml('समर्पण', body);
  }

  /**
   * Generates visual toc.xhtml
   */
  static generateVisualTocXhtml(bookTitle, tocTree) {
    const itemsHtml = tocTree.map(sec => `
      <li class="epub-toc-section-item">
        <a href="${xmlAttributeEscape(sec.href)}">${xmlEscape(sec.title)}</a>
        ${sec.poems && sec.poems.length > 0 ? `
          <ul class="epub-toc-list">
            ${sec.poems.map(p => `
              <li class="epub-toc-poem-item">
                <a href="${xmlAttributeEscape(p.href)}">${xmlEscape(p.title)}</a>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </li>
    `).join('');

    const body = `
  <div class="epub-toc-container">
    <h1 class="epub-toc-title">विषय-सूची</h1>
    <div class="epub-cover-rule"></div>
    <ul class="epub-toc-list">
      ${itemsHtml}
    </ul>
  </div>`;
    return BookEpubGenerator.wrapXhtml('विषय-सूची', body);
  }

  /**
   * Generates section-N.xhtml
   */
  static generateSectionXhtml(secNum, secTitle, secDesc) {
    const body = `
  <div class="epub-section-divider">
    <span class="epub-section-num">खण्ड ${xmlEscape(secNum)}</span>
    <h1 class="epub-section-title">${xmlEscape(secTitle)}</h1>
    <div class="epub-cover-rule"></div>
    ${secDesc ? `<p class="epub-section-desc">${xmlEscape(secDesc)}</p>` : ''}
  </div>`;
    return BookEpubGenerator.wrapXhtml(`खण्ड ${secNum}: ${secTitle}`, body);
  }

  /**
   * Generates poem-N.xhtml
   * Strictly preserves every line break and stanza boundary
   */
  static generatePoemXhtml(title, author, bodyText, poemNum) {
    const cleanBody = sanitizeText(bodyText);
    const stanzas = parsePoemStanzas(cleanBody);

    const stanzasHtml = stanzas.map(stanzaLines => `
      <div class="epub-poem-stanza">
        ${stanzaLines.map(line => `<p class="epub-poem-line">${line.trim() === '' ? '&#160;' : xmlEscape(line)}</p>`).join('\n        ')}
      </div>
    `).join('\n');

    const body = `
  <article class="epub-poem-page">
    <header class="epub-poem-header">
      <h1 class="epub-poem-title">${xmlEscape(title)}</h1>
      ${author ? `<p class="epub-poem-author">${xmlEscape(author)}</p>` : ''}
      <div class="epub-poem-rule"></div>
    </header>
    <div class="epub-poem-body">
      ${stanzasHtml}
    </div>
  </article>`;
    return BookEpubGenerator.wrapXhtml(title, body);
  }

  /**
   * Generates OEBPS/nav.xhtml (EPUB 3 Navigation Document)
   */
  static generateNavXhtml(bookTitle, topEntries, tocTree) {
    const topNavHtml = topEntries.map(e => `
        <li><a href="${xmlAttributeEscape(e.href)}">${xmlEscape(e.title)}</a></li>`).join('');

    const treeNavHtml = tocTree.map(sec => `
        <li>
          <a href="${xmlAttributeEscape(sec.href)}">${xmlEscape(sec.title)}</a>
          ${sec.poems && sec.poems.length > 0 ? `
            <ol>
              ${sec.poems.map(p => `
                <li><a href="${xmlAttributeEscape(p.href)}">${xmlEscape(p.title)}</a></li>
              `).join('')}
            </ol>
          ` : ''}
        </li>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="hi" lang="hi">
<head>
  <meta charset="UTF-8"/>
  <title>विषय-सूची (Navigation)</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>विषय-सूची</h1>
    <ol>
      ${topNavHtml}
      ${treeNavHtml}
    </ol>
  </nav>
</body>
</html>`;
  }

  /**
   * Generates OEBPS/toc.ncx (EPUB 2 NCX compatibility)
   */
  static generateNcx(bookId, bookTitle, author, topEntries, tocTree) {
    let playOrder = 1;
    let navPoints = '';

    for (const e of topEntries) {
      navPoints += `
    <navPoint id="np-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>${xmlEscape(e.title)}</text></navLabel>
      <content src="${xmlAttributeEscape(e.href)}"/>
    </navPoint>`;
      playOrder++;
    }

    for (const sec of tocTree) {
      const secPlayOrder = playOrder++;
      let childPoints = '';

      if (sec.poems && sec.poems.length > 0) {
        for (const p of sec.poems) {
          childPoints += `
      <navPoint id="np-${playOrder}" playOrder="${playOrder}">
        <navLabel><text>${xmlEscape(p.title)}</text></navLabel>
        <content src="${xmlAttributeEscape(p.href)}"/>
      </navPoint>`;
          playOrder++;
        }
      }

      navPoints += `
    <navPoint id="np-${secPlayOrder}" playOrder="${secPlayOrder}">
      <navLabel><text>${xmlEscape(sec.title)}</text></navLabel>
      <content src="${xmlAttributeEscape(sec.href)}"/>
      ${childPoints}
    </navPoint>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="hi">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${xmlAttributeEscape(bookId)}"/>
    <meta name="dtb:depth" content="2"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${xmlEscape(bookTitle)}</text>
  </docTitle>
  <docAuthor>
    <text>${xmlEscape(author)}</text>
  </docAuthor>
  <navMap>
    ${navPoints}
  </navMap>
</ncx>`;
  }

  /**
   * Generates OEBPS/package.opf (Open Packaging Format)
   */
  static generatePackageOpf({ bookId, title, author, description, manifestItems, spineItems }) {
    const isoDate = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

    const manifestXml = manifestItems.map(item => `
    <item id="${xmlAttributeEscape(item.id)}" href="${xmlAttributeEscape(item.href)}" media-type="${xmlAttributeEscape(item.mediaType)}"${item.properties ? ` properties="${xmlAttributeEscape(item.properties)}"` : ''}/>`).join('');

    const spineXml = spineItems.map(item => `
    <itemref idref="${xmlAttributeEscape(item.idref)}"/>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0" xml:lang="hi">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${xmlEscape(bookId)}</dc:identifier>
    <dc:title>${xmlEscape(title)}</dc:title>
    <dc:creator>${xmlEscape(author)}</dc:creator>
    <dc:language>hi</dc:language>
    <meta property="dcterms:modified">${isoDate}</meta>
    <dc:publisher>काव्यकलश (KavyaVault)</dc:publisher>
    ${description ? `<dc:description>${xmlEscape(description)}</dc:description>` : ''}
  </metadata>
  <manifest>
    ${manifestXml}
  </manifest>
  <spine toc="ncx">
    ${spineXml}
  </spine>
</package>`;
  }
}
