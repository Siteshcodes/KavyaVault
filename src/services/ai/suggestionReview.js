/**
 * काव्यकलश (KavyaVault) — AI Suggestion Review Domain Model (suggestionReview.js)
 * Phase 4 / Task 4.3: Human Review: Accept / Edit / Reject AI Suggestions
 *
 * Core architectural principle:
 * AI suggestions are NOT author truth.
 * The human user remains the final authority on every metadata proposal.
 *
 * Provides review state machine, candidate tracking, and approved change computation.
 */

import { SUGGESTION_REVIEW_STATE } from './analysisTypes.js';

/**
 * Creates an isolated, trackable review session for AI suggestions
 * @param {Object} params
 * @param {string} params.poemId - ID of poem being reviewed
 * @param {Object} params.result - Normalized AI analysis output
 * @param {Object} [params.currentPoem={}] - Current poem state from repository
 * @returns {Object} Structured review session
 */
export function createReviewSession({ poemId, result, currentPoem = {} }) {
  if (!poemId || typeof poemId !== 'string') {
    throw new Error('समीक्षा सत्र हेतु वैध कविता आईडी (poemId) अनिवार्य है।');
  }
  if (!result || typeof result !== 'object') {
    throw new Error('समीक्षा सत्र हेतु वैध AI परिणाम ऑब्जेक्ट अनिवार्य है।');
  }

  const sessionId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? `ai_rev_${crypto.randomUUID()}`
    : `ai_rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    sessionId,
    poemId,
    createdAt: new Date().toISOString(),
    category: {
      field: 'category',
      originalValue: (currentPoem && currentPoem.category) ? String(currentPoem.category) : null,
      suggestedValue: (result.category && typeof result.category === 'string') ? result.category.trim() : '',
      approvedValue: null,
      reviewStatus: SUGGESTION_REVIEW_STATE.SUGGESTED,
      isEdited: false
    },
    mood: {
      field: 'mood',
      originalValue: (currentPoem && currentPoem.mood) ? String(currentPoem.mood) : null,
      suggestedValue: (result.mood && typeof result.mood === 'string') ? result.mood.trim() : '',
      approvedValue: null,
      reviewStatus: SUGGESTION_REVIEW_STATE.SUGGESTED,
      isEdited: false
    },
    summary: {
      field: 'summary',
      originalValue: null,
      suggestedValue: (result.summary && typeof result.summary === 'string') ? result.summary.trim() : '',
      approvedValue: null,
      reviewStatus: SUGGESTION_REVIEW_STATE.SUGGESTED,
      isEdited: false
    },
    themes: (Array.isArray(result.themes) ? result.themes : []).map((t, idx) => ({
      id: `theme_${idx}`,
      suggestedValue: String(t).trim(),
      approvedValue: null,
      reviewStatus: SUGGESTION_REVIEW_STATE.SUGGESTED,
      isEdited: false
    })),
    keywords: (Array.isArray(result.keywords) ? result.keywords : []).map((k, idx) => ({
      id: `keyword_${idx}`,
      suggestedValue: String(k).trim(),
      approvedValue: null,
      reviewStatus: SUGGESTION_REVIEW_STATE.SUGGESTED,
      isEdited: false
    }))
  };
}

/**
 * Accepts a candidate suggestion
 * @param {Object} session
 * @param {string} field - 'category' | 'mood' | 'summary' | 'themes' | 'keywords'
 * @param {string} [itemId] - Optional ID for multi-value array item
 */
export function acceptSuggestion(session, field, itemId = null) {
  if (!session || typeof session !== 'object') return;

  if (field === 'themes' || field === 'keywords') {
    const list = session[field];
    if (Array.isArray(list)) {
      const item = list.find(i => i.id === itemId);
      if (item) {
        item.reviewStatus = SUGGESTION_REVIEW_STATE.ACCEPTED;
        item.approvedValue = item.isEdited ? item.approvedValue : item.suggestedValue;
      }
    }
    return;
  }

  const target = session[field];
  if (target && typeof target === 'object') {
    target.reviewStatus = SUGGESTION_REVIEW_STATE.ACCEPTED;
    target.approvedValue = target.isEdited ? target.approvedValue : target.suggestedValue;
  }
}

/**
 * Edits a candidate suggestion with human-authored text
 * @param {Object} session
 * @param {string} field
 * @param {string} newValue
 * @param {string} [itemId]
 */
export function editSuggestion(session, field, newValue, itemId = null) {
  if (!session || typeof session !== 'object') return;
  const trimmed = typeof newValue === 'string' ? newValue.trim() : '';
  if (!trimmed) return;

  if (field === 'themes' || field === 'keywords') {
    const list = session[field];
    if (Array.isArray(list)) {
      const item = list.find(i => i.id === itemId);
      if (item) {
        item.reviewStatus = SUGGESTION_REVIEW_STATE.EDITED;
        item.approvedValue = trimmed;
        item.isEdited = true;
      }
    }
    return;
  }

  const target = session[field];
  if (target && typeof target === 'object') {
    target.reviewStatus = SUGGESTION_REVIEW_STATE.EDITED;
    target.approvedValue = trimmed;
    target.isEdited = true;
  }
}

/**
 * Rejects a candidate suggestion
 * @param {Object} session
 * @param {string} field
 * @param {string} [itemId]
 */
export function rejectSuggestion(session, field, itemId = null) {
  if (!session || typeof session !== 'object') return;

  if (field === 'themes' || field === 'keywords') {
    const list = session[field];
    if (Array.isArray(list)) {
      const item = list.find(i => i.id === itemId);
      if (item) {
        item.reviewStatus = SUGGESTION_REVIEW_STATE.REJECTED;
        item.approvedValue = null;
      }
    }
    return;
  }

  const target = session[field];
  if (target && typeof target === 'object') {
    target.reviewStatus = SUGGESTION_REVIEW_STATE.REJECTED;
    target.approvedValue = null;
  }
}

/**
 * Resets a suggestion back to initial suggested state
 * @param {Object} session
 * @param {string} field
 * @param {string} [itemId]
 */
export function resetSuggestion(session, field, itemId = null) {
  if (!session || typeof session !== 'object') return;

  if (field === 'themes' || field === 'keywords') {
    const list = session[field];
    if (Array.isArray(list)) {
      const item = list.find(i => i.id === itemId);
      if (item) {
        item.reviewStatus = SUGGESTION_REVIEW_STATE.SUGGESTED;
        item.approvedValue = null;
        item.isEdited = false;
      }
    }
    return;
  }

  const target = session[field];
  if (target && typeof target === 'object') {
    target.reviewStatus = SUGGESTION_REVIEW_STATE.SUGGESTED;
    target.approvedValue = null;
    target.isEdited = false;
  }
}

/**
 * Computes the precise delta of approved changes to be applied to PoemRepository.
 *
 * Strict Non-Negotiable Rules:
 * 1. Rejected suggestions are NEVER included.
 * 2. Unreviewed 'suggested' items are NEVER included.
 * 3. Existing user tags are NEVER lost or replaced; approved tags are merged safely.
 * 4. Original poem body, title, author, and manuscript remain 100% untouched.
 *
 * @param {Object} session - Active review session
 * @param {Object} currentPoem - Current poem from repository
 * @returns {{ changes: Object, hasChanges: boolean, approvedCount: number }}
 */
export function computeApprovedChanges(session, currentPoem = {}) {
  if (!session || typeof session !== 'object') {
    return { changes: {}, hasChanges: false, approvedCount: 0 };
  }

  const changes = {};
  let approvedCount = 0;

  // 1. Category
  if (session.category && (session.category.reviewStatus === SUGGESTION_REVIEW_STATE.ACCEPTED || session.category.reviewStatus === SUGGESTION_REVIEW_STATE.EDITED)) {
    if (session.category.approvedValue) {
      approvedCount++;
      if (session.category.approvedValue !== currentPoem.category) {
        changes.category = session.category.approvedValue;
      }
    }
  }

  // 2. Mood
  if (session.mood && (session.mood.reviewStatus === SUGGESTION_REVIEW_STATE.ACCEPTED || session.mood.reviewStatus === SUGGESTION_REVIEW_STATE.EDITED)) {
    if (session.mood.approvedValue) {
      approvedCount++;
      if (session.mood.approvedValue !== currentPoem.mood) {
        changes.mood = session.mood.approvedValue;
      }
    }
  }

  // 3. Themes & Keywords -> Safe merge into tags
  const approvedTagsCandidates = [];

  if (Array.isArray(session.themes)) {
    for (const t of session.themes) {
      if ((t.reviewStatus === SUGGESTION_REVIEW_STATE.ACCEPTED || t.reviewStatus === SUGGESTION_REVIEW_STATE.EDITED) && t.approvedValue) {
        approvedCount++;
        approvedTagsCandidates.push(t.approvedValue);
      }
    }
  }

  if (Array.isArray(session.keywords)) {
    for (const k of session.keywords) {
      if ((k.reviewStatus === SUGGESTION_REVIEW_STATE.ACCEPTED || k.reviewStatus === SUGGESTION_REVIEW_STATE.EDITED) && k.approvedValue) {
        approvedCount++;
        approvedTagsCandidates.push(k.approvedValue);
      }
    }
  }

  if (approvedTagsCandidates.length > 0) {
    const existingTags = Array.isArray(currentPoem.tags) ? [...currentPoem.tags] : [];
    const lowerExisting = new Set(existingTags.map(t => String(t).trim().toLowerCase()));

    let tagsChanged = false;
    for (const candidate of approvedTagsCandidates) {
      const trimmed = candidate.trim();
      if (trimmed && !lowerExisting.has(trimmed.toLowerCase())) {
        existingTags.push(trimmed);
        lowerExisting.add(trimmed.toLowerCase());
        tagsChanged = true;
      }
    }

    if (tagsChanged) {
      changes.tags = existingTags;
    }
  }

  const hasChanges = Object.keys(changes).length > 0;

  return {
    changes,
    hasChanges,
    approvedCount
  };
}
