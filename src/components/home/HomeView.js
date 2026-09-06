/**
 * काव्यकलश (KavyaVault) — Home / Foyer Screen Component
 * Renders the quiet entrance to the personal literary archive.
 */

import './home.css';
import '../layout/layout.css';
import { renderEmptyState } from '../layout/EmptyState.js';
import { getIconSvg } from '../navigation/icons.js';
import { ROUTES } from '../../data/navigation.js';

export function renderHomeView() {
  return `
    <div class="home-foyer">
      <!-- Foyer Welcome Card -->
      <section class="foyer-welcome" aria-labelledby="foyer-heading">
        <h2 id="foyer-heading" class="foyer-greeting">नमस्कार, आपका काव्य-संसार</h2>
        <p class="foyer-tagline">
          शब्दों को सँजोने का अपना शांत, एकांत स्थान। यहाँ आपकी भावनाएँ अमर पंक्तियों में ढलती हैं।
        </p>
        <div class="foyer-action-wrap">
          <a
            href="${ROUTES.NEW_POEM}"
            data-link
            class="btn-primary-action"
            aria-label="नई कविता लिखें"
          >
            ${getIconSvg('quill', 'nav-icon')}
            <span>नई कविता</span>
          </a>
        </div>
      </section>

      <!-- Section: आज की रचना (Poem of the Day) -->
      <section class="foyer-section" aria-labelledby="section-today-heading">
        <div class="foyer-section-header">
          <h3 id="section-today-heading" class="foyer-section-title">आज की रचना</h3>
          <span class="foyer-section-subtitle">दैनिक साहित्यिक प्रेरणा</span>
        </div>

        ${renderEmptyState({
          icon: 'book',
          heading: 'अभी कोई कविता नहीं',
          text: 'आपकी पहली रचना यहाँ सहेजी जाएगी। जब आप शब्द रचेंगे, यह पन्ना जाग्रत हो उठेगा।',
          primaryAction: `
            <a
              href="${ROUTES.NEW_POEM}"
              data-link
              class="btn-primary-action"
              aria-label="नई कविता लिखें"
            >
              ${getIconSvg('quill', 'nav-icon')}
              <span>नई कविता लिखें</span>
            </a>
          `
        })}
      </section>

      <!-- Section: हाल की रचनाएँ (Recent Poems) -->
      <section class="foyer-section" aria-labelledby="section-recent-heading">
        <div class="foyer-section-header">
          <h3 id="section-recent-heading" class="foyer-section-title">हाल की रचनाएँ</h3>
          <span class="foyer-section-subtitle">अंतिम बार रची गई पंक्तियाँ</span>
        </div>

        ${renderEmptyState({
          icon: 'quill',
          heading: 'काव्य-संग्रह अभी रिक्त है',
          text: 'आपके विचार, ग़ज़लें और छंद यहाँ कालक्रमानुसार सहेजे जाएंगे।',
          primaryAction: `
            <a
              href="${ROUTES.POEMS}"
              data-link
              class="btn-secondary-action"
              aria-label="पुस्तकालय देखें"
            >
              ${getIconSvg('book', 'nav-icon')}
              <span>पुस्तकालय देखें</span>
            </a>
          `
        })}
      </section>
    </div>
  `;
}
