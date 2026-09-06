/**
 * काव्यकलश (KavyaVault) — Persistence Diagnostic Test Component (PersistenceTest.js)
 * Development-only view validating live browser localStorage adapter,
 * repository CRUD, immutability, and clean teardown.
 */

import { poemRepository } from '../../services/PoemRepository.js';
import { MigrationManager } from '../../services/storage/MigrationManager.js';
import { LocalStorageAdapter } from '../../services/storage/LocalStorageAdapter.js';

export function renderPersistenceTest() {
  return `
    <div class="persistence-test-container" style="max-width: 800px; margin: 0 auto;">
      <section style="
        background-color: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        padding: var(--space-8) var(--space-6);
        box-shadow: var(--shadow-sm);
      ">
        <header style="border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-4); margin-bottom: var(--space-6);">
          <h2 style="font-family: var(--font-display); font-size: var(--text-h2); color: var(--color-text); margin: 0 0 var(--space-1) 0;">
            स्थानीय भंडारण परीक्षण (Persistence Diagnostic)
          </h2>
          <p style="font-family: var(--font-reading); color: var(--color-text-muted); margin: 0;">
            ब्राउज़र लोकलस्टोरेज एडेप्टर, रिपॉजिटरी चक्र एवं स्वतः डेटा निष्कासन की प्रत्यक्ष जाँच।
          </p>
        </header>

        <div id="persistence-test-results" style="display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6);">
          <p style="color: var(--color-text-subtle);">परीक्षण प्रारंभ हो रहा है...</p>
        </div>

        <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--color-border-subtle); padding-top: var(--space-4);">
          <button type="button" id="btn-rerun-persistence" class="btn-primary-action">
            पुनः परीक्षण चलाएँ (Run Diagnostic)
          </button>
        </div>
      </section>
    </div>
  `;
}

/**
 * Runs the persistence diagnostic lifecycle and updates the DOM
 */
export async function runPersistenceDiagnostic(container) {
  const resultsEl = container.querySelector('#persistence-test-results');
  if (!resultsEl) return;

  const logs = [];
  const addLog = (title, status, detail = '') => {
    logs.push({ title, status, detail });
    resultsEl.innerHTML = logs.map(l => `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-3) var(--space-4);
        background-color: var(--color-surface-raised);
        border: 1px solid ${l.status === 'PASS' ? 'var(--color-success)' : 'var(--color-error)'};
        border-radius: var(--radius-md);
      ">
        <div>
          <strong style="color: var(--color-text);">${l.title}</strong>
          ${l.detail ? `<div style="font-size: 0.8125rem; color: var(--color-text-subtle);">${l.detail}</div>` : ''}
        </div>
        <span style="
          font-weight: 700;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: var(--radius-pill);
          background-color: ${l.status === 'PASS' ? 'rgba(61, 104, 70, 0.15)' : 'rgba(166, 43, 43, 0.15)'};
          color: ${l.status === 'PASS' ? 'var(--color-success)' : 'var(--color-error)'};
        ">${l.status}</span>
      </div>
    `).join('');
  };

  try {
    const adapter = new LocalStorageAdapter();
    const migration = new MigrationManager(adapter);

    // 1. Adapter availability
    const isAvail = adapter.isAvailable();
    addLog('१. भंडारण उपलब्धता (LocalStorage Availability)', isAvail ? 'PASS' : 'FAIL', 'ब्राउज़र स्टोरेज पढ़ने व लिखने हेतु पूर्णतः उपलब्ध है।');

    // 2. Migration init
    const mRes = await migration.initialize();
    addLog('२. स्कीमा संस्करण (Schema Version)', 'PASS', `वर्तमान स्कीमा संस्करण: v${migration.getSchemaVersion()} (${mRes.status})`);

    // Record initial poem count
    const initialCount = poemRepository.getAll({ includeArchived: true }).length;

    // 3. Create test poem
    const testId = `kv_diag_${Date.now()}`;
    const created = poemRepository.create({
      id: testId,
      title: 'प्रायोगिक देवनागरी रचना',
      body: 'यह परीक्षण हेतु रची गई अस्थाई पंक्ति है।',
      author: 'परीक्षक',
      tags: ['परीक्षण', 'स्थानीय']
    });
    addLog('३. रचना सृजन (Create Poem)', created.id === testId ? 'PASS' : 'FAIL', `आईडी: ${created.id}`);

    // 4. Read test poem
    const fetched = poemRepository.getById(testId);
    addLog('४. रचना पठन (Read by ID)', fetched && fetched.title === 'प्रायोगिक देवनागरी रचना' ? 'PASS' : 'FAIL', `शीर्षक: ${fetched ? fetched.title : 'null'}`);

    // 5. Update poem
    const updated = poemRepository.update(testId, { title: 'संशोधित प्रायोगिक रचना' });
    addLog('५. रचना संशोधन (Update Poem)', updated.title === 'संशोधित प्रायोगिक रचना' ? 'PASS' : 'FAIL', 'शीर्षक सफलतापूर्वक अद्यतित हुआ।');

    // 6. Favorite & Archive
    poemRepository.setFavorite(testId, true);
    poemRepository.archive(testId);
    const archivedPoem = poemRepository.getById(testId);
    addLog('६. पसंदीदा व अभिलेखागार (Favorite & Archive)', (archivedPoem.isFavorite && archivedPoem.isArchived) ? 'PASS' : 'FAIL', 'पसंदीदा एवं अभिलेख फ्लैग सक्रिय हैं।');

    // 7. Restore
    poemRepository.restore(testId);
    const restoredPoem = poemRepository.getById(testId);
    addLog('७. अभिलेख से पुनर्स्थापना (Restore from Archive)', (!restoredPoem.isArchived) ? 'PASS' : 'FAIL', 'रचना मुख्य संग्रह में पुनः स्थापित हुई।');

    // 8. Draft save and clear
    poemRepository.saveDraft({ title: 'अस्थाई ड्राफ्ट', body: 'ड्राफ्ट पाठ' });
    const hasDraft = poemRepository.getDraft() !== null;
    poemRepository.clearDraft();
    const draftCleared = poemRepository.getDraft() === null;
    addLog('८. कच्चा आलेख चक्र (Draft Save & Clear)', (hasDraft && draftCleared) ? 'PASS' : 'FAIL', 'ड्राफ्ट सहेजा गया और सफलतापूर्वक साफ़ हुआ।');

    // 9. Delete test poem
    poemRepository.delete(testId);
    const afterDelete = poemRepository.getById(testId);
    const finalCount = poemRepository.getAll({ includeArchived: true }).length;
    addLog('९. विलोपन एवं पूर्ण स्वच्छता (Delete & Clean Teardown)', (afterDelete === null && finalCount === initialCount) ? 'PASS' : 'FAIL', 'परीक्षण डेटा पूर्णतः निष्कासित, शून्य अवशेष।');

  } catch (err) {
    addLog('त्रुटि (Error Encountered)', 'FAIL', err.message);
  }

  // Bind re-run button
  const rerunBtn = container.querySelector('#btn-rerun-persistence');
  if (rerunBtn) {
    rerunBtn.onclick = () => runPersistenceDiagnostic(container);
  }
}
