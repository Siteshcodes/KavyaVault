/**
 * काव्यकलश (KavyaVault) — Manuscript Capture & Import Component (ManuscriptCapture.js)
 *
 * Phase 2 / Task 2.2: Manuscript Capture & Import
 *
 * Provides a dedicated literary manuscript intake flow:
 *   Photo / File → Original Manuscript Artifact → ManuscriptRepository
 *
 * Preserves the original image bytes losslessly with zero resizing, cropping,
 * rotation, format conversion, or pixel modification.
 */

import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { StorageError, StorageErrorCode } from '../../services/storage/StorageError.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

// Supported manuscript image MIME types
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

// Documented configurable file size threshold for LocalStorage (3.5 MB)
export const MAX_MANUSCRIPT_FILE_SIZE_BYTES = 3.5 * 1024 * 1024; // 3.5 MB

export class ManuscriptCapture {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   */
  constructor({ container, router }) {
    this.container = container;
    this.router = router;

    // File state
    this.selectedFile = null;
    this.previewUrl = null;
    this.fileBase64Data = null;
    this.capturedAt = null;

    // Metadata form state
    this.title = '';
    this.notes = '';

    // Status state
    this.isSaving = false;
    this.errorMessage = null;
    this.savedManuscript = null;

    // Bound listeners for clean unmounting
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundInputChangeHandler = this.handleInputChange.bind(this);
    this.boundFileChangeHandler = this.handleFileSelect.bind(this);
    this.boundDragOverHandler = this.handleDragOver.bind(this);
    this.boundDragLeaveHandler = this.handleDragLeave.bind(this);
    this.boundDropHandler = this.handleDrop.bind(this);
  }

  /**
   * Mounts the capture component into the DOM
   */
  mount() {
    this.update();
    this.attachEvents();
  }

  /**
   * Unmounts the component, detaches listeners, and revokes temporary object URLs
   */
  unmount() {
    this.detachEvents();
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  /**
   * Re-renders the component HTML and re-attaches events
   */
  update() {
    if (!this.container) return;
    this.detachEvents();
    this.container.innerHTML = this.render();
    this.attachEvents();
  }

  /**
   * Attaches event listeners to DOM
   */
  attachEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', this.boundClickHandler);
    this.container.addEventListener('input', this.boundInputChangeHandler);

    const fileInput = this.container.querySelector('#manuscript-file-input');
    const cameraInput = this.container.querySelector('#manuscript-camera-input');

    if (fileInput) {
      fileInput.addEventListener('change', this.boundFileChangeHandler);
    }
    if (cameraInput) {
      cameraInput.addEventListener('change', this.boundFileChangeHandler);
    }

    const dropzone = this.container.querySelector('#manuscript-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', this.boundDragOverHandler);
      dropzone.addEventListener('dragleave', this.boundDragLeaveHandler);
      dropzone.addEventListener('drop', this.boundDropHandler);
    }
  }

  /**
   * Detaches event listeners
   */
  detachEvents() {
    if (!this.container) return;

    this.container.removeEventListener('click', this.boundClickHandler);
    this.container.removeEventListener('input', this.boundInputChangeHandler);

    const fileInput = this.container.querySelector('#manuscript-file-input');
    const cameraInput = this.container.querySelector('#manuscript-camera-input');

    if (fileInput) {
      fileInput.removeEventListener('change', this.boundFileChangeHandler);
    }
    if (cameraInput) {
      cameraInput.removeEventListener('change', this.boundFileChangeHandler);
    }

    const dropzone = this.container.querySelector('#manuscript-dropzone');
    if (dropzone) {
      dropzone.removeEventListener('dragover', this.boundDragOverHandler);
      dropzone.removeEventListener('dragleave', this.boundDragLeaveHandler);
      dropzone.removeEventListener('drop', this.boundDropHandler);
    }
  }

  /**
   * Escapes HTML for safe rendering
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
   * Formats raw bytes into human-readable string (KB / MB)
   */
  formatFileSize(bytes) {
    if (typeof bytes !== 'number' || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Handles click events via event delegation
   */
  handleClick(e) {
    const target = e.target;

    // Trigger file select dialog
    const fileSelectBtn = target.closest('[data-action="select-file"]');
    if (fileSelectBtn) {
      e.preventDefault();
      const input = this.container.querySelector('#manuscript-file-input');
      if (input) input.click();
      return;
    }

    // Trigger camera capture dialog
    const cameraBtn = target.closest('[data-action="capture-camera"]');
    if (cameraBtn) {
      e.preventDefault();
      const input = this.container.querySelector('#manuscript-camera-input');
      if (input) input.click();
      return;
    }

    // Change / remove image
    const changeImgBtn = target.closest('[data-action="change-image"]');
    if (changeImgBtn) {
      e.preventDefault();
      this.clearSelectedFile();
      this.update();
      return;
    }

    // Submit preservation
    const preserveBtn = target.closest('[data-action="preserve-manuscript"]');
    if (preserveBtn) {
      e.preventDefault();
      this.handlePreserve();
      return;
    }

    // Reset and preserve another manuscript
    const preserveAnotherBtn = target.closest('[data-action="preserve-another"]');
    if (preserveAnotherBtn) {
      e.preventDefault();
      this.resetForm();
      this.update();
      return;
    }

    // Cancel back to library
    const cancelBtn = target.closest('[data-action="cancel"]');
    if (cancelBtn) {
      e.preventDefault();
      this.router.navigate(ROUTES.POEMS);
      return;
    }
  }

  /**
   * Handles form input events
   */
  handleInputChange(e) {
    const { id, value } = e.target;
    if (id === 'manuscript-title-input') {
      this.title = value;
      this.clearErrorMessage();
    } else if (id === 'manuscript-notes-input') {
      this.notes = value;
    }
  }

  /**
   * Clears error message without full re-render
   */
  clearErrorMessage() {
    if (this.errorMessage) {
      this.errorMessage = null;
      const alertEl = this.container.querySelector('.manuscript-alert-error');
      if (alertEl) {
        alertEl.remove();
      }
    }
  }

  /**
   * Drag and drop handlers
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = this.container.querySelector('#manuscript-dropzone');
    if (dropzone) dropzone.classList.add('is-dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = this.container.querySelector('#manuscript-dropzone');
    if (dropzone) dropzone.classList.remove('is-dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = this.container.querySelector('#manuscript-dropzone');
    if (dropzone) dropzone.classList.remove('is-dragover');

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      this.processSelectedFile(e.dataTransfer.files[0]);
    }
  }

  /**
   * Handles file selection from `<input type="file">`
   */
  handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
      this.processSelectedFile(e.target.files[0]);
    }
  }

  /**
   * Validates and reads selected file losslessly
   */
  processSelectedFile(file) {
    if (!file) {
      this.errorMessage = 'कृपया एक छवि फ़ाइल चुनें।';
      this.update();
      return;
    }

    // 1. Validate MIME type
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
      this.errorMessage = `अमान्य छवि प्रारूप "${file.type || 'अज्ञात'}"। केवल JPEG, PNG और WebP प्रारूप समर्थित हैं।`;
      this.update();
      return;
    }

    // 2. Validate file size threshold
    if (file.size > MAX_MANUSCRIPT_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      this.errorMessage = `फ़ाइल का आकार (${sizeMB} MB) अत्यधिक बड़ा है। स्थानीय ब्राउज़र भंडारण (LocalStorage) की सीमा के कारण कृपया 3.5 MB से कम आकार की छवि चुनें।`;
      this.update();
      return;
    }

    // 3. Clear previous temporary object URL
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }

    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
    this.capturedAt = file.lastModified
      ? new Date(file.lastModified).toISOString()
      : new Date().toISOString();
    this.errorMessage = null;

    // 4. Auto-suggest title if empty based on original filename (cleaned)
    if (!this.title && file.name) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').trim();
      if (baseName) {
        this.title = baseName;
      }
    }

    // 5. Read original bytes losslessly via FileReader.readAsDataURL
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        this.fileBase64Data = reader.result;
        this.update();
      };
      reader.onerror = () => {
        this.errorMessage = 'छवि फ़ाइल को पढ़ने में त्रुटि हुई। कृपया पुनः प्रयास करें।';
        this.update();
      };
      reader.readAsDataURL(file);
    }

    // Initial update to show temporary object URL preview immediately while reader finishes
    this.update();
  }

  /**
   * Clears selected file and cleans up temporary object URL
   */
  clearSelectedFile() {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.selectedFile = null;
    this.fileBase64Data = null;
    this.capturedAt = null;
  }

  /**
   * Resets entire form state
   */
  resetForm() {
    this.clearSelectedFile();
    this.title = '';
    this.notes = '';
    this.errorMessage = null;
    this.savedManuscript = null;
    this.isSaving = false;
  }

  /**
   * Handles preservation submission to ManuscriptRepository
   */
  handlePreserve() {
    if (this.isSaving) return;

    // Validate presence of file
    if (!this.selectedFile || !this.fileBase64Data) {
      this.errorMessage = 'कृपया सुरक्षित सहेजने हेतु एक पांडुलिपि छवि चुनें।';
      this.update();
      return;
    }

    // Validate title
    const trimmedTitle = this.title.trim();
    if (!trimmedTitle) {
      this.errorMessage = 'पांडुलिपि का शीर्षक लिखना अनिवार्य है।';
      this.update();
      const titleInput = this.container.querySelector('#manuscript-title-input');
      if (titleInput && typeof titleInput.focus === 'function') {
        titleInput.focus();
      }
      return;
    }

    this.isSaving = true;
    this.errorMessage = null;
    this.update();

    try {
      // Call domain repository (never write to localStorage directly)
      const manuscript = manuscriptRepository.create({
        title: trimmedTitle,
        originalManuscript: {
          mimeType: this.selectedFile.type,
          data: this.fileBase64Data, // Lossless base64 Data URL
          filename: this.selectedFile.name || null,
          capturedAt: this.capturedAt
        },
        provenance: {
          source: 'handwritten_manuscript',
          recordedAt: new Date().toISOString(),
          notes: this.notes.trim()
        }
      });

      this.savedManuscript = manuscript;
      this.isSaving = false;
      this.update();
    } catch (err) {
      this.isSaving = false;

      // Handle QuotaExceeded error explicitly
      if (
        (err instanceof StorageError && err.code === StorageErrorCode.QUOTA_EXCEEDED) ||
        err.name === 'QuotaExceededError'
      ) {
        this.errorMessage = 'ब्राउज़र भंडारण सीमा (Storage Quota) समाप्त हो गई है। कृपया कुछ पुरानी पांडुलिपियाँ या अप्रयुक्त रचनाएँ हटाएँ और पुनः प्रयास करें।';
      } else {
        this.errorMessage = err.message || 'पांडुलिपि सहेजने में अज्ञात त्रुटि उत्पन्न हुई। कृपया पुनः प्रयास करें।';
      }

      // Preserve user inputs and selected file for safe retry
      this.update();
    }
  }

  /**
   * Renders the complete HTML
   */
  render() {
    const hasFile = Boolean(this.selectedFile);

    return `
      <div class="manuscript-capture-view" role="region" aria-label="पांडुलिपि संरक्षण कक्ष">
        <!-- Top Navigation Bar -->
        <div class="manuscript-top-bar">
          <a href="${ROUTES.POEMS}" data-link class="manuscript-nav-back" aria-label="काव्य पुस्तकालय पर लौटें">
            ${getIconSvg('arrow-left', 'nav-icon')}
            <span>पुस्तकालय</span>
          </a>
          <span class="manuscript-format-hint">मूल पांडुलिपि डिजिटल संरक्षण (Phase 2)</span>
        </div>

        <!-- Section Header -->
        <header style="margin-bottom: var(--space-6);">
          <h1 style="font-family: var(--font-display); font-size: var(--text-h1); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            पांडुलिपि संरक्षण
          </h1>
          <p style="font-family: var(--font-interface); font-size: var(--text-body); color: var(--color-text-secondary); margin: 0; max-width: 680px; line-height: var(--leading-normal);">
            पुरानी डायरियों, हस्तलिखित पन्नों या पांडुलिपि की तस्वीर यहाँ सहेजें। मूल छवि बिना किसी परिवर्तन, संपीड़न या कतरन (crop) के सुरक्षित सहेजी जाती है।
          </p>
        </header>

        <!-- Success Notification Banner -->
        ${this.savedManuscript ? this.renderSuccessBanner() : ''}

        <!-- Error Alert Banner -->
        ${this.errorMessage ? this.renderErrorAlert() : ''}

        ${!this.savedManuscript ? `
          <!-- Main Intake Grid -->
          <div class="manuscript-intake-grid">
            <!-- Left Column: Capture / Preview Zone -->
            <div class="manuscript-capture-column">
              ${hasFile ? this.renderPreviewCard() : this.renderDropzoneCard()}
            </div>

            <!-- Right Column: Metadata Form -->
            <div class="manuscript-metadata-column">
              ${this.renderFormCard(hasFile)}
            </div>
          </div>
        ` : ''}

        <!-- Hidden Native File Inputs -->
        <input
          type="file"
          id="manuscript-file-input"
          class="manuscript-hidden-input"
          accept="image/jpeg,image/png,image/webp"
          tabindex="-1"
          aria-hidden="true"
        />
        <input
          type="file"
          id="manuscript-camera-input"
          class="manuscript-hidden-input"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          tabindex="-1"
          aria-hidden="true"
        />
      </div>
    `;
  }

  /**
   * Renders the dropzone card for selecting or capturing an image
   */
  renderDropzoneCard() {
    return `
      <div
        id="manuscript-dropzone"
        class="manuscript-dropzone-card"
        tabindex="0"
        role="button"
        aria-label="पांडुलिपि छवि फ़ाइल चुनें अथवा यहाँ खींचकर लाएँ"
        data-action="select-file"
      >
        <div class="manuscript-dropzone-icon" aria-hidden="true">
          ${getIconSvg('image', 'dropzone-svg')}
        </div>
        <h2 class="manuscript-dropzone-heading">पांडुलिपि की छवि जोड़ें</h2>
        <p class="manuscript-dropzone-lead">
          अपने डिवाइस से छवि चुनें, सीधे कैमरे से तस्वीर खींचें या फ़ाइल यहाँ ड्रैग व ड्रॉप करें।
        </p>

        <div class="manuscript-action-buttons">
          <button
            type="button"
            class="btn-file-select"
            data-action="select-file"
            aria-label="डिवाइस से पांडुलिपि छवि चुनें"
          >
            ${getIconSvg('upload', 'btn-icon')}
            <span>छवि चुनें</span>
          </button>

          <button
            type="button"
            class="btn-camera-capture"
            data-action="capture-camera"
            aria-label="कैमरे से पांडुलिपि की तस्वीर खींचें"
          >
            ${getIconSvg('camera', 'btn-icon')}
            <span>फ़ोटो खींचें</span>
          </button>
        </div>

        <span class="manuscript-format-hint">
          स्वीकृत प्रारूप: JPEG, PNG, WebP • अधिकतम आकार: 3.5 MB
        </span>
      </div>
    `;
  }

  /**
   * Renders the preview card for the selected file
   */
  renderPreviewCard() {
    const displaySrc = this.previewUrl || this.fileBase64Data || '';
    const fileName = this.selectedFile ? this.selectedFile.name : '';
    const fileSize = this.selectedFile ? this.formatFileSize(this.selectedFile.size) : '';
    const mimeType = this.selectedFile ? this.selectedFile.type : '';

    return `
      <div class="manuscript-preview-card" role="region" aria-label="मूल पांडुलिपि पूर्वावलोकन">
        <div class="manuscript-preview-header">
          <div class="manuscript-badge-original">
            ${getIconSvg('check', 'badge-icon')}
            <span>मूल पांडुलिपि पूर्वावलोकन</span>
          </div>
          <button
            type="button"
            class="btn-change-image"
            data-action="change-image"
            aria-label="अन्य छवि चुनें"
          >
            ${getIconSvg('edit', 'btn-icon')}
            <span>छवि बदलें</span>
          </button>
        </div>

        <div class="manuscript-preview-frame">
          <img
            src="${displaySrc}"
            alt="हस्तलिखित पांडुलिपि पूर्वावलोकन: ${this.escapeHtml(this.title || fileName)}"
            class="manuscript-preview-img"
          />
        </div>

        <div class="manuscript-preview-footer">
          <div class="manuscript-file-info">
            <strong>फ़ाइल:</strong>
            <span>${this.escapeHtml(fileName)}</span>
          </div>
          <div>
            <span>${fileSize}</span> • <span>${mimeType}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the metadata entry form
   */
  renderFormCard(hasFile) {
    return `
      <div class="manuscript-form-card">
        <h2 style="font-family: var(--font-display); font-size: var(--text-h3); color: var(--color-text-primary); margin: 0 0 var(--space-4) 0;">
          पांडुलिपि विवरण
        </h2>

        <div class="manuscript-form-group">
          <label for="manuscript-title-input" class="manuscript-form-label">
            शीर्षक <span class="required-star" aria-hidden="true">*</span>
          </label>
          <input
            type="text"
            id="manuscript-title-input"
            class="manuscript-form-input"
            placeholder="उदा. पुरानी डायरी — पृष्ठ १२ (१९८४)"
            value="${this.escapeHtml(this.title)}"
            required
            aria-required="true"
          />
          <span class="manuscript-form-help">
            पांडुलिपि या रचना को पहचानने हेतु एक सार्थक नाम दें।
          </span>
        </div>

        <div class="manuscript-form-group">
          <label for="manuscript-notes-input" class="manuscript-form-label">
            उद्गम व साहित्यिक टिप्पणियाँ (वैकल्पिक)
          </label>
          <textarea
            id="manuscript-notes-input"
            class="manuscript-form-textarea"
            placeholder="उदा. पिताजी की पुरानी डायरी से प्राप्त, वर्ष १९७५ का हस्तलिखित पृष्ठ। नीली स्याही में रचित..."
          >${this.escapeHtml(this.notes)}</textarea>
          <span class="manuscript-form-help">
            पांडुलिपि की प्राप्ति का स्रोत, ऐतिहासिक संदर्भ या कोई विशेष विवरण।
          </span>
        </div>

        <div class="manuscript-form-actions">
          <button
            type="button"
            class="btn-preserve-primary"
            data-action="preserve-manuscript"
            ${!hasFile || this.isSaving ? 'disabled' : ''}
            aria-label="पांडुलिपि सुरक्षित सहेजें"
          >
            ${getIconSvg('archive', 'btn-icon')}
            <span>${this.isSaving ? 'सहेजा जा रहा है...' : 'पांडुलिपि सहेजें'}</span>
          </button>

          <button
            type="button"
            class="btn-preserve-cancel"
            data-action="cancel"
            aria-label="प्रक्रिया रद्द करें"
          >
            <span>रद्द करें</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders error alert
   */
  renderErrorAlert() {
    return `
      <div class="manuscript-alert manuscript-alert-error" role="alert" aria-live="polite">
        <div style="color: var(--color-accent-terracotta); flex-shrink: 0;" aria-hidden="true">
          ${getIconSvg('close', 'alert-icon')}
        </div>
        <div style="flex: 1;">
          <strong>त्रुटि: </strong>
          <span>${this.escapeHtml(this.errorMessage)}</span>
        </div>
      </div>
    `;
  }

  /**
   * Renders success banner with navigation link
   */
  renderSuccessBanner() {
    const ms = this.savedManuscript;
    return `
      <div class="manuscript-alert manuscript-alert-success" role="status" aria-live="polite">
        <div style="color: #2e7d32; flex-shrink: 0;" aria-hidden="true">
          ${getIconSvg('check', 'alert-icon')}
        </div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 var(--space-1) 0; font-family: var(--font-display); font-size: var(--text-h4);">
            पांडुलिपि सफलतापूर्वक सुरक्षित सहेज ली गई है।
          </h3>
          <p style="margin: 0 0 var(--space-4) 0; font-family: var(--font-interface); color: var(--color-text-secondary);">
            मूल पांडुलिपि डिजिटल संदूक में अपरिवर्तित रूप में संरक्षित हो चुकी है।
          </p>
          <div style="display: flex; gap: var(--space-3); flex-wrap: wrap;">
            <a
              href="/manuscripts/${encodeURIComponent(ms.id)}"
              data-link
              class="btn-preserve-primary"
              style="text-decoration: none; padding: var(--space-2) var(--space-5); min-height: 44px;"
              aria-label="संरक्षित पांडुलिपि देखें"
            >
              ${getIconSvg('book', 'btn-icon')}
              <span>पांडुलिपि देखें</span>
            </a>

            <button
              type="button"
              class="btn-preserve-cancel"
              data-action="preserve-another"
              style="padding: var(--space-2) var(--space-4); min-height: 44px;"
              aria-label="एक और पांडुलिपि सहेजें"
            >
              <span>एक और पांडुलिपि सहेजें</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
