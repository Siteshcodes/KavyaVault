/**
 * काव्यकलश (KavyaVault) — Modern Input Mode Selector (InputModeSelector.js)
 * Phase 3 / Task 3.1: Centralized entry point for Type, Scan, and Speak input modes.
 *
 * Implements:
 * - Type → Poem: direct handoff to PoetryEditor
 * - Scan → Poem: honest placeholder & contract handoff using manuscript system
 * - Speak → Poem: honest placeholder & contract handoff using voice draft contract
 * - Local-first privacy reassurance
 */

import { ROUTES } from '../../data/navigation.js';
import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { poemRepository } from '../../services/PoemRepository.js';
import {
  INPUT_SOURCES,
  createScanDraft,
  createSpeakDraft,
  createTypeDraft
} from '../../services/input/PoemInputService.js';

export class InputModeSelector {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root DOM container
   * @param {Object} options.router Client router instance
   * @param {string} [options.initialMode='overview'] Sub-mode ('overview' | 'scan' | 'speak')
   * @param {Object} [options.manuscriptRepo=null] Optional repository injection
   * @param {Object} [options.poemRepo=null] Optional poem repository injection
   */
  constructor({
    container,
    router,
    initialMode = 'overview',
    manuscriptRepo = null,
    poemRepo = null
  }) {
    this.container = container;
    this.router = router;
    this.currentMode = initialMode;
    this.manuscriptRepo = manuscriptRepo || manuscriptRepository;
    this.poemRepo = poemRepo || poemRepository;
    this.boundClickHandler = this.handleClick.bind(this);
  }

  /**
   * Mounts component into container and binds events
   */
  mount() {
    this.render();
    if (this.container) {
      this.container.addEventListener('click', this.boundClickHandler);
    }
  }

  /**
   * Unmounts component and cleans up listeners
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
      this.container.innerHTML = '';
    }
  }

  /**
   * Sets active submode and re-renders
   * @param {string} mode
   */
  setMode(mode) {
    this.currentMode = mode;
    this.render();
  }

  /**
   * Renders HTML content
   */
  render() {
    if (!this.container) return;

    // Get available manuscripts if any exist for scan demo
    let manuscripts = [];
    try {
      if (this.manuscriptRepo && typeof this.manuscriptRepo.getAll === 'function') {
        manuscripts = this.manuscriptRepo.getAll().filter(m => !m.isArchived);
      }
    } catch {
      manuscripts = [];
    }

    this.container.innerHTML = `
      <section class="input-modes-view" aria-labelledby="input-modes-heading">
        <header class="input-modes-header">
          <h1 id="input-modes-heading" class="input-modes-title">काव्य सृजन माध्यम</h1>
          <p class="input-modes-subtitle">
            अपनी सुविधा अनुसार माध्यम चुनें। टाइप करें, पुरानी पांडुलिपि से पाठ रूपांतरित करें अथवा वाणी द्वारा रचना करें।
          </p>
        </header>

        <!-- Privacy Reassurance Banner -->
        <div class="input-privacy-banner" role="region" aria-label="गोपनीयता आश्वासन">
          <span class="privacy-banner-icon" aria-hidden="true">🔐</span>
          <div class="privacy-banner-content">
            <span class="privacy-banner-title">स्थानीय एवं एकांत रचना (100% Local Privacy)</span>
            <p class="privacy-banner-text">
              आपकी रचनाएँ, पांडुलिपियाँ एवं ध्वनि इनपुट केवल आपके अपने उपकरण में सुरक्षित रहते हैं। कोई भी डेटा किसी बाह्य सर्वर, क्लाउड या एआई मॉडल को नहीं भेजा जाता।
            </p>
          </div>
        </div>

        <!-- Mode Cards Grid -->
        <div class="input-modes-grid" role="list">
          
          <!-- Mode 1: TYPE -->
          <article class="input-mode-card ${this.currentMode === 'type' ? 'active-mode' : ''}" role="listitem">
            <div class="input-mode-card-header">
              <div class="input-mode-icon" aria-hidden="true">✍️</div>
              <span class="input-mode-badge badge-ready">सक्रिय (Active)</span>
            </div>
            <h2 class="input-mode-title">टाइप करें (Type)</h2>
            <p class="input-mode-desc">
              पारंपरिक एवं एकांत लेखन कक्ष। कीबोर्ड अथवा टच-स्क्रीन द्वारा देवनागरी में सीधे अपनी रचना लिखें।
            </p>
            <div class="input-mode-action">
              <button type="button" class="btn-input-action btn-input-primary" id="btn-mode-type" aria-label="टाइप लेखन कक्ष में प्रवेश करें">
                <span>लिखना प्रारंभ करें →</span>
              </button>
            </div>
          </article>

          <!-- Mode 2: SCAN -->
          <article class="input-mode-card ${this.currentMode === 'scan' ? 'active-mode' : ''}" role="listitem">
            <div class="input-mode-card-header">
              <div class="input-mode-icon" aria-hidden="true">📜</div>
              <span class="input-mode-badge badge-contract">अनुबंध तैयार (Next)</span>
            </div>
            <h2 class="input-mode-title">स्कैन करें (Scan)</h2>
            <p class="input-mode-desc">
              हस्तलिखित पांडुलिपि अथवा डायरी के पन्नों से पाठ प्राप्त कर सीधे काव्य प्रारूप में रूपांतरित करें।
            </p>
            <div class="input-mode-action">
              <button type="button" class="btn-input-action btn-input-secondary" id="btn-mode-scan" aria-label="स्कैन माध्यम विवरण एवं अनुबंध देखें">
                <span>अनुबंध एवं विवरण →</span>
              </button>
            </div>
          </article>

          <!-- Mode 3: SPEAK -->
          <article class="input-mode-card ${this.currentMode === 'speak' ? 'active-mode' : ''}" role="listitem">
            <div class="input-mode-card-header">
              <div class="input-mode-icon" aria-hidden="true">🎙️</div>
              <span class="input-mode-badge badge-contract">अनुबंध तैयार (Next)</span>
            </div>
            <h2 class="input-mode-title">बोलकर लिखें (Speak)</h2>
            <p class="input-mode-desc">
              अपनी वाणी में कविता का पाठ करें। स्थानीय वाक्-पहचान द्वारा शब्द सीधे प्रारूप में दर्ज होंगे।
            </p>
            <div class="input-mode-action">
              <button type="button" class="btn-input-action btn-input-secondary" id="btn-mode-speak" aria-label="ध्वनि माध्यम विवरण एवं अनुबंध देखें">
                <span>अनुबंध एवं विवरण →</span>
              </button>
            </div>
          </article>

        </div>

        <!-- Detail / Placeholder / Contract Demonstration Section -->
        ${this.renderContractDetails(manuscripts)}
      </section>
    `;
  }

  /**
   * Renders honest placeholder and contract verification details based on submode
   * @param {Array} manuscripts
   * @returns {string}
   */
  renderContractDetails(manuscripts) {
    if (this.currentMode === 'scan') {
      const hasManuscripts = manuscripts.length > 0;
      return `
        <div class="input-contract-section" id="contract-details-scan" role="region" aria-labelledby="scan-contract-title">
          <h2 id="scan-contract-title" class="input-contract-title">स्कैन माध्यम अनुबंध (Scan → Poem Contract)</h2>
          <p class="input-contract-desc">
            <strong>ईमानदार स्थिति:</strong> स्कैन इनपुट शीघ्र आ रहा है (Phase 3.2)। इस चरण में हमने इसका सुदृढ़ अनुबंध स्थापित कर दिया है ताकि पांडुलिपि के मूल बाइट्स की नकल किए बिना, केवल आईडी एवं पाठ के आधार पर प्रारूप संपादक में भेजा जा सके।
          </p>

          <div class="input-contract-card">
            <strong>अनुबंध प्रारूप (Contract Shape):</strong>
            <pre class="contract-code-preview">
{
  source: "scan",
  manuscriptId: "${hasManuscripts ? manuscripts[0].id : 'ms-sample-123'}",
  text: "हस्तलिखित पांडुलिपि से प्राप्त पंक्तियाँ...",
  title: "${hasManuscripts ? manuscripts[0].title : 'पांडुलिपि कविता'}"
}
            </pre>
            <p class="privacy-banner-text" style="margin-top: 8px;">
              🛡️ <strong>संरक्षण गारंटी:</strong> पांडुलिपि की मूल छवि के बाइट्स कविता में कभी नहीं दोहराए जाते। कविता सहेजने से पूर्व संपादक में समीक्षा अनिवार्य है।
            </p>
          </div>

          <div class="input-contract-actions">
            <a href="${ROUTES.INPUT_SCAN}" data-link class="btn-input-action btn-input-primary" id="btn-start-scan" style="width: auto; text-decoration: none; display: inline-flex; align-items: center;">
              <span>नई पांडुलिपि स्कैन करें →</span>
            </a>
            ${hasManuscripts ? `
              <label for="select-scan-manuscript" class="sr-only">पांडुलिपि चुनें</label>
              <select id="select-scan-manuscript" class="filter-select" aria-label="प्रारूप हेतु पांडुलिपि चुनें">
                ${manuscripts.map(m => `<option value="${m.id}">${m.title || 'अनाम पांडुलिपि'} (${m.id.slice(0, 8)})</option>`).join('')}
              </select>
              <button type="button" class="btn-input-action btn-input-secondary" id="btn-test-scan-draft" style="width: auto;">
                <span>चयनित पांडुलिपि से प्रारूप बनाएं →</span>
              </button>
            ` : `
              <button type="button" class="btn-input-action btn-input-secondary" id="btn-test-scan-sample" style="width: auto;">
                <span>नमूना पांडुलिपि प्रारूप बनाएं →</span>
              </button>
              <a href="${ROUTES.INPUT_SCAN}" data-link class="btn-input-action btn-input-secondary" style="width: auto;">
                <span>नई पांडुलिपि जोड़ें</span>
              </a>
            `}
            <button type="button" class="btn-input-action btn-input-secondary" id="btn-close-details" style="width: auto;">
              <span>संक्षिप्त करें</span>
            </button>
          </div>
        </div>
      `;
    }

    if (this.currentMode === 'speak') {
      return `
        <div class="input-contract-section" id="contract-details-speak" role="region" aria-labelledby="speak-contract-title">
          <h2 id="speak-contract-title" class="input-contract-title">ध्वनि माध्यम अनुबंध (Speak → Poem Contract)</h2>
          <p class="input-contract-desc">
            <strong>ईमानदार स्थिति:</strong> वाणी इनपुट शीघ्र आ रहा है (Phase 3.3)। हमने इसका सुदृढ़ अनुबंध निर्मित कर दिया है, जिससे पहचानी गई वाणी बिना किसी क्लाउड निर्भरता के सीधे मानक प्रारूप में प्रविष्ट होती है।
          </p>

          <div class="input-contract-card">
            <strong>अनुबंध प्रारूप (Contract Shape):</strong>
            <pre class="contract-code-preview">
{
  source: "speak",
  text: "बोली गई रचना की पंक्तियाँ...",
  title: "वाणी से रचित कविता",
  metadata: { language: "hi-IN" }
}
            </pre>
            <p class="privacy-banner-text" style="margin-top: 8px;">
              🛡️ <strong>संपादक समीक्षा:</strong> वाणी इनपुट से प्राप्त पाठ तुरंत डेटाबेस में सहेजा नहीं जाता; यह पहले संपादक में प्रारूप बनकर खुलता है जहाँ आप संपादन कर सकते हैं।
            </p>
          </div>

          <div class="input-contract-actions">
            <button type="button" class="btn-input-action btn-input-primary" id="btn-test-speak-draft" style="width: auto;">
              <span>वाणी प्रारूप का परीक्षण करें →</span>
            </button>
            <button type="button" class="btn-input-action btn-input-secondary" id="btn-close-details" style="width: auto;">
              <span>संक्षिप्त करें</span>
            </button>
          </div>
        </div>
      `;
    }

    // Default: overview
    return '';
  }

  /**
   * Click event handler
   * @param {MouseEvent} event
   */
  handleClick(event) {
    const target = event.target.closest('button, a');
    if (!target) return;

    // Type mode button
    if (target.id === 'btn-mode-type') {
      event.preventDefault();
      // Ensure type draft creation or direct editor navigation
      try {
        createTypeDraft({ title: '', body: '' }, this.poemRepo);
      } catch {
        // Fallback gracefully
      }
      this.router.navigate(ROUTES.NEW_POEM);
      return;
    }

    // Scan mode card button
    if (target.id === 'btn-mode-scan') {
      event.preventDefault();
      this.setMode('scan');
      return;
    }

    // Speak mode card button
    if (target.id === 'btn-mode-speak') {
      event.preventDefault();
      this.setMode('speak');
      return;
    }

    // Close details
    if (target.id === 'btn-close-details') {
      event.preventDefault();
      this.setMode('overview');
      return;
    }

    // Test Scan draft with selected manuscript
    if (target.id === 'btn-test-scan-draft') {
      event.preventDefault();
      const select = this.container.querySelector('#select-scan-manuscript');
      const manuscriptId = select ? select.value : 'ms-sample-123';
      try {
        createScanDraft({
          manuscriptId,
          text: 'पांडुलिपि से प्राप्त पंक्तियाँ\nसाहित्यिक धरोहर का सजीव रूप।',
          title: 'पांडुलिपि से सृजित कविता'
        }, this.poemRepo, this.manuscriptRepo);
      } catch {
        // Fallback
      }
      this.router.navigate(ROUTES.NEW_POEM);
      return;
    }

    // Test Scan draft with sample
    if (target.id === 'btn-test-scan-sample') {
      event.preventDefault();
      try {
        createScanDraft({
          manuscriptId: 'sample-ms-001',
          text: 'पुरातन हस्तलिखित पृष्ठ से उद्धृत\nएक मधुर भावमयी रचना।',
          title: 'हस्तलिखित काव्य'
        }, this.poemRepo, null);
      } catch {
        // Fallback
      }
      this.router.navigate(ROUTES.NEW_POEM);
      return;
    }

    // Test Speak draft
    if (target.id === 'btn-test-speak-draft') {
      event.preventDefault();
      try {
        createSpeakDraft({
          text: 'वाणी से उच्चारित काव्य पंक्ति\nहृदय की गहराइयों से निकली ध्वनि।',
          title: 'वाणी से उच्चारित रचना'
        }, this.poemRepo);
      } catch {
        // Fallback
      }
      this.router.navigate(ROUTES.NEW_POEM);
      return;
    }
  }
}
