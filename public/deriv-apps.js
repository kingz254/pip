(function () {
  'use strict';
  var routes = { home: ['/apps/bot/#dashboard', 'Dashboard'], bld: ['/apps/bot/#bot_builder', 'Bot Builder'],
    ana: ['/apps/digits/', 'Digit Analysis'], smt: ['/apps/digits/?mode=smart', 'Smart Trading'],
    acc: ['/apps/accumulators/', 'Accumulators'], cht: ['/apps/rise-fall/', 'Charts'], tut: ['/apps/bot/#tutorial', 'Tutorials'] };
  var frame = null, current = '', observer = null, childObserver = null, botRunning = false;
  var accounts = [];
  function applyBranding(site) {
    if (!frame || !frame.contentDocument || !site) return;
    var doc = frame.contentDocument;
    if (!doc.head) return;
    var style = doc.getElementById('pipforge-client-branding') || doc.createElement('style');
    var brand = getComputedStyle(site), font = brand.fontFamily, accent = brand.getPropertyValue('--a1').trim();
    var hex = accent.match(/^#([\da-f]{3}|[\da-f]{6})$/i), accentRgb = '0 195 144';
    if (hex) { var value = hex[1]; if (value.length === 3) value = value.replace(/./g, function (c) { return c + c; }); accentRgb = [0, 2, 4].map(function (i) { return parseInt(value.slice(i, i + 2), 16); }).join(' '); }
    var glass = brand.getPropertyValue('--sb').trim() || 'rgba(127,127,127,.08)', edge = brand.getPropertyValue('--sl').trim() || 'rgba(127,127,127,.18)';
    var rgb = brand.color.match(/[\d.]+/g) || [], dark = rgb.length >= 3 && (Number(rgb[0]) + Number(rgb[1]) + Number(rgb[2])) / 3 > 145;
    var theme = site.dataset.clientTheme || (dark ? 'dark' : 'light'), name = site.querySelector('.s-name')?.textContent || 'Client site';
    dark = theme === 'dark';
    doc.title = name;
    doc.documentElement.dataset.pfTheme = theme;
    doc.documentElement.dataset.pfTab = current;
    doc.documentElement.style.setProperty('--pf-client-ink', brand.color);
    doc.documentElement.style.setProperty('--pf-client-muted', brand.getPropertyValue('--sm').trim());
    doc.documentElement.style.setProperty('--pf-client-glass', glass);
    doc.documentElement.style.setProperty('--pf-client-edge', edge);
    doc.documentElement.style.setProperty('--pf-client-accent', accent);
    doc.documentElement.classList.toggle('dark', dark);
    // An iframe gets an opaque (white) canvas when its document's color-scheme differs from the embedding
    // element's. Bot-app never declares one, so it defaults to light while the client site is dark. Match both.
    frame.style.colorScheme = theme;
    doc.documentElement.style.colorScheme = theme;
    if (!doc.__pfThemeObserver && doc.defaultView) {
      doc.__pfThemeObserver = new doc.defaultView.MutationObserver(function () {
        doc.documentElement.classList.toggle('dark', doc.documentElement.dataset.pfTheme === 'dark');
      });
      doc.__pfThemeObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
    style.id = 'pipforge-client-branding';
    style.textContent = 'header,.app-header,.dc-tabs__list,footer{display:none!important}html,body,#root,.layout,.main-body,.main,.main__container,.dc-tabs__content{font-family:'+font+'!important;background:transparent!important;color:var(--pf-client-ink)!important;min-height:0!important}html,body,#root,.layout{height:100%!important;overflow:hidden!important}.layout{min-height:0!important}.main-body,.main,.main__container,.dc-tabs__content{min-height:0!important;max-height:100%!important}html[data-pf-theme] .bg-background,html[data-pf-theme] .bg-card,html[data-pf-theme] .bg-muted,html[data-pf-theme] .bg-popover,html[data-pf-theme] .bg-secondary,html[data-pf-theme] .bg-accent,html[data-pf-theme] [class*="bg-background/"],html[data-pf-theme] [class*="bg-card/"]{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(18px) saturate(135%)!important;-webkit-backdrop-filter:blur(18px) saturate(135%)!important}html[data-pf-theme] .text-foreground,html[data-pf-theme] .text-card-foreground,html[data-pf-theme] .text-popover-foreground{color:var(--pf-client-ink)!important}html[data-pf-theme] .text-muted-foreground{color:var(--pf-client-muted)!important}html[data-pf-theme] .cq-context,html[data-pf-theme] .ciq-chart-area,html[data-pf-theme] .ciq-chart,html[data-pf-theme] .cq-chart-title,html[data-pf-theme] .cq-symbol-select-btn,html[data-pf-theme] .cq-menu-btn,html[data-pf-theme] .sc-dialog,html[data-pf-theme] .sc-mcd{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(18px) saturate(135%)!important;-webkit-backdrop-filter:blur(18px) saturate(135%)!important}html[data-pf-theme="light"] .flutter-chart{mix-blend-mode:multiply!important}html[data-pf-theme="dark"] .flutter-chart{mix-blend-mode:screen!important}:root{--brand-primary:'+accent+';--brand-red-coral:'+accent+';--primary:'+accentRgb+';--ring:'+accentRgb+';--a1:'+accent+';--font-family:'+font+'}';
    style.textContent += 'html[data-pf-theme] main>div[class*="max-w-"]{width:100%!important;max-width:100%!important;box-sizing:border-box!important}body.theme--light,body.theme--dark{--general-main-1:transparent;--general-main-2:transparent;--general-main-3:transparent;--general-main-4:transparent;--general-section-1:var(--pf-client-glass);--general-section-2:var(--pf-client-glass);--general-section-3:var(--pf-client-glass);--general-section-4:var(--pf-client-glass);--general-section-5:var(--pf-client-glass);--general-section-6:var(--pf-client-glass);--general-hover:var(--pf-client-glass);--general-active:var(--pf-client-edge);--text-general:var(--pf-client-ink);--text-prominent:var(--pf-client-ink);--text-less-prominent:var(--pf-client-muted);--text-primary:var(--pf-client-ink);--text-hint:var(--pf-client-muted);--brand-red-coral:var(--pf-client-accent);--brand-primary:var(--pf-client-accent)}.bot-dashboard,.tab__dashboard,.tab__dashboard__content,.bot-builder,.tutorials-wrap{background:transparent!important;color:var(--pf-client-ink)!important}.bot-dashboard,.bot-builder,.tutorials-wrapper,.tutorials-mobile{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}.tutorials-wrapper,.tutorials-mobile__guide{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(18px) saturate(135%)!important;-webkit-backdrop-filter:blur(18px) saturate(135%)!important}html[data-pf-tab="home"] .bot-builder,html[data-pf-tab="tut"] .bot-builder{display:none!important}html[data-pf-tab="home"] .db-info-panel,html[data-pf-tab="home"] #modal_root:has(.db-info-panel){display:none!important}html[data-pf-tab="home"] .tab__dashboard,html[data-pf-tab="home"] .tab__dashboard__content{height:100%!important;min-height:0!important}html[data-pf-tab="home"] .tab__dashboard__content{display:flex!important;align-items:center!important;padding:24px clamp(24px,7vw,112px)!important}.tab__dashboard__content .quick-panel{width:min(100%,1120px);max-width:1120px;margin:auto}html[data-pf-tab="bld"] .bot-builder{inset:0!important;top:0!important;inset-inline-start:0!important;width:100%!important;height:100%!important}html[data-pf-tab="bld"] #scratch_div,html[data-pf-tab="bld"] .injectionDiv{width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important}html[data-pf-tab="bld"] .blocklySvg,html[data-pf-tab="bld"] .blocklyWorkspace,html[data-pf-tab="bld"] .blocklyMainBackground{background:transparent!important;fill:transparent!important}html[data-pf-tab="bld"] .theme--dark .zelos-renderer.zelos_renderer-theme .blocklyMainBackground{fill:transparent!important}html[data-pf-tab="bld"] .blocklyFlyoutBackground,html[data-pf-tab="bld"] .blocklyDropDownDiv,html[data-pf-tab="bld"] .db-toolbox,html[data-pf-tab="bld"] .db-toolbox__content,html[data-pf-tab="bld"] .gtm-toolbox,html[data-pf-tab="bld"] .db-sidebar,html[data-pf-tab="bld"] .run-panel,html[data-pf-tab="bld"] .dc-drawer{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(18px) saturate(135%)!important;-webkit-backdrop-filter:blur(18px) saturate(135%)!important}';
    style.textContent += 'html[data-pf-theme] main{min-height:100dvh!important}html[data-pf-tab="tut"] .tutorials-wrapper{max-height:calc(100dvh - 32px)!important;overflow:auto!important}';
    doc.head.appendChild(style);
    if (doc.body) Object.entries({'--general-main-1':'transparent','--general-main-2':'transparent','--general-main-3':'transparent','--general-section-1':glass,'--general-section-2':glass,'--general-section-3':glass,'--general-section-4':glass,'--general-section-5':glass,'--general-section-6':glass,'--text-general':brand.color,'--text-prominent':brand.color,'--text-less-prominent':brand.getPropertyValue('--sm').trim(),'--brand-primary':accent,'--brand-red-coral':accent}).forEach(function (entry) { doc.body.style.setProperty(entry[0], entry[1], 'important'); });
    frame.contentWindow.postMessage({ type: 'PF_SITE_BRANDING', theme: theme, name: name, accent: accent, font: font }, window.location.origin);
    if (doc.body && !doc.__pfLoaderObserver && doc.defaultView) {
      var syncLoader = function () { if (window.__pfTemplateLoading) window.__pfTemplateLoading(current, !!doc.querySelector('.initial-loader,.dc-loader')); };
      childObserver = new doc.defaultView.MutationObserver(syncLoader);
      childObserver.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-busy'] });
      doc.__pfLoaderObserver = childObserver;
      syncLoader();
    }
  }
  function renderAccount(mode) {
    var id=localStorage.getItem('active_loginid');
    var selected=accounts.find(function(a){return mode?a.account_type===mode:a.account_id===id;}) || (!mode&&accounts.find(function(a){return a.account_type==='demo';}));
    var balance=document.getElementById('account-balance-value'),label=document.getElementById('account-type-label');
    if(selected){localStorage.setItem('active_loginid',selected.account_id);localStorage.setItem('account_type',selected.account_type);}
    if(balance)balance.textContent=selected?String(selected.balance)+' '+selected.currency:'—';
    if(label)label.textContent=selected?selected.account_type.toUpperCase()+' ACCOUNT':'CONNECT YOUR ACCOUNT';
    document.querySelectorAll('#site [data-account-mode]').forEach(function(button){button.setAttribute('aria-pressed',String(!!selected&&button.dataset.accountMode===selected.account_type));});
  }
  async function refreshAccount() {
    try { var response=await fetch('/api/deriv/accounts',{cache:'no-store'}); accounts=response.ok?(await response.json()).data:[];renderAccount(); }
    catch(ignore){renderAccount();}
  }
  window.addEventListener('DOMContentLoaded',refreshAccount);
  window.addEventListener('message', function(event){
    if(event.origin===window.location.origin && frame && event.source===frame.contentWindow && event.data && event.data.type==='pf:bot-running')botRunning=event.data.running===true;
  });
  document.addEventListener('click',function(event){
    var login=event.target.closest('#site #account-connect,#site .s-acts .s-pill,#site .s-acts .s-sign');
    if(login){event.preventDefault();event.stopImmediatePropagation();var url=new URL('/api/deriv/login',window.location.origin);url.searchParams.set('return',window.location.href);if(login.classList.contains('s-sign'))url.searchParams.set('signup','1');window.location.assign(url.href);return;}
    var account=event.target.closest('#site [data-account-mode]');
    if(account){event.preventDefault();event.stopImmediatePropagation();renderAccount(account.dataset.accountMode);if(frame)frame.src=frame.src;return;}
    var target=event.target.closest('#stabs [data-tab]');
    if(target && current==='bld' && target.dataset.tab!=='bld' && botRunning){
      if(!window.confirm('Leave Bot Builder and stop its strategy? Existing open contracts remain on your Deriv account.')){event.preventDefault();event.stopImmediatePropagation();}
      else botRunning=false;
    }
  },true);
  window.PipforgeApps = {
    setTheme: function (site) { applyBranding(site); },
    show: function (tab, site) {
      var route = routes[tab];
      if (!route) { if (childObserver) childObserver.disconnect(); if (frame) frame.remove(); frame = null; current = ''; site.classList.remove('pf-template-active'); return false; }
      var panel = site.querySelector('[data-pn="' + tab + '"]');
      if (!panel) return false;
      site.classList.add('pf-template-active');
      if (current === tab && frame && frame.parentNode === panel) { applyBranding(site); return true; }
      if (childObserver) childObserver.disconnect();
      if (frame) frame.remove();
      frame = document.createElement('iframe');
      frame.className = 'pf-template-frame'; frame.title = route[1]; frame.src = route[0];
      if (window.__pfLoadedFrames) window.__pfLoadedFrames[tab] = false;
      if (window.__pfShowPageLoader) window.__pfShowPageLoader(tab);
      frame.setAttribute('allow', 'fullscreen; clipboard-write');
      frame.referrerPolicy = 'same-origin';
      frame.addEventListener('load',function(){
        if(window.__pfFrameLoaded)window.__pfFrameLoaded(tab);
        applyBranding(site);
      });
      panel.classList.add('pf-template-panel'); panel.appendChild(frame); current = tab;
      if (!observer) {
        observer = new MutationObserver(function () {
          if (frame && !site.querySelector('[data-pn="' + current + '"]').classList.contains('on')) {
            frame.remove(); frame = null; current = '';
          }
        });
        observer.observe(site.querySelector('.s-main'), { subtree: true, attributes: true, attributeFilter: ['class'] });
      }
      return true;
    }
  };
})();
