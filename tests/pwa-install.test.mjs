import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

test('Pipforge install prompt confirms installation once', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://pipforge.example/',
    runScripts: 'outside-only',
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false });
      Object.defineProperty(window.navigator, 'serviceWorker', { value: { register: async () => ({}) } });
    },
  });
  const { window } = dom;
  window.eval(readFileSync(new URL('../public/pwa-install.js', import.meta.url), 'utf8'));
  const installEvent = new window.Event('beforeinstallprompt', { cancelable: true });
  installEvent.prompt = async () => {};
  installEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(installEvent);
  assert.match(window.document.querySelector('[role="dialog"]').textContent, /Install Pipforge/);
  window.dispatchEvent(new window.Event('appinstalled'));
  assert.match(window.document.querySelector('[role="dialog"]').textContent, /Pipforge is installed/);
  window.document.querySelector('.pf-pwa-action').click();
  assert.equal(window.localStorage.getItem('pf_pwa_install_confirmed'), 'true');
  assert.equal(window.document.querySelector('[role="dialog"]'), null);
  dom.window.close();
});
