/**
 * काव्यकलश (KavyaVault) — Typography & Devanagari Reading Validation Component
 * Diagnostic test view validating font stacks, matras, conjuncts, nuktas,
 * line wrapping, and multi-stanza vertical rhythm.
 */

import './typography-test.css';

export function renderTypographyTest() {
  // 1. Conjunct test data
  const conjuncts = [
    { char: 'क्ष', label: 'ksha (क्+ष)' },
    { char: 'त्र', label: 'tra (त्+र)' },
    { char: 'ज्ञ', label: 'gya (ज्+ञ)' },
    { char: 'श्र', label: 'shra (श्+र)' },
    { char: 'द्व', label: 'dva (द्+व)' },
    { char: 'द्घ', label: 'ddha (द्+घ)' },
    { char: 'हृ', label: 'hri (ह्+ऋ)' }
  ];

  // 2. Matra test data
  const matras = [
    { char: 'कि', label: 'i-matra' },
    { char: 'की', label: 'ee-matra' },
    { char: 'कु', label: 'u-matra' },
    { char: 'कू', label: 'oo-matra' },
    { char: 'के', label: 'e-matra' },
    { char: 'कै', label: 'ai-matra' },
    { char: 'को', label: 'o-matra' },
    { char: 'कौ', label: 'au-matra' },
    { char: 'कृ', label: 'ri-matra' }
  ];

  // 3. Virama / Half characters
  const viramas = [
    { char: 'क्', label: 'halant' },
    { char: 'क्त', label: 'kta' },
    { char: 'स्त्र', label: 'stra' },
    { char: 'प्र', label: 'pra' },
    { char: 'क्र', label: 'kra' },
    { char: 'ग्र', label: 'gra' },
    { char: 'द्र', label: 'dra' }
  ];

  // 4. Nuktas
  const nuktas = [
    { char: 'क़', label: 'qa' },
    { char: 'ख़', label: 'kha' },
    { char: 'ग़', label: 'gha' },
    { char: 'ज़', label: 'za' },
    { char: 'ड़', label: 'da' },
    { char: 'ढ़', label: 'dha' },
    { char: 'फ़', label: 'fa' }
  ];

  // 5. Diacritics (Chandrabindu, Anusvara, Visarga)
  const diacritics = [
    { char: 'माँ', label: 'chandrabindu' },
    { char: 'हँसी', label: 'chandrabindu+ee' },
    { char: 'साँझ', label: 'nasal aa' },
    { char: 'अंश', label: 'anusvara' },
    { char: 'दुःख', label: 'visarga' }
  ];

  // 6. Punctuation
  const punctuations = [
    { char: '।', label: 'पूर्णविराम (Danda)' },
    { char: '॥', label: 'दीर्घविराम (Double Danda)' },
    { char: ',', label: 'अल्पविराम' },
    { char: '.', label: 'पूर्णविराम (Latin)' },
    { char: '!', label: 'विस्मयबोधक' },
    { char: '?', label: 'प्रश्नवाचक' },
    { char: '“ ”', label: 'उद्धरण चिह्न' },
    { char: '‘ ’', label: 'एकल उद्धरण' },
    { char: '—', label: 'दीर्घ योजक (Em Dash)' },
    { char: '…', label: 'लोप चिह्न (Ellipsis)' }
  ];

  const renderGlyphGrid = (items) => `
    <div class="glyph-grid" role="list">
      ${items.map(item => `
        <div class="glyph-box" role="listitem">
          <span class="glyph-char">${item.char}</span>
          <span class="glyph-label">${item.label}</span>
        </div>
      `).join('')}
    </div>
  `;

  return `
    <div class="typography-test-container">
      <!-- 1. Font Families Diagnostic Specimen -->
      <section class="typo-test-card" aria-labelledby="test-fonts-heading">
        <header class="typo-test-card-header">
          <h2 id="test-fonts-heading" class="typo-test-title">मुद्रण फॉन्ट परिवार (Font Families)</h2>
          <span class="typo-test-subtitle">प्रयुक्त देवनागरी मुद्रण शैलियाँ</span>
        </header>

        <div class="font-specimen-list">
          <div class="font-specimen-item">
            <div class="font-specimen-meta">
              <span class="font-name">Rozha One</span>
              <span class="font-role">Display Headline (var(--font-display))</span>
            </div>
            <p class="font-specimen-text" style="font-family: var(--font-display); font-size: 1.75rem;">
              काव्यकलश: साहित्य संगीत कला विहीनः साक्षात् पशुः।
            </p>
          </div>

          <div class="font-specimen-item">
            <div class="font-specimen-meta">
              <span class="font-name">Martel</span>
              <span class="font-role">Primary Reading Serif (var(--font-reading))</span>
            </div>
            <p class="font-specimen-text" style="font-family: var(--font-reading);">
              अक्षर जब अंतर्मन से प्रस्फुटित होते हैं, तो मौन भी एक उदात्त काव्य बन जाता है।
            </p>
          </div>

          <div class="font-specimen-item">
            <div class="font-specimen-meta">
              <span class="font-name">Tiro Devanagari Hindi</span>
              <span class="font-role">Classical Literary Reading Alternative</span>
            </div>
            <p class="font-specimen-text" style="font-family: 'Tiro Devanagari Hindi', serif;">
              भावों की निर्मल धारा में बहते हुए शब्द समय के आर-पार अपनी सुगंध बिखेरते हैं।
            </p>
          </div>

          <div class="font-specimen-item">
            <div class="font-specimen-meta">
              <span class="font-name">Yatra One</span>
              <span class="font-role">Decorative Calligraphic Accent (var(--font-accent))</span>
            </div>
            <p class="font-specimen-text" style="font-family: var(--font-accent); font-size: 1.4rem;">
              एक एकांत, पावन और ध्यानमग्न साहित्यिक साधना
            </p>
          </div>

          <div class="font-specimen-item">
            <div class="font-specimen-meta">
              <span class="font-name">Mukta</span>
              <span class="font-role">Clean Interface Sans (var(--font-interface))</span>
            </div>
            <p class="font-specimen-text" style="font-family: var(--font-interface); font-size: 1rem;">
              शब्द संचय • ३२ कविताएँ • मौन पठन समय: १८ मिनट • २२ फरवरी २०२६
            </p>
          </div>
        </div>
      </section>

      <!-- 2. Conjuncts & Ligatures -->
      <section class="typo-test-card" aria-labelledby="test-conjuncts-heading">
        <header class="typo-test-card-header">
          <h2 id="test-conjuncts-heading" class="typo-test-title">संयुक्ताक्षर एवं संधि वर्ण (Conjuncts)</h2>
          <span class="typo-test-subtitle">क्ष, त्र, ज्ञ, श्र, द्व, द्घ, हृ की शुद्धता</span>
        </header>
        ${renderGlyphGrid(conjuncts)}
      </section>

      <!-- 3. Matras & Diacritics Collision Test -->
      <section class="typo-test-card" aria-labelledby="test-matras-heading">
        <header class="typo-test-card-header">
          <h2 id="test-matras-heading" class="typo-test-title">स्वर मात्राएँ एवं उर्ध्व-अधो चिह्न (Matra Collisions)</h2>
          <span class="typo-test-subtitle">ऊपरी एवं निचली मात्राओं का अन्तराल</span>
        </header>
        ${renderGlyphGrid(matras)}
      </section>

      <!-- 4. Virama & Half Characters -->
      <section class="typo-test-card" aria-labelledby="test-viramas-heading">
        <header class="typo-test-card-header">
          <h2 id="test-viramas-heading" class="typo-test-title">हलन्त एवं संयुक्त व्यंजन (Virama / Halant)</h2>
          <span class="typo-test-subtitle">क्, क्त, स्त्र, प्र, क्र, ग्र, द्र</span>
        </header>
        ${renderGlyphGrid(viramas)}
      </section>

      <!-- 5. Nuktas & Urdu-Hindi Loan Phonemes -->
      <section class="typo-test-card" aria-labelledby="test-nuktas-heading">
        <header class="typo-test-card-header">
          <h2 id="test-nuktas-heading" class="typo-test-title">नुक़्ता युक्त वर्ण (Nukta Placement)</h2>
          <span class="typo-test-subtitle">ग़ज़ल एवं नज़्म हेतु क़, ख़, ग़, ज़, ड़, ढ़, फ़</span>
        </header>
        ${renderGlyphGrid(nuktas)}
      </section>

      <!-- 6. Chandrabindu & Anusvara Alignment -->
      <section class="typo-test-card" aria-labelledby="test-diacritics-heading">
        <header class="typo-test-card-header">
          <h2 id="test-diacritics-heading" class="typo-test-title">अनुनासिक, अनुस्वार व विसर्ग</h2>
          <span class="typo-test-subtitle">माँ, हँसी, साँझ, अंश, दुःख</span>
        </header>
        ${renderGlyphGrid(diacritics)}
      </section>

      <!-- 7. Punctuation Marks -->
      <section class="typo-test-card" aria-labelledby="test-punc-heading">
        <header class="typo-test-card-header">
          <h2 id="test-punc-heading" class="typo-test-title">विराम चिह्न (Punctuation)</h2>
          <span class="typo-test-subtitle">पूर्णविराम, दीर्घविराम, उद्धरण एवं योजक चिह्न</span>
        </header>
        <div class="punc-badge-wrap">
          ${punctuations.map(p => `
            <div class="punc-badge">
              <strong>${p.char}</strong>
              <span class="punc-label">${p.label}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- 8. Realistic Long Poetry Line Wrapping -->
      <section class="typo-test-card" aria-labelledby="test-wrapping-heading">
        <header class="typo-test-card-header">
          <h2 id="test-wrapping-heading" class="typo-test-title">पंक्ति विस्तार एवं स्वाभाविक विखंडन (Line Wrapping)</h2>
          <span class="typo-test-subtitle">लघु, मध्यम, दीर्घ एवं अति-दीर्घ काव्य पंक्तियों का पठन</span>
        </header>

        <div class="verse-test-block">
          <span class="verse-meta-tag">लघु पंक्ति (Short Line)</span>
          <p class="verse-line">शब्द मौन हैं।</p>
        </div>

        <div class="verse-test-block">
          <span class="verse-meta-tag">मध्यम पंक्ति (Medium Line)</span>
          <p class="verse-line">साँझ ढली तो अंतर्मन के दीप चुपचाप जल उठे।</p>
        </div>

        <div class="verse-test-block">
          <span class="verse-meta-tag">दीर्घ पंक्ति (Long Line)</span>
          <p class="verse-line">
            शब्द जब मन की अतल गहराइयों से प्रस्फुटित होते हैं, तो मौन भी एक अनूठी और अमर कविता बन जाता है।
          </p>
        </div>

        <div class="verse-test-block">
          <span class="verse-meta-tag">अति-दीर्घ पंक्ति (Very Long Line — 130+ अक्षर)</span>
          <p class="verse-line">
            स्याही की एक-एक बूँद में सदियों की वेदना और उल्लास छुपा है, जिसे केवल वही सहृदय समझ सकता है जो शब्दों के सूक्ष्म स्पंदन को अपनी चेतना में अनुभव करता हो।
          </p>
        </div>
      </section>

      <!-- 9. Multi-Stanza Reading Room Simulator (Capped to --reader-max-width: 780px) -->
      <section class="typo-test-card" aria-labelledby="test-simulator-heading">
        <header class="typo-test-card-header">
          <h2 id="test-simulator-heading" class="typo-test-title">पठन कक्ष प्रतिरूप (Multi-Stanza Reader Simulator)</h2>
          <span class="typo-test-subtitle">७८०px परिधि में छंदबद्ध ऊर्ध्वाधर लय (--leading-poetry: 2.15)</span>
        </header>

        <article class="reader-simulator" aria-label="काव्य-संध्या रचना">
          <h3 class="sim-poem-title">काव्य-संध्या</h3>
          <p class="sim-poem-author">मूल रचना • काव्यकलश मुद्रण कला</p>

          <div class="sim-stanza">
            <p class="sim-verse">अक्षर-अक्षर दीप जलाती, मौन रात जब गाती है,</p>
            <p class="sim-verse">स्याही की हर एक बूँद में, नई दिशा मुस्काती है।</p>
          </div>

          <div class="sim-stanza-divider" aria-hidden="true"></div>

          <div class="sim-stanza">
            <p class="sim-verse">भावों के चिनार सुलगते, अंतस की अमराई में,</p>
            <p class="sim-verse">प्रेम, विरह और शांत स्वरूपा, गूँज उठें तन्हाई में।</p>
          </div>

          <div class="sim-stanza-divider" aria-hidden="true"></div>

          <div class="sim-stanza">
            <p class="sim-verse">काव्यकलश के स्वर्ण पात्र में, शब्द अमर हो जाते हैं,</p>
            <p class="sim-verse">मिट्टी के नश्वर पुतले भी, गीत अमर दे जाते हैं।</p>
          </div>
        </article>
      </section>

      <!-- 10. Mixed Script & Numeric Typography -->
      <section class="typo-test-card" aria-labelledby="test-mixed-heading">
        <header class="typo-test-card-header">
          <h2 id="test-mixed-heading" class="typo-test-title">मिश्रित लिपि एवं अंक (Mixed Script & Numbers)</h2>
          <span class="typo-test-subtitle">देवनागरी, लैटिन एवं अंकों का सामंजस्य</span>
        </header>

        <div class="punc-badge-wrap">
          <div class="punc-badge">कविता — Poetry</div>
          <div class="punc-badge">शब्द • Word</div>
          <div class="punc-badge">2026 — काव्यकलश (KavyaVault)</div>
          <div class="punc-badge">छंद (Meter) • राग (Melody) #108</div>
          <div class="punc-badge">१२३४५६७८९० (Devanagari Numerals)</div>
        </div>
      </section>
    </div>
  `;
}
