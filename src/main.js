/**
 * काव्यकलश (KavyaVault) — मुख्य प्रविष्टि बिंदु (Application Entry Point)
 * 
 * Phase 1: Task 1.5 Application Shell & Home Placeholder
 */

import './styles/main.css';
import './styles/fonts.css';
import { themeService } from './services/theme.js';
import { router } from './services/router.js';
import { AppShell } from './components/layout/AppShell.js';
import { backupService } from './services/storage/BackupService.js';

function initApp() {
  const rootElement = document.getElementById('app');
  if (!rootElement) {
    console.error('[KavyaVault] Root #app element was not found in the DOM.');
    return;
  }
  try { backupService.recoverInterruptedRestore(); }
  catch { rootElement.textContent = 'अधूरी पुनर्स्थापना सुरक्षित पूरी नहीं हो सकी। ब्राउज़र का डेटा न मिटाएँ; अपना बैकअप सुरक्षित रखें।'; return; }
  themeService.init();

  const appShell = new AppShell(router);
  appShell.mount(rootElement);

  console.info('[KavyaVault] Application Shell & Home Foyer mounted.');
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {
    console.warn('ऑफ़लाइन कैश उपलब्ध नहीं है। ऐप ऑनलाइन उपयोग किया जा सकता है।');
  }));
}

// Bootstrap once DOM content is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
