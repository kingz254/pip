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

test('tenant install prompt uses tenant name and theme colors', () => {
  const dom = new JSDOM('<!doctype html><html class="tenant"><head></head><body></body></html>', {
    url: 'https://brand.example/', runScripts: 'outside-only',
  });
  const { window } = dom;
  window.__PF_SITE_BRANDING__ = { name: 'Brand Trades' };
  window.document.documentElement.style.setProperty('--pf-client-accent', '#123456');
  window.eval(readFileSync(new URL('../public/pwa-install.js', import.meta.url), 'utf8'));
  const event = new window.Event('beforeinstallprompt', { cancelable: true });
  event.prompt = async () => {};
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  const dialog = window.document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /Install Brand Trades/);
  assert.equal(dialog.style.getPropertyValue('--pwa-accent'), '#123456');
  dom.window.close();
});
