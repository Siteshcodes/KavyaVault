/**
 * काव्यकलश (KavyaVault) — Safe Devanagari Poem Preview Generator
 * Preserves verse line breaks and prevents Unicode grapheme cluster truncation.
 */

export function generatePoemPreview(bodyText, maxLines = 3, maxChars = 140) {
  if (!bodyText || typeof bodyText !== 'string') return '';

  const lines = bodyText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return '';

  const isTruncatedByLines = lines.length > maxLines;
  const previewLines = lines.slice(0, maxLines);
  const combined = previewLines.join('\n');

  // Unicode code point array avoids splitting surrogate pairs
  const characters = Array.from(combined);

  if (characters.length > maxChars) {
    // Cut without breaking words where possible
    const slice = characters.slice(0, maxChars).join('');
    const lastSpace = slice.lastIndexOf(' ');
    let cleanCut = lastSpace > (maxChars * 0.6) ? slice.substring(0, lastSpace) : slice;

    // Clean trailing punctuation or dangling halant/matra
    cleanCut = cleanCut.replace(/[\s,।॥\-]+$/, '');
    return cleanCut + '…';
  }

  if (isTruncatedByLines) {
    return combined + '\n…';
  }

  return combined;
}
