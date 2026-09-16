/**
 * काव्यकलश (KavyaVault) — Timeline Section Component (TimelineSection.js)
 * Phase 6 / Task 6.2: Personal Digital Library UI
 *
 * Displays chronological poetic provenance milestones (CREATED, UPDATED, AUTHORED, DIGITIZED).
 * Strictly preserves provenance semantics without fabricating dates.
 */

import { escapeHtml } from '../../services/SearchService.js';
import { getIconSvg } from '../navigation/icons.js';
import { renderEmptyState } from '../layout/EmptyState.js';
import { formatPoeticDate } from '../../utils/date.js';
import { TIMELINE_EVENT_TYPE } from '../../services/library/libraryTypes.js';

/**
 * Maps event types to localized Hindi display labels and icons
 */
const EVENT_META = {
  [TIMELINE_EVENT_TYPE.CREATED]: {
    label: 'कविता जोड़ी गई',
    icon: 'book',
    badgeClass: 'badge-event-created'
  },
  [TIMELINE_EVENT_TYPE.UPDATED]: {
    label: 'कविता संशोधित हुई',
    icon: 'edit',
    badgeClass: 'badge-event-updated'
  },
  [TIMELINE_EVENT_TYPE.AUTHORED]: {
    label: 'मूल रचना काल',
    icon: 'quill',
    badgeClass: 'badge-event-authored'
  },
  [TIMELINE_EVENT_TYPE.DIGITIZED]: {
    label: 'पांडुलिपि संरक्षण',
    icon: 'archive',
    badgeClass: 'badge-event-digitized'
  }
};

/**
 * Renders the Timeline section
 * @param {Object} options
 * @param {Array} options.events Array of timeline entries
 * @returns {string} HTML string
 */
export function renderTimelineSection({
  events = []
}) {
  const headerHtml = `
    <div class="timeline-section-header">
      <div class="section-title-wrap">
        <h2 class="section-title">साहित्यिक समयरेखा</h2>
        <p class="section-desc">आपकी रचनाओं और ऐतिहासिक पांडुलिपियों का कालानुक्रमिक प्रवाह।</p>
      </div>
    </div>
  `;

  let contentHtml = '';

  if (!events || events.length === 0) {
    contentHtml = renderEmptyState({
      icon: 'timeline',
      heading: 'समयरेखा में अभी कोई घटना अंकित नहीं है',
      text: 'जैसे ही आप नई कविताएँ लिखेंगे अथवा पांडुलिपियाँ जोड़ेंगे, उनका ऐतिहासिक कालक्रम यहाँ सजीव होगा।',
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
    const itemsHtml = events.map((event, index) => {
      const meta = EVENT_META[event.eventType] || {
        label: 'साहित्यिक घटना',
        icon: 'book',
        badgeClass: 'badge-event-default'
      };

      const formattedDate = formatPoeticDate(event.date);
      const poemTitle = event.poemTitle || 'शीर्षकहीन रचना';

      let detailsHtml = '';
      if (event.metadata) {
        if (event.metadata.title) {
          detailsHtml = `<p class="timeline-meta-text">पांडुलिपि: ${escapeHtml(event.metadata.title)}</p>`;
        } else if (event.metadata.author) {
          detailsHtml = `<p class="timeline-meta-text">रचनाकार: ${escapeHtml(event.metadata.author)}</p>`;
        }
      }

      return `
        <li class="timeline-item" data-event-type="${event.eventType}">
          <div class="timeline-connector">
            <span class="timeline-dot ${meta.badgeClass}" aria-hidden="true"></span>
            ${index < events.length - 1 ? '<span class="timeline-line" aria-hidden="true"></span>' : ''}
          </div>

          <article class="timeline-card" aria-label="${escapeHtml(poemTitle)}, ${meta.label}">
            <header class="timeline-card-header">
              <span class="timeline-event-badge ${meta.badgeClass}">
                ${getIconSvg(meta.icon, 'nav-icon')}
                <span>${meta.label}</span>
              </span>
              <time class="timeline-date" datetime="${event.date}">${formattedDate}</time>
            </header>

            <h3 class="timeline-card-title">
              <a href="/poems/${event.poemId}" data-link class="timeline-poem-link">
                ${escapeHtml(poemTitle)}
              </a>
            </h3>

            ${detailsHtml}
          </article>
        </li>
      `;
    }).join('');

    contentHtml = `
      <ol class="timeline-list" aria-label="काव्य समयरेखा सूची">
        ${itemsHtml}
      </ol>
    `;
  }

  return `
    <div class="library-timeline-view" role="region" aria-label="साहित्यिक समयरेखा">
      ${headerHtml}
      ${contentHtml}
    </div>
  `;
}
