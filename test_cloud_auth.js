import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudErrorMessage } from './src/components/settings/CloudLibraryPanel.js';

test('Firebase sign-in failures give actionable bilingual errors', () => {
  for (const code of ['auth/popup-blocked', 'auth/unauthorized-domain', 'auth/operation-not-allowed', 'auth/network-request-failed']) {
    const message = cloudErrorMessage({ code });
    assert.match(message, /[\u0900-\u097f]/);
    assert.match(message, /[a-zA-Z]{4,}/);
  }
  assert.match(cloudErrorMessage({ message: 'backup failed' }), /backup failed/);
});
