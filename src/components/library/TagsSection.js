/**
 * काव्यकलश (KavyaVault) — Tags Section Component (TagsSection.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Displays literary tag browser preserving Hindi display forms,
 * with poem frequency counts and one-click filtering.
 */

import { escapeHtml } from '../../services/SearchService.js';
import { getIconSvg } from '../navigation/icons.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { toDevanagariNumber } from './CollectionsSection.js';

/**
 * Renders the Tags section
 * @param {Object} options
 * @param {Array} options.tags Array of tag objects { name, normalizedName, poemCount, displayForm }
 * @param {string|null} [options.selectedTag=null]
 * @returns {string} HTML string
 */
export function renderTagsSection({
  tags = [],
  selectedTag = null
}) {
  const headerHtml = `
    <div class="tags-section-header">
      <div class="section-title-wrap">
        <h2 class="section-title">काव्य टैग वाटिका</h2>
        <p class="section-desc">विषय, भाव, छंद और प्रतीकों के आधार पर जुड़े साहित्यिक टैग।</p>
      </div>
    </div>
  `;

  let contentHtml = '';

  if (!tags || tags.length === 0) {
    contentHtml = renderEmptyState({
      icon: 'book',
      heading: 'अभी कोई टैग उपलब्ध नहीं है',
      text: 'अपनी कविताओं में टैग (#प्रकृति, #श्रृंगार, #दोहा, आदि) जोड़कर उन्हें यहाँ विषयवार खोजें।',
      primaryAction: `
        <button
          type="button"
          class="btn-primary-action"
          data-action="navigate-section"
          data-section="all"
          aria-label="सभी कविताएँ देखें"
        >
          ${getIconSvg('book', 'nav-icon')}
          <span>सभी कविताएँ देखें</span>
        </button>
      `
    });
  } else {
    const chipsHtml = tags.map(t => {
      const displayName = t.displayForm || t.name;
      const count = t.poemCount || 0;
      const countStr = toDevanagariNumber(count);
      const isSelected = selectedTag && (
        selectedTag.toLowerCase() === (t.name || '').toLowerCase() ||
        selectedTag.toLowerCase() === (t.normalizedName || '').toLowerCase()
      );

      return `
        <button
          type="button"
          class="tag-browser-chip ${isSelected ? 'is-selected' : ''}"
          data-action="select-tag"
          data-tag="${escapeHtml(displayName)}"
          aria-label="${escapeHtml(displayName)} टैग, ${countStr} कविताएँ"
          aria-pressed="${Boolean(isSelected)}"
        >
          <span class="tag-chip-icon" aria-hidden="true">${getIconSvg('tag', 'nav-icon')}</span>
          <span class="tag-chip-name">#${escapeHtml(displayName)}</span>
          <span class="tag-chip-count" aria-hidden="true">${countStr}</span>
        </button>
      `;
    }).join('');

    contentHtml = `
      <div class="tags-browser-cloud" role="group" aria-label="काव्य टैग सूची">
        ${chipsHtml}
      </div>
    `;
  }

  return `
    <div class="library-tags-view" role="region" aria-label="काव्य टैग अनुभाग">
      ${headerHtml}
      ${contentHtml}
    </div>
  `;
}
