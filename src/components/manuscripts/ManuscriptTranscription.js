/**
 * काव्यकलश (KavyaVault) — Manuscript Transcription Workspace (ManuscriptTranscription.js)
 *
 * Phase 2 / Task 2.6: Manuscript Transcription Workspace
 *
 * Dedicated manual transcription canvas allowing writers to view an original
 * manuscript image side-by-side with a Devanagari typing surface.
 *
 * ARCHIVAL INTEGRITY GUARANTEE:
 * - The original manuscript image artifact is 100% immutable and never modified.
 * - The derived manuscript image is never modified.
 * - If linked to a poem, poem.body remains completely separate and untouched.
 * - Transcription is an independent textual representation with lifecycle:
 *   untranscribed → draft → verified.
 * - Modifying verified text automatically returns status to draft and clears verifiedAt.
 */

import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';
import { formatPoeticDate } from '../../utils/date.js';
import { calculateTextMetrics } from '../../utils/counters.js';

export class ManuscriptTranscription {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   * @param {string} options.manuscriptId Unique manuscript ID
   * @param {import('../../services/ManuscriptRepository.js').ManuscriptRepository} [options.repository=manuscriptRepository]
   * @param {import('../../services/PoemRepository.js').PoemRepository} [options.poemRepo=poemRepository]
   */
  constructor({
    container,
    router,
    manuscriptId,
    repository = manuscriptRepository,
    poemRepo = poemRepository
  }) {
    this.container = container;
    this.router = router;
    this.manuscriptId = manuscriptId;
    this.repository = repository;
    this.poemRepo = poemRepo;

    this.manuscript = null;
    this.activeTab = 'original'; // 'original' | 'derived'
    this.text = '';
    this.status = 'untranscribed';
    this.verifiedAt = null;

    this.saveStatus = 'saved'; // 'saved' | 'saving' | 'unsaved' | 'error'
    this.saveError = null;
    this.isDirty = false;
    this.autosaveTimeout = null;
    this.AUTOSAVE_DELAY = 750;

    this.boundInputHandler = this.handleInput.bind(this);
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
  }

  /**
   * Mounts the workspace view into the container
   */
  mount() {
    this.manuscript = this.repository.getById(this.manuscriptId);

    if (!this.manuscript) {
      this.renderNotFound();
      return;
    }

    const trans = this.manuscript.transcription || {};
    this.text = trans.text || '';
    this.status = trans.status || 'untranscribed';
    this.verifiedAt = trans.verifiedAt || null;

    this.container.innerHTML = this.render();

    this.container.addEventListener('input', this.boundInputHandler);
    this.container.addEventListener('click', this.boundClickHandler);
    document.addEventListener('keydown', this.boundKeyDownHandler);

    this.updateMetrics();
    this.updateSaveStatus(this.saveStatus);
  }

  /**
   * Unmounts workspace, flushes pending autosave, and cleans up listeners
   */
  unmount() {
    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
      this.autosaveTimeout = null;
      this.performAutosave();
    }

    if (this.container) {
      this.container.removeEventListener('input', this.boundInputHandler);
      this.container.removeEventListener('click', this.boundClickHandler);
    }
    document.removeEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * Escapes HTML for secure rendering
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Formats transcription status into Hindi display text
   */
  formatStatus(status) {
    switch (status) {
      case 'verified': return 'प्रमाणित';
      case 'draft': return 'प्रारूप';
      case 'untranscribed':
      default:
        return 'अप्रतिलिपिबद्ध';
    }
  }

  /**
   * Resolves the original manuscript image data URL
   */
  getOriginalImageSrc() {
    const orig = this.manuscript?.originalManuscript || {};
    const raw = orig.data || '';
    if (!raw || typeof raw !== 'string' || raw.trim() === '') return '';
    if (raw.startsWith('data:')) return raw;
    return `data:${orig.mimeType || 'image/jpeg'};base64,${raw}`;
  }

  /**
   * Resolves the derived manuscript image data URL if present
   */
  getDerivedImageSrc() {
    const derived = this.manuscript?.derivedManuscript;
    if (!derived || !derived.data) return '';
    const raw = derived.data;
    if (raw.startsWith('data:')) return raw;
    return `data:${derived.mimeType || 'image/png'};base64,${raw}`;
  }

  /**
   * Resolves active image source to display in viewer
   */
  getActiveImageSrc() {
    if (this.activeTab === 'derived' && this.manuscript?.derivedManuscript) {
      return this.getDerivedImageSrc();
    }
    return this.getOriginalImageSrc();
  }

  /**
   * Input event handler for the transcription textarea
   */
  handleInput(e) {
    if (e.target && e.target.id === 'transcription-textarea') {
      const prevText = this.text;
      this.text = e.target.value;
      this.isDirty = true;
      this.saveError = null;

      // When text is edited, any verified status drops to draft
      if (this.status === 'verified' && this.text !== prevText) {
        this.status = 'draft';
        this.verifiedAt = null;
        this.updateStatusPill();
      } else if (this.status === 'untranscribed' && this.text.trim().length > 0) {
        this.status = 'draft';
        this.updateStatusPill();
      }

      this.updateMetrics();
      this.triggerDebouncedAutosave();
    }
  }

  /**
   * Triggers ~750ms debounced autosave
   */
  triggerDebouncedAutosave() {
    this.updateSaveStatus('unsaved');

    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
    }

    this.autosaveTimeout = setTimeout(() => {
      this.performAutosave();
    }, this.AUTOSAVE_DELAY);
  }

  /**
   * Performs the save operation through ManuscriptRepository
   */
  performAutosave() {
    this.updateSaveStatus('saving');

    try {
      const targetStatus = this.status === 'verified'
        ? 'verified'
        : (this.text.trim().length > 0 ? 'draft' : 'untranscribed');

      const updated = this.repository.updateTranscription(this.manuscriptId, {
        text: this.text,
        status: targetStatus
      });

      this.manuscript = updated;
      this.status = updated.transcription.status;
      this.verifiedAt = updated.transcription.verifiedAt;
      this.isDirty = false;
      this.saveError = null;

      this.updateSaveStatus('saved');
      this.updateStatusPill();
    } catch (err) {
      console.error('[ManuscriptTranscription] Save error:', err);
      this.saveStatus = 'error';
      this.saveError = err.message || 'सहेजने में तकनीकी समस्या उत्पन्न हुई।';
      this.updateSaveStatus('error');
    }
  }

  /**
   * Updates the live metrics bar (words, lines, characters)
   */
  updateMetrics() {
    const metrics = calculateTextMetrics(this.text);
    const wordsEl = this.container.querySelector('#metric-words');
    const charsEl = this.container.querySelector('#metric-chars');
    const linesEl = this.container.querySelector('#metric-lines');

    if (wordsEl) wordsEl.textContent = metrics.words;
    if (charsEl) charsEl.textContent = metrics.characters;
    if (linesEl) linesEl.textContent = metrics.lines;
  }

  /**
   * Updates the autosave indicator UI
   */
  updateSaveStatus(status) {
    this.saveStatus = status;
    const statusEl = this.container.querySelector('#transcription-save-indicator');
    if (!statusEl) return;

    let dotClass = 'status-dot';
    let text = 'सहेजा गया';

    switch (status) {
      case 'saving':
        dotClass = 'status-dot pulse';
        text = 'सहेजा जा रहा है…';
        break;
      case 'unsaved':
        dotClass = 'status-dot dirty';
        text = 'परिवर्तन सहेजे नहीं गए';
        break;
      case 'error':
        dotClass = 'status-dot error';
        text = this.saveError ? `त्रुटि: ${this.saveError}` : 'सहेजने में त्रुटि';
        break;
      case 'saved':
      default:
        dotClass = 'status-dot';
        text = 'सहेजा गया';
        break;
    }

    statusEl.innerHTML = `
      <span class="${dotClass}" aria-hidden="true"></span>
      <span class="status-label">${this.escapeHtml(text)}</span>
    `;

    // Also update error banner if present
    const errBanner = this.container.querySelector('#transcription-error-banner');
    if (errBanner) {
      if (status === 'error' && this.saveError) {
        errBanner.style.display = 'flex';
        const txt = errBanner.querySelector('.error-text');
        if (txt) txt.textContent = this.saveError;
      } else {
        errBanner.style.display = 'none';
      }
    }
  }

  /**
   * Updates status pill UI
   */
  updateStatusPill() {
    const pill = this.container.querySelector('#transcription-status-badge');
    if (!pill) return;

    pill.className = `transcription-status-pill status-${this.status}`;
    pill.textContent = this.formatStatus(this.status);

    const verifyBtn = this.container.querySelector('[data-action="verify-transcription"]');
    if (verifyBtn) {
      if (this.status === 'verified') {
        verifyBtn.classList.add('is-verified');
        verifyBtn.innerHTML = `
          ${getIconSvg('check', 'btn-icon')}
          <span>प्रमाणित (सत्यापित)</span>
        `;
      } else {
        verifyBtn.classList.remove('is-verified');
        verifyBtn.innerHTML = `
          ${getIconSvg('check', 'btn-icon')}
          <span>प्रमाणित करें</span>
        `;
      }
    }
  }

  /**
   * Handles click events via event delegation
   */
  handleClick(e) {
    const target = e.target;

    // 1. Switch image view tab (Original vs Derived)
    const tabBtn = target.closest('[data-action="switch-image-tab"]');
    if (tabBtn) {
      e.preventDefault();
      const tab = tabBtn.getAttribute('data-tab');
      if (tab === 'original' || tab === 'derived') {
        this.activeTab = tab;
        const imgEl = this.container.querySelector('#transcription-image');
        if (imgEl) {
          imgEl.src = this.getActiveImageSrc();
        }
        // Update active tab styles
        this.container.querySelectorAll('[data-action="switch-image-tab"]').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-tab') === tab);
          b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
        });
      }
      return;
    }

    // 2. Explicit Save button
    const saveBtn = target.closest('[data-action="manual-save"]');
    if (saveBtn) {
      e.preventDefault();
      if (this.autosaveTimeout) {
        clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = null;
      }
      this.performAutosave();
      return;
    }

    // 3. Verify Transcription button
    const verifyBtn = target.closest('[data-action="verify-transcription"]');
    if (verifyBtn) {
      e.preventDefault();
      this.handleVerify();
      return;
    }

    // 4. Reset working changes button
    const resetBtn = target.closest('[data-action="reset-transcription"]');
    if (resetBtn) {
      e.preventDefault();
      this.handleReset();
      return;
    }
  }

  /**
   * Explicit verification action
   */
  handleVerify() {
    if (!this.text || this.text.trim() === '') {
      this.saveStatus = 'error';
      this.saveError = 'प्रमाणित करने के लिए सार्थक प्रतिलिपि पाठ अनिवार्य है।';
      this.updateSaveStatus('error');
      const textarea = this.container.querySelector('#transcription-textarea');
      if (textarea) textarea.focus();
      return;
    }

    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
      this.autosaveTimeout = null;
    }

    this.updateSaveStatus('saving');

    try {
      const updated = this.repository.updateTranscription(this.manuscriptId, {
        text: this.text,
        status: 'verified'
      });

      this.manuscript = updated;
      this.status = 'verified';
      this.verifiedAt = updated.transcription.verifiedAt;
      this.isDirty = false;
      this.saveError = null;

      this.updateSaveStatus('saved');
      this.updateStatusPill();
    } catch (err) {
      this.saveStatus = 'error';
      this.saveError = err.message || 'प्रमाणित करने में त्रुटि हुई।';
      this.updateSaveStatus('error');
    }
  }

  /**
   * Resets the working transcription to the last saved repository state
   */
  handleReset() {
    const saved = this.manuscript?.transcription || {};
    this.text = saved.text || '';
    this.status = saved.status || 'untranscribed';
    this.verifiedAt = saved.verifiedAt || null;
    this.isDirty = false;
    this.saveError = null;

    const textarea = this.container.querySelector('#transcription-textarea');
    if (textarea) textarea.value = this.text;

    this.updateMetrics();
    this.updateStatusPill();
    this.updateSaveStatus('saved');
  }

  /**
   * Keydown handler for keyboard shortcuts (Ctrl+S / Cmd+S to save)
   */
  handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (this.autosaveTimeout) {
        clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = null;
      }
      this.performAutosave();
    }
  }

  /**
   * Renders localized 404 state if manuscript is not found
   */
  renderNotFound() {
    this.container.innerHTML = `
      <div class="transcription-workspace-view standard-page-view" role="region" aria-label="पांडुलिपि अप्राप्य">
        <div class="manuscript-top-bar">
          <a href="${ROUTES.MANUSCRIPTS || '/manuscripts'}" data-link class="manuscript-nav-back" aria-label="पांडुलिपि वीथिका पर लौटें">
            ${getIconSvg('arrow-left', 'nav-icon')}
            <span>वीथिका</span>
          </a>
        </div>
        <div class="transcription-not-found" style="text-align: center; padding: var(--space-12) var(--space-4);">
          <div style="font-size: 3rem; margin-bottom: var(--space-3);" aria-hidden="true">📜</div>
          <h2 style="font-family: var(--font-display); font-size: var(--text-h2); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            पांडुलिपि अप्राप्य
          </h2>
          <p style="font-family: var(--font-interface); color: var(--color-text-muted); margin: 0 0 var(--space-6) 0;">
            प्रतिलिपि कक्ष हेतु माँगी गई पांडुलिपि (आईडी: ${this.escapeHtml(this.manuscriptId)}) संग्रह में उपलब्ध नहीं है।
          </p>
          <a href="${ROUTES.MANUSCRIPTS || '/manuscripts'}" data-link class="btn-workspace-action" style="text-decoration: none; display: inline-flex;">
            वीथिका पर लौटें
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Renders the complete transcription workspace HTML
   */
  render() {
    const ms = this.manuscript;
    const orig = ms.originalManuscript || {};
    const derived = ms.derivedManuscript || null;
    const hasDerived = Boolean(derived && derived.data);
    const activeSrc = this.getActiveImageSrc();

    // Linked poem context
    let linkedPoem = null;
    if (ms.poemId) {
      try {
        linkedPoem = this.poemRepo.getById(ms.poemId);
      } catch (_) {}
    }

    return `
      <div class="transcription-workspace-view" role="region" aria-label="पांडुलिपि प्रतिलिपि कक्ष: ${this.escapeHtml(ms.title)}">
        <!-- Top Navigation & Action Header -->
        <header class="transcription-top-header">
          <div class="transcription-header-left">
            <a
              href="/manuscripts/${encodeURIComponent(ms.id)}"
              data-link
              class="workspace-nav-back"
              aria-label="पांडुलिपि अभिलेख पर लौटें"
            >
              ${getIconSvg('arrow-left', 'nav-icon')}
              <span>अभिलेख पर लौटें</span>
            </a>

            <div class="workspace-title-group">
              <h1 class="workspace-title">${this.escapeHtml(ms.title)}</h1>
              <span id="transcription-status-badge" class="transcription-status-pill status-${this.status}">
                ${this.formatStatus(this.status)}
              </span>
            </div>
          </div>

          <div class="transcription-header-actions">
            <div id="transcription-save-indicator" class="transcription-save-status" role="status" aria-live="polite">
              <span class="status-dot"></span>
              <span class="status-label">सहेजा गया</span>
            </div>

            <button
              type="button"
              class="btn-workspace-action"
              data-action="manual-save"
              aria-label="प्रतिलिपि सहेजें"
              title="Ctrl+S / Cmd+S"
            >
              ${getIconSvg('check', 'btn-icon')}
              <span>सहेजें</span>
            </button>

            <button
              type="button"
              class="btn-workspace-action btn-workspace-verify ${this.status === 'verified' ? 'is-verified' : ''}"
              data-action="verify-transcription"
              aria-label="${this.status === 'verified' ? 'प्रतिलिपि प्रमाणित है' : 'प्रतिलिपि प्रमाणित करें'}"
            >
              ${getIconSvg('check', 'btn-icon')}
              <span>${this.status === 'verified' ? 'प्रमाणित (सत्यापित)' : 'प्रमाणित करें'}</span>
            </button>
          </div>
        </header>

        <!-- Linked Poem Notice (Decoupled, Read-Only Context) -->
        ${linkedPoem ? `
          <div class="transcription-poem-notice" role="note">
            <div class="poem-notice-icon" aria-hidden="true">${getIconSvg('book', 'icon-inline')}</div>
            <div class="poem-notice-text">
              <span>यह पांडुलिपि डिजिटल कविता <strong>"${this.escapeHtml(linkedPoem.title)}"</strong> से संबद्ध है। यहाँ किया गया संपादन कविता के मूल पाठ को परिवर्तित नहीं करता।</span>
            </div>
            <a href="/poems/${encodeURIComponent(linkedPoem.id)}" data-link class="poem-notice-link" aria-label="${this.escapeHtml(linkedPoem.title)} कविता पढ़ें">
              कविता पढ़ें &rarr;
            </a>
          </div>
        ` : ''}

        <!-- Error Alert Banner -->
        <div id="transcription-error-banner" class="transcription-alert-banner" role="alert" style="display: none;">
          <span class="alert-icon" aria-hidden="true">${getIconSvg('close', 'icon-inline')}</span>
          <span class="error-text"></span>
        </div>

        <!-- Main Workspace Two-Column Grid -->
        <div class="transcription-workspace-layout">
          <!-- Left Column: Archival Manuscript Image Viewer -->
          <section class="transcription-image-panel" aria-label="हस्तलिखित पांडुलिपि संदर्भ छवि">
            <div class="image-panel-toolbar">
              <div class="image-panel-tabs" role="tablist" aria-label="पांडुलिपि संदर्भ चयन">
                <button
                  type="button"
                  class="image-panel-tab ${this.activeTab === 'original' ? 'active' : ''}"
                  data-action="switch-image-tab"
                  data-tab="original"
                  role="tab"
                  aria-selected="${this.activeTab === 'original'}"
                >
                  मूल पांडुलिपि
                </button>

                ${hasDerived ? `
                  <button
                    type="button"
                    class="image-panel-tab ${this.activeTab === 'derived' ? 'active' : ''}"
                    data-action="switch-image-tab"
                    data-tab="derived"
                    role="tab"
                    aria-selected="${this.activeTab === 'derived'}"
                  >
                    संपादित प्रति
                  </button>
                ` : ''}
              </div>

              <span class="image-immutable-badge" title="मूल छवि सुरक्षित एवं अपरिवर्तित है">
                ${getIconSvg('check', 'badge-icon')}
                <span>अपरिवर्तित मूल</span>
              </span>
            </div>

            <div class="transcription-image-viewport">
              ${activeSrc ? `
                <img
                  id="transcription-image"
                  src="${activeSrc}"
                  alt="${this.escapeHtml(ms.title)} संदर्भ छवि"
                  class="transcription-display-image"
                />
              ` : `
                <div class="transcription-image-missing">
                  <span aria-hidden="true">📜</span>
                  <p>छवि डेटा उपलब्ध नहीं है।</p>
                </div>
              `}
            </div>
          </section>

          <!-- Right Column: Transcription Writing Canvas -->
          <section class="transcription-editor-panel" aria-label="देवनागरी प्रतिलिपि लेखन पटल">
            <div class="editor-panel-header">
              <label for="transcription-textarea" class="editor-canvas-label">
                देवनागरी प्रतिलिपि पाठ (Transcription)
              </label>
              <button
                type="button"
                class="btn-workspace-reset"
                data-action="reset-transcription"
                aria-label="अंतिम सहेजी गई प्रतिलिपि पर लौटें"
                title="अंतिम सहेजी गई प्रतिलिपि पुनः लोड करें"
              >
                ${getIconSvg('restore', 'btn-icon')}
                <span>रीसेट</span>
              </button>
            </div>

            <div class="editor-textarea-wrapper">
              <textarea
                id="transcription-textarea"
                class="transcription-textarea"
                placeholder="हस्तलिखित पांडुलिपि को देखकर यहाँ देवनागरी में प्रतिलिपि लिखें... (उदा. दोहा, पद, छंद, ग़ज़ल)"
                aria-label="हस्तलिखित पांडुलिपि की देवनागरी प्रतिलिपि"
                spellcheck="false"
              >${this.escapeHtml(this.text)}</textarea>
            </div>

            <!-- Bottom Metrics Bar -->
            <footer class="transcription-metrics-bar" aria-label="साहित्यिक परिमाप">
              <div class="metric-item">
                <span class="metric-label">शब्द:</span>
                <span id="metric-words" class="metric-value">0</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">वर्ण:</span>
                <span id="metric-chars" class="metric-value">0</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">पंक्तियाँ:</span>
                <span id="metric-lines" class="metric-value">0</span>
              </div>
            </footer>
          </section>
        </div>
      </div>
    `;
  }
}
