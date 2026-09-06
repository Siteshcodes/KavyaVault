/**
 * काव्यकलश (KavyaVault) — Theme Selector Component (ThemeSelector.js)
 * Renders the accessible 4-theme radio selector in the Settings screen.
 */

import './settings.css';
import { THEMES, themeService } from '../../services/theme.js';

export function renderThemeSelector() {
  const currentThemeId = themeService.getCurrentTheme();

  const optionsHtml = THEMES.map(theme => {
    const isSelected = theme.id === currentThemeId;

    return `
      <label
        for="theme-${theme.id}"
        class="theme-option-card ${isSelected ? 'is-selected' : ''}"
        data-theme-id="${theme.id}"
      >
        <input
          type="radio"
          id="theme-${theme.id}"
          name="kavyavault_theme_choice"
          value="${theme.id}"
          class="theme-radio-input"
          ${isSelected ? 'checked' : ''}
          aria-describedby="desc-${theme.id}"
        />

        <div class="theme-card-content">
          <div class="theme-card-header">
            <!-- Palette Swatch -->
            <div class="theme-swatch" aria-hidden="true" title="रंग दर्शन">
              <span class="swatch-dot" style="background-color: ${theme.colors.bg};" title="पृष्ठभूमि"></span>
              <span class="swatch-dot" style="background-color: ${theme.colors.surface};" title="सतह"></span>
              <span class="swatch-dot" style="background-color: ${theme.colors.text};" title="स्याही"></span>
              <span class="swatch-dot" style="background-color: ${theme.colors.accent};" title="विशेष रंग"></span>
            </div>

            <!-- Radio Indicator with Checkmark -->
            <span class="theme-radio-indicator" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
          </div>

          <div class="theme-card-info">
            <div class="theme-name-wrap">
              <h4 class="theme-title">${theme.name}</h4>
              <span class="theme-subtitle">${theme.enName}</span>
            </div>
            <p class="theme-desc" id="desc-${theme.id}">
              ${theme.description}
            </p>
          </div>
        </div>
      </label>
    `;
  }).join('');

  return `
    <section class="settings-view" aria-labelledby="settings-theme-heading">
      <fieldset class="theme-selector-fieldset">
        <legend id="settings-theme-heading" class="theme-selector-legend">
          विषय / रूप-सज्जा
        </legend>
        <p class="theme-selector-tagline">
          अपनी पठन व लेखन साधना हेतु वातावरण चुनें। यह रूप-रंग संपूर्ण संग्रह में तत्काल सक्रिय हो जाएगा।
        </p>

        <div class="theme-options-grid" role="radiogroup" aria-label="काव्यकलश विषय विकल्प">
          ${optionsHtml}
        </div>
      </fieldset>
    </section>
  `;
}

/**
 * Attaches change listeners to the theme radio buttons
 */
export function attachThemeSelectorEvents(container) {
  if (!container) return;

  const radioInputs = container.querySelectorAll('input[name="kavyavault_theme_choice"]');
  radioInputs.forEach(input => {
    input.addEventListener('change', (event) => {
      const selectedId = event.target.value;
      themeService.setTheme(selectedId);

      // Update selected classes across cards
      const cards = container.querySelectorAll('.theme-option-card');
      cards.forEach(card => {
        if (card.getAttribute('data-theme-id') === selectedId) {
          card.classList.add('is-selected');
        } else {
          card.classList.remove('is-selected');
        }
      });
    });
  });
}
