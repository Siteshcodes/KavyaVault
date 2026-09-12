/**
 * काव्यकलश (KavyaVault) — Application Shell Controller (AppShell.js)
 * Coordinates persistent navigation and route view swapping.
 */

import './layout.css';
import '../manuscripts/manuscripts.css';
import '../reader/reader.css';
import '../editor/editor.css';
import '../input/input.css';
import { Navigation } from '../navigation/Navigation.js';
import { renderPageHeader } from './PageHeader.js';
import { renderEmptyState } from './EmptyState.js';
import { renderHomeView } from '../home/HomeView.js';
import { ROUTES, ROUTE_METADATA } from '../../data/navigation.js';
import { getIconSvg } from '../navigation/icons.js';
import { renderThemeSelector, attachThemeSelectorEvents } from '../settings/ThemeSelector.js';
import { renderTypographyTest } from '../typography/TypographyTest.js';
import { renderPersistenceTest, runPersistenceDiagnostic } from '../persistence/PersistenceTest.js';
import { LibraryView } from '../library/LibraryView.js';
import { PoetryEditor } from '../editor/PoetryEditor.js';
import { PoemReader } from '../reader/PoemReader.js';
import { SearchView } from '../search/SearchView.js';
import { FavoritesView } from '../favorites/FavoritesView.js';
import { ArchiveView } from '../archive/ArchiveView.js';
import { CollectionsView } from '../collections/CollectionsView.js';
import { CollectionDetailView } from '../collections/CollectionDetailView.js';
import { ManuscriptCapture } from '../manuscripts/ManuscriptCapture.js';
import { ManuscriptView } from '../manuscripts/ManuscriptView.js';
import { ManuscriptGallery } from '../manuscripts/ManuscriptGallery.js';
import { ManuscriptTranscription } from '../manuscripts/ManuscriptTranscription.js';
import { InputModeSelector } from '../input/InputModeSelector.js';
import { collectionRepository } from '../../services/CollectionRepository.js';
import { poemRepository } from '../../services/PoemRepository.js';
import { manuscriptRepository } from '../../services/ManuscriptRepository.js';
import { formatPoeticDate } from '../../utils/date.js';

export class AppShell {
  constructor(router) {
    this.router = router;
    this.navigation = new Navigation(router);
    this.container = null;
    this.contentContainer = null;
    this.activeLibraryView = null;
    this.activeEditor = null;
    this.activeReader = null;
    this.activeSearchView = null;
    this.activeFavoritesView = null;
    this.activeArchiveView = null;
    this.activeCollectionsView = null;
    this.activeCollectionDetailView = null;
    this.activeManuscriptCapture = null;
    this.activeManuscriptView = null;
    this.activeManuscriptGallery = null;
    this.activeManuscriptTranscription = null;
    this.activeInputModeSelector = null;
  }

  /**
   * Mounts the persistent application shell into root container
   */
  mount(rootElement) {
    this.container = rootElement;

    // Persistent HTML structure
    this.container.innerHTML = `
      <div class="app-shell">
        <div id="nav-container"></div>
        <main class="content-area" id="main-content" tabindex="-1">
          <div class="container page" id="page-content"></div>
        </main>
      </div>
    `;

    const navContainer = document.getElementById('nav-container');
    this.contentContainer = document.getElementById('page-content');

    const initialPath = this.router.getCurrentPath();
    this.navigation.mount(navContainer, initialPath);
    this.renderRoute(initialPath);

    // Subscribe to router changes
    this.router.init((newPath) => {
      this.navigation.updateActiveRoute(newPath);
      this.renderRoute(newPath);
      this.updateDocumentTitle(newPath);
    });

    // Global keyboard shortcut: Ctrl/Cmd + K to focus/navigate to Search
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.router.getCurrentPath() !== ROUTES.SEARCH) {
          this.router.navigate(ROUTES.SEARCH);
        } else {
          const input = document.getElementById('kavya-search-input');
          if (input) {
            input.focus();
            input.select();
          }
        }
      }
    });
  }

  /**
   * Renders the view corresponding to current route inside the persistent shell
   */
  renderRoute(currentPath) {
    if (!this.contentContainer) return;

    // Cleanup previous view state if active
    if (this.activeLibraryView) {
      this.activeLibraryView.unmount();
      this.activeLibraryView = null;
    }
    if (this.activeEditor) {
      this.activeEditor.unmount();
      this.activeEditor = null;
    }
    if (this.activeReader) {
      this.activeReader.unmount();
      this.activeReader = null;
    }
    if (this.activeSearchView) {
      this.activeSearchView.unmount();
      this.activeSearchView = null;
    }
    if (this.activeFavoritesView) {
      this.activeFavoritesView.unmount();
      this.activeFavoritesView = null;
    }
    if (this.activeArchiveView) {
      this.activeArchiveView.unmount();
      this.activeArchiveView = null;
    }
    if (this.activeCollectionsView) {
      this.activeCollectionsView.unmount();
      this.activeCollectionsView = null;
    }
    if (this.activeCollectionDetailView) {
      this.activeCollectionDetailView.unmount();
      this.activeCollectionDetailView = null;
    }
    if (this.activeManuscriptCapture) {
      this.activeManuscriptCapture.unmount();
      this.activeManuscriptCapture = null;
    }
    if (this.activeManuscriptView) {
      this.activeManuscriptView.unmount();
      this.activeManuscriptView = null;
    }
    if (this.activeManuscriptGallery) {
      this.activeManuscriptGallery.unmount();
      this.activeManuscriptGallery = null;
    }
    if (this.activeManuscriptTranscription) {
      this.activeManuscriptTranscription.unmount();
      this.activeManuscriptTranscription = null;
    }
    if (this.activeInputModeSelector) {
      this.activeInputModeSelector.unmount();
      this.activeInputModeSelector = null;
    }

    // 1. Home / Foyer Screen
    if (currentPath === ROUTES.HOME) {
      this.contentContainer.innerHTML = renderHomeView();
      return;
    }

    // 2. Library Screen (/poems)
    if (currentPath === ROUTES.POEMS) {
      this.activeLibraryView = new LibraryView(this.contentContainer, this.router, 'all');
      this.activeLibraryView.mount();
      return;
    }

    // 3. New Poem Editor (/poems/new)
    if (currentPath === ROUTES.NEW_POEM) {
      this.activeEditor = new PoetryEditor({
        container: this.contentContainer,
        router: this.router,
        poemId: null
      });
      this.activeEditor.mount();
      return;
    }

    // 3b. Scan -> Poem Workflow (/input/scan)
    if (currentPath === ROUTES.INPUT_SCAN || currentPath === '/input/scan') {
      this.activeManuscriptCapture = new ManuscriptCapture({
        container: this.contentContainer,
        router: this.router,
        scanToPoemMode: true
      });
      this.activeManuscriptCapture.mount();
      return;
    }

    // 3c. Modern Input Modes (/input, /input/speak)
    if (currentPath === ROUTES.INPUT_MODES || currentPath.startsWith('/input')) {
      let submode = 'overview';
      if (currentPath === ROUTES.INPUT_SPEAK || currentPath === '/input/speak') {
        submode = 'speak';
      }
      this.activeInputModeSelector = new InputModeSelector({
        container: this.contentContainer,
        router: this.router,
        initialMode: submode
      });
      this.activeInputModeSelector.mount();
      return;
    }

    // 4. Edit Existing Poem (/poems/:id/edit)
    if (currentPath.startsWith('/poems/') && currentPath.endsWith('/edit')) {
      const poemId = currentPath.slice('/poems/'.length, -'/edit'.length);
      if (poemId && poemId !== 'new') {
        this.activeEditor = new PoetryEditor({
          container: this.contentContainer,
          router: this.router,
          poemId
        });
        this.activeEditor.mount();
        return;
      }
    }

    // 5. Real Poem Reader Screen (/poems/:id)
    if (currentPath.startsWith('/poems/') && currentPath !== ROUTES.NEW_POEM && !currentPath.endsWith('/edit')) {
      const poemId = currentPath.slice('/poems/'.length);
      this.activeReader = new PoemReader({
        container: this.contentContainer,
        router: this.router,
        poemId
      });
      this.activeReader.mount();
      return;
    }

    // 6. Search Screen (/search)
    if (currentPath === ROUTES.SEARCH) {
      this.activeSearchView = new SearchView({
        container: this.contentContainer,
        router: this.router
      });
      this.activeSearchView.mount();
      return;
    }

    // 7. Favorites Screen (/favorites)
    if (currentPath === ROUTES.FAVORITES) {
      this.activeFavoritesView = new FavoritesView(this.contentContainer, this.router);
      this.activeFavoritesView.mount();
      return;
    }

    // 8. Archive Screen (/archive)
    if (currentPath === ROUTES.ARCHIVE) {
      this.activeArchiveView = new ArchiveView(this.contentContainer, this.router);
      this.activeArchiveView.mount();
      return;
    }

    // 9. Collections List Screen (/collections)
    if (currentPath === ROUTES.COLLECTIONS) {
      this.activeCollectionsView = new CollectionsView(this.contentContainer, this.router);
      this.activeCollectionsView.mount();
      return;
    }

    // 10. Collection Detail Screen (/collections/:id)
    if (currentPath.startsWith('/collections/') && currentPath !== ROUTES.COLLECTIONS) {
      const collectionId = currentPath.slice('/collections/'.length);
      this.activeCollectionDetailView = new CollectionDetailView({
        container: this.contentContainer,
        router: this.router,
        collectionId
      });
      this.activeCollectionDetailView.mount();
      return;
    }

    // 11. Manuscript Capture Screen (/manuscripts/new & /manuscripts/import)
    if (currentPath === ROUTES.MANUSCRIPT_NEW || currentPath === '/manuscripts/import') {
      this.activeManuscriptCapture = new ManuscriptCapture({
        container: this.contentContainer,
        router: this.router
      });
      this.activeManuscriptCapture.mount();
      return;
    }

    // 12. Manuscript Gallery Screen (/manuscripts)
    if (currentPath === ROUTES.MANUSCRIPTS || currentPath === '/manuscripts') {
      this.activeManuscriptGallery = new ManuscriptGallery({
        container: this.contentContainer,
        router: this.router
      });
      this.activeManuscriptGallery.mount();
      return;
    }

    // 13. Manuscript Transcription Workspace Screen (/manuscripts/:id/transcribe)
    if (currentPath.startsWith('/manuscripts/') && currentPath.endsWith('/transcribe')) {
      const manuscriptId = currentPath.slice('/manuscripts/'.length, -'/transcribe'.length);
      if (manuscriptId && manuscriptId !== 'new') {
        this.activeManuscriptTranscription = new ManuscriptTranscription({
          container: this.contentContainer,
          router: this.router,
          manuscriptId
        });
        this.activeManuscriptTranscription.mount();
        return;
      }
    }

    // 14. Manuscript Archival Detail Screen (/manuscripts/:id)
    if (
      currentPath.startsWith('/manuscripts/') &&
      currentPath !== ROUTES.MANUSCRIPT_NEW &&
      currentPath !== '/manuscripts/import' &&
      !currentPath.endsWith('/transcribe')
    ) {
      const manuscriptId = currentPath.slice('/manuscripts/'.length);
      this.activeManuscriptView = new ManuscriptView({
        container: this.contentContainer,
        router: this.router,
        manuscriptId
      });
      this.activeManuscriptView.mount();
      return;
    }

    // 4. Settings Screen (Theme Switcher & Configuration)
    if (currentPath === ROUTES.SETTINGS) {
      const metadata = ROUTE_METADATA[ROUTES.SETTINGS];
      const headerHtml = renderPageHeader({
        title: metadata.title,
        subtitle: metadata.tagline,
        description: 'काव्यकलश के रूप-रंग और मुद्रण अनुभव को अपनी रुचि अनुसार ढालें।'
      });

      this.contentContainer.innerHTML = `
        <div class="standard-page-view">
          ${headerHtml}
          ${renderThemeSelector()}
        </div>
      `;

      attachThemeSelectorEvents(this.contentContainer);
      return;
    }

    // 3. Typography & Devanagari Test View (Development Diagnostic Route)
    if (currentPath === ROUTES.TYPOGRAPHY_TEST) {
      const metadata = ROUTE_METADATA[ROUTES.TYPOGRAPHY_TEST];
      const headerHtml = renderPageHeader({
        title: metadata.title,
        subtitle: metadata.tagline,
        description: 'देवनागरी मुद्रणकला, मात्रा, संयुक्ताक्षर एवं ऊर्ध्वाधर लय की प्रत्यक्ष जाँच।'
      });

      this.contentContainer.innerHTML = `
        <div class="standard-page-view">
          ${headerHtml}
          ${renderTypographyTest()}
        </div>
      `;
      return;
    }

    // 4. Persistence & Storage Diagnostic View (Development Diagnostic Route)
    if (currentPath === ROUTES.PERSISTENCE_TEST) {
      const metadata = ROUTE_METADATA[ROUTES.PERSISTENCE_TEST];
      const headerHtml = renderPageHeader({
        title: metadata.title,
        subtitle: metadata.tagline,
        description: 'ब्राउज़र स्टोरेज एडेप्टर, रिपॉजिटरी चक्र एवं स्वतः डेटा निष्कासन की जाँच।'
      });

      this.contentContainer.innerHTML = `
        <div class="standard-page-view">
          ${headerHtml}
          ${renderPersistenceTest()}
        </div>
      `;

      runPersistenceDiagnostic(this.contentContainer);
      return;
    }

    // 5. Other Known Standard Routes
    const metadata = ROUTE_METADATA[currentPath];
    if (metadata) {
      const headerHtml = renderPageHeader({
        title: metadata.title,
        subtitle: metadata.tagline,
        description: metadata.placeholder,
        action: currentPath !== ROUTES.NEW_POEM ? `
          <a href="${ROUTES.NEW_POEM}" data-link class="btn-primary-action" aria-label="नई कविता लिखें">
            ${getIconSvg('quill', 'nav-icon')}
            <span>नई कविता</span>
          </a>
        ` : null
      });

      // Semantic empty state for secondary screens awaiting subsequent phase 1 tasks
      const emptyStateHtml = renderEmptyState({
        icon: this.getIconForRoute(currentPath),
        heading: metadata.title,
        text: metadata.placeholder,
        primaryAction: `
          <a href="${ROUTES.HOME}" data-link class="btn-secondary-action" aria-label="मुख्य पृष्ठ पर लौटें">
            ${getIconSvg('home', 'nav-icon')}
            <span>मुख्य द्वार</span>
          </a>
        `
      });

      this.contentContainer.innerHTML = `
        <div class="standard-page-view">
          ${headerHtml}
          ${emptyStateHtml}
        </div>
      `;
      return;
    }

    // 4. Unknown 404 Route Fallback
    this.contentContainer.innerHTML = `
      <div class="standard-page-view">
        ${renderPageHeader({
          title: 'रचना अप्राप्य',
          subtitle: '४०४ पृष्ठ अनुपलब्ध',
          description: 'यह पृष्ठ उपलब्ध नहीं है अथवा इसका मार्ग बदल चुका है।'
        })}
        ${renderEmptyState({
          icon: 'book',
          heading: 'शब्द विलीन हो गए',
          text: 'जिस काव्य पन्ने की आप खोज कर रहे हैं, वह इस संग्रह में उपस्थित नहीं है।',
          primaryAction: `
            <a href="${ROUTES.HOME}" data-link class="btn-primary-action" aria-label="मुख्य पृष्ठ पर लौटें">
              ${getIconSvg('home', 'nav-icon')}
              <span>मुख्य द्वार पर लौटें</span>
            </a>
          `
        })}
      </div>
    `;
  }

  /**
   * Maps routes to appropriate visual icons
   */
  getIconForRoute(path) {
    switch (path) {
      case ROUTES.POEMS: return 'book';
      case ROUTES.FAVORITES: return 'heart';
      case ROUTES.COLLECTIONS: return 'collection';
      case ROUTES.SEARCH: return 'search';
      case ROUTES.MANUSCRIPTS: return 'archive';
      case ROUTES.ARCHIVE: return 'archive';
      case ROUTES.SETTINGS: return 'settings';
      case ROUTES.NEW_POEM: return 'quill';
      default: return 'book';
    }
  }

  /**
   * Updates browser document title
   */
  updateDocumentTitle(path) {
    if (path === ROUTES.MANUSCRIPTS || path === '/manuscripts') {
      document.title = 'पांडुलिपि वीथिका | काव्यकलश (KavyaVault)';
      return;
    }

    if (path === ROUTES.SEARCH) {
      document.title = 'काव्य अन्वेषण | काव्यकलश (KavyaVault)';
      return;
    }

    if (path === ROUTES.FAVORITES) {
      document.title = 'पसंदीदा रचनाएँ | काव्यकलश (KavyaVault)';
      return;
    }

    if (path === ROUTES.ARCHIVE) {
      document.title = 'साहित्यिक अभिलेख | काव्यकलश (KavyaVault)';
      return;
    }

    if (path === ROUTES.COLLECTIONS) {
      document.title = 'काव्य संग्रह | काव्यकलश (KavyaVault)';
      return;
    }

    if (path.startsWith('/collections/') && path !== ROUTES.COLLECTIONS) {
      const collectionId = path.slice('/collections/'.length);
      const collection = collectionRepository.getById(collectionId);
      document.title = collection
        ? `${collection.name} | काव्यकलश (KavyaVault)`
        : 'काव्य संग्रह | काव्यकलश (KavyaVault)';
      return;
    }

    if (path === ROUTES.NEW_POEM) {
      document.title = 'नई रचना | काव्यकलश (KavyaVault)';
      return;
    }

    if (path === ROUTES.MANUSCRIPT_NEW || path === '/manuscripts/import') {
      document.title = 'पांडुलिपि संरक्षण | काव्यकलश (KavyaVault)';
      return;
    }

    if (path.startsWith('/manuscripts/') && path !== ROUTES.MANUSCRIPT_NEW && path !== '/manuscripts/import') {
      const msId = path.slice('/manuscripts/'.length);
      const ms = manuscriptRepository.getById(msId);
      document.title = ms
        ? `${ms.title} | पांडुलिपि | काव्यकलश (KavyaVault)`
        : 'पांडुलिपि | काव्यकलश (KavyaVault)';
      return;
    }

    if (path.startsWith('/poems/') && path.endsWith('/edit')) {
      const id = path.slice('/poems/'.length, -'/edit'.length);
      const poem = poemRepository.getById(id);
      document.title = poem
        ? `संपादित करें: ${poem.title || 'रचना'} | काव्यकलश (KavyaVault)`
        : 'कविता संपादन | काव्यकलश (KavyaVault)';
      return;
    }

    if (path.startsWith('/poems/') && path !== ROUTES.NEW_POEM && !path.endsWith('/edit')) {
      const id = path.slice('/poems/'.length);
      const poem = poemRepository.getById(id);
      if (poem) {
        document.title = `${poem.title || 'रचना'} — ${poem.author || 'अज्ञात'} | काव्यकलश (KavyaVault)`;
        return;
      }
    }

    const meta = ROUTE_METADATA[path];
    if (meta) {
      document.title = `${meta.title} | काव्यकलश (KavyaVault)`;
    } else {
      document.title = `काव्यकलश (KavyaVault) — साहित्यिक धरोहर`;
    }
  }
}
