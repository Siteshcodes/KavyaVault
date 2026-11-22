import { backupService, MAX_BACKUP_BYTES } from '../../services/storage/BackupService.js';

export function renderBackupPanel() {
  return `<section class="backup-panel" aria-labelledby="backup-heading">
    <h2 id="backup-heading">अपना लेखन सुरक्षित रखें</h2>
    <p>अपनी कविताओं, पुस्तकों, प्रारूपों और पांडुलिपियों की प्रति डाउनलोड करें। इसे ब्राउज़र से अलग सुरक्षित स्थान पर रखें।</p>
    <div class="backup-actions">
      <button type="button" class="btn-primary-action" id="backup-download">पूरा बैकअप डाउनलोड करें</button>
    </div>
    <details class="settings-details">
      <summary>बैकअप से वापस लाएँ</summary>
      <p>यह इस ब्राउज़र की मौजूदा लाइब्रेरी को चुने गए बैकअप से बदल देगा।</p>
      <div class="backup-actions">
      <label class="btn-secondary-action backup-file-label" for="backup-file">बैकअप फ़ाइल चुनें</label>
      <input type="file" id="backup-file" accept=".json,application/json" aria-label="बैकअप JSON फ़ाइल चुनें" />
      </div>
      <div id="backup-review" hidden>
      <p id="backup-summary"></p>
      <p>पुनर्स्थापना इस ब्राउज़र की मौजूदा लाइब्रेरी को बदल देगी। पहले वर्तमान बैकअप डाउनलोड करें और काव्यकलश के अन्य टैब बंद करें। समान आईडी वाली प्रतियाँ अलग से नहीं जोड़ी जाएँगी।</p>
      <label><input type="checkbox" id="backup-ack" /> मैंने वर्तमान बैकअप सुरक्षित किया है और अन्य टैब बंद किए हैं।</label>
      <button type="button" class="btn-primary-action" id="backup-restore" disabled>पूरी लाइब्रेरी पुनर्स्थापित करें</button>
      </div>
    </details>
    <p id="backup-status" role="status" aria-live="polite"></p>
  </section>`;
}

export function attachBackupEvents(container) {
  const find = id => container.querySelector(`#${id}`);
  const status = find('backup-status');
  let text = null;
  let generation = 0;
  find('backup-download').addEventListener('click', async () => {
    const button = find('backup-download'); button.disabled = true;
    try {
      const data = await backupService.exportBackup();
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `kavyavault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'बैकअप डाउनलोड शुरू हुआ। फ़ाइल को सुरक्षित स्थान पर रखें।';
    } catch { status.textContent = 'बैकअप नहीं बन सका। ब्राउज़र भंडारण की उपलब्धता जाँचें।'; }
    finally { button.disabled = false; }
  });
  find('backup-file').addEventListener('change', async event => {
    const request = ++generation;
    text = null; find('backup-review').hidden = true; find('backup-restore').disabled = true; find('backup-ack').checked = false;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('बैकअप 40 MB से छोटा होना चाहिए।');
      const candidate = await file.text();
      const { counts } = await backupService.inspectBackup(candidate);
      if (request !== generation) return;
      text = candidate;
      find('backup-summary').textContent = `${counts.poems} कविताएँ · ${counts.manuscripts} पांडुलिपियाँ · ${counts.collections} संग्रह · ${counts.books} पुस्तकें`;
      find('backup-review').hidden = false; status.textContent = 'बैकअप की संरचना और अखंडता जाँच सफल रही।';
    } catch (error) { if (request === generation) status.textContent = error.message; }
  });
  find('backup-ack').addEventListener('change', event => { find('backup-restore').disabled = !text || !event.target.checked; });
  find('backup-restore').addEventListener('click', async () => {
    if (!text || !find('backup-ack').checked) return;
    if (!window.confirm('इस ब्राउज़र की मौजूदा लाइब्रेरी को चुने गए बैकअप से बदलें?')) return;
    find('backup-restore').disabled = true;
    try { await backupService.restoreBackup(text); location.reload(); }
    catch (error) { status.textContent = error.message; find('backup-restore').disabled = false; }
  });
}
