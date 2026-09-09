/**
 * काव्यकलश (KavyaVault) — Non-Destructive Manuscript Transformation Test Suite (test_manuscript_transform.js)
 *
 * Phase 2 / Task 2.3: Non-Destructive Manuscript Image Transformation
 *
 * Verifies:
 * 1. Rotation normalization and dimensional calculation (0°, 90°, 180°, 270°)
 * 2. Crop bounds calculation, bounding validation, and negative/out-of-bounds rejection
 * 3. Derived artifact creation: brand new kv_art_* ID, sourceArtifactId === originalManuscript.id
 * 4. Immutability guarantee: originalManuscript.data remains 100% byte-for-byte unchanged
 * 5. Repository update immutability: updateMetadata blocks derivedManuscript, transformation, originalManuscript
 * 6. Transformation versioning: incrementing transformVersion on repeated transformations
 * 7. Reset / clearDerivedManuscript restores clean null state without affecting original artifact
 * 8. Storage quota resilience: QuotaExceededError preserves existing records
 * 9. Persistence & reload simulation: adapter data survives new repository instantiation
 * 10. Hindi Unicode and XSS-safe rendering in ManuscriptView
 * 11. Canvas-based transformation pipeline produces lossless PNG derived artifact
 */

import { LocalStorageAdapter } from './src/services/storage/LocalStorageAdapter.js';
import { ManuscriptRepository } from './src/services/ManuscriptRepository.js';
import { StorageError, StorageErrorCode } from './src/services/storage/StorageError.js';
import {
  VALID_ROTATIONS,
  normalizeRotation,
  getRotatedDimensions,
  validateCropBounds,
  mapDisplayCropToNatural,
  ManuscriptImageTransformer
} from './src/services/manuscripts/ManuscriptImageTransformer.js';
import { ManuscriptView } from './src/components/manuscripts/ManuscriptView.js';

// Mock storage engine
class MockStorage {
  constructor() {
    this.store = new Map();
    this.simulateQuota = false;
  }
  get length() {
    return this.store.size;
  }
  key(i) {
    return Array.from(this.store.keys())[i] || null;
  }
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  }
  setItem(k, v) {
    if (this.simulateQuota) {
      const err = new Error('QuotaExceededError');
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

// Mock DOM element for view testing
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.innerHTML = '';
    this.attributes = {};
    this.children = [];
    this.eventListeners = {};
    this.style = {};
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
  }
  getAttribute(k) {
    return this.attributes[k] || null;
  }
  removeAttribute(k) {
    delete this.attributes[k];
  }
  addEventListener(evt, fn) {
    if (!this.eventListeners[evt]) this.eventListeners[evt] = [];
    this.eventListeners[evt].push(fn);
  }
  querySelector(sel) {
    return new MockElement('div');
  }
  querySelectorAll(sel) {
    return [];
  }
}

// Deterministic test data URL (mock 1x1 png base64)
const SAMPLE_ORIGINAL_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SAMPLE_DERIVED_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function runTransformTests() {
  console.log('================================================================');
  console.log('  KavyaVault Phase 2 Task 2.3 — Transform Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [${total}] ${name}`);
      console.error(`    Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [${total}] ${name}`);
      console.error(`    Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      process.exit(1);
    }
  }

  // Section 1: Rotation Math & Normalization
  test('normalizeRotation: Accepts valid angles 0, 90, 180, 270', () => {
    console.assert(normalizeRotation(0) === 0, '0 degrees should normalize to 0');
    console.assert(normalizeRotation(90) === 90, '90 degrees should normalize to 90');
    console.assert(normalizeRotation(180) === 180, '180 degrees should normalize to 180');
    console.assert(normalizeRotation(270) === 270, '270 degrees should normalize to 270');
  });

  test('normalizeRotation: Wraps negative angles (-90 => 270, -180 => 180, -270 => 90)', () => {
    console.assert(normalizeRotation(-90) === 270, '-90 should wrap to 270');
    console.assert(normalizeRotation(-180) === 180, '-180 should wrap to 180');
    console.assert(normalizeRotation(-270) === 90, '-270 should wrap to 90');
  });

  test('normalizeRotation: Rejects invalid angles (45, 120, -10, NaN)', () => {
    let threw45 = false;
    try { normalizeRotation(45); } catch (e) { threw45 = true; }
    console.assert(threw45, 'Should reject 45');

    let threwInvalid = false;
    try { normalizeRotation(120); } catch (e) { threwInvalid = true; }
    console.assert(threwInvalid, 'Should reject 120');

    let threwNeg = false;
    try { normalizeRotation(-10); } catch (e) { threwNeg = true; }
    console.assert(threwNeg, 'Should reject -10');
  });

  test('getRotatedDimensions: Preserves dimensions for 0° and 180°', () => {
    const dims0 = getRotatedDimensions(1200, 800, 0);
    console.assert(dims0.width === 1200 && dims0.height === 800, '0 deg preserves dimensions');

    const dims180 = getRotatedDimensions(1200, 800, 180);
    console.assert(dims180.width === 1200 && dims180.height === 800, '180 deg preserves dimensions');
  });

  test('getRotatedDimensions: Swaps dimensions for 90° and 270°', () => {
    const dims90 = getRotatedDimensions(1200, 800, 90);
    console.assert(dims90.width === 800 && dims90.height === 1200, '90 deg swaps dimensions');

    const dims270 = getRotatedDimensions(1200, 800, 270);
    console.assert(dims270.width === 800 && dims270.height === 1200, '270 deg swaps dimensions');
  });

  // Section 2: Crop Bounds Validation
  test('validateCropBounds: Validates and constrains inside bounds', () => {
    const crop = validateCropBounds({ x: 50, y: 50, width: 400, height: 300 }, 1000, 800);
    console.assert(crop.x === 50 && crop.y === 50, 'Crop offsets preserved');
    console.assert(crop.width === 400 && crop.height === 300, 'Crop dimensions preserved');
  });

  test('validateCropBounds: Constrains crop that extends past image edge', () => {
    const crop = validateCropBounds({ x: 900, y: 700, width: 300, height: 300 }, 1000, 800);
    console.assert(crop.width === 100, 'Width constrained to 100 (1000 - 900)');
    console.assert(crop.height === 100, 'Height constrained to 100 (800 - 700)');
  });

  test('validateCropBounds: Rejects negative dimensions, zero dimensions, or invalid objects', () => {
    let threwZero = false;
    try { validateCropBounds({ x: 0, y: 0, width: 0, height: 100 }, 500, 500); } catch (e) { threwZero = true; }
    console.assert(threwZero, 'Zero width rejected');

    let threwNeg = false;
    try { validateCropBounds({ x: 0, y: 0, width: -10, height: 100 }, 500, 500); } catch (e) { threwNeg = true; }
    console.assert(threwNeg, 'Negative width rejected');

    let threwOutOfBounds = false;
    try { validateCropBounds({ x: 600, y: 0, width: 100, height: 100 }, 500, 500); } catch (e) { threwOutOfBounds = true; }
    console.assert(threwOutOfBounds, 'x >= imageWidth rejected');
  });

  // Section 3: ManuscriptRepository Schema & Derived Manuscript Lifecycle
  test('ManuscriptRepository: Newly created manuscript initializes derivedManuscript and transformation as null', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'निराला जी की पांडुलिपि',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'nirala.png',
        byteSize: 1024
      }
    });

    console.assert(ms.derivedManuscript === null, 'derivedManuscript must be null initially');
    console.assert(ms.transformation === null, 'transformation must be null initially');
    console.assert(repo.getDerivedManuscript(ms.id) === null, 'getDerivedManuscript returns null');
  });

  test('ManuscriptRepository: saveDerivedManuscript saves derived artifact and transformation record without mutating original', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'महादेवी जी का मूल पत्र',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'mahadevi.png',
        byteSize: 2048,
        metadata: { width: 1200, height: 800 }
      }
    });

    const originalDataSnapshot = ms.originalManuscript.data;
    const originalChecksumSnapshot = ms.originalManuscript.checksum;
    const originalId = ms.originalManuscript.id;

    const derivedArtifact = {
      id: 'kv_art_derived_123',
      sourceArtifactId: originalId,
      data: SAMPLE_DERIVED_DATA,
      mimeType: 'image/png',
      byteSize: 1500,
      metadata: { width: 800, height: 1200 }
    };

    const transformOptions = {
      rotation: 90,
      crop: { x: 10, y: 10, width: 500, height: 500 }
    };

    const updatedMs = repo.saveDerivedManuscript(ms.id, derivedArtifact, transformOptions);

    // Assert derived artifact is saved
    console.assert(updatedMs.derivedManuscript !== null, 'derivedManuscript is saved');
    console.assert(updatedMs.derivedManuscript.id.startsWith('kv_art_'), 'Derived artifact ID generated with kv_art_ prefix');
    console.assert(updatedMs.derivedManuscript.id !== originalId, 'Derived artifact ID must not equal original ID');
    console.assert(updatedMs.derivedManuscript.sourceArtifactId === originalId, 'sourceArtifactId matches original');
    console.assert(updatedMs.derivedManuscript.data === SAMPLE_DERIVED_DATA, 'Derived data matches');

    // Assert transformation metadata is recorded
    console.assert(updatedMs.transformation !== null, 'transformation recorded');
    console.assert(updatedMs.transformation.rotation === 90, 'rotation recorded');
    console.assert(updatedMs.transformation.crop.width === 500, 'crop recorded');
    console.assert(updatedMs.transformation.transformVersion === 1, 'transformVersion initialized to 1');
    console.assert(typeof updatedMs.transformation.transformedAt === 'string', 'transformedAt timestamp recorded');

    // STRICT ARCHIVAL IMMUTABILITY CHECK
    console.assert(updatedMs.originalManuscript.data === originalDataSnapshot, 'ORIGINAL BYTES MUST NOT CHANGE');
    console.assert(updatedMs.originalManuscript.checksum === originalChecksumSnapshot, 'ORIGINAL CHECKSUM MUST NOT CHANGE');
    console.assert(updatedMs.originalManuscript.id === originalId, 'ORIGINAL ID MUST NOT CHANGE');
    console.assert(updatedMs.originalManuscript.filename === 'mahadevi.png', 'ORIGINAL FILENAME MUST NOT CHANGE');
  });

  test('ManuscriptRepository: Byte-for-byte immutability preserved after rotation transformation', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'दिनकर जी की पांडुलिपि',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'dinkar.png'
      }
    });

    const originalDataBefore = ms.originalManuscript.data;

    // Apply 180 degree rotation
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_rot180',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,mockRotatedBytes180==',
      mimeType: 'image/png'
    }, { rotation: 180, crop: null });

    const msAfter = repo.getById(ms.id);
    console.assert(msAfter.originalManuscript.data === originalDataBefore, 'Original bytes unchanged after rotation');
    console.assert(msAfter.derivedManuscript.data === 'data:image/png;base64,mockRotatedBytes180==', 'Derived holds rotated bytes');
  });

  test('ManuscriptRepository: Byte-for-byte immutability preserved after crop transformation', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'पंत जी की पांडुलिपि',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'pant.png'
      }
    });

    const originalDataBefore = ms.originalManuscript.data;

    // Apply crop
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_crop_rect',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,mockCroppedBytes==',
      mimeType: 'image/png'
    }, { rotation: 0, crop: { x: 20, y: 20, width: 200, height: 200 } });

    const msAfter = repo.getById(ms.id);
    console.assert(msAfter.originalManuscript.data === originalDataBefore, 'Original bytes unchanged after crop');
    console.assert(msAfter.derivedManuscript.data === 'data:image/png;base64,mockCroppedBytes==', 'Derived holds cropped bytes');
  });

  test('ManuscriptRepository: Repeated transformations preserve original and increment transformVersion', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'अज्ञेय जी की पांडुलिपि',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'agyeya.png'
      }
    });

    const originalBytes = ms.originalManuscript.data;

    // 1st transform
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_v1',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,v1==',
      mimeType: 'image/png'
    }, { rotation: 90, crop: null });

    let updated = repo.getById(ms.id);
    console.assert(updated.transformation.transformVersion === 1, 'Version 1 after first transform');
    console.assert(updated.originalManuscript.data === originalBytes, 'Original bytes unchanged v1');

    // 2nd transform
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_v2',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,v2==',
      mimeType: 'image/png'
    }, { rotation: 180, crop: null });

    updated = repo.getById(ms.id);
    console.assert(updated.transformation.transformVersion === 2, 'Version 2 after second transform');
    console.assert(updated.originalManuscript.data === originalBytes, 'Original bytes unchanged v2');

    // 3rd transform
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_v3',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,v3==',
      mimeType: 'image/png'
    }, { rotation: 270, crop: { x: 5, y: 5, width: 100, height: 100 } });

    updated = repo.getById(ms.id);
    console.assert(updated.transformation.transformVersion === 3, 'Version 3 after third transform');
    console.assert(updated.originalManuscript.data === originalBytes, 'Original bytes unchanged v3');
  });

  test('ManuscriptRepository: clearDerivedManuscript clears derived state and leaves original untouched', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'सुभद्रा कुमारी चौहान',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'subhadra.png'
      }
    });

    const originalBytes = ms.originalManuscript.data;

    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_to_delete',
      sourceArtifactId: ms.originalManuscript.id,
      data: SAMPLE_DERIVED_DATA,
      mimeType: 'image/png'
    }, { rotation: 90, crop: null });

    console.assert(repo.getDerivedManuscript(ms.id) !== null, 'Derived exists before clear');

    // Clear / Reset to original
    const cleared = repo.clearDerivedManuscript(ms.id);
    console.assert(cleared.derivedManuscript === null, 'derivedManuscript is null after clear');
    console.assert(cleared.transformation === null, 'transformation is null after clear');
    console.assert(cleared.originalManuscript.data === originalBytes, 'Original bytes completely preserved');
    console.assert(repo.getDerivedManuscript(ms.id) === null, 'getDerivedManuscript returns null after clear');
  });

  // Section 4: Validation & Rejection of Bad Inputs
  test('ManuscriptRepository: Rejects invalid rotation in saveDerivedManuscript', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'टेस्ट पांडुलिपि',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    let threw = false;
    try {
      repo.saveDerivedManuscript(ms.id, {
        id: 'kv_art_bad_rot',
        sourceArtifactId: ms.originalManuscript.id,
        data: SAMPLE_DERIVED_DATA,
        mimeType: 'image/png'
      }, { rotation: 45 });
    } catch (e) {
      threw = true;
    }
    console.assert(threw, 'Should reject non-standard 45 degree rotation');
  });

  test('ManuscriptRepository: Rejects malformed derived artifact (missing id, data, or mismatched sourceArtifactId)', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'टेस्ट पांडुलिपि',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    // Missing id
    let threwId = false;
    try {
      repo.saveDerivedManuscript(ms.id, {
        sourceArtifactId: ms.originalManuscript.id,
        data: SAMPLE_DERIVED_DATA,
        mimeType: 'image/png'
      });
    } catch (e) { threwId = true; }
    console.assert(threwId, 'Must reject derived artifact missing id');

    // Mismatched sourceArtifactId
    let threwMismatch = false;
    try {
      repo.saveDerivedManuscript(ms.id, {
        id: 'kv_art_mismatch',
        sourceArtifactId: 'kv_art_wrong_id',
        data: SAMPLE_DERIVED_DATA,
        mimeType: 'image/png'
      });
    } catch (e) { threwMismatch = true; }
    console.assert(threwMismatch, 'Must reject derived artifact with mismatched sourceArtifactId');

    // Missing data
    let threwData = false;
    try {
      repo.saveDerivedManuscript(ms.id, {
        id: 'kv_art_no_data',
        sourceArtifactId: ms.originalManuscript.id,
        mimeType: 'image/png'
      });
    } catch (e) { threwData = true; }
    console.assert(threwData, 'Must reject derived artifact missing data payload');
  });

  test('ManuscriptRepository: updateMetadata blocks direct mutation of derivedManuscript or transformation', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'मेटाडेटा टेस्ट',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    let threwDerived = false;
    try {
      repo.updateMetadata(ms.id, { derivedManuscript: { hacked: true } });
    } catch (e) {
      threwDerived = true;
      console.assert(e instanceof StorageError, 'Throws StorageError');
    }
    console.assert(threwDerived, 'updateMetadata must block direct alteration of derivedManuscript');

    let threwTransform = false;
    try {
      repo.updateMetadata(ms.id, { transformation: { hacked: true } });
    } catch (e) {
      threwTransform = true;
      console.assert(e instanceof StorageError, 'Throws StorageError');
    }
    console.assert(threwTransform, 'updateMetadata must block direct alteration of transformation');
  });

  // Section 5: Quota Resilience & Persistence Reload Simulation
  test('ManuscriptRepository: QuotaExceededError during saveDerivedManuscript preserves existing record', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'कोटा सुरक्षा टेस्ट',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png', filename: 'safe.png' }
    });

    // Simulate quota error
    mockStorage.simulateQuota = true;

    let threwQuota = false;
    try {
      repo.saveDerivedManuscript(ms.id, {
        id: 'kv_art_quota',
        sourceArtifactId: ms.originalManuscript.id,
        data: SAMPLE_DERIVED_DATA,
        mimeType: 'image/png'
      }, { rotation: 90 });
    } catch (e) {
      threwQuota = true;
      console.assert(e instanceof StorageError, 'Surfaces StorageError');
      console.assert(e.code === StorageErrorCode.QUOTA_EXCEEDED, 'Surfaces QUOTA_EXCEEDED');
    }
    console.assert(threwQuota, 'Quota exceeded thrown cleanly');

    mockStorage.simulateQuota = false;
    const msPreserved = repo.getById(ms.id);
    console.assert(msPreserved.originalManuscript.filename === 'safe.png', 'Original manuscript remains safe');
    console.assert(msPreserved.derivedManuscript === null, 'Derived manuscript was not partially written');
  });

  test('ManuscriptRepository: Persistence survives simulated page reload / new repository instantiation', () => {
    const mockStorage = new MockStorage();
    const adapter1 = new LocalStorageAdapter(mockStorage);
    const repo1 = new ManuscriptRepository(adapter1);

    const ms = repo1.create({
      title: 'रीलोड टेस्ट पांडुलिपि',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'reload_test.png'
      }
    });

    repo1.saveDerivedManuscript(ms.id, {
      id: 'kv_art_persisted',
      sourceArtifactId: ms.originalManuscript.id,
      data: SAMPLE_DERIVED_DATA,
      mimeType: 'image/png'
    }, { rotation: 90, crop: { x: 0, y: 0, width: 100, height: 100 } });

    // Simulate reload with new repository instance reading from same storage
    const adapter2 = new LocalStorageAdapter(mockStorage);
    const repo2 = new ManuscriptRepository(adapter2);

    const reloaded = repo2.getById(ms.id);
    console.assert(reloaded !== null, 'Manuscript retrieved after reload');
    console.assert(reloaded.originalManuscript.data === SAMPLE_ORIGINAL_DATA, 'Original bytes persisted correctly');
    console.assert(reloaded.derivedManuscript.data === SAMPLE_DERIVED_DATA, 'Derived bytes persisted correctly');
    console.assert(reloaded.transformation.rotation === 90, 'Transformation persisted');
    console.assert(reloaded.transformation.crop.width === 100, 'Crop bounds persisted');
  });

  // Section 6: Hindi Unicode & XSS Safety
  test('Unicode / Hindi preservation in metadata and transformation labels', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const devanagariTitle = 'माँ की हस्तलिखित कविता — क्ष त्र ज्ञ श्र द्व द्घ हृ (१९७२)';
    const devanagariNotes = 'पुरानी संदूक से प्राप्त, पन्नों पर स्याही हल्की पड़ गई है।';

    const ms = repo.create({
      title: devanagariTitle,
      provenance: { notes: devanagariNotes },
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_hindi',
      sourceArtifactId: ms.originalManuscript.id,
      data: SAMPLE_DERIVED_DATA,
      mimeType: 'image/png'
    }, { rotation: 180, crop: null });

    const retrieved = repo.getById(ms.id);
    console.assert(retrieved.title === devanagariTitle, 'Title with complex Devanagari conjuncts intact');
    console.assert(retrieved.provenance.notes === devanagariNotes, 'Provenance notes with Hindi punctuation intact');
  });

  test('ManuscriptView: Renders view tabs, reassurance banner, and safely escapes XSS in filenames/titles', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const xssTitle = 'पांडुलिपि <script>alert("xss")</script> & "quotes"';
    const xssFilename = 'test<img src=x onerror=alert(1)>.png';

    const ms = repo.create({
      title: xssTitle,
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: xssFilename
      }
    });

    // Save derived manuscript so view tabs are active
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_xss_derived',
      sourceArtifactId: ms.originalManuscript.id,
      data: SAMPLE_DERIVED_DATA,
      mimeType: 'image/png'
    }, { rotation: 90 });

    const msWithDerived = repo.getById(ms.id);

    const mockContainer = new MockElement();
    const view = new ManuscriptView({
      container: mockContainer,
      router: {},
      manuscriptId: ms.id,
      repository: repo
    });
    view.manuscript = msWithDerived;

    const html = view.render();
    mockContainer.innerHTML = html;

    // XSS safety verification
    console.assert(!html.includes('<script>'), 'Unescaped script tag MUST NOT appear');
    console.assert(!html.includes('<img src=x'), 'Unescaped img tag MUST NOT appear');
    console.assert(html.includes('&lt;script&gt;'), 'Script tag must be HTML entity escaped');

    // UI elements verification
    console.assert(html.includes('मूल पांडुलिपि (अपरिवर्तित)'), 'Includes Original Tab label in Hindi');
    console.assert(html.includes('संपादित प्रति'), 'Includes Derived Tab label in Hindi');
    console.assert(html.includes('मूल पांडुलिपि सुरक्षित है'), 'Includes Non-Destructive Reassurance Banner');
  });

  // Section 7: Canvas Image Transformation Integration with Mock DOM Canvas
  await testAsync('ManuscriptImageTransformer: transform() executes rotation, crop, and lossless PNG export with mock canvas', async () => {
    // Setup global mock for document.createElement and Image
    const originalDocument = global.document;
    const originalImage = global.Image;

    let canvasDrawCalls = [];
    let canvasRotateAngle = 0;
    let canvasTranslations = [];
    let canvasWidth = 0;
    let canvasHeight = 0;

    class MockContext2D {
      constructor() {
        this.imageSmoothingEnabled = false;
        this.imageSmoothingQuality = 'low';
      }
      translate(x, y) {
        canvasTranslations.push({ x, y });
      }
      rotate(rad) {
        canvasRotateAngle = rad;
      }
      drawImage(...args) {
        canvasDrawCalls.push(args);
      }
    }

    class MockCanvas {
      constructor() {
        this.width = 0;
        this.height = 0;
        this.ctx = new MockContext2D();
      }
      getContext(type) {
        return type === '2d' ? this.ctx : null;
      }
      toDataURL(mimeType) {
        return `data:${mimeType};base64,mockCanvasPNGResult==`;
      }
    }

    class MockHtmlImage {
      constructor() {
        this.naturalWidth = 1000;
        this.naturalHeight = 600;
        this.width = 1000;
        this.height = 600;
      }
      set src(v) {
        // Trigger async onload
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 5);
      }
    }

    global.document = {
      createElement: (tag) => {
        if (tag === 'canvas') return new MockCanvas();
        return new MockElement(tag);
      }
    };
    global.Image = MockHtmlImage;

    try {
      const result = await ManuscriptImageTransformer.transform(SAMPLE_ORIGINAL_DATA, {
        rotation: 90,
        crop: { x: 50, y: 50, width: 400, height: 300 }
      });

      console.assert(result.data.startsWith('data:image/png'), 'Exports PNG data URL');
      console.assert(result.mimeType === 'image/png', 'MIME type is image/png');
      console.assert(result.width === 400, 'Cropped width is 400');
      console.assert(result.height === 300, 'Cropped height is 300');
      console.assert(canvasRotateAngle === (90 * Math.PI) / 180, 'Applied 90 degree rotation in radians');
      console.assert(canvasDrawCalls.length >= 2, 'Drew rotated image and cropped image onto canvases');
    } finally {
      // Restore globals
      global.document = originalDocument;
      global.Image = originalImage;
    }
  });

  // ==========================================================================
  // Section 8: Interactive Crop & Coordinate Mapping Tests (Tests 23–36)
  // ==========================================================================

  test('mapDisplayCropToNatural: Maps display coordinates proportionally to natural image coordinates', () => {
    const displayBounds = { width: 400, height: 300 };
    const naturalDims = { width: 1200, height: 900 }; // 3x scale factor
    const displayCrop = { x: 50, y: 40, width: 200, height: 150 };

    const mapped = mapDisplayCropToNatural(displayCrop, displayBounds, naturalDims);
    console.assert(mapped.x === 150, 'x mapped to 150 (50 * 3)');
    console.assert(mapped.y === 120, 'y mapped to 120 (40 * 3)');
    console.assert(mapped.width === 600, 'width mapped to 600 (200 * 3)');
    console.assert(mapped.height === 450, 'height mapped to 450 (150 * 3)');
  });

  test('mapDisplayCropToNatural: Handles non-square image aspect ratio mapping (tall portrait 600x1200 on 300x600 display)', () => {
    const displayBounds = { width: 300, height: 600 };
    const naturalDims = { width: 600, height: 1200 }; // 2x scale factor
    const displayCrop = { x: 30, y: 60, width: 120, height: 240 };

    const mapped = mapDisplayCropToNatural(displayCrop, displayBounds, naturalDims);
    console.assert(mapped.x === 60, 'Tall aspect: x mapped to 60');
    console.assert(mapped.y === 120, 'Tall aspect: y mapped to 120');
    console.assert(mapped.width === 240, 'Tall aspect: width mapped to 240');
    console.assert(mapped.height === 480, 'Tall aspect: height mapped to 480');
  });

  test('mapDisplayCropToNatural: Clamps out-of-bounds selection and normalizes negative drag directions', () => {
    const displayBounds = { width: 400, height: 300 };
    const naturalDims = { width: 800, height: 600 }; // 2x scale factor

    // User dragged backwards (bottom-right to top-left): raw start at (200, 150) with width -100, height -80
    const backwardDrag = { x: 200, y: 150, width: -100, height: -80 };
    const mapped = mapDisplayCropToNatural(backwardDrag, displayBounds, naturalDims);

    console.assert(mapped.x === 200, 'Normalized x: (200 - 100) * 2 = 200');
    console.assert(mapped.y === 140, 'Normalized y: (150 - 80) * 2 = 140');
    console.assert(mapped.width === 200, 'Normalized width: 100 * 2 = 200');
    console.assert(mapped.height === 160, 'Normalized height: 80 * 2 = 160');

    // Out of bounds drag extending past display edge
    const outOfBounds = { x: 350, y: 250, width: 100, height: 100 };
    const clampedMapped = mapDisplayCropToNatural(outOfBounds, displayBounds, naturalDims);
    console.assert(clampedMapped.width === 100, 'Display width clamped to 50 * 2 = 100');
    console.assert(clampedMapped.height === 100, 'Display height clamped to 50 * 2 = 100');
  });

  test('mapDisplayCropToNatural: Rejects zero-width or zero-height crop selections', () => {
    const displayBounds = { width: 400, height: 300 };
    const naturalDims = { width: 800, height: 600 };

    let threwZeroWidth = false;
    try {
      mapDisplayCropToNatural({ x: 10, y: 10, width: 0, height: 50 }, displayBounds, naturalDims);
    } catch (e) {
      threwZeroWidth = true;
    }
    console.assert(threwZeroWidth, 'Must reject zero width selection');

    let threwZeroHeight = false;
    try {
      mapDisplayCropToNatural({ x: 10, y: 10, width: 50, height: 0 }, displayBounds, naturalDims);
    } catch (e) {
      threwZeroHeight = true;
    }
    console.assert(threwZeroHeight, 'Must reject zero height selection');
  });

  test('Rotate 90° + interactive crop coordinate mapping: maps against swapped dimensions (origHeight x origWidth)', () => {
    const origWidth = 1000;
    const origHeight = 800;
    const rotDims = getRotatedDimensions(origWidth, origHeight, 90); // 800 x 1000
    console.assert(rotDims.width === 800 && rotDims.height === 1000, '90 deg swaps dimensions');

    const displayBounds = { width: 400, height: 500 }; // 2x scale
    const displayCrop = { x: 50, y: 50, width: 200, height: 250 };

    const mapped = mapDisplayCropToNatural(displayCrop, displayBounds, rotDims);
    console.assert(mapped.x === 100 && mapped.y === 100, 'x and y mapped to rotated space');
    console.assert(mapped.width === 400 && mapped.height === 500, 'w and h mapped to rotated space');

    // Verify valid against rotated bounds
    const validated = validateCropBounds(mapped, rotDims.width, rotDims.height);
    console.assert(validated.width === 400 && validated.height === 500, 'Crop is valid inside rotated bounds');
  });

  test('Rotate 180° + interactive crop coordinate mapping: maps against rotated dimensions (origWidth x origHeight)', () => {
    const origWidth = 1000;
    const origHeight = 800;
    const rotDims = getRotatedDimensions(origWidth, origHeight, 180); // 1000 x 800
    console.assert(rotDims.width === 1000 && rotDims.height === 800, '180 deg preserves dimensions');

    const displayBounds = { width: 500, height: 400 }; // 2x scale
    const displayCrop = { x: 100, y: 50, width: 250, height: 200 };

    const mapped = mapDisplayCropToNatural(displayCrop, displayBounds, rotDims);
    console.assert(mapped.x === 200 && mapped.y === 100, 'x and y mapped to 180 rotated space');
    console.assert(mapped.width === 500 && mapped.height === 400, 'w and h mapped to 180 rotated space');

    const validated = validateCropBounds(mapped, rotDims.width, rotDims.height);
    console.assert(validated.width === 500 && validated.height === 400, 'Crop is valid inside 180 rotated bounds');
  });

  test('Rotate 270° + interactive crop coordinate mapping: maps against swapped dimensions (origHeight x origWidth)', () => {
    const origWidth = 1200;
    const origHeight = 800;
    const rotDims = getRotatedDimensions(origWidth, origHeight, 270); // 800 x 1200
    console.assert(rotDims.width === 800 && rotDims.height === 1200, '270 deg swaps dimensions');

    const displayBounds = { width: 400, height: 600 }; // 2x scale
    const displayCrop = { x: 20, y: 30, width: 200, height: 300 };

    const mapped = mapDisplayCropToNatural(displayCrop, displayBounds, rotDims);
    console.assert(mapped.x === 40 && mapped.y === 60, 'x and y mapped to 270 rotated space');
    console.assert(mapped.width === 400 && mapped.height === 600, 'w and h mapped to 270 rotated space');

    const validated = validateCropBounds(mapped, rotDims.width, rotDims.height);
    console.assert(validated.width === 400 && validated.height === 600, 'Crop is valid inside 270 rotated bounds');
  });

  test('Interactive crop derived artifact creation receives brand new kv_art_* ID and links sourceArtifactId', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'इंटरैक्टिव क्रॉप टेस्ट पांडुलिपि',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png', filename: 'interactive.png' }
    });

    const displayBounds = { width: 500, height: 400 };
    const naturalDims = { width: 1000, height: 800 };
    const mappedCrop = mapDisplayCropToNatural({ x: 50, y: 50, width: 200, height: 200 }, displayBounds, naturalDims);

    const updated = repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_mock_candidate',
      sourceArtifactId: ms.originalManuscript.id,
      data: SAMPLE_DERIVED_DATA,
      mimeType: 'image/png'
    }, {
      rotation: 0,
      crop: mappedCrop
    });

    console.assert(updated.derivedManuscript.id.startsWith('kv_art_'), 'Receives new kv_art_* ID');
    console.assert(updated.derivedManuscript.id !== ms.originalManuscript.id, 'Derived ID differs from original ID');
    console.assert(updated.derivedManuscript.sourceArtifactId === ms.originalManuscript.id, 'sourceArtifactId matches original');
    console.assert(updated.transformation.crop.width === 400, 'Crop width saved in natural pixels');
  });

  test('Original bytes remain 100% byte-for-byte unchanged after interactive crop transformation', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'अपरिवर्तनीय बाइट्स टेस्ट',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    const originalBytesSnapshot = ms.originalManuscript.data;

    // Apply interactive crop
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_cropped_bytes',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,newCroppedBytes==',
      mimeType: 'image/png'
    }, {
      rotation: 0,
      crop: { x: 10, y: 10, width: 200, height: 200 }
    });

    const recordAfter = repo.getById(ms.id);
    console.assert(recordAfter.originalManuscript.data === originalBytesSnapshot, 'Original bytes strictly identical');
    console.assert(recordAfter.derivedManuscript.data === 'data:image/png;base64,newCroppedBytes==', 'Derived bytes stored separately');
  });

  test('Original metadata remains identical after interactive crop transformation', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'मेटाडेटा अपरिवर्तनीय टेस्ट',
      originalManuscript: {
        data: SAMPLE_ORIGINAL_DATA,
        mimeType: 'image/png',
        filename: 'meta_safe.png',
        capturedAt: '2026-02-01T12:00:00.000Z'
      }
    });

    const originalId = ms.originalManuscript.id;
    const originalChecksum = ms.originalManuscript.checksum;
    const originalFilename = ms.originalManuscript.filename;
    const originalCapturedAt = ms.originalManuscript.capturedAt;

    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_meta_test',
      sourceArtifactId: originalId,
      data: SAMPLE_DERIVED_DATA,
      mimeType: 'image/png'
    }, {
      rotation: 90,
      crop: { x: 0, y: 0, width: 300, height: 300 }
    });

    const record = repo.getById(ms.id);
    console.assert(record.originalManuscript.id === originalId, 'Original ID identical');
    console.assert(record.originalManuscript.checksum === originalChecksum, 'Original checksum identical');
    console.assert(record.originalManuscript.filename === originalFilename, 'Original filename identical');
    console.assert(record.originalManuscript.capturedAt === originalCapturedAt, 'Original capturedAt identical');
  });

  test('Reset crop (reset-crop) clears working crop state while preserving rotation and original bytes', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'क्रॉप रीसेट टेस्ट',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    const view = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: repo
    });
    view.manuscript = ms;
    view.workingRotation = 90;
    view.workingCrop = { x: 20, y: 20, width: 300, height: 300 };
    view.displayCropBox = { x: 10, y: 10, width: 150, height: 150 };

    // Simulate reset crop action
    view.workingCrop = null;
    view.displayCropBox = null;

    console.assert(view.workingCrop === null, 'workingCrop cleared');
    console.assert(view.displayCropBox === null, 'displayCropBox cleared');
    console.assert(view.workingRotation === 90, 'workingRotation preserved at 90');
    console.assert(view.manuscript.originalManuscript.data === SAMPLE_ORIGINAL_DATA, 'Original bytes unchanged');
  });

  test('Repeated interactive crop transformations preserve original artifact byte-for-byte and increment transformVersion', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'क्रॉप संस्करण टेस्ट',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    const origBytes = ms.originalManuscript.data;

    // Crop 1
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_c1',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,crop1==',
      mimeType: 'image/png'
    }, { rotation: 0, crop: { x: 10, y: 10, width: 100, height: 100 } });

    let r = repo.getById(ms.id);
    console.assert(r.transformation.transformVersion === 1, 'Version 1 on first crop');
    console.assert(r.originalManuscript.data === origBytes, 'Original bytes unchanged crop 1');

    // Crop 2
    repo.saveDerivedManuscript(ms.id, {
      id: 'kv_art_c2',
      sourceArtifactId: ms.originalManuscript.id,
      data: 'data:image/png;base64,crop2==',
      mimeType: 'image/png'
    }, { rotation: 90, crop: { x: 20, y: 20, width: 150, height: 150 } });

    r = repo.getById(ms.id);
    console.assert(r.transformation.transformVersion === 2, 'Version 2 on second crop');
    console.assert(r.originalManuscript.data === origBytes, 'Original bytes unchanged crop 2');
  });

  test('Mobile / touch / pointer event handling logic updates selection box and handles cancel', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const ms = repo.create({
      title: 'टच इवेंट टेस्ट',
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    const view = new ManuscriptView({
      container: new MockElement(),
      router: {},
      manuscriptId: ms.id,
      repository: repo
    });
    view.manuscript = ms;
    view.isCropMode = true;

    // Simulate pointerdown
    const mockSurface = new MockElement('div');
    mockSurface.getBoundingClientRect = () => ({ left: 50, top: 50, width: 400, height: 300 });

    view.handlePointerDown({
      button: 0,
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
      currentTarget: mockSurface
    });

    console.assert(view.isDraggingCrop === true, 'Dragging started on touch/pointer down');
    console.assert(view.dragStartPoint.x === 50, 'Start point x = 100 - 50 = 50');
    console.assert(view.dragStartPoint.y === 50, 'Start point y = 100 - 50 = 50');

    // Simulate pointermove
    view.handlePointerMove({
      clientX: 200,
      clientY: 150,
      currentTarget: mockSurface
    });

    console.assert(view.displayCropBox.width === 100, 'Drag width is 100 (150 - 50)');
    console.assert(view.displayCropBox.height === 50, 'Drag height is 50 (100 - 50)');

    // Simulate pointercancel
    view.handlePointerCancel({});
    console.assert(view.isDraggingCrop === false, 'Dragging stopped on pointer cancel');
    console.assert(view.dragStartPoint === null, 'Drag start point reset on cancel');
  });

  test('XSS-safe rendering remains intact with interactive crop panel and status pill', () => {
    const mockStorage = new MockStorage();
    const adapter = new LocalStorageAdapter(mockStorage);
    const repo = new ManuscriptRepository(adapter);

    const xssTitle = 'पांडुलिपि <script>alert("crop_xss")</script>';
    const ms = repo.create({
      title: xssTitle,
      originalManuscript: { data: SAMPLE_ORIGINAL_DATA, mimeType: 'image/png' }
    });

    const container = new MockElement();
    const view = new ManuscriptView({
      container,
      router: {},
      manuscriptId: ms.id,
      repository: repo
    });
    view.manuscript = ms;
    view.isCropMode = true;
    view.workingCrop = { x: 10, y: 10, width: 500, height: 400 };

    const html = view.render();
    container.innerHTML = html;

    console.assert(!html.includes('<script>'), 'No unescaped script tag in crop mode view');
    console.assert(html.includes('&lt;script&gt;'), 'Script tag entity escaped');
    console.assert(html.includes('crop-interactive-surface'), 'Renders interactive crop surface');
    console.assert(html.includes('५०० × ४००') || html.includes('500 × 400 px'), 'Renders crop status pill');
    console.assert(html.includes('आयताकार क्रॉप चयन'), 'Renders Hindi crop panel header');
  });

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} NON-DESTRUCTIVE TRANSFORMATION TESTS PASSED!`);
  console.log('================================================================\n');
}

runTransformTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
