/**
 * काव्यकलश (KavyaVault) — Manuscript Image Transformer (ManuscriptImageTransformer.js)
 *
 * Phase 2 / Task 2.3: Non-Destructive Manuscript Image Transformation
 *
 * Provides isolated, non-destructive canvas-based image rotation (0°, 90°, 180°, 270°)
 * and rectangular cropping. Generates a brand new derived image artifact without
 * ever mutating or altering the original source artifact.
 *
 * Output format: Lossless PNG Data URL ('image/png')
 */

/**
 * Valid rotation angles allowed in KavyaVault
 */
export const VALID_ROTATIONS = [0, 90, 180, 270];

/**
 * Normalizes an angle into a valid 0, 90, 180, or 270 degree rotation
 * @param {number} angle
 * @returns {number}
 */
export function normalizeRotation(angle) {
  let normalized = Math.round(angle) % 360;
  if (normalized < 0) normalized += 360;
  if (!VALID_ROTATIONS.includes(normalized)) {
    throw new Error(`अमान्य घूर्णन कोण ${angle}°। केवल 0°, 90°, 180° या 270° मान्य हैं।`);
  }
  return normalized;
}

/**
 * Calculates the bounding dimensions of an image after rotation
 * @param {number} width - Original width
 * @param {number} height - Original height
 * @param {number} rotation - 0, 90, 180, or 270
 * @returns {{ width: number, height: number }}
 */
export function getRotatedDimensions(width, height, rotation) {
  const normRot = normalizeRotation(rotation);
  if (normRot === 90 || normRot === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

/**
 * Validates crop rectangle against image boundaries
 * @param {{ x: number, y: number, width: number, height: number }} crop
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function validateCropBounds(crop, imageWidth, imageHeight) {
  if (!crop || typeof crop !== 'object') {
    throw new Error('क्रॉप ऑब्जेक्ट अमान्य है।');
  }

  const x = Math.max(0, Math.round(crop.x || 0));
  const y = Math.max(0, Math.round(crop.y || 0));
  const width = Math.round(crop.width);
  const height = Math.round(crop.height);

  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    throw new Error('क्रॉप निर्देशांक संख्यात्मक होने अनिवार्य हैं।');
  }

  if (width <= 0 || height <= 0) {
    throw new Error('क्रॉप की चौड़ाई और ऊँचाई शून्य से अधिक होनी चाहिए।');
  }

  if (x >= imageWidth || y >= imageHeight) {
    throw new Error('क्रॉप निर्देशांक छवि सीमाओं से बाहर हैं।');
  }

  // Constrain to image boundaries
  const constrainedWidth = Math.min(width, imageWidth - x);
  const constrainedHeight = Math.min(height, imageHeight - y);

  return {
    x,
    y,
    width: constrainedWidth,
    height: constrainedHeight
  };
}

/**
 * Maps a display-space crop rectangle (from mouse/touch interaction) to natural image pixel coordinates.
 * Handles dragging in any direction, clamps to displayed bounds, scales by natural-to-display ratios,
 * and ensures valid integer pixel dimensions.
 *
 * @param {{ x: number, y: number, width: number, height: number }} displayCrop - Crop box in display pixels
 * @param {{ width: number, height: number }} displayBounds - Current rendered width/height of the image element
 * @param {{ width: number, height: number }} naturalDims - Natural width/height of the oriented image
 * @returns {{ x: number, y: number, width: number, height: number }} Mapped crop box in natural image pixels
 */
export function mapDisplayCropToNatural(displayCrop, displayBounds, naturalDims) {
  if (!displayCrop || typeof displayCrop !== 'object') {
    throw new Error('क्रॉप ऑब्जेक्ट अमान्य है।');
  }
  if (!displayBounds || typeof displayBounds !== 'object' || !naturalDims || typeof naturalDims !== 'object') {
    throw new Error('प्रदर्शन व प्राकृतिक विमाएँ अनिवार्य हैं।');
  }

  const dispW = Number(displayBounds.width);
  const dispH = Number(displayBounds.height);
  const natW = Number(naturalDims.width);
  const natH = Number(naturalDims.height);

  if (isNaN(dispW) || isNaN(dispH) || dispW <= 0 || dispH <= 0) {
    throw new Error('प्रदर्शन विमाएँ सकारात्मक संख्यात्मक होनी चाहिए।');
  }
  if (isNaN(natW) || isNaN(natH) || natW <= 0 || natH <= 0) {
    throw new Error('प्राकृतिक छवि विमाएँ सकारात्मक संख्यात्मक होनी चाहिए।');
  }

  // Handle negative width/height (dragged right-to-left or bottom-to-top)
  let rawX = Number(displayCrop.x || 0);
  let rawY = Number(displayCrop.y || 0);
  let rawW = Number(displayCrop.width || 0);
  let rawH = Number(displayCrop.height || 0);

  if (isNaN(rawX) || isNaN(rawY) || isNaN(rawW) || isNaN(rawH)) {
    throw new Error('क्रॉप निर्देशांक संख्यात्मक होने चाहिए।');
  }

  let normX = rawW < 0 ? rawX + rawW : rawX;
  let normY = rawH < 0 ? rawY + rawH : rawY;
  let normW = Math.abs(rawW);
  let normH = Math.abs(rawH);

  // Clamp display selection to display boundaries
  const clampedDispX = Math.max(0, Math.min(normX, dispW));
  const clampedDispY = Math.max(0, Math.min(normY, dispH));
  const clampedDispW = Math.min(normW, dispW - clampedDispX);
  const clampedDispH = Math.min(normH, dispH - clampedDispY);

  if (clampedDispW <= 0 || clampedDispH <= 0) {
    throw new Error('क्रॉप चयन का क्षेत्रफल शून्य से अधिक होना चाहिए।');
  }

  const scaleX = natW / dispW;
  const scaleY = natH / dispH;

  const natX = Math.round(clampedDispX * scaleX);
  const natY = Math.round(clampedDispY * scaleY);
  const natWidth = Math.round(clampedDispW * scaleX);
  const natHeight = Math.round(clampedDispH * scaleY);

  // Double clamp natural coordinates against natural dimensions
  const finalX = Math.max(0, Math.min(natX, natW - 1));
  const finalY = Math.max(0, Math.min(natY, natH - 1));
  const finalWidth = Math.max(1, Math.min(natWidth, natW - finalX));
  const finalHeight = Math.max(1, Math.min(natHeight, natH - finalY));

  return {
    x: finalX,
    y: finalY,
    width: finalWidth,
    height: finalHeight
  };
}

/**
 * Loads an HTMLImageElement asynchronously from a source string (Data URL or Object URL)
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image API is not supported in this environment.'));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('पांडुलिपि छवि लोड करने में विफलता।'));
    img.src = src;
  });
}

export class ManuscriptImageTransformer {
  /**
   * Applies non-destructive transformation (rotation then crop) to an image source.
   * Produces a brand new, lossless PNG Data URL representation.
   *
   * @param {string} sourceData - Source image Data URL or Object URL (remains untouched)
   * @param {Object} options
   * @param {number} [options.rotation=0] - 0, 90, 180, or 270 degrees
   * @param {Object|null} [options.crop=null] - Rectangular crop { x, y, width, height }
   * @returns {Promise<{ data: string, mimeType: string, width: number, height: number }>}
   */
  static async transform(sourceData, { rotation = 0, crop = null } = {}) {
    const normRot = normalizeRotation(rotation);

    // If environment has no Canvas, return null or error safely
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      throw new Error('Canvas API is required for manuscript transformation.');
    }

    const img = await loadImage(sourceData);
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    const rotatedDims = getRotatedDimensions(origWidth, origHeight, normRot);

    // 1. Create canvas for rotated image
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = rotatedDims.width;
    rotCanvas.height = rotatedDims.height;
    const rotCtx = rotCanvas.getContext('2d');

    if (!rotCtx) {
      throw new Error('Canvas 2D context could not be initialized.');
    }

    // High quality interpolation
    rotCtx.imageSmoothingEnabled = true;
    rotCtx.imageSmoothingQuality = 'high';

    // Apply rotation around center
    rotCtx.translate(rotatedDims.width / 2, rotatedDims.height / 2);
    rotCtx.rotate((normRot * Math.PI) / 180);
    rotCtx.drawImage(img, -origWidth / 2, -origHeight / 2);

    let finalCanvas = rotCanvas;
    let finalWidth = rotatedDims.width;
    let finalHeight = rotatedDims.height;

    // 2. Apply crop if specified
    if (crop) {
      const validCrop = validateCropBounds(crop, rotatedDims.width, rotatedDims.height);
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = validCrop.width;
      cropCanvas.height = validCrop.height;
      const cropCtx = cropCanvas.getContext('2d');

      if (!cropCtx) {
        throw new Error('Crop canvas context could not be initialized.');
      }

      cropCtx.imageSmoothingEnabled = true;
      cropCtx.imageSmoothingQuality = 'high';

      // Draw cropped subsection from rotated canvas
      cropCtx.drawImage(
        rotCanvas,
        validCrop.x,
        validCrop.y,
        validCrop.width,
        validCrop.height,
        0,
        0,
        validCrop.width,
        validCrop.height
      );

      finalCanvas = cropCanvas;
      finalWidth = validCrop.width;
      finalHeight = validCrop.height;
    }

    // 3. Export as lossless PNG Data URL
    const derivedDataUrl = finalCanvas.toDataURL('image/png');

    return {
      data: derivedDataUrl,
      mimeType: 'image/png',
      width: finalWidth,
      height: finalHeight
    };
  }
}
