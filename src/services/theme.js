/**
 * काव्यकलश (KavyaVault) — Theme Service (theme.js)
 * Manages the four approved literary themes, persistence (kavyavault:theme),
 * and live DOM attribute synchronization.
 */

export const THEMES = [
  {
    id: 'bhojpatra',
    name: 'भोजपत्र',
    enName: 'Bhojpatra',
    description: 'पुराने पन्नों और स्याही की गर्माहट',
    metaThemeColor: '#FAF6EE',
    isDark: false,
    colors: {
      bg: '#FAF6EE',
      surface: '#F3EDE0',
      text: '#2C221E',
      accent: '#B84A29'
    }
  },
  {
    id: 'syahi',
    name: 'स्याही',
    enName: 'Syahi',
    description: 'रात और लेखन की गहराई',
    metaThemeColor: '#121316',
    isDark: true,
    colors: {
      bg: '#121316',
      surface: '#1A1C22',
      text: '#EAE4D9',
      accent: '#D4AF37'
    }
  },
  {
    id: 'khaddar',
    name: 'खद्दर',
    enName: 'Khaddar',
    description: 'प्राकृतिक, सादा और स्पर्शपूर्ण',
    metaThemeColor: '#F4F3EE',
    isDark: false,
    colors: {
      bg: '#F4F3EE',
      surface: '#EAE8E0',
      text: '#273238',
      accent: '#A0472E'
    }
  },
  {
    id: 'velvet-night',
    name: 'मखमली रात',
    enName: 'Velvet Night',
    description: 'गहरी नीली रात में शांत पाठ',
    metaThemeColor: '#0F141C',
    isDark: true,
    colors: {
      bg: '#0F141C',
      surface: '#171E2B',
      text: '#C5CFDE',
      accent: '#6886B3'
    }
  }
];

const STORAGE_KEY = 'kavyavault:theme';
const DEFAULT_THEME_ID = 'bhojpatra';

class ThemeService {
  constructor() {
    this.validThemeIds = new Set(THEMES.map(t => t.id));
    this.currentThemeId = DEFAULT_THEME_ID;
    this.listeners = new Set();
  }

  /**
   * Initializes theme synchronously on application startup
   */
  init() {
    let savedThemeId = null;
    try {
      savedThemeId = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn('[KavyaVault Theme] Could not access localStorage:', e);
    }

    // Validate saved preference, fallback to bhojpatra if missing or corrupted
    if (savedThemeId && this.validThemeIds.has(savedThemeId)) {
      this.currentThemeId = savedThemeId;
    } else {
      this.currentThemeId = DEFAULT_THEME_ID;
    }

    this.applyTheme(this.currentThemeId);
    return this.currentThemeId;
  }

  /**
   * Returns list of all approved themes
   */
  getThemes() {
    return THEMES;
  }

  /**
   * Returns the currently active theme identifier
   */
  getCurrentTheme() {
    return this.currentThemeId;
  }

  /**
   * Returns the theme object for the currently active theme
   */
  getCurrentThemeConfig() {
    return THEMES.find(t => t.id === this.currentThemeId) || THEMES[0];
  }

  /**
   * Changes active theme and persists preference
   */
  setTheme(themeId) {
    if (!this.validThemeIds.has(themeId)) {
      console.warn(`[KavyaVault Theme] Unknown theme "${themeId}", falling back to ${DEFAULT_THEME_ID}`);
      themeId = DEFAULT_THEME_ID;
    }

    this.currentThemeId = themeId;
    this.applyTheme(themeId);

    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch (e) {
      console.warn('[KavyaVault Theme] Could not persist theme preference:', e);
    }

    this.notify();
  }

  /**
   * Applies the theme to the root HTML element and mobile browser bar
   */
  applyTheme(themeId) {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);

    // Update meta theme-color tag for seamless mobile status bar integration
    const themeConfig = THEMES.find(t => t.id === themeId);
    if (themeConfig) {
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.name = 'theme-color';
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute('content', themeConfig.metaThemeColor);
    }
  }

  /**
   * Subscribes to theme changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifies subscribers of theme change
   */
  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentThemeId);
      } catch (err) {
        console.error('[KavyaVault Theme] Listener error:', err);
      }
    }
  }
}

export const themeService = new ThemeService();
