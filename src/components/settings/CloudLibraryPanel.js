import { cloudLibraryService } from '../../services/cloud/CloudLibraryService.js';
import { backupService } from '../../services/storage/BackupService.js';

export function cloudErrorMessage(error) {
  const messages = {
    'auth/popup-blocked': 'पॉपअप रोक दिया गया। ब्राउज़र में पॉपअप की अनुमति दें और फिर प्रयास करें। / Allow popups and try again.',
    'auth/popup-closed-by-user': 'प्रवेश रद्द हुआ। / Sign-in was cancelled.',
    'auth/unauthorized-domain': 'यह वेबसाइट Firebase Authentication में अधिकृत नहीं है। / This domain is not authorized for sign-in.',
    'auth/operation-not-allowed': 'Firebase में Google प्रवेश सक्षम नहीं है। / Google sign-in is not enabled.',
    'auth/network-request-failed': 'नेटवर्क उपलब्ध नहीं है। स्थानीय लेखन जारी रख सकते हैं। / Check your connection; offline writing still works.',
    'permission-denied': 'क्लाउड पहुँच अस्वीकृत हुई। खाते और सुरक्षा नियम जाँचें। / Cloud access was denied.'
  };
  return messages[error?.code] || error?.message || 'क्लाउड सेवा उपलब्ध नहीं है। / Cloud service is unavailable.';
}

export function renderCloudLibraryPanel() {
  return `<section class="backup-panel" aria-labelledby="cloud-heading">
    <h2 id="cloud-heading">Google खाता और क्लाउड प्रति</h2>
    <p>आपकी लाइब्रेरी इस ब्राउज़र में रहती है। उसी ब्राउज़र के दूसरे Google खाते को भी यह स्थानीय प्रति दिख सकती है। प्रवेश के बाद अपनी खाते वाली क्लाउड प्रति स्वयं अपलोड या वापस ला सकते हैं। यह अभी अपने आप सिंक नहीं होती।</p>
    <p id="cloud-account">खाता जाँचा जा रहा है…</p>
    <button type="button" class="btn-secondary-action" id="cloud-sign-in" hidden>Google से प्रवेश करें</button>
    <div id="cloud-controls" hidden>
      <p id="cloud-info"></p>
      <div class="backup-actions">
        <button type="button" class="btn-secondary-action" id="cloud-upload">इस ब्राउज़र की प्रति क्लाउड में रखें</button>
        <button type="button" class="btn-secondary-action" id="cloud-download">क्लाउड प्रति यहाँ लाएँ</button>
        <button type="button" class="btn-secondary-action" id="cloud-sign-out">खाते से बाहर जाएँ</button>
      </div>
      <div id="cloud-review" hidden>
        <p id="cloud-summary"></p>
        <p>यह इस ब्राउज़र की लाइब्रेरी बदल देगा। पहले ऊपर से पूरा बैकअप डाउनलोड करें और दूसरे टैब बंद करें।</p>
        <label><input type="checkbox" id="cloud-ack" /> मैंने वर्तमान बैकअप सुरक्षित किया है और अन्य टैब बंद किए हैं।</label>
        <button type="button" class="btn-primary-action" id="cloud-restore" disabled>क्लाउड प्रति पुनर्स्थापित करें</button>
      </div>
    </div>
    <p id="cloud-status" role="status" aria-live="polite"></p>
  </section>`;
}

export function attachCloudLibraryEvents(container) {
  const find = id => container.querySelector(`#${id}`);
  const status = find('cloud-status');
  if (!cloudLibraryService.configured) {
    find('cloud-account').textContent = 'Google सेवा अभी कॉन्फ़िगर नहीं है। स्थानीय लेखन और बैकअप उपलब्ध हैं।';
    return () => {};
  }
  let candidate = null, busy = false, currentUid = null;
  const clearCandidate = () => { candidate = null; find('cloud-review').hidden = true; find('cloud-ack').checked = false; find('cloud-restore').disabled = true; };
  const run = async (action, timeoutMs = 0) => {
    if (busy) return;
    busy = true;
    for (const id of ['cloud-sign-in', 'cloud-upload', 'cloud-download', 'cloud-sign-out', 'cloud-restore']) find(id).disabled = true;
    status.textContent = 'कृपया प्रतीक्षा करें…';
    let timer;
    try {
      await (timeoutMs ? Promise.race([
        action(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('प्रवेश में बहुत समय लग रहा है। पॉपअप बंद करके फिर प्रयास करें। / Sign-in timed out; close the popup and try again.')), timeoutMs); })
      ]) : action());
      if (status.textContent === 'कृपया प्रतीक्षा करें…') status.textContent = '';
    }
    catch (error) { status.textContent = cloudErrorMessage(error); }
    finally {
      if (timer) clearTimeout(timer);
      busy = false;
      for (const id of ['cloud-sign-in', 'cloud-upload', 'cloud-download', 'cloud-sign-out']) find(id).disabled = false;
      find('cloud-restore').disabled = !candidate || !find('cloud-ack').checked;
    }
  };
  const unsubscribe = cloudLibraryService.observe(async user => {
    if (!container.isConnected) { unsubscribe(); return; }
    if (currentUid !== user?.uid) clearCandidate();
    currentUid = user?.uid || null;
    find('cloud-sign-in').hidden = !!user;
    find('cloud-controls').hidden = !user;
    find('cloud-account').textContent = user ? `खाता: ${user.email || user.displayName || 'Google'}` : 'अभी Google खाते से जुड़े नहीं हैं।';
    if (!user) { find('cloud-info').textContent = ''; return; }
    try {
      const info = await cloudLibraryService.cloudInfo();
      if (currentUid === user.uid) find('cloud-info').textContent = info.exists ? `क्लाउड प्रति: ${new Date(info.updatedAt).toLocaleString('hi-IN')}` : 'इस खाते में अभी कोई क्लाउड प्रति नहीं है।';
    } catch (error) { if (currentUid === user.uid) status.textContent = cloudErrorMessage(error); }
  });
  find('cloud-sign-in').addEventListener('click', () => run(() => cloudLibraryService.signIn(), 90000));
  find('cloud-sign-out').addEventListener('click', () => run(() => cloudLibraryService.signOut()));
  find('cloud-upload').addEventListener('click', () => run(async () => {
    clearCandidate();
    const info = await cloudLibraryService.cloudInfo();
    if (!window.confirm(info.exists ? 'इस खाते की पिछली क्लाउड प्रति बदलें? पहले उसे दूसरे ब्राउज़र में डाउनलोड कर लें।' : 'इस ब्राउज़र की पूरी लाइब्रेरी क्लाउड में रखें?')) return;
    const saved = await cloudLibraryService.upload();
    find('cloud-info').textContent = `क्लाउड प्रति: ${new Date(saved.updatedAt).toLocaleString('hi-IN')}`;
    status.textContent = 'क्लाउड प्रति सुरक्षित की गई।';
  }));
  find('cloud-download').addEventListener('click', () => run(async () => {
    clearCandidate();
    const result = await cloudLibraryService.download();
    candidate = { ...result, uid: currentUid };
    find('cloud-summary').textContent = `${result.counts.poems} कविताएँ · ${result.counts.manuscripts} पांडुलिपियाँ · ${result.counts.collections} संग्रह · ${result.counts.books} पुस्तकें`;
    find('cloud-review').hidden = false;
    status.textContent = 'क्लाउड प्रति जाँची गई। नीचे समीक्षा करें।';
  }));
  find('cloud-ack').addEventListener('change', () => { find('cloud-restore').disabled = !candidate || !find('cloud-ack').checked || busy; });
  find('cloud-restore').addEventListener('click', () => run(async () => {
    if (!candidate || candidate.uid !== cloudLibraryService.user?.uid || !find('cloud-ack').checked) return;
    if (!window.confirm('इस ब्राउज़र की लाइब्रेरी क्लाउड प्रति से बदलें?')) return;
    await backupService.restoreBackup(candidate.text);
    location.reload();
  }));
  return unsubscribe;
}
