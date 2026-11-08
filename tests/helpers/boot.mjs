// Loads public/index.html in jsdom with stubs for canvas/matchMedia so the page logic can run headlessly.
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
export const tick = (ms) => new Promise((r) => setTimeout(r, ms));

export function boot({ sb, fetchImpl, storage, url = 'https://pipforge.test/', config } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(String((e.detail && e.detail.stack) || e.message)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url, virtualConsole: vc,
    beforeParse(w) {
      const ctx = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 5 }) : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
      w.HTMLCanvasElement.prototype.getContext = () => ctx;
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.IntersectionObserver = class { observe(e) { e.classList.add('in'); } unobserve() {} };
      w.scrollTo = () => {};
      w.fetch = fetchImpl || (() => Promise.reject(new Error('offline')));
      w.addEventListener('error', (e) => errors.push('window.onerror: ' + e.message));
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      if (config) w.PF_CONFIG = config;
      if (sb) w.PF_SB = sb;
    },
  });
  const w = dom.window, d = w.document;
  const $ = (id) => d.getElementById(id);
  const click = (el) => { if (!el) throw new Error('missing element'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); };
  const input = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, d, $, click, input, errors, dom };
}
