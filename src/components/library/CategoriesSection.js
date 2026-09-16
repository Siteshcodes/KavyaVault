/**
 * काव्यकलश (KavyaVault) — Categories Section Component (CategoriesSection.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Displays poetic categories derived from CategoryService with counts,
 * slugs, and one-click filtering.
 */

import { escapeHtml } from '../../services/SearchService.js';
import { getIconSvg } from '../navigation/icons.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { toDevanagariNumber } from './CollectionsSection.js';

/**
 * Renders the Categories section
 * @param {Object} options
 * @param {Array} options.categories Array of category objects { name, slug, poemCount, activeCount, archivedCount }
 * @param {string|null} [options.selectedCategory=null]
 * @returns {string} HTML string
 */
export function renderCategoriesSection({
  categories = [],
  selectedCategory = null
}) {
  const headerHtml = `
    <div class="categories-section-header">
      <div class="section-title-wrap">
        <h2 class="section-title">काव्य श्रेणियाँ</h2>
        <p class="section-desc">विधा, रस और अभिव्यक्ति के आधार पर वर्गीकृत काव्य-रूप।</p>
      </div>
    </div>
  `;

  let contentHtml = '';

  if (!categories || categories.length === 0) {
    contentHtml = renderEmptyState({
      icon: 'collection',
      heading: 'अभी कोई श्रेणी उपलब्ध नहीं है',
      text: 'अपनी कविताओं में श्रेणी (जैसे ग़ज़ल, दोहा, मुक्तक, गीत, आदि) अंकित करके उन्हें यहाँ व्यवस्थित रूप में देखें।',
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
    const cardsHtml = categories.map(cat => {
      const count = cat.poemCount || 0;
      const countStr = `${toDevanagariNumber(count)} कविता${count === 1 ? '' : 'एँ'}`;
      const isSelected = selectedCategory && selectedCategory.toLowerCase() === (cat.name || '').toLowerCase();

      return `
        <article class="category-card ${isSelected ? 'is-selected' : ''}" data-category-name="${escapeHtml(cat.name)}">
          <div class="category-card-body">
            <div class="category-card-header">
              <span class="category-card-emblem" aria-hidden="true">❦</span>
              <h3 class="category-card-title">
                <button
                  type="button"
                  class="btn-category-select"
                  data-action="select-category"
                  data-category="${escapeHtml(cat.name)}"
                  aria-label="${escapeHtml(cat.name)} श्रेणी की कविताएँ देखें"
                >
                  ${escapeHtml(cat.name)}
                </button>
              </h3>
            </div>
          </div>

          <footer class="category-card-footer">
            <span class="category-poem-count" aria-label="${countStr}">
              ${getIconSvg('book', 'nav-icon')}
              <span>${countStr}</span>
            </span>

            <button
              type="button"
              class="btn-secondary-action btn-category-open"
              data-action="select-category"
              data-category="${escapeHtml(cat.name)}"
              aria-label="${escapeHtml(cat.name)} देखें"
            >
              <span>रचनाएँ देखें</span>
            </button>
          </footer>
        </article>
      `;
    }).join('');

    contentHtml = `
      <div class="categories-grid" role="feed" aria-label="काव्य श्रेणियाँ ग्रिड">
        ${cardsHtml}
      </div>
    `;
  }

  return `
    <div class="library-categories-view" role="region" aria-label="काव्य श्रेणियाँ अनुभाग">
      ${headerHtml}
      ${contentHtml}
    </div>
  `;
}
