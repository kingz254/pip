(() => {
  const host = location.hostname.toLowerCase();
  const tenant = () => document.documentElement.classList.contains('tenant') && window.__PF_SITE_BRANDING__;
  const key = (suffix) => `pf_pwa_${suffix}:${host}`;
  let deferredPrompt;
  let dialog;
  let installed = localStorage.getItem(key('installed')) === 'true';

  const close = () => {
    if (installed) localStorage.setItem('pf_pwa_install_confirmed', 'true');
    else localStorage.setItem(key('dismissed'), 'true');
    dialog?.remove();
    dialog = null;
  };

  const show = (isInstalled = false) => {
    if (dialog) dialog.remove();
    const brand = tenant();
    const name = brand?.name || 'Pipforge';
    const root = getComputedStyle(document.documentElement);
    dialog = document.createElement('section');
    dialog.className = 'pf-pwa-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', isInstalled ? `${name} is installed` : `Install ${name}`);
    dialog.innerHTML = `<div class="pf-pwa-card"><button class="pf-pwa-close" type="button" aria-label="Close">×</button><div class="pf-pwa-mark" aria-hidden="true">↗</div><div><h2></h2><p></p></div><button class="pf-pwa-action" type="button"></button></div>`;
    dialog.style.setProperty('--pwa-glass', root.getPropertyValue('--pf-client-glass').trim() || root.getPropertyValue('--glass').trim() || 'rgba(255,255,255,.94)');
    dialog.style.setProperty('--pwa-ink', root.getPropertyValue('--pf-client-ink').trim() || root.getPropertyValue('--ink').trim() || '#172033');
    dialog.style.setProperty('--pwa-accent', root.getPropertyValue('--pf-client-accent').trim() || root.getPropertyValue('--red').trim() || '#ff444f');
    dialog.style.setProperty('--pwa-edge', root.getPropertyValue('--pf-client-edge').trim() || root.getPropertyValue('--edge').trim() || '#cbd0d8');
    dialog.style.setProperty('--pwa-blur', root.getPropertyValue('--pf-client-blur').trim() || '18px');
    dialog.querySelector('h2').textContent = isInstalled ? `${name} is installed` : `Install ${name}`;
    dialog.querySelector('p').textContent = isInstalled ? 'Launch it from your home screen or app list for the full experience.' : `Add ${name} to your home screen for quick access.`;
    dialog.querySelector('.pf-pwa-action').textContent = isInstalled ? 'Got it' : 'Install';
    dialog.querySelector('.pf-pwa-close').addEventListener('click', close);
    dialog.querySelector('.pf-pwa-action').addEventListener('click', async () => {
      if (isInstalled) return close();
      if (!deferredPrompt) return close();
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice.outcome === 'accepted') {
        installed = true;
        localStorage.setItem(key('installed'), 'true');
        show(true);
      } else close();
    });
    document.body.append(dialog);
  };

  const style = document.createElement('style');
  style.textContent = '.pf-pwa-dialog{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:#080b1299;color:var(--pwa-ink);font:inherit}.pf-pwa-card{position:relative;display:grid;grid-template-columns:64px 1fr;align-items:center;gap:16px;width:min(100%,560px);padding:26px 24px;border:1px solid var(--pwa-edge);border-radius:24px;background:var(--pwa-glass);color:var(--pwa-ink);backdrop-filter:blur(var(--pwa-blur)) saturate(145%);-webkit-backdrop-filter:blur(var(--pwa-blur)) saturate(145%);box-shadow:0 20px 70px #0005}.pf-pwa-card h2{margin:0 28px 6px 0;font-size:1.35rem}.pf-pwa-card p{margin:0;line-height:1.45;opacity:.78}.pf-pwa-mark{display:grid;width:64px;height:64px;place-items:center;border-radius:18px;background:color-mix(in srgb,var(--pwa-accent) 12%,transparent);color:var(--pwa-accent);font-size:32px}.pf-pwa-action{grid-column:2;justify-self:start;min-height:44px;padding:0 24px;border:0;border-radius:12px;background:var(--pwa-accent);color:#fff;font:inherit;font-weight:700;cursor:pointer}.pf-pwa-close{position:absolute;top:10px;right:12px;border:0;background:transparent;color:var(--pwa-ink);font-size:28px;cursor:pointer}@media(max-width:520px){.pf-pwa-card{grid-template-columns:48px 1fr;gap:12px;padding:22px 16px}.pf-pwa-mark{width:48px;height:48px}.pf-pwa-card h2{font-size:1.12rem}.pf-pwa-action{grid-column:1/-1}}';
  document.head.append(style);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const showPrompt = () => { if (!installed && localStorage.getItem(key('dismissed')) !== 'true') show(); };
    if (document.documentElement.classList.contains('tenant') && !window.__PF_SITE_BRANDING__) window.addEventListener('pf:tenant-ready', showPrompt, { once: true });
    else showPrompt();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    localStorage.setItem(key('installed'), 'true');
    localStorage.removeItem(key('dismissed'));
    show(true);
  });
})();
