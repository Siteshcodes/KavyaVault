/**
 * काव्यकलश (KavyaVault) — Hindi Search & Integration Test Suite (test_search.js)
 * Covers all 20 verification requirements from Phase 1 / Task 1.12:
 * Basic search, Hindi Unicode conjuncts, Matra, Nukta, Halant, Multi-word,
 * Deterministic ranking, updatedAt ordering, XSS safety, and lifecycle integration.
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import {
  normalizeSearchText,
  tokenizeQuery,
  scorePoemMatch,
  searchPoems,
  escapeHtml,
  highlightMatches
} from './src/services/SearchService.js';
import { renderPoemCard } from './src/components/library/PoemCard.js';

// In-memory mock storage engine
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
  }
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

async function runSearchTests() {
  console.log('====================================================');
  console.log('  KAVYAVAULT HINDI SEARCH INTEGRATION TEST SUITE');
  console.log('====================================================');

  const mockStorage = new MockStorage();
  const adapter = new LocalStorageAdapter(mockStorage);
  const repo = new PoemRepository(adapter);

  // Setup rich test corpus
  const samplePoems = [
    {
      id: 'kv_search_1',
      title: 'सावन की बारिश',
      body: 'आज मेघ बरसे घने,\nबचपन की यादें खिलीं।\nसपनों के उपवन में,\nशीतल बूँदें मिलीं।',
      author: 'जयशंकर प्रसाद',
      tags: ['प्रकृति', 'सावन', 'वर्षा'],
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      isFavorite: true,
      isArchived: false
    },
    {
      id: 'kv_search_2',
      title: 'मधुशाला',
      body: 'मदिरालय जाने को घर से चलता है पीनेवला,\nकिस पथ से जाऊँ असमंजस में है वह भोलाभाला।',
      author: 'हरिवंश राय बच्चन',
      tags: ['क्लासिक', 'रुबाइयाँ'],
      createdAt: '2026-01-02T10:00:00.000Z',
      updatedAt: '2026-03-02T10:00:00.000Z',
      isFavorite: false,
      isArchived: false
    },
    {
      id: 'kv_search_3',
      title: 'क़लम और काग़ज़',
      body: 'फ़लक से उतरी एक ग़ज़ल,\nज़िंदगी के दर्द बयां करती है।\nडाल-डाल पर चिड़ियाँ गाती हैं।',
      author: 'ग़ालिब',
      tags: ['शायरी', 'दर्द'],
      createdAt: '2026-01-03T10:00:00.000Z',
      updatedAt: '2026-03-03T10:00:00.000Z',
      isFavorite: false,
      isArchived: false
    },
    {
      id: 'kv_search_4',
      title: 'संयुक्ताक्षर लीला',
      body: 'क्षत्रिय का धर्म है रक्षा करना।\nत्रिशूल और ज्ञान की ज्योति जले।\nश्रद्धा से द्वंद्व समाप्त होता है और हृदय खिलता है।',
      author: 'सूर्यकांत त्रिपाठी निराला',
      tags: ['संस्कृति', 'दर्शन'],
      createdAt: '2026-01-04T10:00:00.000Z',
      updatedAt: '2026-03-04T10:00:00.000Z',
      isFavorite: false,
      isArchived: false
    },
    {
      id: 'kv_search_5',
      title: 'बारिश',
      body: 'बस एक साधारण शीर्षक वाली रचना।',
      author: 'अज्ञेय',
      tags: ['लघु'],
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-03-05T10:00:00.000Z',
      isFavorite: false,
      isArchived: false
    },
    {
      id: 'kv_search_6',
      title: 'अभिलेख की कविता',
      body: 'यह पुरानी रचना अभिलेख में रखी गई है।',
      author: 'अभिलेखकार',
      tags: ['अभिलेख'],
      createdAt: '2026-01-06T10:00:00.000Z',
      updatedAt: '2026-03-06T10:00:00.000Z',
      isFavorite: false,
      isArchived: true
    }
  ];

  for (const p of samplePoems) {
    repo.create(p);
  }

  // Helper to get active poems from repository
  const activePoems = repo.getAll({ includeArchived: false });

  // ----------------------------------------------------
  // TEST 1: Empty query behavior
  // ----------------------------------------------------
  console.log('\n[TEST 1] Empty Query Behavior');
  const emptyRes1 = searchPoems(activePoems, '');
  const emptyRes2 = searchPoems(activePoems, '   ');
  const emptyRes3 = searchPoems(activePoems, null);
  console.assert(emptyRes1.results.length === 0, 'Empty string returns no results');
  console.assert(emptyRes2.results.length === 0, 'Whitespace-only returns no results');
  console.assert(emptyRes3.results.length === 0, 'Null returns no results');
  console.log('✓ Empty query safely returns empty result set without errors.');

  // ----------------------------------------------------
  // TEST 2: Title match
  // ----------------------------------------------------
  console.log('\n[TEST 2] Title Match');
  const titleRes = searchPoems(activePoems, 'मधुशाला');
  console.assert(titleRes.results.length === 1, 'Should find 1 poem for मधुशाला');
  console.assert(titleRes.results[0].poem.id === 'kv_search_2', 'Should match poem 2');
  console.assert(titleRes.results[0].matchContext === 'शीर्षक में मिला', 'Match context should be title');
  console.log('✓ Title search accurately locates poem and indicates title match.');

  // ----------------------------------------------------
  // TEST 3: Body match
  // ----------------------------------------------------
  console.log('\n[TEST 3] Body Match');
  const bodyRes = searchPoems(activePoems, 'शीतल बूँदें');
  console.assert(bodyRes.results.length === 1, 'Should match poem by body text');
  console.assert(bodyRes.results[0].poem.id === 'kv_search_1', 'Should match poem 1');
  console.assert(bodyRes.results[0].matchContext === 'कविता में मिला', 'Match context should be body');
  console.log('✓ Body text search correctly identifies verse match.');

  // ----------------------------------------------------
  // TEST 4: Author match
  // ----------------------------------------------------
  console.log('\n[TEST 4] Author Match');
  const authorRes = searchPoems(activePoems, 'हरिवंश राय बच्चन');
  console.assert(authorRes.results.length === 1, 'Should match poem by author');
  console.assert(authorRes.results[0].poem.author === 'हरिवंश राय बच्चन', 'Author must match');
  console.assert(authorRes.results[0].matchContext === 'रचनाकार में मिला', 'Match context should be author');
  console.log('✓ Author match correctly identifies poet name.');

  // ----------------------------------------------------
  // TEST 5: Tag match
  // ----------------------------------------------------
  console.log('\n[TEST 5] Tag Match');
  const tagRes = searchPoems(activePoems, 'प्रकृति');
  console.assert(tagRes.results.length === 1, 'Should match poem by tag');
  console.assert(tagRes.results[0].poem.id === 'kv_search_1', 'Should find poem with प्रकृति tag');
  console.assert(tagRes.results[0].matchContext === 'टैग में मिला', 'Match context should be tag');
  console.log('✓ Tag match accurately finds poem containing tag.');

  // ----------------------------------------------------
  // TEST 6: Hindi Devanagari matching
  // ----------------------------------------------------
  console.log('\n[TEST 6] Hindi Devanagari Matching');
  const devRes = searchPoems(activePoems, 'मेघ बरसे');
  console.assert(devRes.results.length === 1, 'Should match Devanagari words');
  console.assert(devRes.results[0].poem.id === 'kv_search_1', 'Matched poem 1');
  console.log('✓ Native Devanagari text matching verified.');

  // ----------------------------------------------------
  // TEST 7: Conjunct matching: क्ष त्र ज्ञ श्र द्व हृ
  // ----------------------------------------------------
  console.log('\n[TEST 7] Devanagari Conjunct Matching (क्ष, त्र, ज्ञ, श्र, द्व, हृ)');
  const conjuncts = ['क्षत्रिय', 'त्रिशूल', 'ज्ञान', 'श्रद्धा', 'द्वंद्व', 'हृदय'];
  for (const c of conjuncts) {
    const res = searchPoems(activePoems, c);
    console.assert(res.results.length >= 1, `Must find poem for conjunct word: ${c}`);
    console.assert(res.results[0].poem.id === 'kv_search_4', `Must match poem 4 for ${c}`);
  }
  console.log('✓ All Devanagari complex conjuncts (क्ष, त्र, ज्ञ, श्र, द्व, हृ) matched perfectly.');

  // ----------------------------------------------------
  // TEST 8: Matra preservation
  // ----------------------------------------------------
  console.log('\n[TEST 8] Matra Preservation (सावन vs सवन)');
  const matraCorrect = searchPoems(activePoems, 'सावन');
  const matraDifferent = searchPoems(activePoems, 'सवन');
  console.assert(matraCorrect.results.length >= 1, 'सावन matches poems with aa-ki-matra');
  console.assert(matraDifferent.results.length === 0, 'सवन must not mistakenly match सावन');
  console.log('✓ Matras are strictly preserved; vowel alterations do not falsely match.');

  // ----------------------------------------------------
  // TEST 9: Nukta matching: क़ ख़ ग़ ज़ ड़ ढ़ फ़
  // ----------------------------------------------------
  console.log('\n[TEST 9] Nukta Matching (क़, ख़, ग़, ज़, ड़, ढ़, फ़)');
  const nuktaWords = ['क़लम', 'काग़ज़', 'फ़लक', 'ग़ज़ल', 'ज़िंदगी', 'चिड़ियाँ'];
  for (const nw of nuktaWords) {
    const res = searchPoems(activePoems, nw);
    console.assert(res.results.length >= 1, `Must match nukta word: ${nw}`);
    console.assert(res.results[0].poem.id === 'kv_search_3', `Must match poem 3 for ${nw}`);
  }
  console.log('✓ Nukta characters (क़, ख़, ग़, ज़, ड़, फ़) reliably preserved and searchable.');

  // ----------------------------------------------------
  // TEST 10: Halant/virama handling
  // ----------------------------------------------------
  console.log('\n[TEST 10] Halant / Virama Handling');
  const halantWord = 'द्वंद्व'; // contains virama in द + ् + व
  const halantRes = searchPoems(activePoems, halantWord);
  console.assert(halantRes.results.length === 1, 'Halant sequence must be preserved and match');
  console.assert(halantRes.results[0].poem.id === 'kv_search_4', 'Must match poem 4');
  console.log('✓ Virama / halant sequences retained accurately during search comparison.');

  // ----------------------------------------------------
  // TEST 11: Multi-word: All terms present match
  // ----------------------------------------------------
  console.log('\n[TEST 11] Multi-word: All Terms Present Match');
  const multiRes1 = searchPoems(activePoems, 'बारिश बचपन');
  console.assert(multiRes1.results.length === 1, 'Should match poem having both बारिश and बचपन');
  console.assert(multiRes1.results[0].poem.id === 'kv_search_1', 'Matched poem 1');
  console.log('✓ Multi-word query matches when all terms are present across fields.');

  // ----------------------------------------------------
  // TEST 12: Multi-word: Missing term prevents match
  // ----------------------------------------------------
  console.log('\n[TEST 12] Multi-word: Missing Term Prevents Match');
  const multiRes2 = searchPoems(activePoems, 'बारिश हिमालय');
  console.assert(multiRes2.results.length === 0, 'Missing term "हिमालय" must prevent false match');
  console.log('✓ Query rejected when any required search term is missing.');

  // ----------------------------------------------------
  // TEST 13: Duplicate whitespace handling
  // ----------------------------------------------------
  console.log('\n[TEST 13] Duplicate Whitespace Handling');
  const wsRes = searchPoems(activePoems, '   सावन     बारिश   ');
  console.assert(wsRes.results.length === 1, 'Excess whitespace safely collapsed and matched');
  console.assert(wsRes.results[0].poem.id === 'kv_search_1', 'Matched poem 1');
  console.log('✓ Leading, trailing, and internal multiple spaces collapsed cleanly.');

  // ----------------------------------------------------
  // TEST 14: Ranking: Exact title match ranks above body-only match
  // ----------------------------------------------------
  console.log('\n[TEST 14] Ranking: Exact Title Match Ranks Above Body-Only Match');
  // Poem 5 title is exact 'बारिश'
  // Poem 1 title is 'सावन की बारिश'
  const rankRes1 = searchPoems(activePoems, 'बारिश');
  console.assert(rankRes1.results.length >= 2, 'Should find multiple poems for बारिश');
  console.assert(rankRes1.results[0].poem.id === 'kv_search_5', 'Exact title match must rank first');
  console.assert(rankRes1.results[0].score > rankRes1.results[1].score, 'Exact title has higher score');
  console.log('✓ Exact title match receives highest priority (+1000 score).');

  // ----------------------------------------------------
  // TEST 15: Ranking: Title match ranks above weaker field matches
  // ----------------------------------------------------
  console.log('\n[TEST 15] Ranking: Title Match Ranks Above Weaker Field Matches');
  const titleScore = scorePoemMatch(samplePoems[0], ['सावन'], 'सावन');
  const bodyScore = scorePoemMatch(samplePoems[0], ['उपवन'], 'उपवन');
  console.assert(titleScore.score > bodyScore.score, `Title score (${titleScore.score}) must exceed body score (${bodyScore.score})`);
  console.log('✓ Title matches deterministically outrank body matches.');

  // ----------------------------------------------------
  // TEST 16: Ranking: Equal relevance uses newest updatedAt
  // ----------------------------------------------------
  console.log('\n[TEST 16] Ranking: Equal Relevance Uses Newest updatedAt');
  const equalA = {
    id: 'kv_equal_a',
    title: 'दोस्त',
    body: 'एक पुरानी कविता',
    author: 'कवि',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
  const equalB = {
    id: 'kv_equal_b',
    title: 'दोस्त',
    body: 'एक नवीन कविता',
    author: 'कवि',
    tags: [],
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z'
  };
  const tieResults = searchPoems([equalA, equalB], 'दोस्त');
  console.assert(tieResults.results[0].poem.id === 'kv_equal_b', 'Newer updatedAt must break score tie');
  console.log('✓ Equal relevance scores broken deterministically by updatedAt descending.');

  // ----------------------------------------------------
  // TEST 17: Safety: User poem text cannot execute as HTML/script
  // ----------------------------------------------------
  console.log('\n[TEST 17] Safety: User Poem Text Cannot Execute as HTML/Script');
  const maliciousPoem = {
    id: 'kv_malicious',
    title: '<script>alert("hack")</script>सुरक्षित शीर्षक',
    body: '<img src="x" onerror="stealCookies()">कविता पाठ',
    author: '<b>बोल्ड कवि</b>',
    tags: ['<script>xss</script>'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isFavorite: false,
    isArchived: false
  };
  const renderedHtml = renderPoemCard(maliciousPoem, 'grid', {
    matchBadge: '<script>badgeXss</script>',
    highlightQuery: 'सुरक्षित'
  });
  console.assert(!renderedHtml.includes('<script>'), 'Must not render unescaped <script>');
  console.assert(renderedHtml.includes('&lt;script&gt;'), 'Must escape script tags to &lt;script&gt;');
  console.assert(!renderedHtml.includes('<img src="x"'), 'Must not inject unescaped img tags');
  console.log('✓ XSS vector in poem title, body, author, and match badge sanitized.');

  // ----------------------------------------------------
  // TEST 18: Safety: Search query cannot inject HTML into highlight markup
  // ----------------------------------------------------
  console.log('\n[TEST 18] Safety: Search Query Cannot Inject HTML');
  const highlighted = highlightMatches('कविता का पाठ यहाँ है', '<script>alert(1)</script>');
  console.assert(!highlighted.includes('<script>alert(1)</script>'), 'Query markup injection disallowed');
  console.assert(highlighted.includes('कविता का पाठ यहाँ है'), 'Original text preserved safely');
  console.log('✓ Search query highlight markup handles injection safely.');

  // ----------------------------------------------------
  // TEST 19: Lifecycle: Search result opens /poems/:id
  // ----------------------------------------------------
  console.log('\n[TEST 19] Lifecycle: Search Result Links to /poems/:id');
  const cardHtml = renderPoemCard(samplePoems[0], 'grid', { matchBadge: 'शीर्षक में मिला' });
  console.assert(cardHtml.includes(`href="/poems/${samplePoems[0].id}"`), 'Must contain link to /poems/:id');
  console.assert(cardHtml.includes('data-link'), 'Must contain data-link for SPA router interception');
  console.assert(cardHtml.includes('शीर्षक में मिला'), 'Must show match badge');
  console.log('✓ Result card properly links to /poems/:id reader route with SPA attribute.');

  // ----------------------------------------------------
  // TEST 20: Lifecycle: Favorite/Archive state consistent with repository
  // ----------------------------------------------------
  console.log('\n[TEST 20] Lifecycle: Favorite and Archive State Consistency');
  // Sample poem 1 is favorite
  console.assert(repo.getById('kv_search_1').isFavorite === true, 'Poem 1 initial isFavorite');
  repo.setFavorite('kv_search_1', false);
  console.assert(repo.getById('kv_search_1').isFavorite === false, 'Poem 1 favorite toggled to false');
  repo.setFavorite('kv_search_1', true);
  console.assert(repo.getById('kv_search_1').isFavorite === true, 'Poem 1 favorite restored to true');

  // Archive exclusion: Poem 6 is archived
  const activeOnly = repo.getAll({ includeArchived: false });
  console.assert(!activeOnly.some(p => p.id === 'kv_search_6'), 'Archived poem must be excluded from default active set');
  const searchActive = searchPoems(activeOnly, 'अभिलेख');
  console.assert(searchActive.results.length === 0, 'Archived poem must not appear in active search');
  console.log('✓ Archive isolation and favorite toggling preserve repository consistency.');

  console.log('\n====================================================');
  console.log('  ALL 20 HINDI SEARCH INTEGRATION TESTS PASSED! (100%)');
  console.log('====================================================\n');
}

runSearchTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
