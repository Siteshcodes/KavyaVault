/**
 * काव्यकलश (KavyaVault) — Reusable Page Header Component
 * Provides restrained, literary context for non-reader pages.
 */

export function renderPageHeader({ title, subtitle = '', description = '', action = null }) {
  return `
    <header class="page-header" aria-label="${title}">
      <div class="page-header-body">
        <div class="page-header-heading-wrap">
          <h1 class="page-header-title">${title}</h1>
          ${subtitle ? `<span class="page-header-subtitle">${subtitle}</span>` : ''}
        </div>
        ${description ? `<p class="page-header-description">${description}</p>` : ''}
      </div>
      ${action ? `<div class="page-header-action">${action}</div>` : ''}
    </header>
  `;
}
