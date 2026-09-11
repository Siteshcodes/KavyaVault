/**
 * काव्यकलश (KavyaVault) — Manuscript Detail & Archival View (ManuscriptView.js)
 *
 * Phase 2 / Task 2.3: Non-Destructive Manuscript Image Transformation
 *
 * Dignified archival presentation of a preserved manuscript with non-destructive
 * transformation capabilities (rotation 0°, 90°, 180°, 270° and rectangular cropping).
 *
 * Enforces the core preservation principle:
 *   Original Manuscript (Untouched Archival Artifact) ≠ Derived Manuscript (Working Transformed Copy)
 *
 * The original manuscript image artifact is NEVER modified, cropped, rotated,
 * overwritten, or compressed. All edits generate a distinct derived artifact.
 */

import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { StorageError, StorageErrorCode } from '../../services/storage/StorageError.js';
import {
  ManuscriptImageTransformer,
  mapDisplayCropToNatural,
  getRotatedDimensions
} from '../../services/manuscripts/ManuscriptImageTransformer.js';
import { formatPoeticDate } from '../../utils/date.js';
import { ROUTES } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';

export class ManuscriptView {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container Root mounting container
   * @param {Object} options.router Client router instance
   * @param {string} options.manuscriptId Unique manuscript identifier
   * @param {Object} [options.repository=manuscriptRepository] Manuscript repository
   * @param {Object} [options.poemRepo=poemRepository] Poem repository
   */
  constructor({ container, router, manuscriptId, repository = manuscriptRepository, poemRepo = poemRepository }) {
    this.container = container;
    this.router = router;
    this.manuscriptId = manuscriptId;
    this.repository = repository;
    this.poemRepo = poemRepo;
    this.manuscript = null;

    // View state: 'original' or 'derived'
    this.activeTab = 'original';

    // In-progress transformation state
    this.workingRotation = 0; // 0, 90, 180, 270
    this.workingCrop = null;   // null or { x, y, width, height }
    this.isCropMode = false;
    this.isTransforming = false;
    this.transformedPreviewData = null; // Data URL for uncommitted working preview
    this.transformError = null;
    this.transformSuccessMessage = null;

    // Interactive mouse / touch crop selection state
    this.displayCropBox = null; // { x, y, width, height } in display/CSS pixels
    this.isDraggingCrop = false;
    this.dragStartPoint = null; // { x, y }

    // Modals
    this.showDeleteModal = false;
    this.showClearDerivedModal = false;
    this.showLinkModal = false;
    this.showUnlinkModal = false;

    // Linking state
    this.poemSearchQuery = '';
    this.selectedPoemId = null;
    this.linkError = null;
    this.linkSuccessMessage = null;

    // Bound handlers
    this.boundClickHandler = this.handleClick.bind(this);
    this.boundInputHandler = this.handleInput.bind(this);
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
  }

  /**
   * Mounts the view into the DOM and loads manuscript data
   */
  mount() {
    this.manuscript = this.repository.getById(this.manuscriptId);

    if (!this.manuscript) {
      this.renderNotFound();
      return;
    }

    // Default to derived copy if one exists, otherwise original
    if (this.manuscript.derivedManuscript) {
      this.activeTab = 'derived';
    } else {
      this.activeTab = 'original';
    }

    this.update();
    if (this.container?.addEventListener) {
      this.container.addEventListener('click', this.boundClickHandler);
      this.container.addEventListener('input', this.boundInputHandler);
    }
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('keydown', this.boundKeyDownHandler);
    }
  }

  /**
   * Unmounts the view and detaches event listeners
   */
  unmount() {
    this.detachCropListeners();
    if (this.container?.removeEventListener) {
      this.container.removeEventListener('click', this.boundClickHandler);
      this.container.removeEventListener('input', this.boundInputHandler);
    }
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('keydown', this.boundKeyDownHandler);
    }
  }

  /**
   * Re-renders the component HTML and attaches interactive surface listeners
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
    this.attachCropListeners();
  }

  /**
   * Attaches pointer event listeners to the interactive crop surface
   */
  attachCropListeners() {
    this.detachCropListeners();
    const surface = this.container?.querySelector?.('[data-crop-surface]');
    if (surface && typeof surface.addEventListener === 'function') {
      surface.addEventListener('pointerdown', this.boundPointerDown);
      surface.addEventListener('pointermove', this.boundPointerMove);
      surface.addEventListener('pointerup', this.boundPointerUp);
      surface.addEventListener('pointercancel', this.boundPointerCancel);
    }
  }

  /**
   * Detaches pointer event listeners from the interactive crop surface
   */
  detachCropListeners() {
    const surface = this.container?.querySelector?.('[data-crop-surface]');
    if (surface && typeof surface.removeEventListener === 'function') {
      surface.removeEventListener('pointerdown', this.boundPointerDown);
      surface.removeEventListener('pointermove', this.boundPointerMove);
      surface.removeEventListener('pointerup', this.boundPointerUp);
      surface.removeEventListener('pointercancel', this.boundPointerCancel);
    }
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
   * Formats source identifier into Hindi label
   */
  formatSource(source) {
    switch (source) {
      case 'handwritten_manuscript': return 'हस्तलिखित पांडुलिपि';
      case 'scanned_document': return 'स्कैन किया गया दस्तावेज़';
      case 'photo_capture': return 'कैमरा तस्वीर';
      default: return source || 'अभिलेख';
    }
  }

  /**
   * Helper to resolve the raw image source for the original manuscript
   */
  getOriginalImageSrc() {
    const orig = this.manuscript?.originalManuscript || {};
    const raw = orig.data || '';
    if (!raw || typeof raw !== 'string' || raw.trim() === '') return '';
    if (raw.startsWith('data:')) return raw;
    return `data:${orig.mimeType || 'image/jpeg'};base64,${raw}`;
  }

  /**
   * Helper to resolve the active image source to display in the showcase
   */
  getActiveDisplaySrc() {
    if (this.transformedPreviewData) {
      return this.transformedPreviewData;
    }

    if (this.activeTab === 'derived' && this.manuscript?.derivedManuscript) {
      const derived = this.manuscript.derivedManuscript;
      const raw = derived.data || '';
      if (!raw || typeof raw !== 'string' || raw.trim() === '') return '';
      if (raw.startsWith('data:')) return raw;
      return `data:${derived.mimeType || 'image/png'};base64,${raw}`;
    }

    return this.getOriginalImageSrc();
  }

  /**
   * Applies the current working transformation and generates a live preview
   */
  async applyWorkingTransformation() {
    const origSrc = this.getOriginalImageSrc();

    // If no transformation applied, reset preview
    if (this.workingRotation === 0 && !this.workingCrop) {
      this.transformedPreviewData = null;
      this.update();
      return;
    }

    this.isTransforming = true;
    this.transformError = null;
    this.update();

    try {
      const result = await ManuscriptImageTransformer.transform(origSrc, {
        rotation: this.workingRotation,
        crop: this.workingCrop
      });

      this.transformedPreviewData = result.data;
      this.activeTab = 'derived';
      this.isTransforming = false;
      this.update();
    } catch (err) {
      this.isTransforming = false;
      this.transformError = err.message || 'रूपांतरण लागू करने में त्रुटि हुई।';
      this.update();
    }
  }

  /**
   * Pointer down starts interactive rectangular crop drag
   */
  handlePointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const surface = e.currentTarget;
    if (!surface) return;

    try {
      surface.setPointerCapture(e.pointerId);
    } catch (_) {}

    const rect = surface.getBoundingClientRect();
    const startX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const startY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    this.isDraggingCrop = true;
    this.dragStartPoint = { x: startX, y: startY };
    this.displayCropBox = { x: startX, y: startY, width: 0, height: 0 };

    this.updateCropBoxDOM(this.displayCropBox, surface);
  }

  /**
   * Pointer move updates interactive rectangular crop preview in real-time
   */
  handlePointerMove(e) {
    if (!this.isDraggingCrop || !this.dragStartPoint) return;

    const surface = e.currentTarget;
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    const curX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const curY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const boxX = Math.min(this.dragStartPoint.x, curX);
    const boxY = Math.min(this.dragStartPoint.y, curY);
    const boxW = Math.abs(curX - this.dragStartPoint.x);
    const boxH = Math.abs(curY - this.dragStartPoint.y);

    this.displayCropBox = { x: boxX, y: boxY, width: boxW, height: boxH };
    this.updateCropBoxDOM(this.displayCropBox, surface);
  }

  /**
   * Pointer up completes interactive drag and maps display box to natural image coordinates
   */
  async handlePointerUp(e) {
    if (!this.isDraggingCrop) return;
    this.isDraggingCrop = false;

    const surface = e.currentTarget;
    if (surface) {
      try {
        surface.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }

    if (!this.displayCropBox || this.displayCropBox.width < 10 || this.displayCropBox.height < 10) {
      this.displayCropBox = null;
      if (surface) {
        const boxEl = surface.querySelector('[data-crop-box]');
        if (boxEl) boxEl.style.display = 'none';
      }
      return;
    }

    const imgEl = this.container?.querySelector('.manuscript-archival-img');
    const surfaceRect = surface ? surface.getBoundingClientRect() : (imgEl ? imgEl.getBoundingClientRect() : { width: 800, height: 1000 });

    let natW = imgEl?.naturalWidth;
    let natH = imgEl?.naturalHeight;

    if (!natW || !natH) {
      const orig = this.manuscript.originalManuscript;
      const origW = (orig.metadata && orig.metadata.width) || 1200;
      const origH = (orig.metadata && orig.metadata.height) || 800;
      const rDims = getRotatedDimensions(origW, origH, this.workingRotation);
      natW = rDims.width;
      natH = rDims.height;
    }

    try {
      const naturalCrop = mapDisplayCropToNatural(
        this.displayCropBox,
        { width: surfaceRect.width, height: surfaceRect.height },
        { width: natW, height: natH }
      );

      this.workingCrop = naturalCrop;
      await this.applyWorkingTransformation();
    } catch (err) {
      this.transformError = err.message || 'क्रॉप चयन लागू करने में त्रुटि।';
      this.update();
    }
  }

  /**
   * Pointer cancel aborts active drag
   */
  handlePointerCancel(e) {
    this.isDraggingCrop = false;
    this.dragStartPoint = null;
  }

  /**
   * Updates crop selection DOM overlay directly for high-performance 60fps tracking
   */
  updateCropBoxDOM(box, surface) {
    if (!surface) return;
    const boxEl = surface.querySelector('[data-crop-box]');
    if (!boxEl || !boxEl.style) return;

    if (!box || box.width <= 0 || box.height <= 0) {
      boxEl.style.display = 'none';
      return;
    }

    boxEl.style.display = 'block';
    boxEl.style.left = `${box.x}px`;
    boxEl.style.top = `${box.y}px`;
    boxEl.style.width = `${box.width}px`;
    boxEl.style.height = `${box.height}px`;

    const badgeEl = surface.querySelector('[data-crop-dims-badge]');
    if (badgeEl) {
      badgeEl.textContent = `${Math.round(box.width)} × ${Math.round(box.height)}`;
    }
  }

  /**
   * Handles click events via event delegation
   */
  async handleClick(e) {
    const target = e.target;

    // 1. Switch active view tab (Original vs Derived)
    const tabBtn = target.closest('[data-action="switch-tab"]');
    if (tabBtn) {
      e.preventDefault();
      const tab = tabBtn.getAttribute('data-tab');
      if (tab === 'original' || tab === 'derived') {
        this.activeTab = tab;
        this.transformError = null;
        this.transformSuccessMessage = null;
        this.update();
      }
      return;
    }

    // 2. Rotate Left (90° counter-clockwise = +270°)
    const rotLeftBtn = target.closest('[data-action="rotate-left"]');
    if (rotLeftBtn) {
      e.preventDefault();
      this.workingRotation = (this.workingRotation + 270) % 360;
      this.workingCrop = null;
      this.displayCropBox = null;
      await this.applyWorkingTransformation();
      return;
    }

    // 3. Rotate Right (90° clockwise)
    const rotRightBtn = target.closest('[data-action="rotate-right"]');
    if (rotRightBtn) {
      e.preventDefault();
      this.workingRotation = (this.workingRotation + 90) % 360;
      this.workingCrop = null;
      this.displayCropBox = null;
      await this.applyWorkingTransformation();
      return;
    }

    // 4. Toggle Crop Mode
    const toggleCropBtn = target.closest('[data-action="toggle-crop"]');
    if (toggleCropBtn) {
      e.preventDefault();
      this.isCropMode = !this.isCropMode;
      this.update();
      return;
    }

    // 5. Apply Crop Preset (e.g. Inset 10%)
    const cropPresetBtn = target.closest('[data-action="apply-crop-preset"]');
    if (cropPresetBtn) {
      e.preventDefault();
      const percent = parseInt(cropPresetBtn.getAttribute('data-percent'), 10) || 10;
      const imgEl = this.container.querySelector('.manuscript-archival-img');

      let natW = imgEl?.naturalWidth;
      let natH = imgEl?.naturalHeight;
      if (!natW || !natH) {
        const orig = this.manuscript.originalManuscript;
        const origW = (orig.metadata && orig.metadata.width) || 1200;
        const origH = (orig.metadata && orig.metadata.height) || 800;
        const rDims = getRotatedDimensions(origW, origH, this.workingRotation);
        natW = rDims.width;
        natH = rDims.height;
      }

      const insetX = Math.round(natW * (percent / 100));
      const insetY = Math.round(natH * (percent / 100));

      this.workingCrop = {
        x: insetX,
        y: insetY,
        width: Math.max(1, natW - (insetX * 2)),
        height: Math.max(1, natH - (insetY * 2))
      };
      this.displayCropBox = null;

      await this.applyWorkingTransformation();
      return;
    }

    // 6. Reset Crop Only
    const resetCropBtn = target.closest('[data-action="reset-crop"]');
    if (resetCropBtn) {
      e.preventDefault();
      this.workingCrop = null;
      this.displayCropBox = null;
      await this.applyWorkingTransformation();
      return;
    }

    // 7. Reset Entire Transformation (Reverts working preview to untouched original)
    const resetBtn = target.closest('[data-action="reset-transform"]');
    if (resetBtn) {
      e.preventDefault();
      this.workingRotation = 0;
      this.workingCrop = null;
      this.displayCropBox = null;
      this.isCropMode = false;
      this.transformedPreviewData = null;
      this.transformError = null;
      this.transformSuccessMessage = null;
      this.activeTab = 'original';
      this.update();
      return;
    }

    // 8. Save Derived Version to ManuscriptRepository
    const saveDerivedBtn = target.closest('[data-action="save-derived"]');
    if (saveDerivedBtn) {
      e.preventDefault();
      await this.handleSaveDerived();
      return;
    }

    // 9. Open Clear Derived Confirmation Modal
    const clearDerivedModalBtn = target.closest('[data-action="open-clear-derived-modal"]');
    if (clearDerivedModalBtn) {
      e.preventDefault();
      this.showClearDerivedModal = true;
      this.update();
      return;
    }

    // 10. Cancel Clear Derived
    const cancelClearDerivedBtn = target.closest('[data-action="cancel-clear-derived"]');
    if (cancelClearDerivedBtn) {
      e.preventDefault();
      this.showClearDerivedModal = false;
      this.update();
      return;
    }

    // 11. Confirm Clear Derived
    const confirmClearDerivedBtn = target.closest('[data-action="confirm-clear-derived"]');
    if (confirmClearDerivedBtn) {
      e.preventDefault();
      try {
        const updated = manuscriptRepository.clearDerivedManuscript(this.manuscriptId);
        this.manuscript = updated;
        this.workingRotation = 0;
        this.workingCrop = null;
        this.transformedPreviewData = null;
        this.activeTab = 'original';
        this.showClearDerivedModal = false;
        this.transformSuccessMessage = 'संपादित प्रति हटा दी गई है। मूल पांडुलिपि पूर्ववत सुरक्षित है।';
        this.update();
      } catch (err) {
        this.transformError = err.message || 'संपादित प्रति हटाने में त्रुटि हुई।';
        this.showClearDerivedModal = false;
        this.update();
      }
      return;
    }

    // 12. Trigger delete modal
    const deleteBtn = target.closest('[data-action="open-delete-modal"]');
    if (deleteBtn) {
      e.preventDefault();
      this.showDeleteModal = true;
      this.update();
      return;
    }

    // 13. Cancel delete
    const cancelDeleteBtn = target.closest('[data-action="cancel-delete"]');
    if (cancelDeleteBtn) {
      e.preventDefault();
      this.showDeleteModal = false;
      this.update();
      return;
    }

    // 14. Confirm delete
    const confirmDeleteBtn = target.closest('[data-action="confirm-delete"]');
    if (confirmDeleteBtn) {
      e.preventDefault();
      try {
        this.repository.delete(this.manuscriptId);
        this.router.navigate(ROUTES.MANUSCRIPTS || '/manuscripts');
      } catch (err) {
        console.error('[ManuscriptView] Error deleting manuscript:', err);
      }
      return;
    }

    // 15. Open Link Poem Modal
    const openLinkBtn = target.closest('[data-action="open-link-modal"]');
    if (openLinkBtn) {
      e.preventDefault();
      this.showLinkModal = true;
      this.selectedPoemId = this.manuscript?.poemId || null;
      this.poemSearchQuery = '';
      this.linkError = null;
      this.update();
      return;
    }

    // 16. Close Link Poem Modal
    const closeLinkBtn = target.closest('[data-action="close-link-modal"]');
    if (closeLinkBtn) {
      e.preventDefault();
      this.showLinkModal = false;
      this.update();
      return;
    }

    // 17. Select Poem in Modal
    const selectPoemOption = target.closest('[data-action="select-poem"]');
    if (selectPoemOption) {
      e.preventDefault();
      this.selectedPoemId = decodeURIComponent(selectPoemOption.getAttribute('data-poem-id'));
      const listEl = this.container.querySelector('.link-poem-list');
      if (listEl) {
        listEl.innerHTML = this.renderPoemListItems();
      }
      const confirmBtn = this.container.querySelector('[data-action="confirm-link"]');
      if (confirmBtn) {
        confirmBtn.removeAttribute('disabled');
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.opacity = '1';
      }
      return;
    }

    // 18. Confirm Link Poem
    const confirmLinkBtn = target.closest('[data-action="confirm-link"]');
    if (confirmLinkBtn) {
      e.preventDefault();
      if (!this.selectedPoemId) return;
      try {
        const updated = this.repository.linkToPoem(this.manuscriptId, this.selectedPoemId);
        this.manuscript = updated;
        this.showLinkModal = false;
        this.linkSuccessMessage = 'पांडुलिपि को कविता से सफलतापूर्वक संबद्ध कर दिया गया है।';
        this.update();
      } catch (err) {
        this.linkError = err.message || 'संबद्ध करने में त्रुटि हुई।';
        this.update();
      }
      return;
    }

    // 19. Open Unlink Modal
    const openUnlinkBtn = target.closest('[data-action="open-unlink-modal"]');
    if (openUnlinkBtn) {
      e.preventDefault();
      this.showUnlinkModal = true;
      this.update();
      return;
    }

    // 20. Close Unlink Modal
    const closeUnlinkBtn = target.closest('[data-action="close-unlink-modal"]');
    if (closeUnlinkBtn) {
      e.preventDefault();
      this.showUnlinkModal = false;
      this.update();
      return;
    }

    // 21. Confirm Unlink
    const confirmUnlinkBtn = target.closest('[data-action="confirm-unlink"]');
    if (confirmUnlinkBtn) {
      e.preventDefault();
      try {
        const updated = this.repository.unlinkFromPoem(this.manuscriptId);
        this.manuscript = updated;
        this.showUnlinkModal = false;
        this.linkSuccessMessage = 'कविता से संबंध सफलतापूर्वक हटा दिया गया है।';
        this.update();
      } catch (err) {
        console.error('[ManuscriptView] Error unlinking from poem:', err);
      }
      return;
    }
  }

  /**
   * Saves the derived artifact to ManuscriptRepository
   */
  async handleSaveDerived() {
    if (!this.transformedPreviewData) {
      this.transformError = 'सहेजने के लिए कोई नया संपादन (घूर्णन या क्रॉप) नहीं किया गया है।';
      this.update();
      return;
    }

    this.isTransforming = true;
    this.transformError = null;
    this.transformSuccessMessage = null;
    this.update();

    try {
      const orig = this.manuscript.originalManuscript;
      const derivedArtifact = {
        mimeType: 'image/png',
        data: this.transformedPreviewData,
        sourceArtifactId: orig.id,
        filename: orig.filename ? `derived_${orig.filename}.png` : 'derived_manuscript.png'
      };

      const transformation = {
        rotation: this.workingRotation,
        crop: this.workingCrop
      };

      const updated = manuscriptRepository.saveDerivedManuscript(
        this.manuscriptId,
        derivedArtifact,
        transformation
      );

      this.manuscript = updated;
      this.transformedPreviewData = null; // Working preview committed
      this.workingRotation = 0;
      this.workingCrop = null;
      this.isCropMode = false;
      this.isTransforming = false;
      this.activeTab = 'derived';
      this.transformSuccessMessage = 'संपादित प्रति सफलतापूर्वक सहेज ली गई है। मूल पांडुलिपि पूर्णतः सुरक्षित है।';
      this.update();
    } catch (err) {
      this.isTransforming = false;

      // LocalStorage quota error handling
      if (
        (err instanceof StorageError && err.code === StorageErrorCode.QUOTA_EXCEEDED) ||
        err.name === 'QuotaExceededError'
      ) {
        this.transformError = 'ब्राउज़र भंडारण सीमा (Storage Quota) समाप्त हो गई है। संपादित प्रति सहेजने हेतु पर्याप्त स्थान नहीं है। मूल पांडुलिपि पूरी तरह सुरक्षित है।';
      } else {
        this.transformError = err.message || 'संपादित प्रति सहेजने में त्रुटि हुई। कृपया पुनः प्रयास करें।';
      }

      // Preserve working preview state in memory for retry
      this.update();
    }
  }

  /**
   * Handles keyboard navigation (Escape to close modals)
   */
  handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (this.showDeleteModal) {
        e.preventDefault();
        this.showDeleteModal = false;
        this.update();
      } else if (this.showClearDerivedModal) {
        e.preventDefault();
        this.showClearDerivedModal = false;
        this.update();
      } else if (this.showLinkModal) {
        e.preventDefault();
        this.showLinkModal = false;
        this.update();
      } else if (this.showUnlinkModal) {
        e.preventDefault();
        this.showUnlinkModal = false;
        this.update();
      }
    }
  }

  /**
   * Handles real-time input in dialog search
   */
  handleInput(e) {
    if (e.target && e.target.matches('[data-action="search-poem-input"]')) {
      this.poemSearchQuery = e.target.value;
      const listEl = this.container.querySelector('.link-poem-list');
      if (listEl) {
        listEl.innerHTML = this.renderPoemListItems();
      }
    }
  }

  /**
   * Renders localized 404 state when manuscript record is not found
   */
  renderNotFound() {
    this.container.innerHTML = `
      <div class="manuscript-detail-view standard-page-view" role="region" aria-label="पांडुलिपि अप्राप्य">
        <div class="manuscript-top-bar">
          <a href="${ROUTES.MANUSCRIPTS || '/manuscripts'}" data-link class="manuscript-nav-back" aria-label="पांडुलिपि वीथिका पर लौटें">
            ${getIconSvg('arrow-left', 'nav-icon')}
            <span>वीथिका</span>
          </a>
        </div>
        <div style="text-align: center; padding: var(--space-12) var(--space-4); background: var(--color-bg-card); border-radius: var(--radius-lg); border: 1px solid var(--color-border-subtle); margin-top: var(--space-6);">
          <div style="font-size: 2.5rem; margin-bottom: var(--space-3); color: var(--color-accent-gold);" aria-hidden="true">❦</div>
          <h2 style="font-family: var(--font-display); font-size: var(--text-h2); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            पांडुलिपि अप्राप्य
          </h2>
          <p style="font-family: var(--font-interface); color: var(--color-text-muted); margin: 0 0 var(--space-6) 0; max-width: 480px; margin-left: auto; margin-right: auto; line-height: var(--leading-normal);">
            जिस पांडुलिपि की आप खोज कर रहे हैं, वह इस संग्रह में उपस्थित नहीं है अथवा हटा दी गई है।
          </p>
          <div style="display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap;">
            <a
              href="${ROUTES.MANUSCRIPTS || '/manuscripts'}"
              data-link
              class="manuscript-nav-back"
              style="background: var(--color-accent-gold); color: #1a150e; border: none; font-weight: 600;"
            >
              ${getIconSvg('archive', 'nav-icon')}
              <span>वीथिका पर लौटें</span>
            </a>
            <a
              href="${ROUTES.POEMS}"
              data-link
              class="manuscript-nav-back"
            >
              ${getIconSvg('book', 'nav-icon')}
              <span>पुस्तकालय पर लौटें</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the complete archival view with non-destructive transformation workflow
   */
  render() {
    const ms = this.manuscript;
    const orig = ms.originalManuscript || {};
    const derived = ms.derivedManuscript || null;
    const transform = ms.transformation || null;
    const prov = ms.provenance || {};
    const trans = ms.transcription || {};

    const hasDerived = Boolean(derived);
    const hasUncommittedEdits = Boolean(this.transformedPreviewData);
    const isViewingDerived = this.activeTab === 'derived';

    const displaySrc = this.getActiveDisplaySrc();

    const captureDate = orig.capturedAt
      ? formatPoeticDate(orig.capturedAt)
      : formatPoeticDate(ms.createdAt);

    const derivedDate = derived?.createdAt
      ? formatPoeticDate(derived.createdAt)
      : null;

    let prevManuscript = null;
    let nextManuscript = null;
    try {
      const all = this.repository.getAll();
      const idx = all.findIndex(m => m && m.id === this.manuscriptId);
      if (idx > 0) prevManuscript = all[idx - 1];
      if (idx >= 0 && idx < all.length - 1) nextManuscript = all[idx + 1];
    } catch (_) {}

    let dimsText = null;
    if (isViewingDerived && derived?.width && derived?.height) {
      dimsText = `${derived.width} × ${derived.height} px`;
    } else if (orig.width && orig.height) {
      dimsText = `${orig.width} × ${orig.height} px`;
    } else if (transform?.crop?.width && transform?.crop?.height && isViewingDerived) {
      dimsText = `${transform.crop.width} × ${transform.crop.height} px`;
    }

    return `
      <div class="manuscript-detail-view" role="region" aria-label="पांडुलिपि अभिलेख: ${this.escapeHtml(ms.title)}">
        <!-- Top Navigation Bar -->
        <div class="manuscript-top-bar">
          <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
            <a href="${ROUTES.MANUSCRIPTS || '/manuscripts'}" data-link class="manuscript-nav-back" aria-label="पांडुलिपि वीथिका पर लौटें">
              ${getIconSvg('arrow-left', 'nav-icon')}
              <span>वीथिका</span>
            </a>

            ${prevManuscript || nextManuscript ? `
              <div class="manuscript-prev-next-group" role="navigation" aria-label="पांडुलिपि अनुक्रम">
                ${prevManuscript ? `
                  <a href="/manuscripts/${encodeURIComponent(prevManuscript.id)}" data-link class="manuscript-nav-arrow" title="पिछली: ${this.escapeHtml(prevManuscript.title)}" aria-label="पिछली पांडुलिपि">
                    ${getIconSvg('arrow-left', 'nav-icon')}
                    <span>पिछली</span>
                  </a>
                ` : `
                  <span class="manuscript-nav-arrow disabled" aria-disabled="true">
                    ${getIconSvg('arrow-left', 'nav-icon')}
                    <span>पिछली</span>
                  </span>
                `}
                ${nextManuscript ? `
                  <a href="/manuscripts/${encodeURIComponent(nextManuscript.id)}" data-link class="manuscript-nav-arrow" title="अगली: ${this.escapeHtml(nextManuscript.title)}" aria-label="अगली पांडुलिपि">
                    <span>अगली</span>
                    ${getIconSvg('arrow-left', 'nav-icon nav-icon-flip')}
                  </a>
                ` : `
                  <span class="manuscript-nav-arrow disabled" aria-disabled="true">
                    <span>अगली</span>
                    ${getIconSvg('arrow-left', 'nav-icon nav-icon-flip')}
                  </span>
                `}
              </div>
            ` : ''}
          </div>

          <div style="display: flex; gap: var(--space-2); align-items: center;">
            <a
              href="${ROUTES.MANUSCRIPT_NEW}"
              data-link
              class="manuscript-nav-back"
              aria-label="नई पांडुलिपि सहेजें"
            >
              ${getIconSvg('upload', 'nav-icon')}
              <span>नई पांडुलिपि</span>
            </a>

            <button
              type="button"
              class="manuscript-nav-back"
              data-action="open-delete-modal"
              style="color: var(--color-accent-terracotta);"
              aria-label="पांडुलिपि हटाएं"
            >
              ${getIconSvg('trash', 'nav-icon')}
              <span>हटाएँ</span>
            </button>
          </div>
        </div>

        <!-- Archival Card Container -->
        <article class="manuscript-detail-card">
          <!-- Header with Title & Transcription Status Badge -->
          <header class="manuscript-detail-header">
            <div>
              <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1); flex-wrap: wrap;">
                <span class="manuscript-badge-original">
                  ${getIconSvg('check', 'badge-icon')}
                  <span>${isViewingDerived ? 'संपादित प्रति (Derived)' : 'मूल पांडुलिपि (Original)'}</span>
                </span>
                ${hasDerived ? `
                  <span style="font-family: var(--font-interface); font-size: var(--text-caption); color: var(--color-accent-gold); font-weight: 600;">
                    संस्करण: v${derived.transformVersion || 1}
                  </span>
                ` : ''}
                <span style="font-family: var(--font-interface); font-size: var(--text-caption); color: var(--color-text-muted);">
                  आईडी: ${this.escapeHtml(ms.id)}
                </span>
              </div>
              <h1 class="manuscript-detail-title">
                ${this.escapeHtml(ms.title)}
              </h1>
            </div>

            <!-- Transcription Status (Untranscribed) -->
            <div>
              <span class="manuscript-status-badge status-untranscribed" title="प्रतिलिपि की स्थिति">
                ${getIconSvg('book', 'badge-icon')}
                <span>${trans.status === 'untranscribed' ? 'अप्रतिलिपिबद्ध' : this.escapeHtml(trans.status)}</span>
              </span>
            </div>
          </header>

          <!-- Core Reassurance Banner -->
          <div style="padding: var(--space-4) var(--space-6) 0 var(--space-6);">
            <div class="manuscript-reassurance-banner" role="note">
              <span class="banner-icon" aria-hidden="true">${getIconSvg('check', 'icon-inline')}</span>
              <span><strong>मूल पांडुलिपि सुरक्षित है।</strong> सभी संपादन (घूर्णन व क्रॉप) एक पृथक नई प्रति पर किए जाते हैं।</span>
            </div>

            <!-- Status / Error Alerts -->
            ${this.transformError ? `
              <div class="manuscript-alert manuscript-alert-error" role="alert" style="margin-bottom: var(--space-4);">
                <div style="color: var(--color-accent-terracotta); flex-shrink: 0;" aria-hidden="true">
                  ${getIconSvg('close', 'alert-icon')}
                </div>
                <div>${this.escapeHtml(this.transformError)}</div>
              </div>
            ` : ''}

            ${this.transformSuccessMessage ? `
              <div class="manuscript-alert manuscript-alert-success" role="status" style="margin-bottom: var(--space-4);">
                <div style="color: #2e7d32; flex-shrink: 0;" aria-hidden="true">
                  ${getIconSvg('check', 'alert-icon')}
                </div>
                <div>${this.escapeHtml(this.transformSuccessMessage)}</div>
              </div>
            ` : ''}

            <!-- View Tabs (Switch between Original & Derived) -->
            <div class="manuscript-view-tabs" role="tablist" aria-label="पांडुलिपि प्रति चयन">
              <button
                type="button"
                class="manuscript-view-tab ${!isViewingDerived && !hasUncommittedEdits ? 'active' : ''}"
                data-action="switch-tab"
                data-tab="original"
                role="tab"
                aria-selected="${!isViewingDerived && !hasUncommittedEdits}"
                aria-label="मूल अपरिवर्तित पांडुलिपि देखें"
              >
                ${getIconSvg('book', 'tab-icon')}
                <span>मूल पांडुलिपि (अपरिवर्तित)</span>
              </button>

              ${hasDerived || hasUncommittedEdits ? `
                <button
                  type="button"
                  class="manuscript-view-tab ${isViewingDerived || hasUncommittedEdits ? 'active' : ''}"
                  data-action="switch-tab"
                  data-tab="derived"
                  role="tab"
                  aria-selected="${isViewingDerived || hasUncommittedEdits}"
                  aria-label="संपादित कार्य प्रति देखें"
                >
                  ${getIconSvg('edit', 'tab-icon')}
                  <span>संपादित प्रति ${hasUncommittedEdits ? '(असुरक्षित बदलाव)' : ''}</span>
                </button>
              ` : `
                <button
                  type="button"
                  class="manuscript-view-tab disabled"
                  disabled
                  role="tab"
                  aria-selected="false"
                  aria-disabled="true"
                  title="कोई संपादित प्रति उपलब्ध नहीं है"
                  aria-label="संपादित प्रति उपलब्ध नहीं"
                >
                  ${getIconSvg('edit', 'tab-icon')}
                  <span>संपादित प्रति (अनुपलब्ध)</span>
                </button>
              `}
            </div>
          </div>

          <!-- Transformation Action Toolbar -->
          <div class="manuscript-transform-bar" role="toolbar" aria-label="पांडुलिपि छवि संपादन उपकरण">
            <button
              type="button"
              class="btn-transform-action"
              data-action="rotate-left"
              title="बाईं ओर ९०° घुमाएँ"
              aria-label="बाईं ओर ९० अंश घुमाएँ"
              ${this.isTransforming ? 'disabled' : ''}
            >
              ${getIconSvg('rotate-left', 'btn-icon')}
              <span>घुमाएँ (-९०°)</span>
            </button>

            <button
              type="button"
              class="btn-transform-action"
              data-action="rotate-right"
              title="दाईं ओर ९०° घुमाएँ"
              aria-label="दाईं ओर ९० अंश घुमाएँ"
              ${this.isTransforming ? 'disabled' : ''}
            >
              ${getIconSvg('rotate-right', 'btn-icon')}
              <span>घुमाएँ (+९०°)</span>
            </button>

            <button
              type="button"
              class="btn-transform-action ${this.isCropMode ? 'active' : ''}"
              data-action="toggle-crop"
              title="क्रॉप टूल खोलें"
              aria-label="क्रॉप टूल खोलें या बंद करें"
              ${this.isTransforming ? 'disabled' : ''}
            >
              ${getIconSvg('crop', 'btn-icon')}
              <span>${this.isCropMode ? 'क्रॉप बंद करें' : 'क्रॉप करें'}</span>
            </button>

            <button
              type="button"
              class="btn-transform-action"
              data-action="reset-transform"
              title="संपादन रद्द कर मूल छवि पर लौटें"
              aria-label="पूर्वावस्था पर लौटें"
              ${!hasUncommittedEdits && this.workingRotation === 0 && !this.workingCrop ? 'disabled' : ''}
            >
              ${getIconSvg('restore', 'btn-icon')}
              <span>पूर्वावस्था (रीसेट)</span>
            </button>

            ${hasUncommittedEdits ? `
              <button
                type="button"
                class="btn-transform-action btn-save-derived"
                data-action="save-derived"
                aria-label="संपादित प्रति सहेजें"
                ${this.isTransforming ? 'disabled' : ''}
              >
                ${getIconSvg('check', 'btn-icon')}
                <span>${this.isTransforming ? 'सहेजा जा रहा है...' : 'संपादित प्रति सहेजें'}</span>
              </button>
            ` : ''}

            ${hasDerived && !hasUncommittedEdits ? `
              <button
                type="button"
                class="btn-transform-action btn-discard-derived"
                data-action="open-clear-derived-modal"
                aria-label="संपादित प्रति हटाएँ"
              >
                ${getIconSvg('trash', 'btn-icon')}
                <span>संपादित प्रति हटाएँ</span>
              </button>
            ` : ''}
          </div>

          <!-- Crop Controls Panel (When Crop Mode is Active) -->
          ${this.isCropMode ? `
            <div class="manuscript-crop-panel" role="region" aria-label="आयताकार क्रॉप समायोजन">
              <div class="crop-panel-header">
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  ${getIconSvg('crop', 'btn-icon')}
                  <span style="font-weight: 600;">आयताकार क्रॉप चयन (Interactive Crop)</span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                  <span class="crop-status-pill">
                    ${this.workingCrop
                      ? `चयनित: ${this.workingCrop.width} × ${this.workingCrop.height} px`
                      : 'छवि पर माउस या उंगली से खींचें'}
                  </span>
                  ${this.workingCrop ? `
                    <button
                      type="button"
                      class="btn-crop-clear"
                      data-action="reset-crop"
                      aria-label="क्रॉप चयन हटाएं"
                    >
                      क्रॉप हटाएं
                    </button>
                  ` : ''}
                </div>
              </div>

              <p class="crop-guidance-text">
                👉 <strong>माउस दबाकर या उंगली से खींचें:</strong> पांडुलिपि के जिस भाग को रखना है, उस पर आयताकार क्षेत्र खींचें। मूल पांडुलिपि पूर्णतः सुरक्षित व अपरिवर्तित रहेगी।
              </p>

              <!-- Optional Quick Inset Shortcuts -->
              <div class="crop-preset-grid">
                <span style="font-size: var(--text-caption); color: var(--color-text-muted); align-self: center; margin-right: var(--space-2);">
                  त्वरित प्रीसेट:
                </span>
                <button type="button" class="btn-crop-preset" data-action="apply-crop-preset" data-percent="5" title="किनारे ५% छाँटें">
                  ५% किनारा
                </button>
                <button type="button" class="btn-crop-preset" data-action="apply-crop-preset" data-percent="10" title="१०% किनारा छाँटें">
                  १०% किनारा
                </button>
                <button type="button" class="btn-crop-preset" data-action="apply-crop-preset" data-percent="20" title="२०% किनारा छाँटें">
                  २०% किनारा
                </button>
                ${this.workingCrop ? `
                  <button type="button" class="btn-crop-preset" data-action="reset-crop" style="color: var(--color-accent-terracotta);">
                    क्रॉप रीसेट
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Archival Image Showcase -->
          <div class="manuscript-archival-display">
            <figure class="manuscript-archival-frame" style="margin: 0; position: relative; display: inline-block;">
              ${displaySrc ? `
                <img
                  src="${displaySrc}"
                  alt="${isViewingDerived ? 'संपादित पांडुलिपि प्रति' : 'मूल पांडुलिपि'}: ${this.escapeHtml(ms.title)}"
                  class="manuscript-archival-img"
                />
              ` : `
                <div class="manuscript-missing-image-box" role="alert" style="padding: var(--space-8); text-align: center;">
                  <div style="font-size: 2rem; color: var(--color-accent-terracotta);" aria-hidden="true">⚠️</div>
                  <p style="margin: var(--space-2) 0 0 0; font-family: var(--font-interface); color: var(--color-text-muted);">
                    पांडुलिपि छवि डेटा अप्राप्य है।
                  </p>
                </div>
              `}
              ${this.isCropMode ? `
                <div
                  class="crop-interactive-surface"
                  data-crop-surface
                  style="touch-action: none;"
                  role="application"
                  aria-label="छवि पर खींचकर आयताकार क्रॉप क्षेत्र चुनें"
                >
                  <div
                    class="crop-selection-box"
                    data-crop-box
                    style="${this.displayCropBox ? `display: block; left: ${this.displayCropBox.x}px; top: ${this.displayCropBox.y}px; width: ${this.displayCropBox.width}px; height: ${this.displayCropBox.height}px;` : 'display: none;'}"
                  >
                    <div class="crop-handle handle-nw" aria-hidden="true"></div>
                    <div class="crop-handle handle-ne" aria-hidden="true"></div>
                    <div class="crop-handle handle-se" aria-hidden="true"></div>
                    <div class="crop-handle handle-sw" aria-hidden="true"></div>
                    <div class="crop-dims-badge" data-crop-dims-badge>
                      ${this.workingCrop ? `${this.workingCrop.width} × ${this.workingCrop.height} px` : ''}
                    </div>
                  </div>
                </div>
              ` : ''}
            </figure>
          </div>

          <!-- Archival Metadata Grid -->
          <div class="manuscript-detail-metadata-grid">
            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">प्रदर्शित प्रति</span>
              <span class="manuscript-meta-value" style="font-weight: 600; color: var(--color-accent-gold);">
                ${isViewingDerived ? 'संपादित प्रति (Derived Version)' : 'मूल पांडुलिपि (Original Artifact)'}
              </span>
            </div>

            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">मूल फ़ाइल नाम</span>
              <span class="manuscript-meta-value">${this.escapeHtml(orig.filename || 'अज्ञात फ़ाइल')}</span>
            </div>

            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">मूल कैप्चर तिथि</span>
              <span class="manuscript-meta-value">${captureDate}</span>
            </div>

            ${hasDerived && isViewingDerived ? `
              <div class="manuscript-meta-item">
                <span class="manuscript-meta-label">संपादित तिथि</span>
                <span class="manuscript-meta-value">${derivedDate || 'हाल ही में'}</span>
              </div>
            ` : ''}

            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">छवि प्रारूप (MIME)</span>
              <span class="manuscript-meta-value">${this.escapeHtml(isViewingDerived && derived ? derived.mimeType : (orig.mimeType || 'image/jpeg'))}</span>
            </div>

            <div class="manuscript-meta-item">
              <span class="manuscript-meta-label">उद्गम स्रोत</span>
              <span class="manuscript-meta-value">${this.formatSource(prov.source)}</span>
            </div>

            ${dimsText ? `
              <div class="manuscript-meta-item">
                <span class="manuscript-meta-label">छवि आयाम (Dimensions)</span>
                <span class="manuscript-meta-value">${this.escapeHtml(dimsText)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Provenance Notes Section -->
          ${prov.notes ? `
            <div class="manuscript-notes-section">
              <h2 class="manuscript-notes-heading">उद्गम व साहित्यिक संदर्भ</h2>
              <div class="manuscript-notes-body">${this.escapeHtml(prov.notes)}</div>
            </div>
          ` : ''}

          <!-- Linked Poem Archival Section -->
          ${this.renderLinkedPoemSection()}
        </article>

        <!-- Delete Entire Manuscript Modal -->
        ${this.showDeleteModal ? this.renderDeleteModal() : ''}

        <!-- Clear Derived Version Confirmation Modal -->
        ${this.showClearDerivedModal ? this.renderClearDerivedModal() : ''}

        <!-- Link Poem Modal -->
        ${this.showLinkModal ? this.renderLinkModal() : ''}

        <!-- Unlink Poem Modal -->
        ${this.showUnlinkModal ? this.renderUnlinkModal() : ''}
      </div>
    `;
  }

  /**
   * Renders modal to discard only the derived copy
   */
  renderClearDerivedModal() {
    return `
      <div
        class="modal-backdrop"
        style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-4);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-derived-dialog-title"
      >
        <div
          class="modal-dialog"
          style="background: var(--color-bg-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); padding: var(--space-6); max-width: 440px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.4);"
        >
          <h3 id="clear-derived-dialog-title" style="font-family: var(--font-display); font-size: var(--text-h3); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            संपादित प्रति हटाएँ?
          </h3>
          <p style="font-family: var(--font-interface); font-size: var(--text-body-small); color: var(--color-text-secondary); margin: 0 0 var(--space-6) 0; line-height: var(--leading-normal);">
            क्या आप इस पांडुलिपि की संपादित कार्य-प्रति हटाना चाहते हैं? आपकी <strong>मूल पांडुलिपि पूरी तरह सुरक्षित रहेगी</strong>।
          </p>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-3);">
            <button
              type="button"
              class="btn-preserve-cancel"
              data-action="cancel-clear-derived"
              style="min-height: 44px;"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-preserve-primary"
              data-action="confirm-clear-derived"
              style="background: var(--color-accent-terracotta); color: #fff; min-height: 44px;"
            >
              हाँ, संपादित प्रति हटाएँ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the delete confirmation modal for the entire manuscript
   */
  renderDeleteModal() {
    return `
      <div
        class="modal-backdrop"
        style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-4);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div
          class="modal-dialog"
          style="background: var(--color-bg-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); padding: var(--space-6); max-width: 440px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.4);"
        >
          <h3 id="delete-dialog-title" style="font-family: var(--font-display); font-size: var(--text-h3); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            पांडुलिपि स्थायी रूप से हटाएँ?
          </h3>
          <p style="font-family: var(--font-interface); font-size: var(--text-body-small); color: var(--color-text-secondary); margin: 0 0 var(--space-6) 0; line-height: var(--leading-normal);">
            क्या आप <strong>"${this.escapeHtml(this.manuscript.title)}"</strong> पांडुलिपि को स्थायी रूप से हटाना चाहते हैं? यह मूल छवि और संपादित प्रतियाँ आपके डिजिटल संदूक से मिटा दी जाएंगी।
          </p>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-3);">
            <button
              type="button"
              class="btn-preserve-cancel"
              data-action="cancel-delete"
              style="min-height: 44px;"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-preserve-primary"
              data-action="confirm-delete"
              style="background: var(--color-accent-terracotta); color: #fff; min-height: 44px;"
            >
              हाँ, हटाएँ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders the linked poem archival section in the reader
   */
  renderLinkedPoemSection() {
    const ms = this.manuscript;
    if (!ms) return '';

    let linkedPoem = null;
    if (ms.poemId) {
      try {
        linkedPoem = this.repository.getLinkedPoem
          ? this.repository.getLinkedPoem(this.manuscriptId)
          : (this.poemRepo ? this.poemRepo.getById(ms.poemId) : null);
      } catch (_) {
        linkedPoem = null;
      }
    }

    return `
      <section class="manuscript-linked-poem-section" aria-labelledby="linked-poem-heading">
        <div class="manuscript-linked-header">
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            ${getIconSvg('quill', 'meta-icon')}
            <h2 id="linked-poem-heading" class="manuscript-linked-heading">इस पांडुलिपि से संबंधित कविता</h2>
          </div>
          ${linkedPoem ? `
            <button
              type="button"
              class="btn-manuscript-unlink"
              data-action="open-unlink-modal"
              aria-label="कविता से संबंध हटाएं"
              title="कविता से संबंध हटाएं"
            >
              ${getIconSvg('close', 'icon-inline')}
              <span>संबंध हटाएँ</span>
            </button>
          ` : ''}
        </div>

        ${this.linkSuccessMessage ? `
          <div class="manuscript-feedback-banner feedback-success" role="status" style="margin-bottom: var(--space-4);">
            ${getIconSvg('check', 'banner-icon')}
            <span>${this.escapeHtml(this.linkSuccessMessage)}</span>
          </div>
        ` : ''}

        ${linkedPoem ? `
          <div class="manuscript-linked-card" role="region" aria-label="संबद्ध कविता विवरण">
            <div class="linked-card-info">
              <h3 class="linked-card-title">${this.escapeHtml(linkedPoem.title || 'शीर्षकहीन रचना')}</h3>
              <div class="linked-card-meta">
                <span class="linked-card-author">${this.escapeHtml(linkedPoem.author || 'अज्ञात')}</span>
                <span class="card-meta-dot" aria-hidden="true">•</span>
                <time datetime="${linkedPoem.updatedAt || linkedPoem.createdAt}">
                  अद्यतन: ${formatPoeticDate(linkedPoem.updatedAt || linkedPoem.createdAt)}
                </time>
              </div>
            </div>
            <div class="linked-card-actions">
              <a
                href="/poems/${encodeURIComponent(linkedPoem.id)}"
                data-link
                class="btn-read-linked-poem"
                aria-label="${this.escapeHtml(linkedPoem.title)} कविता पढ़ें"
              >
                ${getIconSvg('book', 'icon-inline')}
                <span>कविता पढ़ें</span>
              </a>
              <button
                type="button"
                class="btn-relink-poem"
                data-action="open-link-modal"
                aria-label="अन्य कविता से जोड़ें"
                title="अन्य कविता से जोड़ें"
              >
                ${getIconSvg('edit', 'icon-inline')}
                <span>बदलें</span>
              </button>
            </div>
          </div>
        ` : `
          <div class="manuscript-unlinked-box">
            <p class="manuscript-unlinked-text">अभी किसी कविता से संबद्ध नहीं</p>
            <button
              type="button"
              class="btn-link-poem-cta"
              data-action="open-link-modal"
              aria-label="इस पांडुलिपि को कविता से जोड़ें"
            >
              ${getIconSvg('quill', 'icon-inline')}
              <span>कविता से जोड़ें</span>
            </button>
          </div>
        `}
      </section>
    `;
  }

  /**
   * Renders the list items for the poem selection modal
   * @returns {string} HTML string
   */
  renderPoemListItems() {
    let poems = [];
    try {
      const allPoems = this.poemRepo ? this.poemRepo.getAll({ includeArchived: true }) : [];
      const query = (this.poemSearchQuery || '').toLowerCase().trim();
      poems = allPoems.filter(p => {
        if (!p || typeof p !== 'object') return false;
        if (!query) return true;
        const t = (p.title || '').toLowerCase();
        const a = (p.author || '').toLowerCase();
        return t.includes(query) || a.includes(query);
      });
    } catch (err) {
      poems = [];
    }

    if (poems.length === 0) {
      return `
        <div style="text-align: center; padding: var(--space-6); color: var(--color-text-muted); font-family: var(--font-interface); font-size: var(--text-body-small);">
          कोई कविता नहीं मिली।
        </div>
      `;
    }

    return poems.map(poem => {
      const isSelected = this.selectedPoemId === poem.id;
      return `
        <div
          class="link-poem-option ${isSelected ? 'selected' : ''}"
          data-action="select-poem"
          data-poem-id="${encodeURIComponent(poem.id)}"
          role="radio"
          aria-checked="${isSelected}"
          tabindex="0"
          style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); border: 1px solid ${isSelected ? 'var(--color-accent-gold)' : 'var(--color-border-subtle)'}; background: ${isSelected ? 'rgba(184, 134, 11, 0.08)' : 'var(--color-bg-secondary)'}; cursor: pointer; transition: all 0.2s ease;"
        >
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-family: var(--font-display); font-weight: 600; color: var(--color-text-primary); font-size: var(--text-body-small);">
              ${this.escapeHtml(poem.title || 'शीर्षकहीन')}
            </span>
            <span style="font-family: var(--font-interface); font-size: 12px; color: var(--color-text-muted);">
              ${this.escapeHtml(poem.author || 'अज्ञात')} • ${formatPoeticDate(poem.createdAt)}
            </span>
          </div>
          <div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${isSelected ? 'var(--color-accent-gold)' : 'var(--color-border-subtle)'}; display: flex; align-items: center; justify-content: center; background: ${isSelected ? 'var(--color-accent-gold)' : 'transparent'};">
            ${isSelected ? '<span style="width: 8px; height: 8px; border-radius: 50%; background: #fff;"></span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renders the modal dialog to link the manuscript to a poem
   */
  renderLinkModal() {
    return `
      <div
        class="modal-backdrop"
        style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-4);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-dialog-title"
      >
        <div
          class="modal-dialog link-poem-dialog"
          style="background: var(--color-bg-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); padding: var(--space-6); max-width: 520px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 16px 36px rgba(0,0,0,0.4);"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
            <h3 id="link-dialog-title" style="font-family: var(--font-display); font-size: var(--text-h3); color: var(--color-text-primary); margin: 0;">
              पांडुलिपि को कविता से जोड़ें
            </h3>
            <button
              type="button"
              data-action="close-link-modal"
              aria-label="संवाद बंद करें"
              style="background: transparent; border: none; cursor: pointer; color: var(--color-text-muted); padding: var(--space-1);"
            >
              ${getIconSvg('close', 'icon-inline')}
            </button>
          </div>

          <p style="font-family: var(--font-interface); font-size: var(--text-body-small); color: var(--color-text-secondary); margin: 0 0 var(--space-4) 0; line-height: var(--leading-normal);">
            इस हस्तलिखित पांडुलिपि से संबंधित डिजिटल कविता का चयन करें:
          </p>

          <!-- Search filter input -->
          <div style="margin-bottom: var(--space-4);">
            <input
              type="search"
              class="link-poem-search-input"
              data-action="search-poem-input"
              placeholder="शीर्षक या रचनाकार खोजें..."
              value="${this.escapeHtml(this.poemSearchQuery)}"
              aria-label="कविता खोजें"
              style="width: 100%; height: 44px; padding: 0 var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle); background: var(--color-bg-secondary); color: var(--color-text-primary); font-family: var(--font-interface); font-size: var(--text-body-small); box-sizing: border-box;"
            />
          </div>

          ${this.linkError ? `
            <div class="manuscript-feedback-banner feedback-error" role="alert" style="margin-bottom: var(--space-3);">
              ${getIconSvg('alert', 'banner-icon')}
              <span>${this.escapeHtml(this.linkError)}</span>
            </div>
          ` : ''}

          <!-- Scrollable Poem Selection List -->
          <div class="link-poem-list" role="radiogroup" aria-label="उपलब्ध कविताएं" style="overflow-y: auto; max-height: 300px; margin-bottom: var(--space-6); display: flex; flex-direction: column; gap: var(--space-2); padding-right: var(--space-1);">
            ${this.renderPoemListItems()}
          </div>

          <!-- Dialog Actions -->
          <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: auto;">
            <button
              type="button"
              class="btn-modal-cancel"
              data-action="close-link-modal"
              aria-label="रद्द करें"
              style="min-height: 48px; padding: 0 var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle); background: transparent; color: var(--color-text-primary); cursor: pointer; font-family: var(--font-interface);"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-modal-confirm"
              data-action="confirm-link"
              ${!this.selectedPoemId ? 'disabled' : ''}
              aria-label="संबद्ध करें"
              style="min-height: 48px; padding: 0 var(--space-5); border-radius: var(--radius-md); border: none; background: var(--color-accent-gold); color: #1a150e; font-weight: 600; cursor: ${!this.selectedPoemId ? 'not-allowed' : 'pointer'}; opacity: ${!this.selectedPoemId ? '0.5' : '1'}; font-family: var(--font-interface);"
            >
              संबद्ध करें
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renders confirmation modal to unlink manuscript from poem
   */
  renderUnlinkModal() {
    return `
      <div
        class="modal-backdrop"
        style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-4);"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unlink-dialog-title"
      >
        <div
          class="modal-dialog"
          style="background: var(--color-bg-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); padding: var(--space-6); max-width: 440px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.4);"
        >
          <h3 id="unlink-dialog-title" style="font-family: var(--font-display); font-size: var(--text-h3); color: var(--color-text-primary); margin: 0 0 var(--space-2) 0;">
            कविता से संबंध हटाएँ?
          </h3>
          <p style="font-family: var(--font-interface); font-size: var(--text-body-small); color: var(--color-text-secondary); margin: 0 0 var(--space-6) 0; line-height: var(--leading-normal);">
            क्या आप इस पांडुलिपि का कविता से संबंध हटाना चाहते हैं? आपकी पांडुलिपि और कविता दोनों पूरी तरह सुरक्षित रहेंगी।
          </p>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-3);">
            <button
              type="button"
              class="btn-modal-cancel"
              data-action="close-unlink-modal"
              aria-label="रद्द करें"
              style="min-height: 48px; padding: 0 var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle); background: transparent; color: var(--color-text-primary); cursor: pointer; font-family: var(--font-interface);"
            >
              रद्द करें
            </button>
            <button
              type="button"
              class="btn-modal-confirm"
              data-action="confirm-unlink"
              aria-label="संबंध हटाएँ"
              style="min-height: 48px; padding: 0 var(--space-4); border-radius: var(--radius-md); border: none; background: var(--color-accent-terracotta); color: #fff; font-weight: 600; cursor: pointer; font-family: var(--font-interface);"
            >
              संबंध हटाएँ
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
