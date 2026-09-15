/**
 * काव्यकलश (KavyaVault) — AI Analysis Domain Model & Enums (analysisTypes.js)
 * Phase 4 / Task 4.1: AI Analysis Foundation
 *
 * Defines controlled statuses, validation boundaries, and constants for AI poetry analysis.
 * The AI assistant operates strictly as an organization/analysis tool:
 *   - Suggests category, mood, themes, keywords, summary
 *   - Never mutates author text, never generates verses, never establishes provenance
 */

import { StorageError, StorageErrorCode } from '../storage/StorageError.js';

/**
 * Controlled analysis execution lifecycle states
 */
export const ANALYSIS_STATUS = Object.freeze({
  IDLE: 'idle',
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
});

export const VALID_ANALYSIS_STATUSES = Object.freeze(Object.values(ANALYSIS_STATUS));

/**
 * Human review state for AI suggestions (for future review/approval tasks)
 */
export const SUGGESTION_REVIEW_STATE = Object.freeze({
  SUGGESTED: 'suggested',
  ACCEPTED: 'accepted',
  EDITED: 'edited',
  REJECTED: 'rejected'
});

export const VALID_SUGGESTION_REVIEW_STATES = Object.freeze(Object.values(SUGGESTION_REVIEW_STATE));

/**
 * Common literary rasas / moods supported in Hindi poetry
 */
export const LITERARY_MOODS = Object.freeze([
  'श्रृंगार', // Shringara (Love / Beauty)
  'वीर',     // Vira (Heroism / Courage)
  'करुण',    // Karuna (Sorrow / Compassion)
  'शांत',    // Shanta (Peace / Tranquility)
  'हास्य',   // Hasya (Humor / Comic)
  'रौद्र',    // Raudra (Fury / Anger)
  'भयानक',   // Bhayanaka (Fear / Horror)
  'वीभत्स',  // Vibhatsa (Disgust)
  'अद्भुत',   // Adbhuta (Wonder / Astonishment)
  'वात्सल्य', // Vatsalya (Parental affection)
  'भक्ति'     // Bhakti (Devotion / Spiritual)
]);

/**
 * Common thematic categories in KavyaVault
 */
export const POETRY_CATEGORIES = Object.freeze([
  'प्रकृति एवं सौन्दर्य',
  'प्रेम एवं विरह',
  'राष्ट्रभक्ति एवं चेतना',
  'आध्यात्म एवं दर्शन',
  'सामाजिक चिंतन',
  'स्मृतियाँ एवं एकांत',
  'जीवन संघर्ष',
  'भक्ति एवं समर्पण',
  'विविध मुक्तक'
]);

/**
 * Maximum text length and collection size constraints for safe, bounded analysis output
 */
export const ANALYSIS_CONSTRAINTS = Object.freeze({
  MAX_CATEGORY_LENGTH: 100,
  MAX_MOOD_LENGTH: 50,
  MAX_SUMMARY_LENGTH: 500,
  MAX_THEME_ITEM_LENGTH: 60,
  MAX_THEMES_COUNT: 10,
  MAX_KEYWORD_ITEM_LENGTH: 40,
  MAX_KEYWORDS_COUNT: 15
});

/**
 * Validates an analysis request envelope before provider invocation.
 * @param {Object} request
 * @throws {StorageError} if validation fails
 */
export function validateAnalysisRequest(request) {
  if (!request || typeof request !== 'object') {
    throw new StorageError(
      'विश्लेषण अनुरोध (Analysis Request) एक ऑब्जेक्ट होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 1. poemId is required and must be non-empty string
  if (typeof request.poemId !== 'string' || request.poemId.trim() === '') {
    throw new StorageError(
      'विश्लेषण हेतु वैध कविता आईडी (poemId) आवश्यक है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 2. Explicit User Consent is strictly required
  if (request.analysisConsent !== true) {
    throw new StorageError(
      'एआई विश्लेषण हेतु उपयोगकर्ता की स्पष्ट सहमति (analysisConsent: true) अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 3. title must be a string
  if (typeof request.title !== 'string') {
    throw new StorageError(
      'कविता का शीर्षक (title) स्ट्रिंग होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 4. body must be a non-empty string
  if (typeof request.body !== 'string' || request.body.trim() === '') {
    throw new StorageError(
      'विश्लेषण हेतु कविता का मुख्य पाठ (body) गैर-रिक्त होना अनिवार्य है।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 5. Optional author must be string if provided
  if (request.author !== undefined && request.author !== null && typeof request.author !== 'string') {
    throw new StorageError(
      'रचनाकार (author) स्ट्रिंग होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // 6. Optional tags must be array if provided
  if (request.tags !== undefined && request.tags !== null && !Array.isArray(request.tags)) {
    throw new StorageError(
      'टैग (tags) एक ऐरे होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
}

/**
 * Validates and normalizes raw output from an AI provider adapter.
 * Rejects malformed objects, deduplicates arrays, and enforces length bounds.
 * @param {Object} result
 * @returns {Object} Normalized analysis result { category, mood, themes, keywords, summary }
 * @throws {StorageError} if validation fails
 */
export function validateAndNormalizeAnalysisResult(result) {
  if (!result || typeof result !== 'object') {
    throw new StorageError(
      'एआई प्रदाता से प्राप्त परिणाम (result) एक ऑब्जेक्ट होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // Category
  if (typeof result.category !== 'string' || result.category.trim() === '') {
    throw new StorageError(
      'सुझाई गई श्रेणी (category) एक गैर-रिक्त स्ट्रिंग होनी चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  const category = result.category.trim();
  if (category.length > ANALYSIS_CONSTRAINTS.MAX_CATEGORY_LENGTH) {
    throw new StorageError(
      `श्रेणी की लंबाई ${ANALYSIS_CONSTRAINTS.MAX_CATEGORY_LENGTH} वर्णों से अधिक नहीं हो सकती।`,
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // Mood
  if (typeof result.mood !== 'string' || result.mood.trim() === '') {
    throw new StorageError(
      'सुझाया गया भाव/रस (mood) एक गैर-रिक्त स्ट्रिंग होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  const mood = result.mood.trim();
  if (mood.length > ANALYSIS_CONSTRAINTS.MAX_MOOD_LENGTH) {
    throw new StorageError(
      `भाव/रस की लंबाई ${ANALYSIS_CONSTRAINTS.MAX_MOOD_LENGTH} वर्णों से अधिक नहीं हो सकती।`,
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // Themes (Array of strings, deduplicated, bounded)
  if (!Array.isArray(result.themes)) {
    throw new StorageError(
      'सुझाए गए विषय (themes) एक ऐरे होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  const cleanedThemes = [];
  const themeSet = new Set();
  for (const item of result.themes) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new StorageError(
        'प्रत्येक विषय (theme) गैर-रिक्त स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    const trimmed = item.trim();
    if (trimmed.length > ANALYSIS_CONSTRAINTS.MAX_THEME_ITEM_LENGTH) {
      throw new StorageError(
        `विषय "${trimmed.slice(0, 15)}..." की लंबाई ${ANALYSIS_CONSTRAINTS.MAX_THEME_ITEM_LENGTH} वर्णों से अधिक है।`,
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    if (!themeSet.has(trimmed.toLowerCase())) {
      themeSet.add(trimmed.toLowerCase());
      cleanedThemes.push(trimmed);
    }
  }
  if (cleanedThemes.length > ANALYSIS_CONSTRAINTS.MAX_THEMES_COUNT) {
    throw new StorageError(
      `विषयों की संख्या ${ANALYSIS_CONSTRAINTS.MAX_THEMES_COUNT} से अधिक नहीं हो सकती।`,
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // Keywords (Array of strings, deduplicated, bounded)
  if (!Array.isArray(result.keywords)) {
    throw new StorageError(
      'सुझाए गए मुख्य शब्द (keywords) एक ऐरे होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  const cleanedKeywords = [];
  const keywordSet = new Set();
  for (const item of result.keywords) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new StorageError(
        'प्रत्येक मुख्य शब्द (keyword) गैर-रिक्त स्ट्रिंग होना चाहिए।',
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    const trimmed = item.trim();
    if (trimmed.length > ANALYSIS_CONSTRAINTS.MAX_KEYWORD_ITEM_LENGTH) {
      throw new StorageError(
        `मुख्य शब्द "${trimmed.slice(0, 15)}..." की लंबाई ${ANALYSIS_CONSTRAINTS.MAX_KEYWORD_ITEM_LENGTH} वर्णों से अधिक है।`,
        StorageErrorCode.VALIDATION_ERROR
      );
    }
    if (!keywordSet.has(trimmed.toLowerCase())) {
      keywordSet.add(trimmed.toLowerCase());
      cleanedKeywords.push(trimmed);
    }
  }
  if (cleanedKeywords.length > ANALYSIS_CONSTRAINTS.MAX_KEYWORDS_COUNT) {
    throw new StorageError(
      `मुख्य शब्दों की संख्या ${ANALYSIS_CONSTRAINTS.MAX_KEYWORDS_COUNT} से अधिक नहीं हो सकती।`,
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  // Summary (string, bounded)
  if (typeof result.summary !== 'string' || result.summary.trim() === '') {
    throw new StorageError(
      'सुझाया गया सारांश (summary) एक गैर-रिक्त स्ट्रिंग होना चाहिए।',
      StorageErrorCode.VALIDATION_ERROR
    );
  }
  const summary = result.summary.trim();
  if (summary.length > ANALYSIS_CONSTRAINTS.MAX_SUMMARY_LENGTH) {
    throw new StorageError(
      `सारांश की लंबाई ${ANALYSIS_CONSTRAINTS.MAX_SUMMARY_LENGTH} वर्णों से अधिक नहीं हो सकती।`,
      StorageErrorCode.VALIDATION_ERROR
    );
  }

  return {
    category,
    mood,
    themes: cleanedThemes,
    keywords: cleanedKeywords,
    summary
  };
}
