/**
 * काव्यकलश (KavyaVault) — Poetry Reader Component (PoemReader.js)
 * Dignified reading sanctuary with full lifecycle actions: Favorite toggle,
 * Archive/Restore, Delete confirmation modal, and Edit routing.
 */

import { poemRepository } from '../../services/PoemRepository.js';
import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { poemAnalysisService } from '../../services/ai/PoemAnalysisService.js';
import { ANALYSIS_STATUS, SUGGESTION_REVIEW_STATE } from '../../services/ai/analysisTypes.js';
import {
  createReviewSession,
  acceptSuggestion,
  editSuggestion,
  rejectSuggestion,
  resetSuggestion,
  computeApprovedChanges
} from '../../services/ai/suggestionReview.js';
import { formatPoeticDate } from '../../utils/date.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

export class PoemReader {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   * @param {string} options.poemId Unique poem ID
   * @param {Object} [options.poemRepo=poemRepository] Poem repository instance
   * @param {Object} [options.manuscriptRepo=manuscriptRepository] Manuscript repository instance
   * @param {Object} [options.analysisService=poemAnalysisService] AI analysis service instance
   */
  constructor({ container, router, poemId, poemRepo = poemRepository, manuscriptRepo = manuscriptRepository, analysisService = poemAnalysisService }) {
    this.container = container;
    this.router = router;
    this.poemId = poemId;
    this.poemRepo = poemRepo;
    this.manuscriptRepo = manuscriptRepo;
    this.analysisService = analysisService;
    this.poem = null;
    this.showDeleteModal = false;

    // AI Analysis & Human Review State
    this.showAiConsentModal = false;
    this.aiAnalysisState = 'idle'; // 'idle' | 'consent-required' | 'pending' | 'completed' | 'failed'
    this.aiAnalysisResult = null;
    this.aiAnalysisError = null;
    this.isAnalyzing = false;
    this.aiReviewSession = null;
    this.editingTarget = null; // null | { field: string, itemId?: string }
    this.aiNotificationMessage = null;

    this.boundClickHandler = this.handleClick.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
  }

  /**
   * Mounts the reader into DOM and fetches poem data
   */
  mount() {
    const repo = this.poemRepo || poemRepository;
    this.poem = repo.getById(this.poemId);

    if (!this.poem) {
      this.renderMissingPoem();
      return;
    }

    if (this.aiAnalysisResult && !this.aiReviewSession) {
      this.aiReviewSession = createReviewSession({
        poemId: this.poem.id,
        result: this.aiAnalysisResult,
        currentPoem: this.poem
      });
    }

    this.update();

    this.container.addEventListener('click', this.boundClickHandler);
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.boundKeyDownHandler);
    }
  }

  /**
   * Unmounts reader and cleans up event listeners
   */
  unmount() {
    if (this.container) {
      this.container.removeEventListener('click', this.boundClickHandler);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.boundKeyDownHandler);
    }
  }

  /**
   * Re-renders the reader HTML in place
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
  }

  /**
   * Renders localized 404 state when poem is not found
   */
  renderMissingPoem() {
    this.container.innerHTML = `
      <div class="poem-reader-view standard-page-view" role="region" aria-label="रचना अनुपलब्ध">
        <div class="reader-top-bar">
          <a href="${ROUTES.POEMS}" data-link class="reader-nav-back" aria-label="पुस्तकालय पर लौटें">
            ${getIconSvg('book', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>
        </div>
        <div class="reader-article" style="text-align: center; padding: var(--space-10) var(--space-4);">
          <div class="reader-ornament" aria-hidden="true">❦</div>
          <h2 class="reader-poem-title" style="margin-top: var(--space-2);">रचना अप्राप्य</h2>
          <p style="font-family: var(--font-interface); color: var(--color-text-muted); margin: var(--space-3) 0 var(--space-6) 0;">
            जिस काव्य पन्ने की आप खोज कर रहे हैं, वह इस संग्रह में उपस्थित नहीं है अथवा हटा दिया गया है।
          </p>
          <div>
            <a href="${ROUTES.POEMS}" data-link class="btn-reader-action" style="padding: 0 var(--space-5); text-decoration: none; display: inline-flex;">
              ${getIconSvg('book', 'nav-icon')}
              <span>पुस्तकालय पर लौटें</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Escapes HTML to prevent injection while preserving verse integrity
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
   * Formats multiline poetry body into semantic stanzas and verse lines
   */
  renderStanzas(bodyText) {
    if (!bodyText || typeof bodyText !== 'string') return '';

    // Split on double newlines to delineate stanzas
    const rawStanzas = bodyText.split(/\r?\n\s*\r?\n/);

    return rawStanzas
      .map(stanza => {
        const lines = stanza.split(/\r?\n/);
        const linesHtml = lines
          .map(line => {
            const trimmed = line.trim();
            if (!trimmed) {
              return '<div class="reader-stanza-spacer" aria-hidden="true"></div>';
            }
            return `<p class="reader-verse-line">${this.escapeHtml(line)}</p>`;
          })
          .join('');

        return `<div class="reader-stanza">${linesHtml}</div>`;
      })
      .join('');
  }

  /**
   * Returns complete HTML for Reader
   */
  render() {
    const poem = this.poem;
    if (!poem) return '';

    const formattedDate = formatPoeticDate(poem.updatedAt || poem.createdAt);
    const createdDate = formatPoeticDate(poem.createdAt);

    const isFavorite = Boolean(poem.isFavorite);
    const isArchived = Boolean(poem.isArchived);

    // Tags rendering
    const tagsHtml = (Array.isArray(poem.tags) && poem.tags.length > 0)
      ? `<div class="reader-tags">${poem.tags.map(t => `<span class="reader-tag">#${this.escapeHtml(t)}</span>`).join('')}</div>`
      : '';

    // Archived banner
    const archiveBannerHtml = isArchived ? `
      <div class="reader-archived-banner" role="status">
        <div class="banner-content">
          ${getIconSvg('archive', 'nav-icon')}
          <span>यह रचना आपके अभिलेखागार में सुरक्षित है।</span>
        </div>
        <button
          type="button"
          class="btn-banner-restore"
          data-action="toggle-archive"
          aria-label="मुख्य पुस्तकालय में पुनर्स्थापित करें"
        >
          ${getIconSvg('restore', 'nav-icon')}
          <span>मुख्य पुस्तकालय में लाएं</span>
        </button>
      </div>
    ` : '';

    // Delete confirmation modal
    const deleteModalHtml = this.showDeleteModal ? `
      <div class="delete-modal-backdrop" id="delete-modal-backdrop" role="presentation">
        <div
          class="delete-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-desc"
        >
          <div class="delete-modal-header">
            <h3 id="delete-dialog-title" class="delete-modal-title">क्या आप इस रचना को हटाना चाहते हैं?</h3>
          </div>
          <div class="delete-modal-body">
            <p id="delete-dialog-desc">
              "<strong>${this.escapeHtml(poem.title)}</strong>" हमेशा के लिए संग्रह से मिटा दी जाएगी। यह क्रिया पूर्ववत नहीं की जा सकती।
            </p>
          </div>
          <div class="delete-modal-actions">
            <button
              type="button"
              class="btn-modal-cancel"
              data-action="close-delete-modal"
              aria-label="हटाने की प्रक्रिया रद्द करें"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-modal-confirm"
              data-action="confirm-delete"
              aria-label="रचना स्थायी रूप से हटाएं"
            >
              स्थायी रूप से हटाएं
            </button>
          </div>
        </div>
      </div>
    ` : '';

    // AI Consent Confirmation Modal
    const aiConsentModalHtml = this.renderAiConsentModal();

    return `
      <div class="poem-reader-view standard-page-view" role="region" aria-label="काव्य पठन कक्ष">
        <!-- Top Action Toolbar -->
        <header class="reader-top-bar" role="toolbar" aria-label="पठन नियंत्रण पट्टी">
          <a href="${ROUTES.POEMS}" data-link class="reader-nav-back" aria-label="पुस्तकालय पर लौटें">
            ${getIconSvg('book', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>

          <div class="reader-lifecycle-actions" role="group" aria-label="रचना क्रियाएँ">
            <!-- AI Analysis Entry Point -->
            <button
              type="button"
              class="btn-reader-action btn-reader-ai ${this.aiAnalysisState === 'pending' ? 'is-loading' : ''}"
              data-action="open-ai-consent"
              aria-label="AI से विश्लेषण करें"
              title="AI से विश्लेषण करें"
              ${this.isAnalyzing ? 'disabled' : ''}
            >
              ${getIconSvg('sparkles', 'nav-icon')}
              <span>${this.aiAnalysisState === 'pending' ? 'विश्लेषण जारी...' : 'AI से विश्लेषण करें'}</span>
            </button>

            <!-- Favorite Action -->
            <button
              type="button"
              class="btn-reader-action btn-reader-fav ${isFavorite ? 'is-favorite' : ''}"
              data-action="toggle-fav"
              aria-label="${isFavorite ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें'}"
              aria-pressed="${isFavorite}"
              title="${isFavorite ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें'}"
            >
              ${getIconSvg(isFavorite ? 'heart-filled' : 'heart', 'nav-icon')}
              <span>${isFavorite ? 'पसंदीदा' : 'पसंद'}</span>
            </button>

            <!-- Edit Action -->
            <a
              href="/poems/${poem.id}/edit"
              data-link
              class="btn-reader-action btn-reader-edit"
              aria-label="रचना संपादित करें"
              title="रचना संपादित करें"
            >
              ${getIconSvg('edit', 'nav-icon')}
              <span>संपादित करें</span>
            </a>

            <!-- Archive / Restore Action -->
            <button
              type="button"
              class="btn-reader-action btn-reader-archive"
              data-action="toggle-archive"
              aria-label="${isArchived ? 'पुनर्स्थापित करें' : 'अभिलेख में भेजें'}"
              title="${isArchived ? 'पुनर्स्थापित करें' : 'अभिलेख में भेजें'}"
            >
              ${getIconSvg(isArchived ? 'restore' : 'archive', 'nav-icon')}
              <span>${isArchived ? 'पुनर्स्थापित करें' : 'अभिलेख'}</span>
            </button>

            <!-- Delete Action -->
            <button
              type="button"
              class="btn-reader-action btn-reader-delete"
              data-action="open-delete-modal"
              aria-label="रचना हटाएं"
              title="रचना हटाएं"
            >
              ${getIconSvg('trash', 'nav-icon')}
              <span>हटाएं</span>
            </button>
          </div>
        </header>

        <!-- Archived Status Banner -->
        ${archiveBannerHtml}

        <!-- Sanctuary: The Poem Article -->
        <article class="reader-article" aria-labelledby="poem-reader-title">
          <header class="reader-header">
            <h1 id="poem-reader-title" class="reader-poem-title">
              ${this.escapeHtml(poem.title || 'शीर्षकहीन रचना')}
            </h1>

            <div class="reader-meta">
              <span class="reader-author">${this.escapeHtml(poem.author || 'अज्ञात')}</span>
              ${poem.category ? `
                <span class="reader-meta-dot" aria-hidden="true">•</span>
                <span class="reader-category" title="श्रेणी">${this.escapeHtml(poem.category)}</span>
              ` : ''}
              ${poem.mood ? `
                <span class="reader-meta-dot" aria-hidden="true">•</span>
                <span class="reader-mood" title="रस / भाव">${this.escapeHtml(poem.mood)}</span>
              ` : ''}
              <span class="reader-meta-dot" aria-hidden="true">•</span>
              <time datetime="${poem.updatedAt || poem.createdAt}">${formattedDate}</time>
            </div>

            ${tagsHtml}
          </header>

          <!-- Poetry Stanzas & Verses -->
          <main class="reader-poetry-canvas">
            ${this.renderStanzas(poem.body)}
          </main>

          <!-- Linked Archival Manuscripts -->
          ${this.renderLinkedManuscriptsSection()}

          <!-- AI Suggestions / Analysis Section -->
          ${this.renderAiSuggestionsSection()}

          <!-- Reader Footer: Dingbat & Timestamps -->
          <footer class="reader-footer">
            <div class="reader-ornament" aria-hidden="true">❦</div>
            <div class="reader-timestamp">
              <span>रचना तिथि: ${createdDate}</span>
              ${poem.updatedAt && poem.updatedAt !== poem.createdAt ? `<span> • अद्यतन: ${formattedDate}</span>` : ''}
            </div>
          </footer>
        </article>

        <!-- Accessible Delete Confirmation Modal -->
        ${deleteModalHtml}

        <!-- Accessible AI Consent Modal -->
        ${aiConsentModalHtml}
      </div>
    `;
  }

  /**
   * Renders accessible AI analysis consent modal
   * @returns {string} HTML string
   */
  renderAiConsentModal() {
    if (!this.showAiConsentModal) return '';

    return `
      <div class="ai-consent-modal-backdrop" id="ai-consent-modal-backdrop" role="presentation">
        <div
          class="ai-consent-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-consent-dialog-title"
          aria-describedby="ai-consent-dialog-desc"
        >
          <div class="ai-consent-modal-header">
            <div class="ai-badge-icon" aria-hidden="true">✨</div>
            <h3 id="ai-consent-dialog-title" class="ai-consent-modal-title">
              क्या आप इस कविता का AI विश्लेषण करना चाहते हैं?
            </h3>
          </div>
          <div class="ai-consent-modal-body">
            <p id="ai-consent-dialog-desc">
              काव्यकलश इस रचना के पाठ के आधार पर उपयुक्त श्रेणी, रस/भाव, विषय, मुख्य शब्द एवं साहित्यिक सारांश का सुझाव देगा।
            </p>
            <div class="ai-consent-notice" role="note">
              <span class="ai-notice-bullet">ℹ️</span>
              <span>
                यह विश्लेषण वर्तमान में कॉन्फ़िगर किए गए प्रदाता द्वारा निष्पादित होगा। परिणाम केवल <strong>AI सुझाव</strong> हैं — आपकी मूल कविता अथवा मेटाडेटा में कोई स्वतः बदलाव नहीं होगा।
              </span>
            </div>
          </div>
          <div class="ai-consent-modal-actions">
            <button
              type="button"
              class="btn-modal-cancel"
              data-action="close-ai-consent"
              aria-label="विश्लेषण प्रक्रिया रद्द करें"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-modal-confirm btn-ai-confirm"
              data-action="confirm-ai-analysis"
              aria-label="सहमति देकर विश्लेषण करें"
            >
              सहमति देकर विश्लेषण करें
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the AI analysis suggestions panel or status lifecycle in the reader view
   * @returns {string} HTML string
   */
  renderAiSuggestionsSection() {
    if (this.aiAnalysisState === 'idle') {
      return '';
    }

    if (this.aiAnalysisState === 'pending') {
      return `
        <section class="reader-ai-section reader-ai-pending" aria-label="AI विश्लेषण प्रगति" role="status" aria-live="polite">
          <div class="ai-status-card">
            <div class="ai-spinner" aria-hidden="true"></div>
            <div class="ai-status-content">
              <h3 class="ai-status-title">कविता का विश्लेषण किया जा रहा है...</h3>
              <p class="ai-status-desc">साहित्यिक भाव, श्रेणी, विषय और मुख्य शब्दों का अध्ययन जारी है।</p>
            </div>
          </div>
        </section>
      `;
    }

    if (this.aiAnalysisState === 'failed') {
      return `
        <section class="reader-ai-section reader-ai-error" aria-label="AI विश्लेषण त्रुटि" role="alert">
          <div class="ai-status-card is-error">
            <span class="ai-error-icon" aria-hidden="true">⚠️</span>
            <div class="ai-status-content">
              <h3 class="ai-status-title">AI विश्लेषण संपन्न नहीं हो सका</h3>
              <p class="ai-status-desc">${this.escapeHtml(this.aiAnalysisError || 'प्रदाता अनुपलब्ध है अथवा त्रुटि उत्पन्न हुई।')}</p>
            </div>
            <button
              type="button"
              class="btn-reader-action btn-ai-retry"
              data-action="open-ai-consent"
              aria-label="पुनः प्रयास करें"
            >
              ${getIconSvg('sparkles', 'nav-icon')}
              <span>पुनः प्रयास करें</span>
            </button>
          </div>
        </section>
      `;
    }

    if (this.aiAnalysisState === 'completed' && this.aiAnalysisResult) {
      const result = this.aiAnalysisResult;
      const categoryStr = result.category ? result.category.trim() : '';
      const moodStr = result.mood ? result.mood.trim() : '';
      const themesArr = Array.isArray(result.themes) ? result.themes : [];
      const keywordsArr = Array.isArray(result.keywords) ? result.keywords : [];
      const summaryStr = result.summary ? result.summary.trim() : '';

      const hasContent = Boolean(categoryStr || moodStr || themesArr.length > 0 || keywordsArr.length > 0 || summaryStr);

      if (!hasContent) {
        return `
          <section class="reader-ai-section reader-ai-empty" aria-label="AI सुझाव रिक्त">
            <div class="ai-status-card is-empty">
              <span class="ai-empty-icon" aria-hidden="true">🍃</span>
              <div class="ai-status-content">
                <h3 class="ai-status-title">कोई AI सुझाव उपलब्ध नहीं हैं</h3>
                <p class="ai-status-desc">इस कविता के लिए कोई सार्थक सुझाव प्राप्त नहीं हुए।</p>
              </div>
              <button
                type="button"
                class="btn-reader-action btn-ai-retry"
                data-action="open-ai-consent"
                aria-label="पुनः विश्लेषण करें"
              >
                ${getIconSvg('sparkles', 'nav-icon')}
                <span>पुनः विश्लेषण करें</span>
              </button>
            </div>
          </section>
        `;
      }

      if (!this.aiReviewSession) {
        this.aiReviewSession = createReviewSession({
          poemId: this.poem.id,
          result: this.aiAnalysisResult,
          currentPoem: this.poem
        });
      }

      const session = this.aiReviewSession;
      const { changes, hasChanges, approvedCount } = computeApprovedChanges(session, this.poem);

      return `
        <section class="reader-ai-section reader-ai-completed" aria-label="AI विश्लेषण सुझाव">
          <div class="ai-suggestions-container">
            <header class="ai-suggestions-header">
              <div class="ai-suggestions-title-group">
                <span class="ai-badge" aria-label="AI सुझाव">✨ AI सुझाव</span>
                <h2 class="ai-suggestions-heading">कविता विश्लेषण एवं संगठन</h2>
              </div>
              <button
                type="button"
                class="btn-reader-action btn-ai-reanalyze"
                data-action="open-ai-consent"
                aria-label="पुनः विश्लेषण करें"
                title="पुनः विश्लेषण करें"
                ${this.isAnalyzing ? 'disabled' : ''}
              >
                ${getIconSvg('sparkles', 'nav-icon')}
                <span>पुनः विश्लेषण करें</span>
              </button>
            </header>

            <p class="ai-suggestions-disclaimer">
              ये सुझाव केवल अवलोकन हेतु हैं। इन्हें कविता में सहेजा नहीं गया है।
            </p>

            <div class="ai-suggestions-grid">
              ${session.category && session.category.suggestedValue ? `
                <div class="ai-field-card" data-review-field="category">
                  <div class="ai-field-header">
                    <span class="ai-field-tag">AI सुझाव</span>
                    <h3 class="ai-field-label">श्रेणी</h3>
                    <span class="ai-status-badge badge-${session.category.reviewStatus}">
                      ${session.category.reviewStatus === 'accepted' ? '✓ स्वीकृत' : (session.category.reviewStatus === 'edited' ? '✎ संपादित' : (session.category.reviewStatus === 'rejected' ? '✗ अस्वीकृत' : 'सुझाव'))}
                    </span>
                  </div>
                  <div class="ai-field-comparison">
                    <div class="ai-comp-item">
                      <span class="ai-comp-meta">वर्तमान:</span>
                      <span class="ai-comp-val">${this.escapeHtml(this.poem.category || 'कोई नहीं')}</span>
                    </div>
                    <div class="ai-comp-item">
                      <span class="ai-comp-meta">AI सुझाव:</span>
                      <span class="ai-field-value ai-field-highlight ${session.category.reviewStatus === 'rejected' ? 'is-rejected' : ''}">${this.escapeHtml(session.category.suggestedValue)}</span>
                    </div>
                    ${session.category.isEdited ? `
                      <div class="ai-comp-item">
                        <span class="ai-comp-meta">संपादित:</span>
                        <span class="ai-comp-val ai-field-edited">${this.escapeHtml(session.category.approvedValue)}</span>
                      </div>
                    ` : ''}
                  </div>

                  ${(this.editingTarget && this.editingTarget.field === 'category') ? `
                    <div class="ai-inline-editor">
                      <input
                        type="text"
                        id="edit-category-input"
                        class="ai-editor-input"
                        value="${this.escapeHtml(session.category.isEdited ? session.category.approvedValue : session.category.suggestedValue)}"
                        aria-label="श्रेणी संपादित करें"
                        maxlength="100"
                      />
                      <div class="ai-editor-actions">
                        <button type="button" class="btn-review-sm btn-save" data-action="save-edit-suggestion" data-field="category" aria-label="संपादित श्रेणी सहेजें">सहेजें</button>
                        <button type="button" class="btn-review-sm btn-cancel" data-action="cancel-edit-suggestion" aria-label="संपादन रद्द करें">रद्द करें</button>
                      </div>
                    </div>
                  ` : `
                    <div class="ai-review-btn-row">
                      <button
                        type="button"
                        class="btn-review-opt btn-accept ${session.category.reviewStatus === 'accepted' ? 'is-selected' : ''}"
                        data-action="accept-ai-suggestion"
                        data-field="category"
                        aria-label="श्रेणी स्वीकार करें"
                        aria-pressed="${session.category.reviewStatus === 'accepted'}"
                      >
                        ✓ स्वीकार
                      </button>
                      <button
                        type="button"
                        class="btn-review-opt btn-edit ${session.category.reviewStatus === 'edited' ? 'is-selected' : ''}"
                        data-action="edit-ai-suggestion"
                        data-field="category"
                        aria-label="श्रेणी संपादित करें"
                      >
                        ✎ संपादन
                      </button>
                      <button
                        type="button"
                        class="btn-review-opt btn-reject ${session.category.reviewStatus === 'rejected' ? 'is-selected' : ''}"
                        data-action="reject-ai-suggestion"
                        data-field="category"
                        aria-label="श्रेणी अस्वीकार करें"
                        aria-pressed="${session.category.reviewStatus === 'rejected'}"
                      >
                        ✗ अस्वीकार
                      </button>
                      ${session.category.reviewStatus !== 'suggested' ? `
                        <button
                          type="button"
                          class="btn-review-opt btn-reset"
                          data-action="reset-ai-suggestion"
                          data-field="category"
                          aria-label="श्रेणी रीसेट करें"
                        >
                          ↺ रीसेट
                        </button>
                      ` : ''}
                    </div>
                  `}
                </div>
              ` : ''}

              ${session.mood && session.mood.suggestedValue ? `
                <div class="ai-field-card" data-review-field="mood">
                  <div class="ai-field-header">
                    <span class="ai-field-tag">AI सुझाव</span>
                    <h3 class="ai-field-label">मूड / रस</h3>
                    <span class="ai-status-badge badge-${session.mood.reviewStatus}">
                      ${session.mood.reviewStatus === 'accepted' ? '✓ स्वीकृत' : (session.mood.reviewStatus === 'edited' ? '✎ संपादित' : (session.mood.reviewStatus === 'rejected' ? '✗ अस्वीकृत' : 'सुझाव'))}
                    </span>
                  </div>
                  <div class="ai-field-comparison">
                    <div class="ai-comp-item">
                      <span class="ai-comp-meta">वर्तमान:</span>
                      <span class="ai-comp-val">${this.escapeHtml(this.poem.mood || 'कोई नहीं')}</span>
                    </div>
                    <div class="ai-comp-item">
                      <span class="ai-comp-meta">AI सुझाव:</span>
                      <span class="ai-field-value ai-field-highlight ${session.mood.reviewStatus === 'rejected' ? 'is-rejected' : ''}">${this.escapeHtml(session.mood.suggestedValue)}</span>
                    </div>
                    ${session.mood.isEdited ? `
                      <div class="ai-comp-item">
                        <span class="ai-comp-meta">संपादित:</span>
                        <span class="ai-comp-val ai-field-edited">${this.escapeHtml(session.mood.approvedValue)}</span>
                      </div>
                    ` : ''}
                  </div>

                  ${(this.editingTarget && this.editingTarget.field === 'mood') ? `
                    <div class="ai-inline-editor">
                      <input
                        type="text"
                        id="edit-mood-input"
                        class="ai-editor-input"
                        value="${this.escapeHtml(session.mood.isEdited ? session.mood.approvedValue : session.mood.suggestedValue)}"
                        aria-label="मूड संपादित करें"
                        maxlength="50"
                      />
                      <div class="ai-editor-actions">
                        <button type="button" class="btn-review-sm btn-save" data-action="save-edit-suggestion" data-field="mood" aria-label="संपादित मूड सहेजें">सहेजें</button>
                        <button type="button" class="btn-review-sm btn-cancel" data-action="cancel-edit-suggestion" aria-label="संपादन रद्द करें">रद्द करें</button>
                      </div>
                    </div>
                  ` : `
                    <div class="ai-review-btn-row">
                      <button
                        type="button"
                        class="btn-review-opt btn-accept ${session.mood.reviewStatus === 'accepted' ? 'is-selected' : ''}"
                        data-action="accept-ai-suggestion"
                        data-field="mood"
                        aria-label="मूड स्वीकार करें"
                        aria-pressed="${session.mood.reviewStatus === 'accepted'}"
                      >
                        ✓ स्वीकार
                      </button>
                      <button
                        type="button"
                        class="btn-review-opt btn-edit ${session.mood.reviewStatus === 'edited' ? 'is-selected' : ''}"
                        data-action="edit-ai-suggestion"
                        data-field="mood"
                        aria-label="मूड संपादित करें"
                      >
                        ✎ संपादन
                      </button>
                      <button
                        type="button"
                        class="btn-review-opt btn-reject ${session.mood.reviewStatus === 'rejected' ? 'is-selected' : ''}"
                        data-action="reject-ai-suggestion"
                        data-field="mood"
                        aria-label="मूड अस्वीकार करें"
                        aria-pressed="${session.mood.reviewStatus === 'rejected'}"
                      >
                        ✗ अस्वीकार
                      </button>
                      ${session.mood.reviewStatus !== 'suggested' ? `
                        <button
                          type="button"
                          class="btn-review-opt btn-reset"
                          data-action="reset-ai-suggestion"
                          data-field="mood"
                          aria-label="मूड रीसेट करें"
                        >
                          ↺ रीसेट
                        </button>
                      ` : ''}
                    </div>
                  `}
                </div>
              ` : ''}

              ${session.themes && session.themes.length > 0 ? `
                <div class="ai-field-card ai-field-full" data-review-field="themes">
                  <div class="ai-field-header">
                    <span class="ai-field-tag">AI सुझाव</span>
                    <h3 class="ai-field-label">विषय</h3>
                  </div>
                  <div class="ai-chips-list">
                    ${session.themes.map(t => {
                      const isEditingThis = (this.editingTarget && this.editingTarget.field === 'themes' && this.editingTarget.itemId === t.id);
                      if (isEditingThis) {
                        return `
                          <div class="ai-chip-editor">
                            <input
                              type="text"
                              id="edit-themes-${t.id}-input"
                              class="ai-editor-input ai-chip-input"
                              value="${this.escapeHtml(t.isEdited ? t.approvedValue : t.suggestedValue)}"
                              aria-label="विषय संपादित करें"
                              maxlength="60"
                            />
                            <button type="button" class="btn-review-sm btn-save" data-action="save-edit-suggestion" data-field="themes" data-item-id="${t.id}" aria-label="सहेजें">सहेजें</button>
                            <button type="button" class="btn-review-sm btn-cancel" data-action="cancel-edit-suggestion" aria-label="रद्द करें">रद्द करें</button>
                          </div>
                        `;
                      }

                      return `
                        <div class="ai-review-chip ${t.reviewStatus}" data-chip-id="${t.id}">
                          <span class="ai-chip-text ${t.reviewStatus === 'rejected' ? 'is-rejected' : ''}">#${this.escapeHtml(t.isEdited ? t.approvedValue : t.suggestedValue)}</span>
                          <span class="ai-chip-status-icon badge-${t.reviewStatus}" aria-hidden="true">${t.reviewStatus === 'accepted' ? '✓' : (t.reviewStatus === 'edited' ? '✎' : (t.reviewStatus === 'rejected' ? '✗' : ''))}</span>
                          <div class="ai-chip-actions">
                            <button type="button" class="btn-chip-opt btn-opt-accept ${t.reviewStatus === 'accepted' ? 'is-active' : ''}" data-action="accept-ai-suggestion" data-field="themes" data-item-id="${t.id}" aria-label="विषय '${this.escapeHtml(t.suggestedValue)}' स्वीकार करें" title="स्वीकार करें">✓</button>
                            <button type="button" class="btn-chip-opt btn-opt-edit ${t.reviewStatus === 'edited' ? 'is-active' : ''}" data-action="edit-ai-suggestion" data-field="themes" data-item-id="${t.id}" aria-label="विषय '${this.escapeHtml(t.suggestedValue)}' संपादित करें" title="संपादित करें">✎</button>
                            <button type="button" class="btn-chip-opt btn-opt-reject ${t.reviewStatus === 'rejected' ? 'is-active' : ''}" data-action="reject-ai-suggestion" data-field="themes" data-item-id="${t.id}" aria-label="विषय '${this.escapeHtml(t.suggestedValue)}' अस्वीकार करें" title="अस्वीकार करें">✗</button>
                            ${t.reviewStatus !== 'suggested' ? `
                              <button type="button" class="btn-chip-opt btn-opt-reset" data-action="reset-ai-suggestion" data-field="themes" data-item-id="${t.id}" aria-label="विषय '${this.escapeHtml(t.suggestedValue)}' रीसेट करें" title="रीसेट">↺</button>
                            ` : ''}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              ${session.keywords && session.keywords.length > 0 ? `
                <div class="ai-field-card ai-field-full" data-review-field="keywords">
                  <div class="ai-field-header">
                    <span class="ai-field-tag">AI सुझाव</span>
                    <h3 class="ai-field-label">मुख्य शब्द</h3>
                  </div>
                  <div class="ai-chips-list">
                    ${session.keywords.map(k => {
                      const isEditingThis = (this.editingTarget && this.editingTarget.field === 'keywords' && this.editingTarget.itemId === k.id);
                      if (isEditingThis) {
                        return `
                          <div class="ai-chip-editor">
                            <input
                              type="text"
                              id="edit-keywords-${k.id}-input"
                              class="ai-editor-input ai-chip-input"
                              value="${this.escapeHtml(k.isEdited ? k.approvedValue : k.suggestedValue)}"
                              aria-label="मुख्य शब्द संपादित करें"
                              maxlength="40"
                            />
                            <button type="button" class="btn-review-sm btn-save" data-action="save-edit-suggestion" data-field="keywords" data-item-id="${k.id}" aria-label="सहेजें">सहेजें</button>
                            <button type="button" class="btn-review-sm btn-cancel" data-action="cancel-edit-suggestion" aria-label="रद्द करें">रद्द करें</button>
                          </div>
                        `;
                      }

                      return `
                        <div class="ai-review-chip ${k.reviewStatus}" data-chip-id="${k.id}">
                          <span class="ai-chip-text ${k.reviewStatus === 'rejected' ? 'is-rejected' : ''}">${this.escapeHtml(k.isEdited ? k.approvedValue : k.suggestedValue)}</span>
                          <span class="ai-chip-status-icon badge-${k.reviewStatus}" aria-hidden="true">${k.reviewStatus === 'accepted' ? '✓' : (k.reviewStatus === 'edited' ? '✎' : (k.reviewStatus === 'rejected' ? '✗' : ''))}</span>
                          <div class="ai-chip-actions">
                            <button type="button" class="btn-chip-opt btn-opt-accept ${k.reviewStatus === 'accepted' ? 'is-active' : ''}" data-action="accept-ai-suggestion" data-field="keywords" data-item-id="${k.id}" aria-label="मुख्य शब्द '${this.escapeHtml(k.suggestedValue)}' स्वीकार करें" title="स्वीकार करें">✓</button>
                            <button type="button" class="btn-chip-opt btn-opt-edit ${k.reviewStatus === 'edited' ? 'is-active' : ''}" data-action="edit-ai-suggestion" data-field="keywords" data-item-id="${k.id}" aria-label="मुख्य शब्द '${this.escapeHtml(k.suggestedValue)}' संपादित करें" title="संपादित करें">✎</button>
                            <button type="button" class="btn-chip-opt btn-opt-reject ${k.reviewStatus === 'rejected' ? 'is-active' : ''}" data-action="reject-ai-suggestion" data-field="keywords" data-item-id="${k.id}" aria-label="मुख्य शब्द '${this.escapeHtml(k.suggestedValue)}' अस्वीकार करें" title="अस्वीकार करें">✗</button>
                            ${k.reviewStatus !== 'suggested' ? `
                              <button type="button" class="btn-chip-opt btn-opt-reset" data-action="reset-ai-suggestion" data-field="keywords" data-item-id="${k.id}" aria-label="मुख्य शब्द '${this.escapeHtml(k.suggestedValue)}' रीसेट करें" title="रीसेट">↺</button>
                            ` : ''}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              ` : ''}

              ${session.summary && session.summary.suggestedValue ? `
                <div class="ai-field-card ai-field-full" data-review-field="summary">
                  <div class="ai-field-header">
                    <span class="ai-field-tag">AI सुझाव</span>
                    <h3 class="ai-field-label">सारांश</h3>
                    <span class="ai-status-badge badge-${session.summary.reviewStatus}">
                      ${session.summary.reviewStatus === 'accepted' ? '✓ स्वीकृत' : (session.summary.reviewStatus === 'edited' ? '✎ संपादित' : (session.summary.reviewStatus === 'rejected' ? '✗ अस्वीकृत' : 'सुझाव'))}
                    </span>
                  </div>

                  ${(this.editingTarget && this.editingTarget.field === 'summary') ? `
                    <div class="ai-inline-editor">
                      <textarea
                        id="edit-summary-input"
                        class="ai-editor-input ai-editor-textarea"
                        aria-label="सारांश संपादित करें"
                        rows="3"
                        maxlength="500"
                      >${this.escapeHtml(session.summary.isEdited ? session.summary.approvedValue : session.summary.suggestedValue)}</textarea>
                      <div class="ai-editor-actions">
                        <button type="button" class="btn-review-sm btn-save" data-action="save-edit-suggestion" data-field="summary" aria-label="संपादित सारांश सहेजें">सहेजें</button>
                        <button type="button" class="btn-review-sm btn-cancel" data-action="cancel-edit-suggestion" aria-label="संपादन रद्द करें">रद्द करें</button>
                      </div>
                    </div>
                  ` : `
                    <blockquote class="ai-summary-text ${session.summary.reviewStatus === 'rejected' ? 'is-rejected' : ''}">${this.escapeHtml(session.summary.isEdited ? session.summary.approvedValue : session.summary.suggestedValue)}</blockquote>
                    <div class="ai-review-btn-row" style="margin-top: var(--space-3);">
                      <button
                        type="button"
                        class="btn-review-opt btn-accept ${session.summary.reviewStatus === 'accepted' ? 'is-selected' : ''}"
                        data-action="accept-ai-suggestion"
                        data-field="summary"
                        aria-label="सारांश स्वीकार करें"
                        aria-pressed="${session.summary.reviewStatus === 'accepted'}"
                      >
                        ✓ स्वीकार
                      </button>
                      <button
                        type="button"
                        class="btn-review-opt btn-edit ${session.summary.reviewStatus === 'edited' ? 'is-selected' : ''}"
                        data-action="edit-ai-suggestion"
                        data-field="summary"
                        aria-label="सारांश संपादित करें"
                      >
                        ✎ संपादन
                      </button>
                      <button
                        type="button"
                        class="btn-review-opt btn-reject ${session.summary.reviewStatus === 'rejected' ? 'is-selected' : ''}"
                        data-action="reject-ai-suggestion"
                        data-field="summary"
                        aria-label="सारांश अस्वीकार करें"
                        aria-pressed="${session.summary.reviewStatus === 'rejected'}"
                      >
                        ✗ अस्वीकार
                      </button>
                      ${session.summary.reviewStatus !== 'suggested' ? `
                        <button
                          type="button"
                          class="btn-review-opt btn-reset"
                          data-action="reset-ai-suggestion"
                          data-field="summary"
                          aria-label="सारांश रीसेट करें"
                        >
                          ↺ रीसेट
                        </button>
                      ` : ''}
                    </div>
                  `}
                </div>
              ` : ''}
            </div>

            <!-- Review Action Toolbar -->
            <div class="ai-review-toolbar" role="group" aria-label="समीक्षा नियंत्रण पट्टी">
              <div class="ai-review-stats">
                <span class="ai-review-approved-count">स्वीकृत सुझाव: <strong>${approvedCount}</strong></span>
                ${hasChanges ? '<span class="ai-review-changes-notice">• सहेजने हेतु तैयार</span>' : ''}
              </div>
              <div class="ai-review-actions-group">
                <button
                  type="button"
                  class="btn-reader-action btn-review-discard"
                  data-action="discard-ai-review"
                  aria-label="समीक्षा रद्द करें"
                >
                  समीक्षा रद्द करें
                </button>
                <button
                  type="button"
                  class="btn-reader-action btn-review-apply ${hasChanges ? 'is-ready' : ''}"
                  data-action="apply-ai-suggestions"
                  aria-label="स्वीकृत सुझाव सहेजें"
                  ${hasChanges ? '' : 'disabled'}
                >
                  ${getIconSvg('sparkles', 'nav-icon')}
                  <span>स्वीकृत सुझाव सहेजें</span>
                </button>
              </div>
            </div>

            ${this.aiNotificationMessage ? `
              <div class="ai-review-notification" role="status" aria-live="polite">
                <span class="ai-notification-icon">✓</span>
                <span>${this.escapeHtml(this.aiNotificationMessage)}</span>
              </div>
            ` : ''}
          </div>
        </section>
      `;
    }

    return '';
  }

  /**
   * Central click event delegation handler
   */
  handleClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');

    if (action === 'toggle-fav') {
      this.toggleFavorite();
    } else if (action === 'toggle-archive') {
      this.toggleArchive();
    } else if (action === 'open-delete-modal') {
      this.openDeleteModal();
    } else if (action === 'close-delete-modal') {
      this.closeDeleteModal();
    } else if (action === 'confirm-delete') {
      this.confirmDelete();
    } else if (action === 'open-ai-consent') {
      this.openAiConsentModal();
    } else if (action === 'close-ai-consent') {
      this.closeAiConsentModal();
    } else if (action === 'confirm-ai-analysis') {
      this.confirmAiAnalysis();
    } else if (action === 'accept-ai-suggestion') {
      const field = actionEl.getAttribute('data-field');
      const itemId = actionEl.getAttribute('data-item-id');
      this.handleAcceptSuggestion(field, itemId);
    } else if (action === 'edit-ai-suggestion') {
      const field = actionEl.getAttribute('data-field');
      const itemId = actionEl.getAttribute('data-item-id');
      this.handleStartEditSuggestion(field, itemId);
    } else if (action === 'save-edit-suggestion') {
      const field = actionEl.getAttribute('data-field');
      const itemId = actionEl.getAttribute('data-item-id');
      const explicitVal = (event && event.editValue !== undefined) ? event.editValue : null;
      this.handleSaveEditSuggestion(field, itemId, explicitVal);
    } else if (action === 'cancel-edit-suggestion') {
      this.handleCancelEditSuggestion();
    } else if (action === 'reject-ai-suggestion') {
      const field = actionEl.getAttribute('data-field');
      const itemId = actionEl.getAttribute('data-item-id');
      this.handleRejectSuggestion(field, itemId);
    } else if (action === 'reset-ai-suggestion') {
      const field = actionEl.getAttribute('data-field');
      const itemId = actionEl.getAttribute('data-item-id');
      this.handleResetSuggestion(field, itemId);
    } else if (action === 'apply-ai-suggestions') {
      this.handleApplyApprovedSuggestions();
    } else if (action === 'discard-ai-review') {
      this.handleDiscardReview();
    }
  }

  /**
   * Accepts a specific candidate suggestion
   */
  handleAcceptSuggestion(field, itemId = null) {
    if (!this.aiReviewSession) return;
    acceptSuggestion(this.aiReviewSession, field, itemId);
    if (this.editingTarget && this.editingTarget.field === field && (!itemId || this.editingTarget.itemId === itemId)) {
      this.editingTarget = null;
    }
    this.aiNotificationMessage = null;
    this.update();
  }

  /**
   * Enters inline edit mode for a suggestion
   */
  handleStartEditSuggestion(field, itemId = null) {
    this.editingTarget = { field, itemId: itemId || null };
    this.aiNotificationMessage = null;
    this.update();

    if (this.container && typeof this.container.querySelector === 'function') {
      const inputEl = this.container.querySelector('.ai-editor-input');
      if (inputEl && typeof inputEl.focus === 'function') {
        inputEl.focus();
      }
    }
  }

  /**
   * Saves human-edited text for a candidate suggestion
   */
  handleSaveEditSuggestion(field, itemId = null, explicitValue = null) {
    if (!this.aiReviewSession) return;
    let newValue = explicitValue;
    if (newValue === null && this.container && typeof this.container.querySelector === 'function') {
      const inputEl = this.container.querySelector('#edit-' + field + (itemId ? '-' + itemId : '') + '-input')
        || this.container.querySelector('.ai-editor-input');
      if (inputEl && inputEl.value !== undefined) {
        newValue = inputEl.value;
      }
    }
    if (typeof newValue === 'string' && newValue.trim() !== '') {
      editSuggestion(this.aiReviewSession, field, newValue.trim(), itemId);
    }
    this.editingTarget = null;
    this.aiNotificationMessage = null;
    this.update();
  }

  /**
   * Cancels editing a suggestion
   */
  handleCancelEditSuggestion() {
    this.editingTarget = null;
    this.update();
  }

  /**
   * Rejects a candidate suggestion
   */
  handleRejectSuggestion(field, itemId = null) {
    if (!this.aiReviewSession) return;
    rejectSuggestion(this.aiReviewSession, field, itemId);
    if (this.editingTarget && this.editingTarget.field === field && (!itemId || this.editingTarget.itemId === itemId)) {
      this.editingTarget = null;
    }
    this.aiNotificationMessage = null;
    this.update();
  }

  /**
   * Resets a suggestion to initial suggested state
   */
  handleResetSuggestion(field, itemId = null) {
    if (!this.aiReviewSession) return;
    resetSuggestion(this.aiReviewSession, field, itemId);
    if (this.editingTarget && this.editingTarget.field === field && (!itemId || this.editingTarget.itemId === itemId)) {
      this.editingTarget = null;
    }
    this.aiNotificationMessage = null;
    this.update();
  }

  /**
   * Applies approved suggestions explicitly to PoemRepository
   */
  handleApplyApprovedSuggestions() {
    if (!this.aiReviewSession || !this.poem) return;
    const { changes, hasChanges, approvedCount } = computeApprovedChanges(this.aiReviewSession, this.poem);
    if (!hasChanges && approvedCount === 0) return;

    try {
      const repo = this.poemRepo || poemRepository;
      const updated = repo.update(this.poem.id, changes);
      this.poem = updated;
      this.aiNotificationMessage = `स्वीकृत सुझाव सफलतापूर्वक कविता में सहेजे गए (${approvedCount} स्वीकृत)।`;
      this.editingTarget = null;
      this.update();
    } catch (err) {
      this.aiNotificationMessage = `सुझाव सहेजने में त्रुटि: ${err.message}`;
      this.update();
    }
  }

  /**
   * Discards the active AI suggestions review without saving
   */
  handleDiscardReview() {
    this.aiReviewSession = null;
    this.aiAnalysisResult = null;
    this.aiAnalysisState = 'idle';
    this.editingTarget = null;
    this.aiNotificationMessage = null;
    this.update();
  }

  /**
   * Opens AI analysis explicit consent modal
   */
  openAiConsentModal() {
    if (this.isAnalyzing) return;
    this.showAiConsentModal = true;
    this.update();

    // Safe keyboard focus on confirm action
    const confirmBtn = this.container.querySelector('.btn-ai-confirm');
    if (confirmBtn) confirmBtn.focus();
  }

  /**
   * Closes AI analysis consent modal without performing analysis
   */
  closeAiConsentModal() {
    this.showAiConsentModal = false;
    this.update();
  }

  /**
   * Executes AI analysis request through PoemAnalysisService following explicit consent
   */
  async confirmAiAnalysis() {
    if (this.isAnalyzing || !this.poem) return;

    this.showAiConsentModal = false;
    this.isAnalyzing = true;
    this.aiAnalysisState = 'pending';
    this.aiAnalysisError = null;
    this.update();

    try {
      const service = this.analysisService || poemAnalysisService;
      const res = await service.analyzePoem({
        poemId: this.poem.id,
        title: this.poem.title,
        body: this.poem.body,
        author: this.poem.author,
        tags: this.poem.tags,
        analysisConsent: true
      });

      if (res && res.status === ANALYSIS_STATUS.COMPLETED && res.result) {
        this.aiAnalysisState = 'completed';
        this.aiAnalysisResult = res.result;
        this.aiAnalysisError = null;
        this.aiReviewSession = createReviewSession({
          poemId: this.poem.id,
          result: res.result,
          currentPoem: this.poem
        });
        this.editingTarget = null;
        this.aiNotificationMessage = null;
      } else {
        this.aiAnalysisState = 'failed';
        this.aiAnalysisError = (res && res.error) ? res.error : 'विश्लेषण परिणाम प्राप्त नहीं हो सका।';
        this.aiAnalysisResult = null;
        this.aiReviewSession = null;
        this.editingTarget = null;
        this.aiNotificationMessage = null;
      }
    } catch (err) {
      this.aiAnalysisState = 'failed';
      this.aiAnalysisError = err.message || 'अप्रत्याशित त्रुटि उत्पन्न हुई।';
      this.aiAnalysisResult = null;
      this.aiReviewSession = null;
      this.editingTarget = null;
      this.aiNotificationMessage = null;
    } finally {
      this.isAnalyzing = false;
      this.update();
    }
  }

  /**
   * Toggles favorite status in PoemRepository and updates view
   */
  toggleFavorite() {
    if (!this.poem) return;
    try {
      const repo = this.poemRepo || poemRepository;
      const updated = repo.setFavorite(this.poem.id, !this.poem.isFavorite);
      this.poem = updated;
      this.update();
    } catch (err) {
      console.error('[PoemReader] Error toggling favorite:', err);
    }
  }

  /**
   * Toggles archive status in PoemRepository and updates view
   */
  toggleArchive() {
    if (!this.poem) return;
    try {
      const repo = this.poemRepo || poemRepository;
      let updated;
      if (this.poem.isArchived) {
        updated = repo.restore(this.poem.id);
      } else {
        updated = repo.archive(this.poem.id);
      }
      this.poem = updated;
      this.update();
    } catch (err) {
      console.error('[PoemReader] Error toggling archive:', err);
    }
  }

  /**
   * Formats source identifier for archival display in reader
   * @param {string} source
   * @returns {string}
   */
  formatSource(source) {
    switch (source) {
      case 'handwritten-manuscript':
      case 'handwritten_manuscript':
      case 'handwritten':
        return 'हस्तलिखित पांडुलिपि';
      case 'scanned-document':
      case 'scanned_document':
        return 'स्कैन किया गया दस्तावेज़';
      case 'camera-capture':
      case 'photo_capture':
        return 'कैमरा तस्वीर';
      case 'imported-image':
      case 'imported_image':
        return 'आयातित छवि';
      case 'other':
        return 'अन्य स्रोत';
      default:
        return source || 'अभिलेख';
    }
  }

  /**
   * Opens delete confirmation modal
   */
  openDeleteModal() {
    this.showDeleteModal = true;
    this.update();

    // Focus cancel button for safe keyboard defaults
    const cancelBtn = this.container.querySelector('.btn-modal-cancel');
    if (cancelBtn) cancelBtn.focus();
  }

  /**
   * Closes delete confirmation modal
   */
  closeDeleteModal() {
    this.showDeleteModal = false;
    this.update();
  }

  /**
   * Permanently deletes poem through PoemRepository and navigates to library
   */
  confirmDelete() {
    if (!this.poem) return;
    try {
      const repo = this.poemRepo || poemRepository;
      const id = this.poem.id;
      repo.delete(id);

      // Clean any lingering draft tied to this poem ID
      const draft = repo.getDraft ? repo.getDraft() : null;
      if (draft && draft.poemId === id && repo.clearDraft) {
        repo.clearDraft();
      }

      this.showDeleteModal = false;
      this.router.navigate(ROUTES.POEMS);
    } catch (err) {
      console.error('[PoemReader] Error deleting poem:', err);
    }
  }

  /**
   * Keyboard shortcuts (Escape key dismisses delete modal or AI consent modal)
   */
  handleKeyDown(event) {
    if (event.key === 'Escape') {
      if (this.showAiConsentModal) {
        event.preventDefault();
        this.closeAiConsentModal();
      } else if (this.showDeleteModal) {
        event.preventDefault();
        this.closeDeleteModal();
      }
    }
  }

  /**
   * Renders archival linked manuscripts section beneath poem verses
   * @returns {string} HTML string
   */
  renderLinkedManuscriptsSection() {
    let linkedManuscripts = [];
    try {
      const repo = this.manuscriptRepo || manuscriptRepository;
      linkedManuscripts = repo.getManuscriptsForPoem
        ? repo.getManuscriptsForPoem(this.poemId)
        : (repo.getByPoemId ? repo.getByPoemId(this.poemId) : []);
    } catch (_) {
      linkedManuscripts = [];
    }

    if (!Array.isArray(linkedManuscripts) || linkedManuscripts.length === 0) {
      return '';
    }

    return `
      <section class="reader-linked-manuscripts-section" aria-labelledby="reader-linked-ms-title">
        <div class="reader-linked-ms-header">
          <span class="reader-linked-ms-icon" aria-hidden="true">📜</span>
          <h2 id="reader-linked-ms-title" class="reader-linked-ms-title">
            मूल पांडुलिपि${linkedManuscripts.length > 1 ? 'याँ' : ''}
          </h2>
        </div>

        <div class="reader-linked-ms-grid">
          ${linkedManuscripts.map(ms => {
            const orig = ms.originalManuscript || {};
            const derived = ms.derivedManuscript || {};
            const prov = ms.provenance || {};
            const raw = derived.data || orig.data || '';
            const mime = derived.data ? (derived.mimeType || 'image/png') : (orig.mimeType || 'image/jpeg');
            const imgSrc = raw.startsWith('data:') ? raw : (raw ? `data:${mime};base64,${raw}` : '');
            const captureDate = orig.capturedAt ? formatPoeticDate(orig.capturedAt) : formatPoeticDate(ms.createdAt);
            const sourceLabel = prov.source ? this.formatSource(prov.source) : null;

            return `
              <div class="reader-linked-ms-card" role="region" aria-label="पांडुलिपि: ${this.escapeHtml(ms.title)}">
                <div class="reader-linked-ms-thumb-frame">
                  ${imgSrc ? `
                    <img src="${imgSrc}" alt="${this.escapeHtml(ms.title)}" class="reader-linked-ms-thumb" />
                  ` : `
                    <span class="reader-linked-ms-thumb-fallback">📜</span>
                  `}
                </div>
                <div class="reader-linked-ms-info">
                  <h3 class="reader-linked-ms-name">${this.escapeHtml(ms.title || 'शीर्षकहीन पांडुलिपि')}</h3>
                  <div class="reader-linked-ms-meta">
                    <span class="reader-linked-ms-date">${captureDate}</span>
                    ${sourceLabel ? `
                      <span class="reader-linked-ms-dot" aria-hidden="true">•</span>
                      <span class="reader-linked-ms-source">${this.escapeHtml(sourceLabel)}</span>
                    ` : ''}
                  </div>
                  ${prov.notes ? `
                    <p class="reader-linked-ms-notes">${this.escapeHtml(prov.notes)}</p>
                  ` : ''}
                </div>
                <div class="reader-linked-ms-action">
                  <a
                    href="/manuscripts/${encodeURIComponent(ms.id)}"
                    data-link
                    class="btn-reader-view-manuscript"
                    aria-label="${this.escapeHtml(ms.title)} पांडुलिपि देखें"
                  >
                    ${getIconSvg('archive', 'icon-inline')}
                    <span>पांडुलिपि देखें</span>
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }
}
