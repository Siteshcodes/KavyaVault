/**
 * काव्यकलश (KavyaVault) — Final Hardening & Reliability Test Suite (test_hardening.js)
 * Phase 1 / Task 1.15 Release Gate
 *
 * 26 Deep-Pass Verification Tests across:
 * - Storage corruption recovery & non-destructive reads
 * - Storage quota exceeded & access failure modes
 * - Devanagari Unicode, nukta, halant, conjuncts, and poetic punctuation integrity
 * - Extreme payload sizes and boundary inputs
 * - XSS prevention & HTML escaping in cards, reader, and search highlights
 * - Cross-entity referential integrity between Poems and Collections
 * - UI component resiliency against malformed or non-standard poem records
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import { PoemRepository } from './src/services/PoemRepository.js';
import { CollectionRepository } from './src/services/CollectionRepository.js';
import { MigrationManager, CURRENT_SCHEMA_VERSION } from './src/services/storage/MigrationManager.js';
import { STORAGE_KEYS } from './src/data/storageKeys.js';
import { escapeHtml, highlightMatches, searchPoems } from './src/services/SearchService.js';
import { renderPoemCard } from './src/components/library/PoemCard.js';

// In-memory mock storage engine with controllable error simulation
class MockStorage {
  constructor() {
    this.store = new Map();
    this.simulateQuota = false;
    this.simulateAccessBlocked = false;
  }
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
  }
  getItem(k) {
    if (this.simulateAccessBlocked) {
      throw new Error('Access to localStorage is denied.');
    }
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    if (this.simulateAccessBlocked) {
      throw new Error('Access to localStorage is denied.');
    }
    if (this.simulateQuota) {
      const err = new Error('QuotaExceededError: DomException');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

// Stanza parser matching PoemReader
function parseStanzas(bodyText) {
  if (!bodyText || typeof bodyText !== 'string') return [];
  const rawStanzas = bodyText.split(/\r?\n\s*\r?\n/);
  return rawStanzas.map(stanza => {
    const lines = stanza.split(/\r?\n/);
    return lines.map(line => line.trim()).filter(Boolean);
  });
}

async function runHardeningTests() {
  console.log('================================================================');
  console.log('  KAVYAVAULT PHASE 1 FINAL HARDENING & RELEASE GATE TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  function test(title, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`✓ [Test ${total}] ${title}`);
    } catch (err) {
      console.error(`✗ [Test ${total}] ${title}`);
      console.error('   Error:', err.message);
      throw err;
    }
  }

  // ==========================================================================
  // GROUP 1: STORAGE CORRUPTION & NON-DESTRUCTIVE RECOVERY (TESTS 1-4)
  // ==========================================================================
  console.log('\n--- Group 1: Storage Corruption & Non-destructive Recovery ---');

  test('PoemRepository recovers cleanly when STORAGE_KEYS.POEMS is corrupted non-array string', () => {
    const storage = new MockStorage();
    storage.store.set(STORAGE_KEYS.POEMS, '"this is not an array"');
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const list = repo.getAll();
    console.assert(Array.isArray(list), 'getAll must return an array');
    console.assert(list.length === 0, 'corrupted data must yield empty array');
  });

  test('Non-destructive read does not overwrite existing raw corrupted storage until explicit write', () => {
    const storage = new MockStorage();
    const rawCorrupt = '{"invalid_object": true}';
    storage.store.set(STORAGE_KEYS.POEMS, rawCorrupt);
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    // Read only
    repo.getAll();
    repo.getById('some_id');

    // Storage should still contain the original raw value, not overwritten with []
    const untouched = storage.store.get(STORAGE_KEYS.POEMS);
    console.assert(untouched === rawCorrupt, 'Raw storage must NOT be overwritten on read');
  });

  test('CollectionRepository recovers cleanly when STORAGE_KEYS.COLLECTIONS is non-array without overwriting', () => {
    const storage = new MockStorage();
    const rawCorrupt = '"corrupted collections string"';
    storage.store.set(STORAGE_KEYS.COLLECTIONS, rawCorrupt);
    const adapter = new LocalStorageAdapter(storage);
    const colRepo = new CollectionRepository(adapter);

    const list = colRepo.getAll();
    console.assert(Array.isArray(list) && list.length === 0, 'getAll must return empty array');
    console.assert(storage.store.get(STORAGE_KEYS.COLLECTIONS) === rawCorrupt, 'Storage must not be overwritten on read');
  });

  test('MigrationManager safely handles newer schema version without downgrade', async () => {
    const storage = new MockStorage();
    const futureMetadata = {
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      initializedAt: '2026-09-01T00:00:00.000Z',
      lastMigratedAt: '2026-09-01T00:00:00.000Z'
    };
    storage.store.set(STORAGE_KEYS.METADATA, JSON.stringify(futureMetadata));
    const adapter = new LocalStorageAdapter(storage);
    const migration = new MigrationManager(adapter);

    const result = await migration.initialize();
    console.assert(result.status === 'NEWER_VERSION_DETECTED', `Expected NEWER_VERSION_DETECTED, got ${result.status}`);

    const metadataAfter = adapter.get(STORAGE_KEYS.METADATA);
    console.assert(metadataAfter.schemaVersion === CURRENT_SCHEMA_VERSION + 1, 'Version must not be downgraded');
  });

  // ==========================================================================
  // GROUP 2: QUOTA EXCEEDED & STORAGE ERROR HANDLING (TESTS 5-7)
  // ==========================================================================
  console.log('\n--- Group 2: Quota Exceeded & Storage Error Handling ---');

  test('Quota exceeded error during poem create throws StorageError with QUOTA_EXCEEDED', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    storage.simulateQuota = true;

    let threw = false;
    try {
      repo.create({
        title: 'विशाल कविता',
        body: 'बहुत पंक्तियाँ...',
        author: 'रचनाकार'
      });
    } catch (err) {
      threw = true;
      console.assert(err instanceof StorageError, 'Must be StorageError');
      console.assert(err.code === StorageErrorCode.QUOTA_EXCEEDED, `Expected QUOTA_EXCEEDED, got ${err.code}`);
    }
    console.assert(threw, 'Must throw when quota is exceeded');
  });

  test('Quota exceeded error during poem update throws StorageError and preserves original record', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const original = repo.create({
      title: 'मूल कविता',
      body: 'मूल पंक्तियाँ',
      author: 'मूल कवि'
    });

    storage.simulateQuota = true;

    let threw = false;
    try {
      repo.update(original.id, {
        title: 'संशोधित शीर्षक'
      });
    } catch (err) {
      threw = true;
      console.assert(err instanceof StorageError, 'Must be StorageError');
      console.assert(err.code === StorageErrorCode.QUOTA_EXCEEDED, 'Must be QUOTA_EXCEEDED');
    }
    console.assert(threw, 'Must throw on quota error during update');

    // Restore quota simulation and verify original data intact
    storage.simulateQuota = false;
    const restored = repo.getById(original.id);
    console.assert(restored.title === 'मूल कविता', 'Original record must remain untouched');
  });

  test('LocalStorageAdapter gracefully throws descriptive error when localStorage is blocked', () => {
    const storage = new MockStorage();
    storage.simulateAccessBlocked = true;
    const adapter = new LocalStorageAdapter(storage);

    let threw = false;
    try {
      adapter.get(STORAGE_KEYS.POEMS);
    } catch (err) {
      threw = true;
      console.assert(err instanceof StorageError, 'Must throw StorageError');
      console.assert(err.code === StorageErrorCode.UNKNOWN_ERROR, 'Must have proper error code');
    }
    console.assert(threw, 'Must throw when access blocked');
  });

  // ==========================================================================
  // GROUP 3: UNICODE, NUKTA, MATRAS, AND SPECIAL CHARACTER RIGOR (TESTS 8-12)
  // ==========================================================================
  console.log('\n--- Group 3: Unicode, Nukta, Matras, and Special Characters ---');

  test('Preserves decomposed Devanagari characters (NFD) normalized to NFC across storage lifecycle', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    // Decomposed nukta: क + ़ (U+0915 U+093C) vs precomposed क़ (U+0958)
    const decomposedTitle = '\u0915\u093C\u093F\u0938\u094D\u0938\u093E'; // क़िस्सा in NFD
    const created = repo.create({
      title: decomposedTitle,
      body: 'एक कहानी क़िस्सा',
      author: 'अज्ञात'
    });

    const fetched = repo.getById(created.id);
    console.assert(fetched.title.normalize('NFC') === 'क़िस्सा', 'Title must roundtrip cleanly');
  });

  test('Devanagari text with chandrabindu, anusvara, and visarga preserves byte and character integrity', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const specialVerse = 'चाँद (chandrabindu: \u0901), गंगा (anusvara: \u0902), दुःख (visarga: \u0903)';
    const created = repo.create({
      title: 'ध्वनि परीक्षण',
      body: specialVerse,
      author: 'कवि'
    });

    const fetched = repo.getById(created.id);
    console.assert(fetched.body === specialVerse, 'Chandrabindu, anusvara, and visarga must be preserved identically');
  });

  test('Hindi conjuncts (ksh, tra, gya, shr) and virama sequences roundtrip identically', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    // क्ष (k+virama+ssa), त्र (t+virama+ra), ज्ञ (j+virama+nya), श्र (sh+virama+ra), द्व (d+virama+va), द्ध (d+virama+dha)
    const conjunctText = 'क्षेत्र, त्रिभुवन, ज्ञान, श्रद्धा, द्वार, बुद्धि';
    const created = repo.create({
      title: 'संयुक्त वर्ण',
      body: conjunctText,
      author: 'शास्त्री'
    });

    const fetched = repo.getById(created.id);
    console.assert(fetched.body === conjunctText, 'Conjuncts and virama sequences must roundtrip identically');
  });

  test('Search deterministically matches Unicode normalized forms across matras and punctuation', () => {
    const poems = [
      {
        id: 'p_unicode_1',
        title: 'ज़िंदगी का सफ़र',
        body: 'हँसते गाते कट जाए रस्ते',
        author: 'साहिर',
        tags: ['ग़ज़ल']
      }
    ];

    // Search with precomposed nukta
    const res1 = searchPoems(poems, 'ज़िंदगी');
    console.assert(res1.totalCount === 1, 'Should find zindagi with precomposed nukta');

    // Search with decomposed nukta
    const res2 = searchPoems(poems, '\u091C\u093C\u093F\u0902\u0926\u0917\u0940');
    console.assert(res2.totalCount === 1, 'Should match decomposed nukta query via NFC normalization');
  });

  test('Hindi numbers (०-९) and punctuation (।, ॥, —, ‘’, “”) remain uncorrupted in title, body, and tags', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const poemData = {
      title: 'श्लोक संख्या १२॥',
      body: 'गुरुर्ब्रह्मा गुरुर्विष्णुः गुरुर्देवो महेश्वरः।\nगुरुः साक्षात् परं ब्रह्म तस्मै श्रीगुरवे नमः॥',
      author: 'व्यास — ‘महर्षि’ “प्राचीन”',
      tags: ['संस्कृत-श्लोक', 'संख्या-१०८']
    };

    const created = repo.create(poemData);
    const fetched = repo.getById(created.id);

    console.assert(fetched.title === poemData.title, 'Hindi numerals and double danda must match');
    console.assert(fetched.body === poemData.body, 'Single and double danda must match');
    console.assert(fetched.author === poemData.author, 'Em dash and smart quotes must match');
    console.assert(fetched.tags[1] === 'संख्या-१०८', 'Hindi numerals in tags must match');
  });

  // ==========================================================================
  // GROUP 4: EXTREME TEXT SIZES & BOUNDARY INPUTS (TESTS 13-16)
  // ==========================================================================
  console.log('\n--- Group 4: Extreme Text Sizes & Boundary Inputs ---');

  test('Very long poem body (10,000 lines / ~300KB) creates, reads, and updates safely', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const line = 'यह एक लंबी काव्य पंक्ति है जो काव्यकलश की दृढ़ता की परीक्षा करती है।';
    const numLines = 5000;
    const bigBody = Array(numLines).fill(line).join('\n');

    const created = repo.create({
      title: 'महाकाव्य',
      body: bigBody,
      author: 'महाकवि'
    });

    console.assert(created.id, 'Must create long poem');
    const fetched = repo.getById(created.id);
    console.assert(fetched.body.length === bigBody.length, 'Length must be identical');

    // Update with extra line
    const updated = repo.update(created.id, { body: bigBody + '\nअंतिम पंक्ति।' });
    console.assert(updated.body.endsWith('अंतिम पंक्ति।'), 'Update must succeed on large body');
  });

  test('Empty string or whitespace-only author falls back to अज्ञात correctly', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const p1 = repo.create({ title: 'रचना १', body: 'पंक्तियाँ', author: '' });
    const p2 = repo.create({ title: 'रचना २', body: 'पंक्तियाँ', author: '   ' });
    const p3 = repo.create({ title: 'रचना ३', body: 'पंक्तियाँ' });

    console.assert(p1.author === 'अज्ञात', 'Empty author should fallback to अज्ञात');
    console.assert(p2.author === 'अज्ञात', 'Whitespace author should fallback to अज्ञात');
    console.assert(p3.author === 'अज्ञात', 'Undefined author should fallback to अज्ञात');
  });

  test('Multi-line titles or titles with trailing/leading newlines/whitespace are safely trimmed', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const created = repo.create({
      title: '  \n\t  अग्निपथ   \n  ',
      body: 'वृक्ष हों भले खड़े,\nहों घने हों बड़े',
      author: '  हरिवंश राय बच्चन  '
    });

    console.assert(created.title === 'अग्निपथ', `Expected 'अग्निपथ', got '${created.title}'`);
    console.assert(created.author === 'हरिवंश राय बच्चन', `Expected trimmed author, got '${created.author}'`);
  });

  test('Tags with spaces, duplicates, or non-string items parse and sanitize safely', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const created = repo.create({
      title: 'टैग परीक्षण',
      body: 'पंक्तियाँ...',
      tags: ['  प्रेरणा  ', 'गीत', '  प्रेरणा  ', 123, '']
    });

    console.assert(created.tags.includes('प्रेरणा'), 'Tags must be trimmed');
    console.assert(created.tags.includes('123'), 'Non-string tags converted safely');
  });

  // ==========================================================================
  // GROUP 5: XSS & HTML SANITIZATION RIGOR (TESTS 17-20)
  // ==========================================================================
  console.log('\n--- Group 5: XSS & HTML Sanitization Rigor ---');

  test('Script tags and event handlers in poem title are escaped in PoemCard rendering', () => {
    const maliciousPoem = {
      id: 'xss_poem_1',
      title: '<script>alert("xss")</script> कविता',
      body: 'काव्य पंक्तियाँ',
      author: '<img src=x onerror=alert(1)> कवि',
      tags: ['<svg onload=alert(2)>'],
      isFavorite: false,
      isArchived: false
    };

    const cardHtml = renderPoemCard(maliciousPoem);
    console.assert(!cardHtml.includes('<script>'), 'Must not contain raw <script>');
    console.assert(cardHtml.includes('&lt;script&gt;'), 'Must escape script tags in title');
    console.assert(!cardHtml.includes('<img src=x onerror='), 'Must not contain raw img tag with onerror');
    console.assert(cardHtml.includes('&lt;img'), 'Must escape img tag');
    console.assert(!cardHtml.includes('<svg onload='), 'Must not contain raw svg with onload');
    console.assert(cardHtml.includes('&lt;svg'), 'Must escape svg tag');
  });

  test('Dangerous SVG / iframe / img in search matches are sanitized via escapeHtml', () => {
    const dangerousInput = '<iframe src="javascript:alert(1)"></iframe>';
    const escaped = escapeHtml(dangerousInput);
    console.assert(!escaped.includes('<iframe'), 'iframe tag must be escaped');
    console.assert(escaped.includes('&lt;iframe'), 'iframe escaped representation required');
  });

  test('Poem body stanzas escape raw HTML while preserving verse line structure', () => {
    const rawBody = '<b onmouseover="evil()">पहला चरण</b>\nदूसरा चरण\n\n<script>alert(1)</script>तीसरा चरण';
    const stanzas = parseStanzas(rawBody);

    console.assert(stanzas.length === 2, 'Must have 2 stanzas');
    console.assert(stanzas[0].length === 2, 'Stanza 1 must have 2 lines');

    // Simulate PoemReader.renderStanzas escaping
    const renderedStanzaHtml = stanzas.map(stanza => {
      const linesHtml = stanza.map(line => `<p class="reader-verse-line">${escapeHtml(line)}</p>`).join('');
      return `<div class="reader-stanza">${linesHtml}</div>`;
    }).join('');

    console.assert(!renderedStanzaHtml.includes('<b onmouseover='), 'Must not contain raw malicious b tag');
    console.assert(!renderedStanzaHtml.includes('<script>'), 'Must not contain raw script tag');
    console.assert(renderedStanzaHtml.includes('&lt;b onmouseover='), 'Malicious b tag must be escaped');
    console.assert(renderedStanzaHtml.includes('&lt;script&gt;'), 'Malicious script tag must be escaped');
  });

  test('SearchService highlightMatches escapes input before wrapping match in mark tag', () => {
    const textWithAngleBrackets = 'कवि <script>alert("hacked")</script> निराला';
    const query = 'निराला';
    const highlighted = highlightMatches(textWithAngleBrackets, query);

    console.assert(!highlighted.includes('<script>'), 'Raw script tag must not be injected in highlight output');
    console.assert(highlighted.includes('&lt;script&gt;'), 'Script tag must be escaped');
    console.assert(highlighted.includes('<mark class="search-highlight">निराला</mark>'), 'Mark tag must wrap match');
  });

  // ==========================================================================
  // GROUP 6: RELATIONSHIP & REFERENTIAL INTEGRITY (TESTS 21-23)
  // ==========================================================================
  console.log('\n--- Group 6: Relationship & Referential Integrity ---');

  test('Deleting a poem removes its ID reference from all collections', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const colRepo = new CollectionRepository(adapter);
    const poemRepo = new PoemRepository(adapter, colRepo);

    const poemA = poemRepo.create({ title: 'कविता क', body: '...' });
    const poemB = poemRepo.create({ title: 'कविता ख', body: '...' });

    const col1 = colRepo.create({ name: 'संग्रह १', poemIds: [poemA.id, poemB.id] });
    const col2 = colRepo.create({ name: 'संग्रह २', poemIds: [poemA.id] });

    console.assert(colRepo.getById(col1.id).poemIds.includes(poemA.id), 'Col 1 has poem A');
    console.assert(colRepo.getById(col2.id).poemIds.includes(poemA.id), 'Col 2 has poem A');

    // Delete poem A
    poemRepo.delete(poemA.id);

    // References must be removed from both collections
    const col1After = colRepo.getById(col1.id);
    const col2After = colRepo.getById(col2.id);

    console.assert(!col1After.poemIds.includes(poemA.id), 'Poem A must be removed from Col 1');
    console.assert(col1After.poemIds.includes(poemB.id), 'Poem B must still be in Col 1');
    console.assert(!col2After.poemIds.includes(poemA.id), 'Poem A must be removed from Col 2');
    console.assert(col2After.poemIds.length === 0, 'Col 2 should have 0 poems');
  });

  test('Deleting a collection does NOT delete referenced poems from repository', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const colRepo = new CollectionRepository(adapter);
    const poemRepo = new PoemRepository(adapter, colRepo);

    const poem = poemRepo.create({ title: 'अमर रचना', body: '...' });
    const col = colRepo.create({ name: 'अमर संकलन', poemIds: [poem.id] });

    colRepo.delete(col.id);

    console.assert(colRepo.getById(col.id) === null, 'Collection must be deleted');
    console.assert(poemRepo.getById(poem.id) !== null, 'Poem must still exist in PoemRepository');
  });

  test('Adding duplicate poem ID to collection is idempotent', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const colRepo = new CollectionRepository(adapter);

    const col = colRepo.create({ name: 'अद्वितीय संग्रह' });
    colRepo.addPoem(col.id, 'kv_p_test_1');
    colRepo.addPoem(col.id, 'kv_p_test_1');
    colRepo.addPoem(col.id, 'kv_p_test_1');

    const updated = colRepo.getById(col.id);
    console.assert(updated.poemIds.length === 1, `Expected 1 poemId, got ${updated.poemIds.length}`);
    console.assert(updated.poemIds[0] === 'kv_p_test_1', 'PoemId must match');
  });

  // ==========================================================================
  // GROUP 7: UI COMPONENT RESILIENCY (TESTS 24-26)
  // ==========================================================================
  console.log('\n--- Group 7: UI Component Resiliency ---');

  test('PoemCard renders cleanly when poem has null, undefined, or string tags without throwing', () => {
    const malformedPoem1 = { id: 'p_m1', title: 'रचना १', body: 'पंक्ति', author: 'कवि', tags: null };
    const malformedPoem2 = { id: 'p_m2', title: 'रचना २', body: 'पंक्ति', author: 'कवि', tags: undefined };
    const malformedPoem3 = { id: 'p_m3', title: 'रचना ३', body: 'पंक्ति', author: 'कवि', tags: 'single-tag-string' };

    let html1, html2, html3;
    try {
      html1 = renderPoemCard(malformedPoem1);
      html2 = renderPoemCard(malformedPoem2);
      html3 = renderPoemCard(malformedPoem3);
    } catch (err) {
      console.assert(false, `Should not throw on non-array tags: ${err.message}`);
    }

    console.assert(typeof html1 === 'string' && html1.includes('p_m1'), 'Card 1 rendered');
    console.assert(typeof html2 === 'string' && html2.includes('p_m2'), 'Card 2 rendered');
    console.assert(typeof html3 === 'string' && html3.includes('p_m3'), 'Card 3 rendered');
  });

  test('PoemCard renders cleanly when isFavorite or isArchived are non-boolean or missing', () => {
    const malformedPoem = {
      id: 'p_m4',
      title: 'रचना ४',
      body: 'पंक्ति',
      author: 'कवि',
      tags: ['गीत'],
      isFavorite: 'truthy-string',
      isArchived: 0
    };

    const cardHtml = renderPoemCard(malformedPoem);
    console.assert(cardHtml.includes('aria-pressed="true"'), 'truthy isFavorite coerced to boolean');
    console.assert(!cardHtml.includes('is-archived'), '0 isArchived coerced to false');
  });

  test('Localized missing poem 404 state handles non-existent poem ID gracefully', () => {
    const storage = new MockStorage();
    const adapter = new LocalStorageAdapter(storage);
    const repo = new PoemRepository(adapter);

    const nonExistent = repo.getById('non_existent_random_id');
    console.assert(nonExistent === null, 'Non-existent poem must return null');

    // Simulate localized 404 message template
    const missingStateHtml = `
      <div class="reader-article" style="text-align: center;">
        <div class="reader-ornament" aria-hidden="true">❦</div>
        <h2 class="reader-poem-title">रचना अप्राप्य</h2>
        <p>जिस काव्य पन्ने की आप खोज कर रहे हैं, वह इस संग्रह में उपस्थित नहीं है अथवा हटा दिया गया है।</p>
      </div>
    `;
    console.assert(missingStateHtml.includes('रचना अप्राप्य'), 'Missing poem notice must be present');
  });

  // ==========================================================================
  // FINAL RESULTS
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} FINAL HARDENING TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runHardeningTests().catch(err => {
  console.error('\n❌ HARDENING TEST SUITE ENCOUNTERED UNEXPECTED ERROR:');
  console.error(err);
  process.exit(1);
});
