/**
 * काव्यकलश (KavyaVault) — Home / Foyer Screen Component (HomeView.js)
 * Phase 6 / Task 6.3: Library Discovery, Navigation & UX Polish
 *
 * Provides a quiet, editorial literary entrance into the personal archive.
 * Natural discovery pathways for:
 * 1. आपकी कविताएँ (Latest / featured poems)
 * 2. हाल में पढ़ी गई (Recently read with timestamp badge)
 * 3. पसंदीदा (Curated favorites)
 * 4. संग्रह (Anthology collections)
 *
 * Avoids SaaS dashboard clutter. Completely local-first and privacy-focused.
 */

import { renderEmptyState } from '../layout/EmptyState.js';
import { getIconSvg } from '../navigation/icons.js';
import { ROUTES } from '../../data/navigation.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { libraryService } from '../../services/LibraryService.js';
import { collectionRepository } from '../../services/CollectionRepository.js';
import { escapeHtml } from '../../services/SearchService.js';
import { formatPoeticDate } from '../../utils/date.js';
import { toDevanagariNumber } from '../library/CollectionsSection.js';

/**
 * Renders the quiet entrance to the personal literary archive
 * @param {Object} [options={}]
 * @param {Object} [options.poemRepo=poemRepository]
 * @param {Object} [options.libraryService=libraryService]
 * @param {Object} [options.collectionRepo=collectionRepository]
 * @returns {string} HTML string
 */
export function renderHomeView(options = {}) {
  const poemRepo = options.poemRepo || poemRepository;
  const service = options.libraryService || libraryService;
  const colRepo = options.collectionRepo || collectionRepository;

  // Safe data extraction
  let allPoems = [];
  try {
    allPoems = poemRepo && typeof poemRepo.getAll === 'function'
      ? poemRepo.getAll({ includeArchived: false })
      : [];
  } catch {
    allPoems = [];
  }

  let recentItems = [];
  try {
    recentItems = service && service.recent && typeof service.recent.getRecentWithPoems === 'function'
      ? service.recent.getRecentWithPoems({ limit: 3 })
      : [];
  } catch {
    recentItems = [];
  }

  let favoritePoems = [];
  try {
    if (service && service.favorites) {
      if (typeof service.favorites.listFavorites === 'function') {
        favoritePoems = service.favorites.listFavorites().slice(0, 3);
      } else if (typeof service.favorites.getFavorites === 'function') {
        favoritePoems = service.favorites.getFavorites().slice(0, 3);
      }
    }
  } catch {
    favoritePoems = [];
  }

  let collections = [];
  try {
    collections = service && service.collections && typeof service.collections.listCollections === 'function'
      ? service.collections.listCollections().slice(0, 3)
      : [];
  } catch {
    collections = [];
  }

  const totalPoemCount = allPoems.length;
  const totalPoemCountStr = toDevanagariNumber(totalPoemCount);

  // 1. Welcome Greeting Card
  const welcomeHtml = `
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
        <a
          href="${ROUTES.POEMS}"
          data-link
          class="btn-secondary-action"
          aria-label="पुस्तकालय देखें"
        >
          ${getIconSvg('book', 'nav-icon')}
          <span>पुस्तकालय</span>
        </a>
        <a
          href="${ROUTES.MANUSCRIPT_NEW}"
          data-link
          class="btn-secondary-action"
          aria-label="पुरानी पांडुलिपि सहेजें"
        >
          ${getIconSvg('upload', 'nav-icon')}
          <span>पांडुलिपि सहेजें</span>
        </a>
      </div>
    </section>
  `;

  // 2. आपकी कविताएँ / नवीनतम रचनाएँ
  let latestPoemsHtml = '';
  if (allPoems.length === 0) {
    latestPoemsHtml = renderEmptyState({
      icon: 'book',
      heading: 'अभी आपकी काव्य-डायरी खाली है।',
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
    });
  } else {
    const latestThree = allPoems.slice(0, 3);
    latestPoemsHtml = `
      <div class="home-discovery-grid" role="feed" aria-label="नवीनतम काव्य रचनाएँ">
        ${latestThree.map(poem => {
          const bodySnippet = (poem.body || '').split('\n').filter(l => l.trim()).slice(0, 2).join(' / ');
          return `
            <article class="home-discovery-card" aria-label="${escapeHtml(poem.title || 'रचना')}">
              <header class="home-card-header">
                <h4 class="home-card-title">
                  <a href="/poems/${poem.id}" data-link class="home-card-title-link">
                    ${escapeHtml(poem.title || 'शीर्षकहीन')}
                  </a>
                </h4>
                ${poem.isFavorite ? `<span class="home-fav-icon" aria-label="प्रिय रचना" title="प्रिय रचना">${getIconSvg('heart-filled', 'nav-icon')}</span>` : ''}
              </header>
              <div class="home-card-meta">
                <span class="home-card-author">${escapeHtml(poem.author || 'अज्ञात')}</span>
                ${poem.category ? `<span class="home-meta-dot">•</span><span class="home-card-cat">${escapeHtml(poem.category)}</span>` : ''}
                <span class="home-meta-dot">•</span>
                <time datetime="${poem.updatedAt || poem.createdAt}">${formatPoeticDate(poem.updatedAt || poem.createdAt)}</time>
              </div>
              <p class="home-card-snippet">${escapeHtml(bodySnippet || 'पंक्तियाँ...')}</p>
            </article>
          `;
        }).join('')}
      </div>
      <div class="home-section-footer">
        <a href="${ROUTES.POEMS}" data-link class="home-discovery-link" aria-label="काव्य पुस्तकालय में सभी रचनाएँ देखें">
          <span>काव्य पुस्तकालय में सभी रचनाएँ देखें (${totalPoemCountStr})</span>
          ${getIconSvg('arrow-right', 'nav-icon')}
        </a>
      </div>
    `;
  }

  // 3. हाल में पढ़ी गई (Recently Read)
  let recentSectionHtml = '';
  if (recentItems.length === 0) {
    recentSectionHtml = `
      <div class="home-empty-card">
        <p class="home-empty-text">आपने अभी कोई कविता नहीं पढ़ी है। अपनी पसंदीदा पंक्तियाँ पढ़ें।</p>
        <a href="${ROUTES.POEMS}" data-link class="home-empty-action">पुस्तकालय में कविताएँ पढ़ें →</a>
      </div>
    `;
  } else {
    recentSectionHtml = `
      <div class="home-discovery-grid" role="feed" aria-label="हाल में पढ़ी गई कविताएँ">
        ${recentItems.map(item => {
          const poem = item.poem;
          const bodySnippet = (poem.body || '').split('\n').filter(l => l.trim()).slice(0, 2).join(' / ');
          const viewDate = formatPoeticDate(item.viewedAt);
          return `
            <article class="home-discovery-card home-card-recent" aria-label="${escapeHtml(poem.title || 'रचना')}">
              <header class="home-card-header">
                <h4 class="home-card-title">
                  <a href="/poems/${poem.id}" data-link class="home-card-title-link">
                    ${escapeHtml(poem.title || 'शीर्षकहीन')}
                  </a>
                </h4>
                <span class="home-recent-badge">पठन: ${viewDate}</span>
              </header>
              <div class="home-card-meta">
                <span class="home-card-author">${escapeHtml(poem.author || 'अज्ञात')}</span>
                ${poem.category ? `<span class="home-meta-dot">•</span><span class="home-card-cat">${escapeHtml(poem.category)}</span>` : ''}
              </div>
              <p class="home-card-snippet">${escapeHtml(bodySnippet || 'पंक्तियाँ...')}</p>
            </article>
          `;
        }).join('')}
      </div>
      <div class="home-section-footer">
        <a href="/poems?section=recent" data-link class="home-discovery-link" aria-label="हाल में पढ़ी गई सभी कविताएँ देखें">
          <span>हाल में पढ़ी गई सभी रचनाएँ देखें</span>
          ${getIconSvg('arrow-right', 'nav-icon')}
        </a>
      </div>
    `;
  }

  // 4. पसंदीदा (Curated Favorites)
  let favoritesSectionHtml = '';
  if (favoritePoems.length === 0) {
    favoritesSectionHtml = `
      <div class="home-empty-card">
        <p class="home-empty-text">अभी कोई कविता पसंदीदा नहीं है। अपनी प्रिय रचनाओं को दिल के चिह्न (♥) से संजोएँ।</p>
        <a href="${ROUTES.POEMS}" data-link class="home-empty-action">पुस्तकालय देखें →</a>
      </div>
    `;
  } else {
    favoritesSectionHtml = `
      <div class="home-discovery-grid" role="feed" aria-label="पसंदीदा कविताएँ">
        ${favoritePoems.map(poem => {
          const bodySnippet = (poem.body || '').split('\n').filter(l => l.trim()).slice(0, 2).join(' / ');
          return `
            <article class="home-discovery-card home-card-fav" aria-label="${escapeHtml(poem.title || 'रचना')}">
              <header class="home-card-header">
                <h4 class="home-card-title">
                  <a href="/poems/${poem.id}" data-link class="home-card-title-link">
                    ${escapeHtml(poem.title || 'शीर्षकहीन')}
                  </a>
                </h4>
                <span class="home-fav-icon" aria-label="पसंदीदा" title="पसंदीदा">${getIconSvg('heart-filled', 'nav-icon')}</span>
              </header>
              <div class="home-card-meta">
                <span class="home-card-author">${escapeHtml(poem.author || 'अज्ञात')}</span>
                ${poem.category ? `<span class="home-meta-dot">•</span><span class="home-card-cat">${escapeHtml(poem.category)}</span>` : ''}
              </div>
              <p class="home-card-snippet">${escapeHtml(bodySnippet || 'पंक्तियाँ...')}</p>
            </article>
          `;
        }).join('')}
      </div>
      <div class="home-section-footer">
        <a href="/poems?section=favorites" data-link class="home-discovery-link" aria-label="सभी पसंदीदा कविताएँ देखें">
          <span>सभी पसंदीदा कविताएँ देखें</span>
          ${getIconSvg('arrow-right', 'nav-icon')}
        </a>
      </div>
    `;
  }

  // 5. काव्य संग्रह (Collections)
  let collectionsSectionHtml = '';
  if (collections.length === 0) {
    collectionsSectionHtml = `
      <div class="home-empty-card">
        <p class="home-empty-text">अभी कोई संग्रह नहीं बनाया गया है। विभिन्न भावों और छंदों के अनुसार संग्रह बनाएँ।</p>
        <a href="/poems?section=collections" data-link class="home-empty-action">नया संग्रह बनाएँ →</a>
      </div>
    `;
  } else {
    collectionsSectionHtml = `
      <div class="home-discovery-grid" role="feed" aria-label="काव्य संग्रह">
        ${collections.map(col => {
          const count = col.poemIds ? col.poemIds.length : 0;
          const countStr = `${toDevanagariNumber(count)} कविता${count === 1 ? '' : 'एँ'}`;
          return `
            <article class="home-discovery-card home-card-collection" aria-label="${escapeHtml(col.name)}">
              <header class="home-card-header">
                <h4 class="home-card-title">
                  <a href="/poems?section=collections&collectionId=${col.id}" data-link class="home-card-title-link">
                    ${escapeHtml(col.name)}
                  </a>
                </h4>
                <span class="home-collection-count-badge">${countStr}</span>
              </header>
              <p class="home-card-snippet">${escapeHtml(col.description || 'साहित्यिक काव्य संकलन।')}</p>
            </article>
          `;
        }).join('')}
      </div>
      <div class="home-section-footer">
        <a href="/poems?section=collections" data-link class="home-discovery-link" aria-label="सभी काव्य संग्रह देखें">
          <span>सभी काव्य संग्रह देखें</span>
          ${getIconSvg('arrow-right', 'nav-icon')}
        </a>
      </div>
    `;
  }

  return `
    <div class="home-foyer" role="region" aria-label="काव्यकलश मुख्य द्वार">
      ${welcomeHtml}

      <!-- 1. आपकी कविताएँ -->
      <section class="foyer-section" aria-labelledby="section-poems-heading">
        <div class="foyer-section-header">
          <h3 id="section-poems-heading" class="foyer-section-title">आपकी कविताएँ</h3>
          <span class="foyer-section-subtitle">नवीनतम सृजन</span>
        </div>
        ${latestPoemsHtml}
      </section>

      <!-- 2. हाल में पढ़ी गई -->
      <section class="foyer-section" aria-labelledby="section-recent-heading">
        <div class="foyer-section-header">
          <h3 id="section-recent-heading" class="foyer-section-title">हाल में पढ़ी गई</h3>
          <span class="foyer-section-subtitle">साहित्यिक स्मृतियाँ</span>
        </div>
        ${recentSectionHtml}
      </section>

      <!-- 3. पसंदीदा -->
      <section class="foyer-section" aria-labelledby="section-favorites-heading">
        <div class="foyer-section-header">
          <h3 id="section-favorites-heading" class="foyer-section-title">पसंदीदा</h3>
          <span class="foyer-section-subtitle">हृदयस्पर्शी रचनाएँ</span>
        </div>
        ${favoritesSectionHtml}
      </section>

      <!-- 4. संग्रह -->
      <section class="foyer-section" aria-labelledby="section-collections-heading">
        <div class="foyer-section-header">
          <h3 id="section-collections-heading" class="foyer-section-title">संग्रह</h3>
          <span class="foyer-section-subtitle">काव्य संकलन</span>
        </div>
        ${collectionsSectionHtml}
      </section>
    </div>
  `;
}
