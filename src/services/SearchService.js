/**
 * काव्यकलश (KavyaVault) — Search Service (SearchService.js)
 * Deterministic, Unicode-safe, Hindi-first search across poetry repository.
 * Pure logic decoupled from DOM, UI, and LocalStorage.
 */

/**
 * Conservative Unicode search text normalizer.
 * - Safely converts non-string values.
 * - Applies Unicode NFC normalization.
 * - Lowercases Latin characters for case-insensitivity.
 * - Preserves Devanagari matras, nuktas, halant/virama, conjuncts, and semantic marks.
 * - Collapses duplicate whitespace.
 * - Does NOT transliterate Hindi to Latin.
 *
 * @param {*} text
 * @returns {string} Normalized string
 */
export function normalizeSearchText(text) {
  if (text === null || text === undefined) {
    return '';
  }

  const str = String(text);
  if (str.trim() === '') {
    return '';
  }

  return str
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes a query string into individual normalized search terms.
 *
 * @param {string} query
 * @returns {string[]} Array of non-empty search terms
 */
export function tokenizeQuery(query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean);
}

/**
 * HTML Escaper to ensure complete XSS prevention before rendering any user content.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes characters for safe use in RegExp.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safely highlights matching query terms in text.
 * Escapes the input text first, then wraps matched terms in <mark class="search-highlight">.
 *
 * @param {string} text Raw text to highlight
 * @param {string} query Search query containing terms
 * @returns {string} Safe HTML string with highlights
 */
export function highlightMatches(text, query) {
  if (!text || typeof text !== 'string') return '';
  const escapedText = escapeHtml(text);

  const terms = tokenizeQuery(query);
  if (terms.length === 0) {
    return escapedText;
  }

  // Build pattern of escaped terms, sorted longest first to prevent partial clobbering
  const sortedTerms = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const patternParts = sortedTerms.map(term => escapeRegExp(escapeHtml(term)));
  if (patternParts.length === 0) return escapedText;

  const regex = new RegExp(`(${patternParts.join('|')})`, 'gi');
  return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Computes deterministic relevance score for a poem against query terms.
 *
 * Requirement: Multi-word query requires ALL terms to be present across
 * searchable fields (title, body, author, tags).
 *
 * Ranking priorities:
 * 1. Exact title match (highest)
 * 2. Title contains full query / terms
 * 3. Tag match
 * 4. Author match
 * 5. Body match
 *
 * @param {Object} poem
 * @param {string[]} terms
 * @param {string} normalizedQuery
 * @returns {{ matched: boolean, score: number, matchContext: string|null }}
 */
export function scorePoemMatch(poem, terms, normalizedQuery) {
  if (!poem || typeof poem !== 'object' || terms.length === 0) {
    return { matched: false, score: 0, matchContext: null };
  }

  const normTitle = normalizeSearchText(poem.title || '');
  const normBody = normalizeSearchText(poem.body || '');
  const normAuthor = normalizeSearchText(poem.author || '');
  const normTags = Array.isArray(poem.tags) ? poem.tags.map(t => normalizeSearchText(t)) : [];

  // 1. Verify that ALL terms exist somewhere in the poem's searchable fields
  for (const term of terms) {
    const inTitle = normTitle.includes(term);
    const inBody = normBody.includes(term);
    const inAuthor = normAuthor.includes(term);
    const inTags = normTags.some(tag => tag.includes(term));

    if (!inTitle && !inBody && !inAuthor && !inTags) {
      return { matched: false, score: 0, matchContext: null };
    }
  }

  // 2. All terms matched. Calculate deterministic relevance score.
  let score = 0;
  const matchFields = new Set();

  // Title scoring
  if (normTitle === normalizedQuery) {
    score += 1000; // Exact title match
    matchFields.add('title');
  } else if (normTitle.startsWith(normalizedQuery)) {
    score += 500; // Title prefix match
    matchFields.add('title');
  } else if (normTitle.includes(normalizedQuery)) {
    score += 300; // Title contains entire query
    matchFields.add('title');
  }

  terms.forEach(term => {
    if (normTitle.includes(term)) {
      score += 80;
      matchFields.add('title');
    }
  });

  // Tag scoring
  if (normTags.some(tag => tag === normalizedQuery)) {
    score += 200;
    matchFields.add('tag');
  } else if (normTags.some(tag => tag.includes(normalizedQuery))) {
    score += 100;
    matchFields.add('tag');
  }

  terms.forEach(term => {
    if (normTags.some(tag => tag.includes(term))) {
      score += 60;
      matchFields.add('tag');
    }
  });

  // Author scoring
  if (normAuthor === normalizedQuery) {
    score += 150;
    matchFields.add('author');
  } else if (normAuthor.includes(normalizedQuery)) {
    score += 80;
    matchFields.add('author');
  }

  terms.forEach(term => {
    if (normAuthor.includes(term)) {
      score += 40;
      matchFields.add('author');
    }
  });

  // Body scoring
  if (normBody.includes(normalizedQuery)) {
    score += 30;
    matchFields.add('body');
  }

  terms.forEach(term => {
    if (normBody.includes(term)) {
      score += 10;
      matchFields.add('body');
    }
  });

  // Determine primary match context indicator in Hindi
  let matchContext = 'कविता में मिला';
  if (matchFields.has('title')) {
    matchContext = 'शीर्षक में मिला';
  } else if (matchFields.has('tag')) {
    matchContext = 'टैग में मिला';
  } else if (matchFields.has('author')) {
    matchContext = 'रचनाकार में मिला';
  }

  return { matched: true, score, matchContext };
}

/**
 * Searches a collection of poems using deterministic matching and ranking.
 *
 * @param {Array<Object>} poems List of poems from repository
 * @param {string} query Search input string
 * @returns {{ results: Array<{ poem: Object, score: number, matchContext: string }>, query: string, totalCount: number }}
 */
export function searchPoems(poems, query) {
  if (!Array.isArray(poems)) {
    return { results: [], query: '', totalCount: 0 };
  }

  const normalizedQuery = normalizeSearchText(query);
  const terms = tokenizeQuery(query);

  if (terms.length === 0 || !normalizedQuery) {
    return { results: [], query: '', totalCount: 0 };
  }

  const matches = [];

  for (const poem of poems) {
    const match = scorePoemMatch(poem, terms, normalizedQuery);
    if (match.matched) {
      matches.push({
        poem,
        score: match.score,
        matchContext: match.matchContext
      });
    }
  }

  // Sort deterministically:
  // 1. Relevance score descending
  // 2. For equal scores, updatedAt descending (newest first)
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const timeA = new Date(a.poem.updatedAt || a.poem.createdAt || 0).getTime();
    const timeB = new Date(b.poem.updatedAt || b.poem.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return {
    results: matches,
    query: normalizedQuery,
    totalCount: matches.length
  };
}
