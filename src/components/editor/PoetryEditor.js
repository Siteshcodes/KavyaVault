/**
 * काव्यकलश (KavyaVault) — Poetry Editor Component (PoetryEditor.js)
 * Dedicated Hindi-first poetry writing space with debounced draft autosave (~750ms),
 * explicit draft recovery, live Unicode-safe metrics, and repository integration.
 */

import { poemRepository } from '../../services/PoemRepository.js';
import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { formatInputSourceLabel } from '../../services/input/PoemInputService.js';
import { calculateTextMetrics } from '../../utils/counters.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

export class PoetryEditor {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   * @param {string|null} [options.poemId=null] Existing poem ID if editing, null for new
   * @param {Object|null} [options.initialPoem=null] Pre-loaded poem object if available
   * @param {Object|null} [options.initialDraft=null] Pre-loaded draft from input handoff
   * @param {Object|null} [options.manuscriptRepo=null] Manuscript repository instance
   * @param {Object|null} [options.repository=null] Poem repository instance
   */
  constructor({ container, router, poemId = null, initialPoem = null, initialDraft = null, manuscriptRepo = null, manuscriptRepository: msRepoAlias = null, repository = null }) {
    this.container = container;
    this.router = router;
    this.poemId = poemId;
    this.initialPoem = initialPoem;
    this.initialDraft = initialDraft;
    this.manuscriptRepo = manuscriptRepo || msRepoAlias || manuscriptRepository;
    this.repository = repository || poemRepository;

    // Form fields state
    this.title = '';
    this.body = '';
    this.author = '';
    this.tags = '';

    // Modern input source tracking (Phase 3)
    this.source = 'type';
    this.manuscriptId = null;
    this.inputMetadata = null;

    // Autosave & status
    this.autosaveTimeout = null;
    this.AUTOSAVE_DELAY = 750;
    this.saveStatus = 'saved'; // 'saved' | 'saving' | 'unsaved'
    this.validationError = null;

    // Draft recovery state
    this.showRecoveryPrompt = false;
    this.recoveredDraft = null;

    // Bound listeners for clean unmounting
    this.boundInputHandler = this.handleInput.bind(this);
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
  }

  /**
   * Helper: parses comma-separated tags string into clean array
   */
  parseTags(tagsString) {
    if (!tagsString || typeof tagsString !== 'string') return [];
    return tagsString
      .split(/[,،]+/)
      .map(t => t.trim().replace(/^#+/, ''))
      .filter(Boolean);
  }

  /**
   * Mounts the editor into DOM and initializes draft recovery checks
   */
  mount() {
    // 0. Explicit Initial Draft Handoff (e.g. from Scan/Speak/Type services)
    if (this.initialDraft && !this.poemId) {
      this.title = this.initialDraft.title || '';
      this.body = this.initialDraft.body || this.initialDraft.text || '';
      this.author = this.initialDraft.author || '';
      this.tags = Array.isArray(this.initialDraft.tags) ? this.initialDraft.tags.join(', ') : '';
      this.source = this.initialDraft.source || 'type';
      this.manuscriptId = this.initialDraft.manuscriptId || null;
      this.inputMetadata = this.initialDraft.inputMetadata || this.initialDraft.metadata || null;
    } else if (this.poemId) {
      // 1. EDIT MODE: Load existing poem
      if (!this.initialPoem) {
        this.initialPoem = this.repository.getById(this.poemId);
      }

      if (!this.initialPoem) {
        this.renderNotFound();
        return;
      }

      this.title = this.initialPoem.title || '';
      this.body = this.initialPoem.body || '';
      this.author = this.initialPoem.author || '';
      this.tags = Array.isArray(this.initialPoem.tags) ? this.initialPoem.tags.join(', ') : '';

      // Check if an existing draft matches this poem and has newer unsaved content
      const draft = this.repository.getDraft();
      if (draft && draft.poemId === this.poemId) {
        const isDifferent = (draft.title && draft.title !== this.title) ||
                            (draft.body && draft.body !== this.body);
        if (isDifferent) {
          this.showRecoveryPrompt = true;
          this.recoveredDraft = draft;
        }
      }
    } else {
      // 2. NEW POEM MODE: Check for unsaved draft
      const draft = this.repository.getDraft();
      if (draft && draft.poemId === null) {
        const hasContent = (draft.title && draft.title.trim().length > 0) ||
                           (draft.body && draft.body.trim().length > 0);
        if (hasContent) {
          this.showRecoveryPrompt = true;
          this.recoveredDraft = draft;
        } else {
          this.source = draft.source || 'type';
          this.manuscriptId = draft.manuscriptId || null;
          this.inputMetadata = draft.inputMetadata || null;
        }
      }
    }

    // Render HTML structure
    this.container.innerHTML = this.render();

    // Attach event listeners
    this.container.addEventListener('input', this.boundInputHandler);
    this.container.addEventListener('click', this.boundClickHandler);
    document.addEventListener('keydown', this.boundKeyDownHandler);

    // Initial metrics update
    this.updateMetrics();
  }

  /**
   * Unmounts editor, flushes pending autosave, and cleans listeners
   */
  unmount() {
    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
      this.autosaveTimeout = null;
      // Flush draft on leave if dirty
      this.performAutosave();
    }

    if (this.container) {
      this.container.removeEventListener('input', this.boundInputHandler);
      this.container.removeEventListener('click', this.boundClickHandler);
    }
    document.removeEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * Renders 404 state if editing a non-existent poem
   */
  renderNotFound() {
    this.container.innerHTML = `
      <div class="poetry-editor-view standard-page-view">
        <div class="editor-top-bar">
          <a href="${ROUTES.POEMS}" data-link class="btn-editor-back" aria-label="पुस्तकालय पर लौटें">
            ${getIconSvg('book', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>
        </div>
        <div class="editor-canvas" style="text-align: center; padding: var(--space-8) var(--space-4);">
          <h2 style="font-family: var(--font-display); color: var(--color-text);">रचना अप्राप्य</h2>
          <p style="font-family: var(--font-interface); color: var(--color-text-muted); margin-top: var(--space-2);">
            संशोधन हेतु माँगी गई कविता (आईडी: ${this.poemId}) संग्रह में उपलब्ध नहीं है।
          </p>
          <div style="margin-top: var(--space-6);">
            <a href="${ROUTES.POEMS}" data-link class="btn-editor-save" style="text-decoration: none; display: inline-flex;">
              पुस्तकालय पर लौटें
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Returns complete HTML for editor
   */
  render() {
    const isEditMode = Boolean(this.poemId);
    const saveButtonLabel = isEditMode ? 'अद्यतन करें' : 'सहेजें';

    // Recovery Banner HTML
    let recoveryBannerHtml = '';
    if (this.showRecoveryPrompt && this.recoveredDraft) {
      const heading = isEditMode
        ? 'इस रचना का सहेजा हुआ ड्राफ्ट मिला है'
        : 'पिछली अधूरी रचना मिली है';
      const desc = isEditMode
        ? 'अंतिम बार सहेजे गए ड्राफ्ट में कुछ नए बदलाव मौजूद हैं।'
        : 'क्या आप पिछले सहेजे गए ड्राफ्ट से आगे बढ़ना चाहते हैं?';
      const discardLabel = isEditMode
        ? 'मूल रचना रखें'
        : 'नई कविता शुरू करें';

      recoveryBannerHtml = `
        <div class="draft-recovery-banner" id="editor-recovery-banner" role="alert" aria-live="assertive">
          <div class="recovery-info">
            <span class="recovery-heading">${heading}</span>
            <span class="recovery-desc">${desc}</span>
          </div>
          <div class="recovery-actions">
            <button type="button" class="btn-recovery-continue" data-action="recover-draft" aria-label="ड्राफ्ट से जारी रखें">
              जारी रखें
            </button>
            <button type="button" class="btn-recovery-discard" data-action="discard-draft" aria-label="${discardLabel}">
              ${discardLabel}
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="poetry-editor-view" role="region" aria-label="कविता लेखन कक्ष">
        <!-- Top Action Bar -->
        <header class="editor-top-bar">
          <div class="editor-top-left">
            <button type="button" class="btn-editor-back" data-action="cancel" aria-label="वापस जाएँ">
              ${getIconSvg('close', 'nav-icon')}
              <span>रद्द करें</span>
            </button>

            <!-- Autosave Status Indicator -->
            <div class="editor-save-status is-${this.saveStatus}" id="editor-save-status" role="status" aria-live="polite">
              <span class="status-dot ${this.saveStatus === 'saving' ? 'pulse' : ''}" aria-hidden="true"></span>
              <span class="status-text">${this.getStatusText(this.saveStatus)}</span>
            </div>

            <!-- Input Source Badge (Phase 3) -->
            ${this.source && this.source !== 'type' ? `
              <div class="editor-source-indicator source-${this.source}" role="note" aria-label="इनपुट माध्यम: ${formatInputSourceLabel(this.source)}">
                <span class="source-indicator-icon" aria-hidden="true">${this.source === 'scan' ? '📜' : '🎙️'}</span>
                <span class="source-indicator-label">${formatInputSourceLabel(this.source)}</span>
              </div>
            ` : ''}

          </div>

          <div class="editor-top-right">
            <button type="button" class="btn-editor-save" data-action="save" aria-label="${saveButtonLabel}">
              ${getIconSvg('check', 'nav-icon')}
              <span>${saveButtonLabel}</span>
            </button>
          </div>
        </header>

        <!-- Draft Recovery Banner -->
        ${recoveryBannerHtml}

        <!-- Validation Prompt Container -->
        <div id="editor-validation-container" style="display: ${this.validationError ? 'block' : 'none'};">
          ${this.validationError ? `<div class="editor-validation-message" role="alert">${this.validationError}</div>` : ''}
        </div>

        <!-- Scan Source Manuscript Reference Banner -->
        ${this.source === 'scan' && this.manuscriptId ? `
          <div class="editor-manuscript-context" role="note" style="padding: var(--space-2) var(--space-4); background: var(--color-bg-secondary); border-left: 3px solid var(--color-accent-gold); font-size: var(--text-sm); margin-bottom: var(--space-3); border-radius: var(--radius-sm);">
            <span>📜 <strong>पांडुलिपि संदर्भ:</strong> यह प्रारूप पांडुलिपि (${this.escapeHtml(this.manuscriptId)}) की प्रतिलिपि से सृजित हुआ है। सहेजने पर यह कविता पांडुलिपि से संबद्ध हो जाएगी।</span>
          </div>
        ` : ''}

        <!-- Editorial Writing Canvas -->
        <main class="editor-canvas">
          <!-- Title Input -->
          <div class="editor-title-wrap">
            <label for="editor-title" class="sr-only">कविता का शीर्षक</label>
            <input
              type="text"
              id="editor-title"
              class="editor-title-input"
              placeholder="कविता का शीर्षक"
              value="${this.escapeHtml(this.title)}"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <!-- Author Field -->
          <div class="editor-meta-row">
            <div class="editor-author-wrap">
              <label for="editor-author" class="editor-author-label">रचनाकार:</label>
              <input
                type="text"
                id="editor-author"
                class="editor-author-input"
                placeholder="रचनाकार (वैकल्पिक)"
                value="${this.escapeHtml(this.author)}"
                autocomplete="off"
              />
            </div>
          </div>

          <!-- Poetry Body Textarea -->
          <div class="editor-body-wrap">
            <label for="editor-body" class="sr-only">कविता की पंक्तियाँ</label>
            <textarea
              id="editor-body"
              class="editor-body-textarea"
              placeholder="अपनी कविता यहाँ लिखें..."
              rows="15"
              spellcheck="false"
            >${this.escapeHtml(this.body)}</textarea>
          </div>

          <!-- Tags Input -->
          <details class="editor-tags-wrap">
            <summary>अतिरिक्त विवरण</summary>
            <label for="editor-tags" class="editor-tags-label">टैग (वैकल्पिक):</label>
            <input
              type="text"
              id="editor-tags"
              class="editor-tags-input"
              placeholder="प्रकृति, बारिश, बचपन (अल्पविराम से अलग करें)"
              value="${this.escapeHtml(this.tags)}"
              autocomplete="off"
            />
          </details>
        </main>

        <!-- Bottom Footer: Live Metrics & Keyboard Hint -->
        <footer class="editor-bottom-bar">
          <div class="editor-metrics" role="status" aria-label="काव्य गणना">
            <span class="metric-item">शब्द: <strong id="metric-words">0</strong></span>
            <span class="metric-dot" aria-hidden="true">•</span>
            <span class="metric-item">पंक्तियाँ: <strong id="metric-lines">0</strong></span>
            <span class="metric-dot" aria-hidden="true">•</span>
            <span class="metric-item">अक्षर: <strong id="metric-chars">0</strong></span>
          </div>

          <div class="editor-keyboard-hint">
            <span>सहेजने हेतु: <kbd>Ctrl</kbd> + <kbd>S</kbd></span>
          </div>
        </footer>
      </div>
    `;
  }

  /**
   * Maps status enum to localized Hindi text
   */
  getStatusText(status) {
    switch (status) {
      case 'saving': return 'सहेजा जा रहा है…';
      case 'saved': return 'सहेजा गया';
      case 'unsaved': return 'अभी सहेजा नहीं गया';
      default: return 'सहेजा गया';
    }
  }

  /**
   * Escape helper for safe attribute injection
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Live input event handler
   */
  handleInput(event) {
    this.readFormValues();
    this.clearValidationError();
    this.updateMetrics();
    this.triggerDebouncedAutosave();
  }

  /**
   * Reads current values directly from DOM inputs
   */
  readFormValues() {
    const titleEl = this.container.querySelector('#editor-title');
    const bodyEl = this.container.querySelector('#editor-body');
    const authorEl = this.container.querySelector('#editor-author');
    const tagsEl = this.container.querySelector('#editor-tags');

    if (titleEl) this.title = titleEl.value;
    if (bodyEl) this.body = bodyEl.value;
    if (authorEl) this.author = authorEl.value;
    if (tagsEl) this.tags = tagsEl.value;
  }

  /**
   * Updates live word, line, and character count spans without full re-render
   */
  updateMetrics() {
    const metrics = calculateTextMetrics(this.body);

    const wordsEl = this.container.querySelector('#metric-words');
    const linesEl = this.container.querySelector('#metric-lines');
    const charsEl = this.container.querySelector('#metric-chars');

    if (wordsEl) wordsEl.textContent = metrics.words;
    if (linesEl) linesEl.textContent = metrics.lines;
    if (charsEl) charsEl.textContent = metrics.characters;
  }

  /**
   * Updates the save status indicator visually
   */
  updateSaveStatus(status) {
    this.saveStatus = status;
    const statusEl = this.container.querySelector('#editor-save-status');
    if (!statusEl) return;

    statusEl.className = `editor-save-status is-${status}`;
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');

    if (dot) {
      dot.className = `status-dot ${status === 'saving' ? 'pulse' : ''}`;
    }
    if (text) {
      text.textContent = this.getStatusText(status);
    }
  }

  /**
   * Debounced autosave mechanism (~750ms)
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
   * Writes current draft through PoemRepository
   */
  performAutosave() {
    this.updateSaveStatus('saving');

    try {
      this.readFormValues();
      const hasContent = Boolean(this.title.trim() || this.body.trim() || this.poemId);

      if (hasContent) {
        this.repository.saveDraft({
          poemId: this.poemId || null,
          title: this.title,
          body: this.body,
          author: this.author,
          tags: this.parseTags(this.tags),
          source: this.source || 'type',
          manuscriptId: this.manuscriptId || null,
          inputMetadata: this.inputMetadata || null
        });
      }

      this.updateSaveStatus('saved');
    } catch (err) {
      console.error('[PoetryEditor] Autosave error:', err);
      this.updateSaveStatus('unsaved');
    }
  }

  /**
   * Validates and publishes/saves the poem through PoemRepository
   */
  savePoem() {
    this.readFormValues();

    // 1. Validation checks
    if (!this.title.trim()) {
      this.setValidationError('कृपया कविता का शीर्षक लिखें।');
      const titleEl = this.container.querySelector('#editor-title');
      if (titleEl) titleEl.focus();
      return;
    }

    if (!this.body.trim()) {
      this.setValidationError('कृपया कविता की पंक्तियाँ लिखें।');
      const bodyEl = this.container.querySelector('#editor-body');
      if (bodyEl) bodyEl.focus();
      return;
    }

    try {
      const parsedTags = this.parseTags(this.tags);

      if (this.poemId) {
        // Update existing poem
        this.repository.update(this.poemId, {
          title: this.title.trim(),
          body: this.body,
          author: this.author.trim() || 'अज्ञात',
          tags: parsedTags
        });
        this.repository.clearDraft();
        this.router.navigate(`/poems/${this.poemId}`);
      } else {
        // Create new poem
        const newPoem = this.repository.create({
          title: this.title.trim(),
          body: this.body,
          author: this.author.trim() || 'अज्ञात',
          tags: parsedTags,
          source: this.source || 'type',
          manuscriptId: this.manuscriptId || null
        });

        // Link manuscript if source was scan and manuscriptId is present
        if (this.manuscriptId && this.manuscriptRepo && typeof this.manuscriptRepo.linkToPoem === 'function') {
          try {
            this.manuscriptRepo.linkToPoem(this.manuscriptId, newPoem.id);
          } catch (mErr) {
            console.warn('[PoetryEditor] Could not link manuscript to poem:', mErr);
          }
        }

        this.repository.clearDraft();
        this.router.navigate(ROUTES.POEMS);
      }
    } catch (err) {
      console.error('[PoetryEditor] Save error:', err);
      this.setValidationError(err && err.message ? err.message : 'रचना सहेजने में तकनीकी समस्या उत्पन्न हुई। कृपया पुनः प्रयास करें।');
    }
  }

  /**
   * Sets validation error message
   */
  setValidationError(msg) {
    this.validationError = msg;
    const container = this.container.querySelector('#editor-validation-container');
    if (container) {
      container.style.display = 'block';
      container.innerHTML = `<div class="editor-validation-message" role="alert">${msg}</div>`;
    }
  }

  /**
   * Clears active validation error message
   */
  clearValidationError() {
    if (this.validationError) {
      this.validationError = null;
      const container = this.container.querySelector('#editor-validation-container');
      if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
      }
    }
  }

  /**
   * Applies discovered draft into form inputs
   */
  applyRecoveredDraft() {
    if (!this.recoveredDraft) return;

    this.title = this.recoveredDraft.title || '';
    this.body = this.recoveredDraft.body || '';
    this.author = this.recoveredDraft.author || '';
    this.tags = Array.isArray(this.recoveredDraft.tags) ? this.recoveredDraft.tags.join(', ') : '';
    this.source = this.recoveredDraft.source || 'type';
    this.manuscriptId = this.recoveredDraft.manuscriptId || null;
    this.inputMetadata = this.recoveredDraft.inputMetadata || null;

    const titleEl = this.container.querySelector('#editor-title');
    const bodyEl = this.container.querySelector('#editor-body');
    const authorEl = this.container.querySelector('#editor-author');
    const tagsEl = this.container.querySelector('#editor-tags');

    if (titleEl) titleEl.value = this.title;
    if (bodyEl) bodyEl.value = this.body;
    if (authorEl) authorEl.value = this.author;
    if (tagsEl) tagsEl.value = this.tags;

    this.showRecoveryPrompt = false;
    const banner = this.container.querySelector('#editor-recovery-banner');
    if (banner) banner.remove();

    this.updateMetrics();
    this.updateSaveStatus('saved');
  }

  /**
   * Discards discovered draft and clears it from storage
   */
  discardDraft() {
    this.repository.clearDraft();
    this.showRecoveryPrompt = false;
    this.recoveredDraft = null;
    this.source = 'type';
    this.manuscriptId = null;
    this.inputMetadata = null;

    const banner = this.container.querySelector('#editor-recovery-banner');
    if (banner) banner.remove();

    // Reset to base state
    if (this.poemId && this.initialPoem) {
      this.title = this.initialPoem.title || '';
      this.body = this.initialPoem.body || '';
      this.author = this.initialPoem.author || '';
      this.tags = Array.isArray(this.initialPoem.tags) ? this.initialPoem.tags.join(', ') : '';
    } else {
      this.title = '';
      this.body = '';
      this.author = '';
      this.tags = '';
    }

    const titleEl = this.container.querySelector('#editor-title');
    const bodyEl = this.container.querySelector('#editor-body');
    const authorEl = this.container.querySelector('#editor-author');
    const tagsEl = this.container.querySelector('#editor-tags');

    if (titleEl) titleEl.value = this.title;
    if (bodyEl) bodyEl.value = this.body;
    if (authorEl) authorEl.value = this.author;
    if (tagsEl) tagsEl.value = this.tags;

    this.updateMetrics();
    this.updateSaveStatus('saved');
  }

  /**
   * Handles editor button clicks via delegation
   */
  handleClick(event) {
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.getAttribute('data-action');
    if (action === 'save') {
      this.savePoem();
    } else if (action === 'cancel') {
      this.handleCancel();
    } else if (action === 'recover-draft') {
      this.applyRecoveredDraft();
    } else if (action === 'discard-draft') {
      this.discardDraft();
    }
  }

  /**
   * Handles cancel / back action
   */
  handleCancel() {
    if (this.poemId) {
      this.router.navigate(`/poems/${this.poemId}`);
    } else {
      this.router.navigate(ROUTES.POEMS);
    }
  }

  /**
   * Keyboard shortcuts handler (Ctrl/Cmd + S)
   */
  handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
      event.preventDefault();
      this.savePoem();
    }
  }
}
