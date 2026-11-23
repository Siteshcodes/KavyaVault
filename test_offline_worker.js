import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('offline worker leaves Firebase auth and config requests to Hosting', async () => {
  const handlers = {};
  const cache = { match: async () => ({ source: 'app shell' }) };
  const context = {
    self: { location: { origin: 'https://kavyavault-1a3ce.web.app' }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: { open: async () => cache }, fetch: async () => ({ source: 'network' }), URL
  };
  vm.runInNewContext(readFileSync('dist/sw.js', 'utf8'), context);
  const dispatch = async (pathname, mode = 'navigate') => {
    let response;
    handlers.fetch({ request: { url: `https://kavyavault-1a3ce.web.app${pathname}`, method: 'GET', mode }, respondWith: promise => { response = promise; } });
    return response && (await response).source;
  };
  assert.equal(await dispatch('/__/auth/handler?providerId=google.com'), undefined);
  assert.equal(await dispatch('/__/firebase/init.json', 'cors'), undefined);
  assert.equal(await dispatch('/settings'), 'app shell');
});
