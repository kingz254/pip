(() => {
  const key = 'pf_pwa_installed';
  const confirmedKey = 'pf_pwa_install_confirmed';
  let installPrompt;
  let dialog;
  const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || localStorage.getItem(key) === 'true';
  const close = () => {
    if (!dialog) return;
    if (dialog.dataset.installed === 'true') localStorage.setItem(confirmedKey, 'true');
    else sessionStorage.setItem('pf_pwa_dismissed', 'true');
    dialog.remove(); dialog = null;
  };
  const show = isInstalled => {
    if (dialog || (isInstalled ? localStorage.getItem(confirmedKey) === 'true' : sessionStorage.getItem('pf_pwa_dismissed') === 'true')) return;
    dialog = document.createElement('section');
    dialog.className = 'pf-pwa-prompt';
    dialog.dataset.installed = String(isInstalled);
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = `<button class="pf-pwa-close" aria-label="Close">×</button><div class="pf-pwa-icon">${isInstalled ? '↗' : 'P'}</div><div class="pf-pwa-copy"><strong>${isInstalled ? 'Pipforge is installed' : 'Install Pipforge'}</strong><p>${isInstalled ? 'Launch it from your home screen or app list for the full experience.' : 'Add Pipforge to your home screen for quick access.'}</p><button class="pf-pwa-action">${isInstalled ? 'Got it' : 'Install'}</button></div>`;
    document.body.append(dialog);
    dialog.querySelector('.pf-pwa-close').addEventListener('click', close);
    dialog.querySelector('.pf-pwa-action').addEventListener('click', async () => {
      if (isInstalled) return close();
      const prompt = installPrompt;
      if (!prompt) return close();
      dialog.remove(); dialog = null; installPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome !== 'accepted') sessionStorage.setItem('pf_pwa_dismissed', 'true');
    });
  };
  const style = document.createElement('style');
  style.textContent = '.pf-pwa-prompt{position:fixed;z-index:100000;left:20px;right:20px;bottom:24px;max-width:720px;margin:auto;display:flex;gap:18px;align-items:flex-start;padding:26px 32px;border:2px solid #858995;border-radius:28px;background:#fff;color:#17202e;box-shadow:0 16px 55px #1115;font:16px/1.5 system-ui,sans-serif}.pf-pwa-icon{display:grid;place-items:center;flex:none;width:64px;height:64px;border-radius:18px;background:#f3f5f9;color:#ff444f;font-size:32px;font-weight:800}.pf-pwa-copy{flex:1}.pf-pwa-copy strong{font-size:24px}.pf-pwa-copy p{margin:6px 24px 18px 0;color:#667382}.pf-pwa-action{padding:10px 20px;border:1px solid #e8edf2;border-radius:16px;background:#fff;color:#667382;font:inherit;font-weight:700;cursor:pointer}.pf-pwa-close{position:absolute;right:16px;top:12px;border:0;background:transparent;color:#667382;font-size:28px;cursor:pointer}@media(max-width:520px){.pf-pwa-prompt{left:12px;right:12px;bottom:14px;padding:22px 18px;border-radius:22px}.pf-pwa-icon{width:52px;height:52px}.pf-pwa-copy strong{font-size:20px}}';
  document.head.append(style);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (installed()) { localStorage.setItem(key, 'true'); show(true); }
  window.addEventListener('beforeinstallprompt', event => {
    if (installed()) return;
    event.preventDefault(); installPrompt = event; show(false);
  });
  window.addEventListener('appinstalled', () => {
    localStorage.setItem(key, 'true');
    if (dialog) { dialog.remove(); dialog = null; }
    show(true);
  });
})();
