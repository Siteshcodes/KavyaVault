/**
 * काव्यकलश (KavyaVault) — Library Filter Drawer Component (LibraryFilterDrawer.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Provides a collapsible, accessible filtering drawer allowing multi-criteria
 * filtering by collection, category, tag, favorites, and date ranges.
 */

import { escapeHtml } from '../../services/SearchService.js';
import { getIconSvg } from '../navigation/icons.js';

/**
 * Renders the filter drawer and active filter chips
 * @param {Object} options
 * @param {boolean} options.isOpen Whether drawer is expanded
 * @param {Object} options.activeFilter Current filter values { category, tag, collectionId, isFavorite, isArchived, sortField, sortOrder }
 * @param {Array} options.categories Available category options
 * @param {Array} options.tags Available tag options
 * @param {Array} options.collections Available collections
 * @returns {string} HTML string
 */
export function renderLibraryFilterDrawer({
  isOpen = false,
  activeFilter = {},
  categories = [],
  tags = [],
  collections = []
}) {
  const activeChips = [];

  if (activeFilter.category) {
    activeChips.push({
      key: 'category',
      label: `श्रेणी: ${activeFilter.category}`
    });
  }

  if (activeFilter.tag) {
    activeChips.push({
      key: 'tag',
      label: `टैग: #${activeFilter.tag}`
    });
  }

  if (activeFilter.collectionId) {
    const col = collections.find(c => c.id === activeFilter.collectionId);
    const colName = col ? col.name : 'चयनित संग्रह';
    activeChips.push({
      key: 'collectionId',
      label: `संग्रह: ${colName}`
    });
  }

  if (activeFilter.isFavorite) {
    activeChips.push({
      key: 'isFavorite',
      label: 'केवल पसंदीदा'
    });
  }

  if (activeFilter.isArchived) {
    activeChips.push({
      key: 'isArchived',
      label: 'अभिलेखागार'
    });
  }

  const chipsHtml = activeChips.length > 0
    ? `
      <div class="active-filters-bar" role="group" aria-label="सक्रिय फ़िल्टर">
        <span class="active-filters-label">सक्रिय फ़िल्टर:</span>
        <div class="active-filters-chips">
          ${activeChips.map(chip => `
            <button
              type="button"
              class="active-filter-chip"
              data-action="remove-filter-chip"
              data-filter-key="${chip.key}"
              aria-label="${escapeHtml(chip.label)} हटाएं"
            >
              <span>${escapeHtml(chip.label)}</span>
              <span class="chip-remove-icon" aria-hidden="true">${getIconSvg('close', 'nav-icon')}</span>
            </button>
          `).join('')}
          <button
            type="button"
            class="btn-clear-all-filters"
            data-action="clear-all-filters"
            aria-label="सभी फ़िल्टर साफ़ करें"
          >
            सभी साफ़ करें
          </button>
        </div>
      </div>
    `
    : '';

  if (!isOpen) {
    return chipsHtml;
  }

  // Expanded Drawer markup
  const categoryOptions = categories.map(c => `
    <option value="${escapeHtml(c.name)}" ${activeFilter.category === c.name ? 'selected' : ''}>
      ${escapeHtml(c.name)} (${c.poemCount || 0})
    </option>
  `).join('');

  const tagOptions = tags.map(t => `
    <option value="${escapeHtml(t.name)}" ${activeFilter.tag === t.name ? 'selected' : ''}>
      #${escapeHtml(t.displayForm || t.name)} (${t.poemCount || 0})
    </option>
  `).join('');

  const collectionOptions = collections.map(c => `
    <option value="${c.id}" ${activeFilter.collectionId === c.id ? 'selected' : ''}>
      ${escapeHtml(c.name)} (${c.poemIds ? c.poemIds.length : 0})
    </option>
  `).join('');

  return `
    ${chipsHtml}
    <div class="library-filter-drawer is-open" id="library-filter-drawer" role="region" aria-label="उन्नत फ़िल्टर">
      <div class="drawer-header">
        <h3 class="drawer-title">
          ${getIconSvg('filter', 'nav-icon')}
          <span>काव्य पुस्तकालय फ़िल्टर</span>
        </h3>
        <button
          type="button"
          class="btn-drawer-close"
          data-action="toggle-filter-drawer"
          aria-label="फ़िल्टर बंद करें"
        >
          ${getIconSvg('close', 'nav-icon')}
        </button>
      </div>

      <div class="drawer-body">
        <div class="filter-field-group">
          <label for="filter-category-select" class="filter-field-label">श्रेणी</label>
          <select id="filter-category-select" class="filter-select" data-filter-field="category">
            <option value="">-- समस्त श्रेणियाँ --</option>
            ${categoryOptions}
          </select>
        </div>

        <div class="filter-field-group">
          <label for="filter-tag-select" class="filter-field-label">टैग</label>
          <select id="filter-tag-select" class="filter-select" data-filter-field="tag">
            <option value="">-- समस्त टैग --</option>
            ${tagOptions}
          </select>
        </div>

        <div class="filter-field-group">
          <label for="filter-collection-select" class="filter-field-label">काव्य संग्रह</label>
          <select id="filter-collection-select" class="filter-select" data-filter-field="collectionId">
            <option value="">-- समस्त संग्रह --</option>
            ${collectionOptions}
          </select>
        </div>
      </div>

      <div class="drawer-footer">
        <button
          type="button"
          class="btn-secondary-action"
          data-action="clear-all-filters"
        >
          <span>फ़िल्टर रीसेट करें</span>
        </button>
        <button
          type="button"
          class="btn-primary-action"
          data-action="apply-filter-drawer"
        >
          ${getIconSvg('check', 'nav-icon')}
          <span>लागू करें</span>
        </button>
      </div>
    </div>
    ${chipsHtml}
  `;
}
