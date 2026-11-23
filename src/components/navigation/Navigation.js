/**
 * काव्यकलश (KavyaVault) — Navigation Shell Component
 * Renders Desktop Sidebar, Mobile Top Header, Mobile Bottom Nav, and Mobile Drawer.
 * Single source of truth driven by src/data/navigation.js.
 */

import './navigation.css';
import {
  ROUTES,
  DESKTOP_PRIMARY_ITEMS,
  DESKTOP_SECONDARY_ITEMS,
  DESKTOP_ACTION_ITEM,
  MOBILE_NAV_ITEMS,
  MOBILE_DRAWER_ITEMS
} from '../../data/navigation.js';
import { getIconSvg } from './icons.js';

export class Navigation {
  constructor(router) {
    this.router = router;
    this.isDrawerOpen = false;
    this.container = null;
  }

  /**
   * Generates the desktop sidebar HTML
   */
  renderDesktopSidebar(currentPath) {
    const renderLink = (item) => {
      const isActive = currentPath === item.path;
      return `
        <li>
          <a
            href="${item.path}"
            class="nav-link"
            data-link
            data-route="${item.path}"
            ${isActive ? 'aria-current="page"' : ''}
            title="${item.description || item.label}"
          >
            ${getIconSvg(item.icon, 'nav-icon')}
            <span class="nav-link-text">${item.label}</span>
          </a>
        </li>
      `;
    };

    return `
      <aside class="nav-sidebar" aria-label="मुख्य डेस्कटॉप साइडबार">
        <a href="${ROUTES.POEMS}" class="sidebar-brand" data-link aria-label="मेरी कविताएँ">
          <span class="brand-title">काव्यकलश</span>
          <span class="brand-subtitle">Kavyakalash</span>
          <span class="brand-tagline">साहित्यिक धरोहर व पुस्तकालय</span>
        </a>

        <nav aria-label="मुख्य अनुभाग" class="nav-group">
          <span class="nav-group-title">काव्य वाटिका</span>
          <ul class="nav-group" role="list">
            ${DESKTOP_PRIMARY_ITEMS.map(renderLink).join('')}
          </ul>
        </nav>

        <hr class="sidebar-divider" />

        <nav aria-label="अतिरिक्त अनुभाग" class="nav-group">
          <span class="nav-group-title">व्यवस्था</span>
          <ul class="nav-group" role="list">
            ${DESKTOP_SECONDARY_ITEMS.map(renderLink).join('')}
          </ul>
        </nav>

        <div class="sidebar-footer">
          <a
            href="${DESKTOP_ACTION_ITEM.path}"
            class="btn-new-poem-desktop"
            data-link
            data-route="${DESKTOP_ACTION_ITEM.path}"
            ${currentPath === DESKTOP_ACTION_ITEM.path ? 'aria-current="page"' : ''}
            title="${DESKTOP_ACTION_ITEM.description}"
          >
            ${getIconSvg(DESKTOP_ACTION_ITEM.icon, 'nav-icon')}
            <span>${DESKTOP_ACTION_ITEM.label}</span>
          </a>
        </div>
      </aside>
    `;
  }

  /**
   * Generates the mobile top header HTML
   */
  renderMobileHeader() {
    return `
      <header class="mobile-header" aria-label="मोबाइल शीर्ष शीर्षक">
        <a href="${ROUTES.POEMS}" class="mobile-brand" data-link aria-label="मेरी कविताएँ">
          <span class="mobile-brand-title">काव्यकलश</span>
          <span class="mobile-brand-tagline">साहित्यिक धरोहर व पुस्तकालय</span>
        </a>
        <button
          type="button"
          class="btn-drawer-toggle"
          id="btn-drawer-toggle"
          aria-label="अतिरिक्त मेनू खोलें"
          aria-expanded="false"
          aria-controls="mobile-drawer"
        >
          ${getIconSvg('menu', 'nav-icon')}
        </button>
      </header>
    `;
  }

  /**
   * Generates the mobile bottom navigation bar HTML
   */
  renderMobileBottomNav(currentPath) {
    const itemsHtml = MOBILE_NAV_ITEMS.map(item => {
      const isActive = currentPath === item.path;

      if (item.isAction) {
        return `
          <a
            href="${item.path}"
            class="mobile-action-item"
            data-link
            data-route="${item.path}"
            ${isActive ? 'aria-current="page"' : ''}
            aria-label="${item.label}"
            title="${item.label}"
          >
            <span class="mobile-action-button">
              ${getIconSvg(item.icon, 'nav-icon')}
            </span>
            <span class="mobile-action-label">${item.mobileLabel || item.label}</span>
          </a>
        `;
      }

      return `
        <a
          href="${item.path}"
          class="mobile-nav-item"
          data-link
          data-route="${item.path}"
          ${isActive ? 'aria-current="page"' : ''}
          aria-label="${item.label}"
        >
          ${getIconSvg(item.icon, 'nav-icon')}
          <span>${item.mobileLabel || item.label}</span>
        </a>
      `;
    }).join('');

    return `
      <nav class="mobile-nav" aria-label="मोबाइल निचला नेविगेशन">
        ${itemsHtml}
      </nav>
    `;
  }

  /**
   * Generates the mobile secondary drawer HTML
   */
  renderMobileDrawer(currentPath) {
    const drawerLinks = MOBILE_DRAWER_ITEMS.map(item => {
      const isActive = currentPath === item.path;
      return `
        <li>
          <a
            href="${item.path}"
            class="nav-link"
            data-link
            data-route="${item.path}"
            ${isActive ? 'aria-current="page"' : ''}
          >
            ${getIconSvg(item.icon, 'nav-icon')}
            <span class="nav-link-text">${item.label}</span>
          </a>
        </li>
      `;
    }).join('');

    return `
      <div
        class="mobile-drawer-backdrop"
        id="drawer-backdrop"
        tabindex="-1"
        aria-hidden="true"
      ></div>
      <aside
        class="mobile-drawer"
        id="mobile-drawer"
        role="dialog"
        aria-label="अतिरिक्त साहित्यिक विकल्प"
        aria-modal="true"
        aria-hidden="true"
      >
        <div class="drawer-header">
          <span class="drawer-title">काव्य अनुभाग</span>
          <button
            type="button"
            class="btn-drawer-close"
            id="btn-drawer-close"
            aria-label="मेनू बंद करें"
          >
            ${getIconSvg('close', 'nav-icon')}
          </button>
        </div>
        <ul class="nav-group" role="list">
          ${drawerLinks}
        </ul>
      </aside>
    `;
  }

  /**
   * Initial mount of navigation elements into target container
   */
  mount(container, initialPath) {
    this.container = container;
    this.render(initialPath);
    this.attachEventListeners();
  }

  /**
   * Renders the complete navigation shell
   */
  render(currentPath) {
    if (!this.container) return;

    this.container.innerHTML = `
      ${this.renderDesktopSidebar(currentPath)}
      ${this.renderMobileHeader()}
      ${this.renderMobileBottomNav(currentPath)}
      ${this.renderMobileDrawer(currentPath)}
    `;
  }

  /**
   * Attaches drawer and keyboard listeners
   */
  attachEventListeners() {
    // Drawer open button
    const openBtn = document.getElementById('btn-drawer-toggle');
    const closeBtn = document.getElementById('btn-drawer-close');
    const backdrop = document.getElementById('drawer-backdrop');

    if (openBtn) {
      openBtn.addEventListener('click', () => this.openDrawer());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeDrawer());
    }

    // Escape key listener for closing mobile drawer
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isDrawerOpen) {
        this.closeDrawer();
      }
    });
  }

  /**
   * Opens the mobile secondary drawer
   */
  openDrawer() {
    this.isDrawerOpen = true;
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const toggleBtn = document.getElementById('btn-drawer-toggle');

    if (drawer && backdrop) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Closes the mobile secondary drawer
   */
  closeDrawer() {
    this.isDrawerOpen = false;
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const toggleBtn = document.getElementById('btn-drawer-toggle');

    if (drawer && backdrop) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Updates active state on all navigation links when route changes
   */
  updateActiveRoute(currentPath) {
    if (this.isDrawerOpen) {
      this.closeDrawer();
    }

    // Select all links with data-route attribute
    const allLinks = document.querySelectorAll('[data-route]');
    allLinks.forEach(link => {
      const route = link.getAttribute('data-route');
      if (route === currentPath) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }
}
