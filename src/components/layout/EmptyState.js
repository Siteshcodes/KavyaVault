/**
 * काव्यकलश (KavyaVault) — Reusable Literary Empty State Component
 * Renders quiet, contemplative empty states with optional primary and secondary actions.
 */

import { getIconSvg } from '../navigation/icons.js';

export function renderEmptyState({
  icon = 'book',
  heading = 'अभी कोई रचना नहीं',
  text = 'शब्दों की प्रतीक्षा में पन्ने मौन हैं।',
  primaryAction = null,
  secondaryAction = null,
  className = ''
}) {
  return `
    <div class="empty-state ${className}">
      <div class="empty-state-ornament" aria-hidden="true">
        ${getIconSvg(icon, 'empty-state-icon')}
      </div>
      <h3 class="empty-state-heading">${heading}</h3>
      <p class="empty-state-text">${text}</p>
      ${(primaryAction || secondaryAction) ? `
        <div class="empty-state-actions">
          ${primaryAction ? primaryAction : ''}
          ${secondaryAction ? secondaryAction : ''}
        </div>
      ` : ''}
    </div>
  `;
}
