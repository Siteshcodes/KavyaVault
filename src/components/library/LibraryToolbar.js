/**
 * काव्यकलश (KavyaVault) — Library Toolbar Component (LibraryToolbar.js)
 * Provides filter pills (सभी, पसंदीदा, अभिलेख), count badge, and Grid/List view toggles.
 */

import { getIconSvg } from '../navigation/icons.js';

export function renderLibraryToolbar({
  activeFilter = 'all',
  viewMode = 'grid',
  count = 0,
  showFilters = true,
  countLabel = null
}) {
  const filters = [
    { id: 'all', label: 'सभी' },
    { id: 'favorites', label: 'पसंदीदा' },
    { id: 'archived', label: 'अभिलेख' }
  ];

  const filterPillsHtml = showFilters
    ? filters.map(f => `
      <button
        type="button"
        class="filter-pill ${activeFilter === f.id ? 'is-active' : ''}"
        data-filter="${f.id}"
        aria-pressed="${activeFilter === f.id}"
      >
        ${f.label}
      </button>
    `).join('')
    : '';

  const displayCount = countLabel || `${count} रचनाएँ`;

  return `
    <div class="library-toolbar" role="toolbar" aria-label="पुस्तकालय नियंत्रण पट्टी">
      <div class="toolbar-left" role="group" aria-label="काव्य श्रेणियाँ">
        ${filterPillsHtml}
      </div>

      <div class="toolbar-right">
        <span class="library-count" aria-live="polite">${displayCount}</span>

        <div class="view-toggle-group" role="group" aria-label="दृश्य शैली">
          <button
            type="button"
            class="btn-view-toggle ${viewMode === 'grid' ? 'is-active' : ''}"
            data-view="grid"
            aria-label="ग्रिड दृश्य"
            aria-pressed="${viewMode === 'grid'}"
            title="ग्रिड दृश्य"
          >
            ${getIconSvg('grid', 'nav-icon')}
          </button>

          <button
            type="button"
            class="btn-view-toggle ${viewMode === 'list' ? 'is-active' : ''}"
            data-view="list"
            aria-label="सूची दृश्य"
            aria-pressed="${viewMode === 'list'}"
            title="सूची दृश्य"
          >
            ${getIconSvg('list', 'nav-icon')}
          </button>
        </div>
      </div>
    </div>
  `;
}
