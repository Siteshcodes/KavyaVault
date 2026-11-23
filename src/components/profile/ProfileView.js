import './profile.css';
import { scopedStorage, onLibraryChange } from '../../services/storage/LibraryWorkspace.js';
import { profileStats, ageFromBirthDate, readRows } from './profileModel.js';
import { ProfileService } from '../../services/cloud/ProfileService.js';
import { getAutoSync } from '../../services/cloud/AutoSyncService.js';
import { RECORD_KINDS, ARRAY_KINDS } from '../../services/cloud/recordKinds.js';

export function mountProfileView(container, user) {
  container.innerHTML = `<div class="profile-page">
    <header class="profile-header"><div id="profile-avatar" class="profile-avatar" aria-hidden="true"></div><div><p class="profile-eyebrow">My Profile / मेरी प्रोफ़ाइल</p><h1 id="profile-name">मेरी प्रोफ़ाइल</h1><p id="profile-email"></p></div></header>
    <section class="profile-card"><h2>मेरी जानकारी / About me</h2><form id="profile-form">
      <label>नाम / Display name <input id="profile-display-name" maxlength="100" autocomplete="name" /></label>
      <label>कलम नाम / Pen name <input id="profile-pen-name" maxlength="100" /></label>
      <label>जन्मतिथि / Date of birth (private) <input id="profile-birth-date" type="date" /></label>
      <p id="profile-age"></p>
      <label>परिचय / Biography <textarea id="profile-bio" maxlength="1000" rows="4"></textarea></label>
      <button class="btn-primary-action" type="submit">जानकारी सहेजें / Save profile</button>
    </form><p id="profile-message" role="status" aria-live="polite"></p></section>
    <section class="profile-card"><h2>मेरा साहित्य / My library</h2><div id="profile-stats" class="profile-stats"></div></section>
    <section class="profile-card"><h2>कूड़ेदान / Recover deleted writing</h2><p>हटाई गई रचनाएँ यहाँ से वापस लाई जा सकती हैं। / Deleted records can be restored here.</p><div id="profile-trash"></div></section>
    <section class="profile-card"><h2>खाता / Account</h2><p id="profile-created"></p><p id="profile-sync"></p><a href="/settings" data-link>सिंक, बैकअप और खाता सेटिंग्स / Sync and account settings</a></section>
  </div>`;
  const find = id => container.querySelector(`#${id}`);
  const initials = (user.displayName || user.email || 'क').trim().slice(0, 1).toUpperCase();
  find('profile-avatar').textContent = initials;
  if (user.photoURL && /^https:\/\//.test(user.photoURL)) {
    const picture = document.createElement('img'); picture.src = user.photoURL; picture.alt = '';
    picture.referrerPolicy = 'no-referrer';
    picture.onerror = () => picture.remove();
    find('profile-avatar').append(picture);
  }
  find('profile-email').textContent = user.email || '';
  find('profile-created').textContent = `खाता बनाया / Account created: ${user.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('hi-IN') : '—'}`;
  const service = new ProfileService(user.uid);
  const showProfile = profile => {
    find('profile-display-name').value = profile.displayName || user.displayName || '';
    find('profile-pen-name').value = profile.penName || '';
    find('profile-bio').value = profile.bio || '';
    find('profile-birth-date').value = profile.birthDate || '';
    find('profile-name').textContent = profile.penName || profile.displayName || user.displayName || 'मेरी प्रोफ़ाइल';
    find('profile-age').textContent = ageFromBirthDate(profile.birthDate) === null ? '' : `उम्र / Age: ${ageFromBirthDate(profile.birthDate)}`;
  };
  showProfile(service.local);
  service.load().then(profile => { if (container.isConnected) showProfile(profile); });
  const updateStats = () => {
    const stats = profileStats();
    find('profile-stats').replaceChildren();
    for (const [label, value] of [['कविताएँ / Poems', stats.poems], ['पुस्तकें / Books', stats.books], ['पांडुलिपियाँ / Manuscripts', stats.manuscripts], ['संग्रह / Collections', stats.collections], ['प्रारूप / Drafts', stats.drafts], ['संग्रहित / Archived', stats.archived]]) {
      const item = document.createElement('div'); item.className = 'profile-stat';
      const number = document.createElement('strong'); number.textContent = String(value);
      const title = document.createElement('span'); title.textContent = label;
      item.append(number, title); find('profile-stats').append(item);
    }
  };
  updateStats();
  const renderTrash = () => {
    const target = find('profile-trash'); target.replaceChildren();
    const prefix = `kavyavault:trash:${user.uid}:`;
    const keys = [];
    for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index); if (key?.startsWith(prefix)) keys.push(key); }
    if (!keys.length) { target.textContent = 'कूड़ेदान खाली है। / Trash is empty.'; return; }
    for (const key of keys) {
      let record;
      try { record = JSON.parse(localStorage.getItem(key)); } catch { continue; }
      const kind = key.slice(prefix.length).split(':')[0];
      if (!ARRAY_KINDS.has(kind) || !record?.id) continue;
      const row = document.createElement('div'); row.className = 'profile-trash-row';
      const label = document.createElement('span'); label.textContent = `${record.title || record.name || record.id} · ${kind}`;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-secondary-action'; button.textContent = 'वापस लाएँ / Restore';
      button.addEventListener('click', () => {
        const storage = scopedStorage();
        const field = RECORD_KINDS[kind];
        const rows = readRows(storage, field);
        const restored = rows.some(item => item.id === record.id) ? { ...record, id: `${record.id}_restored_${crypto.randomUUID()}` } : record;
        storage.setItem(field, JSON.stringify([...rows, restored]));
        localStorage.removeItem(key);
        renderTrash(); updateStats();
      });
      row.append(label, button); target.append(row);
    }
  };
  renderTrash();
  const stopStats = onLibraryChange(change => { if (change.uid === user.uid) { updateStats(); renderTrash(); } });
  const stopSync = getAutoSync()?.subscribe(state => { find('profile-sync').textContent = `सिंक / Sync: ${state.status} · Last successful sync: ${state.lastSync ? new Date(state.lastSync).toLocaleString('hi-IN') : '—'}`; });
  const form = find('profile-form');
  const save = async event => {
    event.preventDefault();
    try {
      const profile = await service.save({ displayName: find('profile-display-name').value, penName: find('profile-pen-name').value,
        bio: find('profile-bio').value, birthDate: find('profile-birth-date').value });
      showProfile(profile);
      find('profile-message').textContent = navigator.onLine && getAutoSync()?.mode === 'on' ? 'प्रोफ़ाइल सहेजी गई। / Profile saved.' : 'इस डिवाइस पर सहेजा गया। सिंक चालू होने पर अपलोड होगा। / Saved locally; uploads when sync is enabled.';
    } catch (error) { find('profile-message').textContent = error.message; }
  };
  form.addEventListener('submit', save);
  const reconnect = () => service.flush().catch(() => {});
  window.addEventListener('online', reconnect);
  return () => { stopStats(); stopSync?.(); form.removeEventListener('submit', save); window.removeEventListener('online', reconnect); };
}
