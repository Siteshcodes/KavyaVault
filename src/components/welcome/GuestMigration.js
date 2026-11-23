import { BackupService } from '../../services/storage/BackupService.js';
import { scopedStorage } from '../../services/storage/LibraryWorkspace.js';
import { ARRAY_KINDS, RECORD_KINDS } from '../../services/cloud/recordKinds.js';
import { cloudLibraryService } from '../../services/cloud/CloudLibraryService.js';

export function mergeGuestRecords(raw, uid) {
  const account = scopedStorage(raw);
  const added = {};
  for (const [kind, key] of Object.entries(RECORD_KINDS)) {
    const guestRaw = raw.getItem(key);
    if (guestRaw === null) continue;
    if (!ARRAY_KINDS.has(kind)) {
      if (account.getItem(key) === null) { account.setItem(key, guestRaw); added[kind] = 1; }
      continue;
    }
    const guest = JSON.parse(guestRaw);
    const current = JSON.parse(account.getItem(key) || '[]');
    if (!Array.isArray(guest) || !Array.isArray(current)) throw new Error('अमान्य स्थानीय संग्रह। / Invalid local library.');
    const byId = new Map(current.map(item => [item.id, item]));
    const next = [...current];
    for (const item of guest) {
      if (!item?.id) continue;
      const existing = byId.get(item.id);
      if (existing && JSON.stringify(existing) === JSON.stringify(item)) continue;
      const copy = existing ? { ...item, id: `${item.id}_guest_${crypto.randomUUID()}` } : item;
      if (existing && typeof copy.title === 'string') copy.title += ' (अतिथि प्रति / Guest copy)';
      next.push(copy); byId.set(copy.id, copy);
      added[kind] = (added[kind] || 0) + 1;
    }
    if (next.length !== current.length) account.setItem(key, JSON.stringify(next));
  }
  return added;
}

export function showGuestMigration(uid) {
  const marker = `kavyavault:migration:${uid}`;
  if (localStorage.getItem(marker)) return;
  const overlay = document.createElement('div');
  overlay.className = 'migration-overlay';
  overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="migration-title" class="migration-dialog">
    <h2 id="migration-title">अतिथि रचनाएँ मिलीं / Guest writing found</h2>
    <p>आपका अतिथि लेखन इस डिवाइस पर अलग सुरक्षित है। इसे इस Google खाते की लाइब्रेरी में मिलाएँ, अलग रखें, या प्रवेश रद्द करें। कुछ भी अपने आप नहीं मिटाया जाएगा।</p>
    <button id="migration-backup" class="btn-secondary-action">पहले अतिथि बैकअप डाउनलोड करें / Download recovery backup</button>
    <label><input type="checkbox" id="migration-ack" disabled /> मैंने बैकअप सुरक्षित किया है / I saved the backup</label>
    <div class="migration-actions"><button id="migration-merge" class="btn-primary-action" disabled>रचनाएँ मिलाएँ / Merge</button><button id="migration-separate" class="btn-secondary-action">अलग रखें / Keep separate</button><button id="migration-cancel" class="btn-secondary-action">प्रवेश रद्द / Cancel</button></div>
    <p id="migration-status" role="status"></p></section>`;
  document.body.append(overlay);
  const find = id => overlay.querySelector(`#${id}`);
  find('migration-backup').onclick = async () => {
    try {
      const text = await new BackupService(localStorage).exportBackup();
      await new BackupService(localStorage).inspectBackup(text);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `kavyakalash-guest-recovery-${new Date().toISOString().slice(0, 10)}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      find('migration-ack').disabled = false;
      find('migration-status').textContent = 'बैकअप डाउनलोड हुआ। फ़ाइल सुरक्षित रखने की पुष्टि करें। / Confirm the downloaded file is saved.';
    } catch (error) { find('migration-status').textContent = error.message; }
  };
  find('migration-ack').onchange = () => { find('migration-merge').disabled = !find('migration-ack').checked; };
  find('migration-merge').onclick = () => {
    try {
      mergeGuestRecords(localStorage, uid);
      localStorage.setItem(marker, 'merged');
      overlay.remove(); location.reload();
    } catch (error) { find('migration-status').textContent = error.message; }
  };
  find('migration-separate').onclick = () => { localStorage.setItem(marker, 'separate'); overlay.remove(); };
  find('migration-cancel').onclick = () => cloudLibraryService.signOut();
  find('migration-backup').focus();
}
