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
import { setActiveLibraryUid, guestHasLibrary } from './services/storage/LibraryWorkspace.js';
import { cloudLibraryService } from './services/cloud/CloudLibraryService.js';
import { startAutoSync } from './services/cloud/AutoSyncService.js';
import { mountWelcomeScreen } from './components/welcome/WelcomeScreen.js';
import { showGuestMigration } from './components/welcome/GuestMigration.js';
import { ProfileService } from './services/cloud/ProfileService.js';

function initApp(user) {
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
  const indicator = document.getElementById('sync-indicator');
  if (user) {
    const sync = startAutoSync(user.uid);
    const profile = new ProfileService(user.uid);
    profile.load().then(() => profile.flush()).catch(() => {});
    window.addEventListener('online', () => profile.flush().catch(() => {}));
    sync.subscribe(state => { indicator.textContent = `☁ ${state.status} · ${state.pending} pending`; });
    let refreshTimer;
    window.addEventListener('kavyakalash:library-updated', () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        const path = router.getCurrentPath();
        if ([`/poems`, `/books`, `/manuscripts`, `/profile`].includes(path)) appShell.renderRoute(path);
      }, 300);
    });
    if (guestHasLibrary()) {
      if (sync.mode !== 'on') showGuestMigration(user.uid);
      let stop;
      stop = sync.subscribe(state => {
        if (state.ready || state.status.startsWith('Error:')) { stop?.(); showGuestMigration(user.uid); }
      });
    }
  } else indicator.textContent = 'अतिथि · इस डिवाइस पर सहेजा गया / Guest · Saved locally';

  console.info('[KavyaVault] Application Shell & Home Foyer mounted.');
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {
    console.warn('ऑफ़लाइन कैश उपलब्ध नहीं है। ऐप ऑनलाइन उपयोग किया जा सकता है।');
  }));
}

// Bootstrap once DOM content is parsed
function start() {
  const root = document.getElementById('app');
  root.textContent = 'काव्यकलश खुल रहा है… / Opening Kavyakalash…';
  let first = true;
  let currentUid = null;
  const authTimeout = setTimeout(() => { if (first) handleUser(null); }, 15000);
  const handleUser = user => {
    clearTimeout(authTimeout);
    const uid = user?.uid || null;
    if (!first && currentUid !== uid) { location.reload(); return; }
    if (!first) return;
    first = false;
    currentUid = uid;
    setActiveLibraryUid(uid);
    if (!uid && !guestHasLibrary() && !localStorage.getItem('kavyavault:welcome-choice')) {
      mountWelcomeScreen(root, () => { localStorage.setItem('kavyavault:welcome-choice', 'guest'); initApp(null); });
    } else initApp(user);
  };
  cloudLibraryService.observe(handleUser, () => handleUser(null));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
