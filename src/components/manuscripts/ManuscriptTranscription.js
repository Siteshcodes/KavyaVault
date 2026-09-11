/**
 * काव्यकलश (KavyaVault) — Manuscript Transcription Workspace (ManuscriptTranscription.js)
 *
 * Phase 2 / Task 2.6 & Task 2.7:
 * - Dedicated manual transcription canvas (image side-by-side with Devanagari editor)
 * - Lightweight Version History foundation with immutable historical snapshots
 * - Restore semantics preserving complete linear audit trail
 *
 * ARCHIVAL INTEGRITY GUARANTEE:
 * - The original manuscript image artifact is 100% immutable and never modified.
 * - The derived manuscript image is never modified.
 * - If linked to a poem, poem.body remains completely separate and untouched.
 * - Current transcription lifecycle: untranscribed → draft → verified.
 * - Modifying verified text automatically returns status to draft and clears verifiedAt.
 * - Restoring creates a NEW version snapshot without deleting previous history.
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

    // Version history state
    this.history = [];
    this.historyOpen = false;
    this.previewVersion = null;
    this.confirmRestoreVersion = null;

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
    this.history = this.repository.getTranscriptionHistory(this.manuscriptId);

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
   * Formats version source into literary Hindi
   */
  formatSource(source) {
    switch (source) {
      case 'verification': return 'प्रमाणीकरण';
      case 'restore': return 'पुनर्स्थापित';
      case 'manual-save':
      default:
        return 'सहेजा गया';
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
    const mime = orig.mimeType || 'image/jpeg';
    return `data:${mime};base64,${raw}`;
  }

  /**
   * Resolves the derived manuscript image data URL (if one exists)
   */
  getDerivedImageSrc() {
    const derived = this.manuscript?.derivedManuscript;
    if (!derived || !derived.data) return '';
    const raw = derived.data;
    if (raw.startsWith('data:')) return raw;
    const mime = derived.mimeType || 'image/jpeg';
    return `data:${mime};base64,${raw}`;
  }

  /**
   * Resolves active image URL based on active tab
   */
  getActiveImageSrc() {
    if (this.activeTab === 'derived') {
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
  performAutosave(options = {}) {
    this.updateSaveStatus('saving');

    try {
      const targetStatus = this.status === 'verified'
        ? 'verified'
        : (this.text.trim().length > 0 ? 'draft' : 'untranscribed');

      const updated = this.repository.updateTranscription(this.manuscriptId, {
        text: this.text,
        status: targetStatus
      }, options);

      this.manuscript = updated;
      this.status = updated.transcription.status;
      this.verifiedAt = updated.transcription.verifiedAt;
      this.history = this.repository.getTranscriptionHistory(this.manuscriptId);
      this.isDirty = false;
      this.saveError = null;

      this.updateSaveStatus('saved');
      this.updateStatusPill();
      this.updateHistoryButton();
      if (this.historyOpen) {
        this.updateHistoryList();
      }
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
   * Updates history toggle button in header
   */
  updateHistoryButton() {
    const btn = this.container.querySelector('[data-action="toggle-history"]');
    if (!btn) return;
    btn.classList.toggle('active', this.historyOpen);
    btn.setAttribute('aria-expanded', String(this.historyOpen));
    const label = btn.querySelector('.history-count-label');
    if (label) {
      label.textContent = `इतिहास (${this.history.length})`;
    }
  }

  /**
   * Re-renders history card list
   */
  updateHistoryList() {
    const content = this.container.querySelector('#transcription-history-content');
    if (!content) return;
    content.innerHTML = this.renderHistoryContent();

    const countEl = this.container.querySelector('.history-total-count');
    if (countEl) {
      countEl.textContent = `(${this.history.length} संस्करण)`;
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
      this.performAutosave({ source: 'manual-save', createVersion: true });
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

    // 5. Toggle history panel
    const toggleHistoryBtn = target.closest('[data-action="toggle-history"]');
    if (toggleHistoryBtn) {
      e.preventDefault();
      this.historyOpen = !this.historyOpen;
      const panel = this.container.querySelector('#transcription-history-panel');
      if (panel) {
        panel.style.display = this.historyOpen ? 'block' : 'none';
        panel.classList.toggle('is-open', this.historyOpen);
      }
      this.updateHistoryButton();
      if (this.historyOpen) {
        this.updateHistoryList();
      }
      return;
    }

    // 6. Preview historical version
    const previewBtn = target.closest('[data-action="preview-version"]');
    if (previewBtn) {
      e.preventDefault();
      const versionId = previewBtn.getAttribute('data-version-id');
      const found = this.history.find(v => v && v.id === versionId);
      if (found) {
        this.previewVersion = found;
        this.renderModals();
      }
      return;
    }

    // 7. Close preview modal
    const closePreviewBtn = target.closest('[data-action="close-preview"]');
    if (closePreviewBtn) {
      e.preventDefault();
      this.previewVersion = null;
      this.renderModals();
      return;
    }

    // 8. Request restore (opens confirmation dialog)
    const requestRestoreBtn = target.closest('[data-action="request-restore"]');
    if (requestRestoreBtn) {
      e.preventDefault();
      const versionId = requestRestoreBtn.getAttribute('data-version-id');
      const found = this.history.find(v => v && v.id === versionId);
      if (found) {
        this.previewVersion = null; // close preview if open
        this.confirmRestoreVersion = found;
        this.renderModals();
      }
      return;
    }

    // 9. Cancel restore
    const cancelRestoreBtn = target.closest('[data-action="cancel-restore"]');
    if (cancelRestoreBtn) {
      e.preventDefault();
      this.confirmRestoreVersion = null;
      this.renderModals();
      return;
    }

    // 10. Confirm restore
    const confirmRestoreBtn = target.closest('[data-action="confirm-restore"]');
    if (confirmRestoreBtn) {
      e.preventDefault();
      const versionId = confirmRestoreBtn.getAttribute('data-version-id');
      this.handleRestore(versionId);
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
      }, { source: 'verification', changeNote: 'प्रमाणित प्रतिलिपि', createVersion: true });

      this.manuscript = updated;
      this.status = 'verified';
      this.verifiedAt = updated.transcription.verifiedAt;
      this.history = this.repository.getTranscriptionHistory(this.manuscriptId);
      this.isDirty = false;
      this.saveError = null;

      this.updateSaveStatus('saved');
      this.updateStatusPill();
      this.updateHistoryButton();
      if (this.historyOpen) {
        this.updateHistoryList();
      }
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
   * Restores a historical version as active transcription and creates a restore version snapshot
   */
  handleRestore(versionId) {
    if (!versionId) return;

    try {
      const updated = this.repository.restoreTranscriptionVersion(this.manuscriptId, versionId);
      this.manuscript = updated;
      this.text = updated.transcription.text || '';
      this.status = updated.transcription.status || 'draft';
      this.verifiedAt = updated.transcription.verifiedAt || null;
      this.history = this.repository.getTranscriptionHistory(this.manuscriptId);
      this.isDirty = false;
      this.saveError = null;

      const textarea = this.container.querySelector('#transcription-textarea');
      if (textarea) textarea.value = this.text;

      this.updateMetrics();
      this.updateStatusPill();
      this.updateSaveStatus('saved');
      this.updateHistoryButton();
      if (this.historyOpen) {
        this.updateHistoryList();
      }

      this.confirmRestoreVersion = null;
      this.previewVersion = null;
      this.renderModals();
    } catch (err) {
      this.saveStatus = 'error';
      this.saveError = err.message || 'पुनर्स्थापित करने में त्रुटि हुई।';
      this.updateSaveStatus('error');
    }
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
      this.performAutosave({ source: 'manual-save', createVersion: true });
    }
  }

  /**
   * Renders localized 404 state if manuscript is not found
   */
  renderNotFound() {
    this.container.innerHTML = `
      <div class="transcription-workspace-view" role="region" aria-label="पांडुलिपि प्रतिलिपि त्रुटि">
        <div style="max-width: 600px; margin: var(--space-12) auto; text-align: center; padding: var(--space-8);">
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
   * Renders history card list content
   */
  renderHistoryContent() {
    if (!this.history || this.history.length === 0) {
      return `
        <div class="history-empty-state">
          <p class="history-empty-text">अभी तक कोई पिछला संस्करण सहेजा नहीं गया है। प्रतिलिपि सहेजने पर स्वतः संस्करण निर्मित होंगे।</p>
        </div>
      `;
    }

    const sorted = [...this.history].reverse();
    const activeVersionId = this.manuscript?.transcription?.currentVersionId;

    return `
      <div class="history-card-list" role="list">
        ${sorted.map(v => {
          const isActive = v.id === activeVersionId;
          const snippet = v.text ? v.text.split(/\r?\n/).slice(0, 2).join(' ') : '—';
          return `
            <article class="history-card ${isActive ? 'is-active' : ''}" role="listitem">
              <div class="history-card-header">
                <div class="history-card-meta">
                  <span class="history-version-badge">v${v.versionNumber}</span>
                  <span class="transcription-status-pill status-${v.status}">
                    ${this.formatStatus(v.status)}
                  </span>
                  <span class="history-source-badge">${this.formatSource(v.source)}</span>
                  ${isActive ? '<span class="history-active-badge">वर्तमान सक्रिय</span>' : ''}
                </div>
                <time class="history-time">${formatPoeticDate(v.createdAt)}</time>
              </div>

              ${v.changeNote ? `<div class="history-note"><em>${this.escapeHtml(v.changeNote)}</em></div>` : ''}

              <div class="history-preview-snippet">
                "${this.escapeHtml(snippet)}"
              </div>

              <div class="history-card-actions">
                <button
                  type="button"
                  class="btn-history-action btn-history-preview"
                  data-action="preview-version"
                  data-version-id="${v.id}"
                  aria-label="संस्करण ${v.versionNumber} का पूर्वावलोकन करें"
                >
                  ${getIconSvg('eye', 'btn-icon')}
                  <span>पूर्वावलोकन</span>
                </button>
                <button
                  type="button"
                  class="btn-history-action btn-history-restore"
                  data-action="request-restore"
                  data-version-id="${v.id}"
                  aria-label="संस्करण ${v.versionNumber} पुनर्स्थापित करें"
                >
                  ${getIconSvg('restore', 'btn-icon')}
                  <span>पुनर्स्थापित करें</span>
                </button>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Renders modal dialogs for preview and restore confirmation
   */
  renderModals() {
    const modalContainer = this.container.querySelector('#transcription-modal-container');
    if (!modalContainer) return;

    if (this.previewVersion) {
      const v = this.previewVersion;
      modalContainer.innerHTML = `
        <div class="transcription-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="preview-modal-title">
          <div class="transcription-modal-box">
            <header class="transcription-modal-header">
              <div>
                <h3 id="preview-modal-title" class="transcription-modal-title">
                  संस्करण v${v.versionNumber} — पूर्वावलोकन (केवल पढ़ने योग्य)
                </h3>
                <p class="transcription-modal-subtitle">
                  यह एक सुरक्षित, केवल पढ़ने योग्य पूर्वावलोकन है। आपके मौजूदा कार्य में कोई परिवर्तन नहीं हुआ है।
                </p>
              </div>
              <button type="button" class="btn-modal-close" data-action="close-preview" aria-label="पूर्वावलोकन बंद करें">
                ${getIconSvg('close', 'btn-icon')}
              </button>
            </header>

            <div class="transcription-modal-meta">
              <span class="history-version-badge">v${v.versionNumber}</span>
              <span class="transcription-status-pill status-${v.status}">${this.formatStatus(v.status)}</span>
              <span class="history-source-badge">${this.formatSource(v.source)}</span>
              <time class="history-time">${formatPoeticDate(v.createdAt)}</time>
            </div>

            <div class="transcription-modal-content">
              <pre class="transcription-modal-pre">${this.escapeHtml(v.text || '—')}</pre>
            </div>

            <footer class="transcription-modal-footer">
              <button type="button" class="btn-modal-secondary" data-action="close-preview">
                वर्तमान संस्करण रखें
              </button>
              <button
                type="button"
                class="btn-modal-primary"
                data-action="request-restore"
                data-version-id="${v.id}"
              >
                ${getIconSvg('restore', 'btn-icon')}
                <span>यह संस्करण पुनर्स्थापित करें</span>
              </button>
            </footer>
          </div>
        </div>
      `;
      return;
    }

    if (this.confirmRestoreVersion) {
      const v = this.confirmRestoreVersion;
      modalContainer.innerHTML = `
        <div class="transcription-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
          <div class="transcription-modal-box confirm-box">
            <header class="transcription-modal-header">
              <h3 id="confirm-modal-title" class="transcription-modal-title">
                पुनर्स्थापना की पुष्टि
              </h3>
              <button type="button" class="btn-modal-close" data-action="cancel-restore" aria-label="रद्द करें">
                ${getIconSvg('close', 'btn-icon')}
              </button>
            </header>

            <div class="transcription-modal-body">
              <p class="confirm-prompt">
                क्या आप <strong>संस्करण v${v.versionNumber}</strong> को वर्तमान प्रतिलिपि के रूप में पुनर्स्थापित करना चाहते हैं?
              </p>
              <div class="confirm-archival-note">
                <span class="note-icon" aria-hidden="true">ℹ️</span>
                <p>
                  <strong>पुरातात्विक सुरक्षा:</strong> आपकी वर्तमान प्रतिलिपि सुरक्षित रहेगी। पुनर्स्थापना एक नया संस्करण बनाएगी। मूल पांडुलिपि छवि और संबद्ध कविता पूर्णतः अपरिवर्तित रहेंगी।
                </p>
              </div>
            </div>

            <footer class="transcription-modal-footer">
              <button type="button" class="btn-modal-secondary" data-action="cancel-restore">
                रद्द करें
              </button>
              <button
                type="button"
                class="btn-modal-confirm"
                data-action="confirm-restore"
                data-version-id="${v.id}"
              >
                ${getIconSvg('restore', 'btn-icon')}
                <span>हाँ, संस्करण v${v.versionNumber} पुनर्स्थापित करें</span>
              </button>
            </footer>
          </div>
        </div>
      `;
      return;
    }

    modalContainer.innerHTML = '';
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

            <!-- Version History Toggle Button -->
            <button
              type="button"
              class="btn-workspace-action btn-workspace-history ${this.historyOpen ? 'active' : ''}"
              data-action="toggle-history"
              aria-expanded="${this.historyOpen}"
              aria-label="प्रतिलिपि संस्करण इतिहास देखें"
              title="संस्करण इतिहास"
            >
              ${getIconSvg('clock', 'btn-icon')}
              <span class="history-count-label">इतिहास (${this.history ? this.history.length : 0})</span>
            </button>

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

        <!-- Collapsible Version History Section -->
        <section
          id="transcription-history-panel"
          class="transcription-history-section ${this.historyOpen ? 'is-open' : ''}"
          aria-label="प्रतिलिपि संस्करण इतिहास"
          style="${this.historyOpen ? 'display: block;' : 'display: none;'}"
        >
          <div class="history-section-header">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              ${getIconSvg('clock', 'history-header-icon')}
              <h3 class="history-section-title">प्रतिलिपि संस्करण इतिहास</h3>
              <span class="history-total-count">(${this.history ? this.history.length : 0} संस्करण)</span>
            </div>
            <p class="history-section-desc">
              प्रत्येक सहेजे गए परिवर्तन का पुरातात्विक स्नैपशॉट। पिछला संस्करण पुनर्स्थापित करने पर एक नया ऑडिट संस्करण बनेगा।
            </p>
          </div>

          <div id="transcription-history-content">
            ${this.renderHistoryContent()}
          </div>
        </section>

        <!-- Modal Container for Preview and Restore Confirmation -->
        <div id="transcription-modal-container"></div>
      </div>
    `;
  }
}
