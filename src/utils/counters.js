/**
 * काव्यकलश (KavyaVault) — Unicode-Safe Poetic Text Counters (counters.js)
 * Calculates words, lines, and Unicode code-point characters without modifying text.
 */

/**
 * Calculates live text metrics for poetry editing
 * @param {string} text Raw poem text
 * @returns {{ words: number, lines: number, characters: number }}
 */
export function calculateTextMetrics(text) {
  if (!text || typeof text !== 'string') {
    return { words: 0, lines: 0, characters: 0 };
  }

  // 1. Characters: Count Unicode code points (safe for emojis and surrogate pairs)
  const characters = Array.from(text).length;

  // 2. Lines: Split on newline boundaries (\r\n or \n)
  // If string is completely empty, 0 lines; otherwise count line slots
  const lines = text.length === 0 ? 0 : text.split(/\r?\n/).length;

  // 3. Words: Whitespace-delimited tokens in Hindi and Latin scripts
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(Boolean).length;

  return { words, lines, characters };
}
