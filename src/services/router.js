/**
 * काव्यकलश (KavyaVault) — Lightweight Client-Side Router
 * Handles browser history (pushState, popstate), link interception, and active route subscription.
 */

import { ROUTES } from '../data/navigation.js';

class Router {
  constructor() {
    this.routes = Object.values(ROUTES);
    this.currentPath = this.normalizePath(window.location.pathname);
    this.listeners = new Set();
    this.initialized = false;
  }

  /**
   * Normalizes URLs, stripping trailing slashes except for root
   */
  normalizePath(pathname) {
    if (!pathname || pathname === '') return '/';
    const trimmed = pathname.replace(/\/+$/, '');
    return trimmed === '' ? '/' : trimmed;
  }

  /**
   * Validates if a route is recognized
   */
  isValidRoute(path) {
    if (!path) return false;
    const [cleanPath] = path.split('?');
    return this.routes.includes(cleanPath);
  }

  /**
   * Initializes router listeners
   */
  init(callback) {
    if (callback) {
      this.subscribe(callback);
    }

    if (this.initialized) return;

    // Handle browser back and forward buttons
    window.addEventListener('popstate', () => {
      this.currentPath = this.normalizePath(window.location.pathname);
      this.notify();
    });

    // Global click listener for internal route navigation links
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-link]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (href && href.startsWith('/')) {
        event.preventDefault();
        this.navigate(href);
      }
    });

    this.initialized = true;
    this.notify();
  }

  /**
   * Navigates to a specific path
   */
  navigate(path, replace = false) {
    const targetPath = this.normalizePath(path);
    if (targetPath === this.currentPath && !replace) return;

    if (replace) {
      window.history.replaceState({}, '', targetPath);
    } else {
      window.history.pushState({}, '', targetPath);
    }

    this.currentPath = targetPath;
    this.notify();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Subscribes a callback to route change events
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifies all subscribers of current route
   */
  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.currentPath);
      } catch (err) {
        console.error('[KavyaVault Router] Listener error:', err);
      }
    }
  }

  /**
   * Retrieves current active path
   */
  getCurrentPath() {
    return this.currentPath;
  }
}

export const router = new Router();
