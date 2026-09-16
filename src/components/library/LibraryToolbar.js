/**
 * काव्यकलश (KavyaVault) — Library Toolbar Component (LibraryToolbar.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Provides:
 * 1. 8 Core Library Section Tabs (सभी कविताएँ, पसंदीदा, हाल में पढ़ी गई, संग्रह, श्रेणियाँ, टैग, अभिलेख, समयरेखा)
 * 2. Multi-tier Sorting selector
 * 3. Filter Drawer Toggle button
 * 4. Grid / List View Toggle buttons
 * 5. Dynamic count display
 *
 * Maintains 100% backward compatibility with previous phases.
 */

import { getIconSvg } from '../navigation/icons.js';

export const LIBRARY_SECTIONS = [
  { id: 'all', label: 'सभी कविताएँ', icon: 'book' },
  { id: 'favorites', label: 'पसंदीदा', icon: 'heart' },
  { id: 'recent', label: 'हाल में पढ़ी गई', icon: 'clock' },
  { id: 'collections', label: 'संग्रह', icon: 'collection' },
  { id: 'categories', label: 'श्रेणियाँ', icon: 'folder' },
  { id: 'tags', label: 'टैग', icon: 'tag' },
  { id: 'archived', label: 'अभिलेख', icon: 'archive' },
  { id: 'timeline', label: 'समयरेखा', icon: 'timeline' }
];

export const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: 'नवीनतम अद्यतन' },
  { value: 'updatedAt:asc', label: 'प्राचीनतम अद्यतन' },
  { value: 'createdAt:desc', label: 'नवीनतम रचना' },
  { value: 'title:asc', label: 'शीर्षक अनुसार' },
  { value: 'authoredDate:desc', label: 'रचना काल अनुसार' }
];

/**
 * Renders the library navigation and controls toolbar
 * @param {Object} options
 * @param {string} [options.activeSection='all'] Active section id
 * @param {string} [options.activeFilter='all'] Backward compatible alias
 * @param {string} [options.viewMode='grid'] Grid or List
 * @param {number} [options.count=0] Item count
 * @param {boolean} [options.showFilters=true]
 * @param {string|null} [options.countLabel=null]
 * @param {string} [options.currentSort='updatedAt:desc']
 * @param {boolean} [options.isFilterOpen=false]
 * @param {number} [options.activeFilterCount=0]
 * @param {boolean} [options.showSortAndFilter=true]
 * @returns {string} HTML string
 */
export function renderLibraryToolbar({
  activeSection = null,
  activeFilter = 'all',
  viewMode = 'grid',
  count = 0,
  showFilters = true,
  countLabel = null,
  currentSort = 'updatedAt:desc',
  isFilterOpen = false,
  activeFilterCount = 0,
  showSortAndFilter = true
}) {
  const currentSection = activeSection || activeFilter || 'all';

  // Section Navigation Tabs
  const tabsHtml = showFilters
    ? `
      <nav class="library-sections-nav" role="tablist" aria-label="पुस्तकालय विभाग">
        ${LIBRARY_SECTIONS.map(sec => {
          const isActive = currentSection === sec.id;
          return `
            <button
              type="button"
              role="tab"
              class="library-section-tab ${isActive ? 'is-active' : ''}"
              data-section="${sec.id}"
              data-filter="${sec.id}"
              aria-selected="${isActive}"
              tabindex="${isActive ? '0' : '-1'}"
              id="library-tab-${sec.id}"
              aria-controls="library-panel-${sec.id}"
            >
              ${getIconSvg(sec.icon, 'nav-icon')}
              <span class="tab-label">${sec.label}</span>
            </button>
          `;
        }).join('')}
      </nav>
    `
    : '';

  const displayCount = countLabel || `${count} रचनाएँ`;

  // Sort Selector & Filter Toggle (applicable when viewing poems list)
  const sortAndFilterControls = showSortAndFilter
    ? `
      <div class="library-sorting-controls" role="group" aria-label="क्रमबद्धता व फ़िल्टर">
        <label for="library-sort-select" class="visually-hidden">क्रमबद्ध करें</label>
        <select
          id="library-sort-select"
          class="library-sort-select"
          data-action="change-sort"
          aria-label="रचनाओं को क्रमबद्ध करें"
        >
          ${SORT_OPTIONS.map(opt => `
            <option value="${opt.value}" ${currentSort === opt.value ? 'selected' : ''}>
              ${opt.label}
            </option>
          `).join('')}
        </select>

        <button
          type="button"
          class="btn-filter-toggle ${isFilterOpen ? 'is-active' : ''} ${activeFilterCount > 0 ? 'has-filters' : ''}"
          data-action="toggle-filter-drawer"
          aria-expanded="${Boolean(isFilterOpen)}"
          aria-controls="library-filter-drawer"
          aria-label="फ़िल्टर खोलें या बंद करें"
          title="उन्नत फ़िल्टर"
        >
          ${getIconSvg('filter', 'nav-icon')}
          <span>फ़िल्टर</span>
          ${activeFilterCount > 0 ? `<span class="filter-count-badge">${activeFilterCount}</span>` : ''}
        </button>
      </div>
    `
    : '';

  return `
    <div class="library-toolbar" role="toolbar" aria-label="पुस्तकालय नियंत्रण पट्टी">
      <div class="toolbar-top">
        ${tabsHtml}
      </div>

      <div class="toolbar-bottom">
        <div class="toolbar-bottom-left">
          ${sortAndFilterControls}
        </div>

        <div class="toolbar-bottom-right">
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
    </div>
  `;
}
