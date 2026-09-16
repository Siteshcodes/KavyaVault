/**
 * काव्यकलश (KavyaVault) — Recent Poems Section (RecentSection.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Displays recently viewed poems in bounded, deduplicated, newest-first order.
 * CRITICAL: Viewing history does not mutate poem.updatedAt.
 */

import { escapeHtml } from '../../services/SearchService.js';
import { getIconSvg } from '../navigation/icons.js';
import { renderPoemCard } from './PoemCard.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { formatPoeticDate } from '../../utils/date.js';

/**
 * Renders the Recent Poems section
 * @param {Object} options
 * @param {Array} options.recentItems Array of { poemId, viewedAt, poem }
 * @param {string} [options.viewMode='grid']
 * @returns {string} HTML string
 */
export function renderRecentSection({
  recentItems = [],
  viewMode = 'grid'
}) {
  const headerHtml = `
    <div class="recent-section-header">
      <div class="section-title-wrap">
        <h2 class="section-title">हाल में पढ़ी गई रचनाएँ</h2>
        <p class="section-desc">आपके द्वारा हाल ही में पढ़ी गई कविताओं का स्वतः सहेजा गया क्रम।</p>
      </div>
    </div>
  `;

  let contentHtml = '';

  if (!recentItems || recentItems.length === 0) {
    contentHtml = renderEmptyState({
      icon: 'book',
      heading: 'हाल में कोई कविता नहीं पढ़ी गई है',
      text: 'जैसे-जैसे आप पुस्तकालय में कविताएँ खोलकर पढ़ते जाएँगे, वे यहाँ कालक्रमानुसार दिखाई देंगी।',
      primaryAction: `
        <button
          type="button"
          class="btn-primary-action"
          data-action="navigate-section"
          data-section="all"
          aria-label="पुस्तकालय में कविताएँ पढ़ें"
        >
          ${getIconSvg('book', 'nav-icon')}
          <span>पुस्तकालय में कविताएँ पढ़ें</span>
        </button>
      `
    });
  } else {
    const listClass = viewMode === 'list' ? 'library-collection-list' : 'library-collection-grid';
    const cardsHtml = recentItems.map(item => {
      const formattedViewDate = formatPoeticDate(item.viewedAt);
      const cardHtml = renderPoemCard(item.poem, viewMode, {
        matchBadge: `पठन: ${formattedViewDate}`
      });
      return cardHtml;
    }).join('');

    contentHtml = `
      <div class="${listClass}" role="feed" aria-label="हाल में पढ़ी गई कविताएँ">
        ${cardsHtml}
      </div>
    `;
  }

  return `
    <div class="library-recent-view" role="region" aria-label="हाल में पढ़ी गई कविताएँ">
      ${headerHtml}
      ${contentHtml}
    </div>
  `;
}
