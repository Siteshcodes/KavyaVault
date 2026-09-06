/**
 * काव्यकलश (KavyaVault) — मुख्य प्रविष्टि बिंदु (Application Entry Point)
 * 
 * Phase 1: Task 1.5 Application Shell & Home Placeholder
 */

import './styles/main.css';
import { themeService } from './services/theme.js';
import { router } from './services/router.js';
import { AppShell } from './components/layout/AppShell.js';

// Synchronous theme initialization before DOM render to prevent flashing
themeService.init();

function initApp() {
  const rootElement = document.getElementById('app');
  if (!rootElement) {
    console.error('[KavyaVault] Root #app element was not found in the DOM.');
    return;
  }

  const appShell = new AppShell(router);
  appShell.mount(rootElement);

  console.info('[KavyaVault] Application Shell & Home Foyer mounted.');
}

// Bootstrap once DOM content is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
