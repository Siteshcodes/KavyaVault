/**
 * काव्यकलश (KavyaVault) — Poem Card Component (PoemCard.js)
 * Renders individual poem items in Grid or List presentation modes.
 */

import { generatePoemPreview } from '../../utils/preview.js';
import { formatPoeticDate } from '../../utils/date.js';
import { getIconSvg } from '../navigation/icons.js';
import { escapeHtml, highlightMatches } from '../../services/SearchService.js';

export function renderPoemCard(poem, viewMode = 'grid', options = {}) {
  const previewText = generatePoemPreview(poem.body);
  const formattedDate = formatPoeticDate(poem.updatedAt || poem.createdAt);

  const displayTitle = options.highlightQuery
    ? highlightMatches(poem.title || 'शीर्षकहीन रचना', options.highlightQuery)
    : escapeHtml(poem.title || 'शीर्षकहीन रचना');

  const displayAuthor = options.highlightQuery
    ? highlightMatches(poem.author || 'अज्ञात', options.highlightQuery)
    : escapeHtml(poem.author || 'अज्ञात');

  const displaySnippet = options.highlightQuery
    ? highlightMatches(previewText, options.highlightQuery)
    : escapeHtml(previewText);

  const tagsHtml = (Array.isArray(poem.tags) && poem.tags.length > 0)
    ? `<div class="card-tags">${poem.tags.map(t => {
        const tagText = options.highlightQuery
          ? highlightMatches(t, options.highlightQuery)
          : escapeHtml(t);
        return `<span class="card-tag">#${tagText}</span>`;
      }).join('')}</div>`
    : '';

  const matchBadgeHtml = options.matchBadge
    ? `<span class="badge-match-context">${escapeHtml(options.matchBadge)}</span>`
    : '';

  const isFavorite = Boolean(poem.isFavorite);
  const isArchived = Boolean(poem.isArchived);

  const favoriteIcon = isFavorite ? getIconSvg('heart-filled', 'nav-icon') : getIconSvg('heart', 'nav-icon');
  const archiveIcon = isArchived ? getIconSvg('restore', 'nav-icon') : getIconSvg('archive', 'nav-icon');
  const archiveLabel = isArchived ? 'पुनर्स्थापित करें' : 'अभिलेख में भेजें';

  return `
    <article
      class="poem-card ${viewMode === 'list' ? 'poem-card-list' : 'poem-card-grid'} ${isArchived ? 'is-archived' : ''}"
      data-poem-id="${poem.id}"
      aria-labelledby="poem-title-${poem.id}"
    >
      <div class="card-body-content">
        <header class="card-header">
          <div class="card-title-wrap">
            <h3 id="poem-title-${poem.id}" class="card-title">
              <a href="/poems/${poem.id}" data-link class="card-title-link">
                ${displayTitle}
              </a>
            </h3>
            ${matchBadgeHtml}
            ${poem.isArchived ? `<span class="badge-archived">अभिलेख</span>` : ''}
          </div>

          <div class="card-meta">
            <span class="card-author">${displayAuthor}</span>
            <span class="card-meta-dot" aria-hidden="true">•</span>
            <time class="card-date" datetime="${poem.updatedAt || poem.createdAt}">${formattedDate}</time>
          </div>
        </header>

        <div class="card-snippet">
          <p class="card-snippet-text">${displaySnippet}</p>
        </div>

        ${tagsHtml}
      </div>

      <footer class="card-footer">
        <div class="card-actions">
          <button
            type="button"
            class="btn-card-action btn-card-fav ${isFavorite ? 'is-active' : ''}"
            data-action="toggle-fav"
            data-poem-id="${poem.id}"
            aria-label="${isFavorite ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें'}"
            aria-pressed="${isFavorite}"
            title="${isFavorite ? 'पसंदीदा से हटाएं' : 'पसंदीदा में जोड़ें'}"
          >
            ${favoriteIcon}
          </button>

          <button
            type="button"
            class="btn-card-action btn-card-archive"
            data-action="toggle-archive"
            data-poem-id="${poem.id}"
            aria-label="${archiveLabel}"
            title="${archiveLabel}"
          >
            ${archiveIcon}
          </button>

          <a
            href="/poems/${poem.id}"
            data-link
            class="btn-card-action btn-card-read"
            aria-label="${escapeHtml(poem.title || 'रचना')} पढ़ें"
          >
            <span>पठन</span>
            ${getIconSvg('book', 'nav-icon')}
          </a>
        </div>
      </footer>
    </article>
  `;
}
