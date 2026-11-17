(function () {
  'use strict';
  var routes = { home: ['/apps/bot/#dashboard', 'Dashboard'], bld: ['/apps/bot/#bot_builder', 'Bot Builder'],
    ana: ['/apps/digits/', 'Digit Analysis'], smt: ['/apps/digits/?mode=smart', 'Smart Trading'],
    acc: ['/apps/accumulators/', 'Accumulators'], cht: ['/apps/rise-fall/', 'Charts'] };
  var frame = null, current = '', observer = null, childObserver = null, botRunning = false;
  var accounts = [], derivAuthenticated = false;
  function addDashboardTools(doc) {
    if (current !== 'home' || !doc.querySelector('.tab__dashboard__content') || doc.querySelector('.pf-dashboard-tools')) return;
    var tools = doc.createElement('section');
    tools.className = 'pf-dashboard-tools';
    tools.setAttribute('aria-label', 'Explore your trading workspace');
    tools.innerHTML = '<h2>Explore more tools</h2><div class="pf-dashboard-tools__grid"><button type="button" data-pf-client-tab="frb"><span>✦</span><b>Free bot library</b><small>Browse starter strategies you can edit.</small><i>Explore →</i></button><button type="button" data-pf-client-tab="ana"><span>◷</span><b>Live analysis</b><small>Review live ticks and digit statistics.</small><i>Open analysis →</i></button><button type="button" data-pf-client-tab="cht"><span>⌁</span><b>Market charts</b><small>Follow price movement on a live chart.</small><i>View charts →</i></button><button type="button" data-pf-client-tab="blk"><span>▧</span><b>Bulk trades</b><small>Estimate the total stake for a batch.</small><i>Calculate exposure →</i></button></div>';
    tools.addEventListener('click', function (event) {
      var button = event.target.closest('[data-pf-client-tab]');
      if (button) { var destination = window.parent.document.querySelector('#stabs [data-tab="' + button.dataset.pfClientTab + '"]'); if (destination) destination.click(); }
    });
    var tiles = doc.querySelector('#tab__dashboard__table__tiles');
    (tiles ? tiles.parentNode : doc.querySelector('.tab__dashboard__content .quick-panel')).insertBefore(tools, tiles ? tiles.nextSibling : null);
  }
  function applyBranding(site) {
    if (!frame || !frame.contentDocument || !site) return;
    var doc = frame.contentDocument;
    if (!doc.head) return;
    var style = doc.getElementById('pipforge-client-branding') || doc.createElement('style');
    var brand = getComputedStyle(site), font = brand.fontFamily, accent = brand.getPropertyValue('--a1').trim();
    var hex = accent.match(/^#([\da-f]{3}|[\da-f]{6})$/i), accentRgb = '0 195 144';
    if (hex) { var value = hex[1]; if (value.length === 3) value = value.replace(/./g, function (c) { return c + c; }); accentRgb = [0, 2, 4].map(function (i) { return parseInt(value.slice(i, i + 2), 16); }).join(' '); }
    var glass = brand.getPropertyValue('--sb').trim() || 'rgba(127,127,127,.08)', edge = brand.getPropertyValue('--sl').trim() || 'rgba(127,127,127,.18)', blur = brand.getPropertyValue('--pf-client-blur').trim() || '18px';
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
    doc.documentElement.style.setProperty('--pf-client-blur', blur);
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
    style.textContent = 'header,.app-header,.dc-tabs__list,footer{display:none!important}html,body,#root,.layout,.main-body,.main,.main__container,.dc-tabs__content{font-family:'+font+'!important;background:transparent!important;color:var(--pf-client-ink)!important;min-height:0!important}html,body,#root,.layout{height:100%!important;overflow:hidden!important}.layout{min-height:0!important}.main-body,.main,.main__container,.dc-tabs__content{min-height:0!important;max-height:100%!important}html[data-pf-theme] .bg-background,html[data-pf-theme] .bg-card,html[data-pf-theme] .bg-muted,html[data-pf-theme] .bg-popover,html[data-pf-theme] .bg-secondary,html[data-pf-theme] .bg-accent,html[data-pf-theme] [class*="bg-background/"],html[data-pf-theme] [class*="bg-card/"]{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important;-webkit-backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important}html[data-pf-theme] .text-foreground,html[data-pf-theme] .text-card-foreground,html[data-pf-theme] .text-popover-foreground{color:var(--pf-client-ink)!important}html[data-pf-theme] .text-muted-foreground{color:var(--pf-client-muted)!important}html[data-pf-theme] .cq-context,html[data-pf-theme] .ciq-chart-area,html[data-pf-theme] .ciq-chart,html[data-pf-theme] .cq-chart-title,html[data-pf-theme] .cq-symbol-select-btn,html[data-pf-theme] .cq-menu-btn,html[data-pf-theme] .sc-dialog,html[data-pf-theme] .sc-mcd{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important;-webkit-backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important}html[data-pf-theme="light"] .flutter-chart{mix-blend-mode:multiply!important}html[data-pf-theme="dark"] .flutter-chart{mix-blend-mode:screen!important}:root{--brand-primary:'+accent+';--brand-red-coral:'+accent+';--primary:'+accentRgb+';--ring:'+accentRgb+';--a1:'+accent+';--font-family:'+font+'}';
    style.textContent += 'html[data-pf-theme] main>div[class*="max-w-"]{width:100%!important;max-width:100%!important;box-sizing:border-box!important}body.theme--light,body.theme--dark{--general-main-1:transparent;--general-main-2:transparent;--general-main-3:transparent;--general-main-4:transparent;--general-section-1:var(--pf-client-glass);--general-section-2:var(--pf-client-glass);--general-section-3:var(--pf-client-glass);--general-section-4:var(--pf-client-glass);--general-section-5:var(--pf-client-glass);--general-section-6:var(--pf-client-glass);--general-hover:var(--pf-client-glass);--general-active:var(--pf-client-edge);--text-general:var(--pf-client-ink);--text-prominent:var(--pf-client-ink);--text-less-prominent:var(--pf-client-muted);--text-primary:var(--pf-client-ink);--text-hint:var(--pf-client-muted);--brand-red-coral:var(--pf-client-accent);--brand-primary:var(--pf-client-accent)}.bot-dashboard,.tab__dashboard,.tutorials-wrap{background:transparent!important;color:var(--pf-client-ink)!important}.tab__dashboard__content,.bot-builder{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(145%)!important;-webkit-backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(145%)!important}.bot-dashboard,.bot-builder,.tutorials-wrapper,.tutorials-mobile{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}.tutorials-wrapper,.tutorials-mobile__guide{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important;-webkit-backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important}html[data-pf-tab="home"] .bot-builder,html[data-pf-tab="tut"] .bot-builder{display:none!important}html[data-pf-tab="home"] .db-info-panel,html[data-pf-tab="home"] #modal_root:has(.db-info-panel){display:none!important}html[data-pf-tab="home"] .tab__dashboard,html[data-pf-tab="home"] .tab__dashboard__content{height:100%!important;min-height:0!important}html[data-pf-tab="home"] .tab__dashboard__content{display:flex!important;align-items:center!important;padding:24px clamp(24px,7vw,112px)!important}html[data-pf-tab="home"] .tab__dashboard__content,html[data-pf-tab="home"] .tab__dashboard__content *:not(button):not(svg):not(path):not(i){color:var(--pf-client-ink)!important}.tab__dashboard__content .quick-panel{width:min(100%,1120px);max-width:1120px;margin:auto}html[data-pf-tab="bld"] .bot-builder{inset:0!important;top:0!important;inset-inline-start:0!important;width:100%!important;height:100%!important}html[data-pf-tab="bld"] #scratch_div,html[data-pf-tab="bld"] .injectionDiv{width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important}html[data-pf-tab="bld"] .blocklySvg,html[data-pf-tab="bld"] .blocklyWorkspace,html[data-pf-tab="bld"] .blocklyMainBackground{background:transparent!important;fill:transparent!important}html[data-pf-tab="bld"] .theme--dark .zelos-renderer.zelos_renderer-theme .blocklyMainBackground{fill:transparent!important}html[data-pf-tab="bld"] .blocklyFlyoutBackground,html[data-pf-tab="bld"] .blocklyDropDownDiv,html[data-pf-tab="bld"] .db-toolbox,html[data-pf-tab="bld"] .db-toolbox__content,html[data-pf-tab="bld"] .gtm-toolbox,html[data-pf-tab="bld"] .db-sidebar,html[data-pf-tab="bld"] .run-panel,html[data-pf-tab="bld"] .dc-drawer{background:var(--pf-client-glass)!important;color:var(--pf-client-ink)!important;border-color:var(--pf-client-edge)!important;backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important;-webkit-backdrop-filter:blur(var(--pf-client-blur, 18px)) saturate(135%)!important}';
    style.textContent += 'html[data-pf-tab="home"] .main{height:100%!important;min-height:0!important;padding:0!important}html[data-pf-tab="home"] .main__container,html[data-pf-tab="home"] .dc-tabs,html[data-pf-tab="home"] .dc-tabs__content{height:100%!important;min-height:0!important}html[data-pf-tab="home"] .bot-dashboard{display:block!important;height:100%!important;min-height:0!important}html[data-pf-tab="home"] .tab__dashboard{display:flex!important;flex:1 1 auto!important;height:100%!important;min-height:0!important}html[data-pf-tab="home"] .tab__dashboard__content{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;height:100%!important;min-height:0!important;overflow:auto!important;padding:24px clamp(16px,4vw,64px)!important}html[data-pf-tab="home"] .tab__dashboard__content .quick-panel{width:min(100%,1440px)!important;max-width:1440px!important;margin:0 auto!important;flex:0 0 auto!important}.pf-dashboard-tools{grid-column:1/-1;width:min(100%,1440px);margin:18px auto 0}.pf-dashboard-tools h2{margin:0 0 12px;color:var(--pf-client-ink);font-family:inherit;font-size:18px;font-weight:600;line-height:1.3}.pf-dashboard-tools__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.pf-dashboard-tools__grid button{display:grid;justify-items:start;gap:8px;min-width:0;min-height:136px;padding:16px;border:1px solid var(--pf-client-edge);border-radius:14px;background:var(--pf-client-glass);color:var(--pf-client-ink);text-align:left;cursor:pointer;backdrop-filter:blur(var(--pf-client-blur,18px)) saturate(135%);-webkit-backdrop-filter:blur(var(--pf-client-blur,18px)) saturate(135%)}.pf-dashboard-tools__grid button:hover{border-color:var(--pf-client-accent);transform:translateY(-2px)}.pf-dashboard-tools__grid button>span{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--pf-client-accent) 16%,transparent);color:var(--pf-client-accent);font-size:19px}.pf-dashboard-tools__grid b{font-size:14px}.pf-dashboard-tools__grid small{color:var(--pf-client-muted);font-size:12px;line-height:1.45}.pf-dashboard-tools__grid i{align-self:end;color:var(--pf-client-accent);font-size:12px;font-style:normal;font-weight:650}@media(max-width:760px){.pf-dashboard-tools{margin-top:18px}.pf-dashboard-tools__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-dashboard-tools__grid button{min-height:120px;padding:12px}}';
    style.textContent += 'html[data-pf-tab="home"] .run-panel,html[data-pf-tab="home"] .run-panel__container,html[data-pf-tab="home"] .run-panel__container--mobile{display:none!important}';
    doc.head.appendChild(style);
    if (doc.body) Object.entries({'--general-main-1':'transparent','--general-main-2':'transparent','--general-main-3':'transparent','--general-section-1':glass,'--general-section-2':glass,'--general-section-3':glass,'--general-section-4':glass,'--general-section-5':glass,'--general-section-6':glass,'--text-general':brand.color,'--text-prominent':brand.color,'--text-less-prominent':brand.getPropertyValue('--sm').trim(),'--brand-primary':accent,'--brand-red-coral':accent}).forEach(function (entry) { doc.body.style.setProperty(entry[0], entry[1], 'important'); });
    frame.contentWindow.postMessage({ type: 'PF_SITE_BRANDING', theme: theme, name: name, accent: accent, font: font }, window.location.origin);
    if (doc.body && !doc.__pfLoaderObserver && doc.defaultView) {
      var syncLoader = function () { addDashboardTools(doc); if (window.__pfTemplateLoading) window.__pfTemplateLoading(current, !!doc.querySelector('.initial-loader,.dc-loader')); };
      childObserver = new doc.defaultView.MutationObserver(syncLoader);
      childObserver.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'aria-busy'] });
      doc.__pfLoaderObserver = childObserver;
      syncLoader();
    }
  }
  function renderAccount(mode) {
    var id=localStorage.getItem('active_loginid'), savedMode=localStorage.getItem('pf-client-account-mode')||'demo';
    var wanted=mode||savedMode, selected=accounts.find(function(a){return a.account_type===wanted&&a.status==='active';});
    if(!mode&&!selected)selected=accounts.find(function(a){return a.account_id===id&&a.status==='active';})||accounts.find(function(a){return a.status==='active';});
    var balance=document.getElementById('account-balance-value'),label=document.getElementById('account-type-label');
    var site=document.getElementById('site');
    if(site)site.dataset.derivAuthenticated=String(derivAuthenticated);
    if(selected){localStorage.setItem('active_loginid',selected.account_id);localStorage.setItem('account_type',selected.account_type);}
    if(balance){try{balance.textContent=selected?new Intl.NumberFormat(undefined,{style:'currency',currency:selected.currency}).format(Number(selected.balance)):'Balance unavailable';}catch(ignore){balance.textContent=selected?String(selected.balance)+' '+selected.currency:'Balance unavailable';}}
    if(label)label.textContent=selected?selected.account_type.toUpperCase()+' ACCOUNT':wanted.toUpperCase()+' ACCOUNT';
    document.querySelectorAll('#site [data-account-mode]').forEach(function(button){button.setAttribute('aria-pressed',String(!!selected&&button.dataset.accountMode===selected.account_type));button.disabled=!accounts.some(function(a){return a.account_type===button.dataset.accountMode&&a.status==='active';});});
  }
  async function refreshAccount() {
    try {
      var session=await fetch('/api/deriv/session',{cache:'no-store'}), state=session.ok?await session.json():{authenticated:false};
      derivAuthenticated=state.authenticated===true;
      if(derivAuthenticated){var response=await fetch('/api/deriv/accounts',{cache:'no-store'});if(response.status===401)derivAuthenticated=false;accounts=response.ok?(await response.json()).data||[]:[];}
      else accounts=[];
      renderAccount();
    } catch(ignore){renderAccount();}
  }
  window.addEventListener('DOMContentLoaded',refreshAccount);
  window.addEventListener('message', function(event){
    if(event.origin===window.location.origin && frame && event.source===frame.contentWindow && event.data && event.data.type==='pf:bot-running')botRunning=event.data.running===true;
  });
  document.addEventListener('click',function(event){
    var login=event.target.closest('#site #account-connect,#site .s-acts .s-pill,#site .s-acts .s-sign');
    if(login){event.preventDefault();event.stopImmediatePropagation();var url=new URL('/api/deriv/login',window.location.origin);url.searchParams.set('return',window.location.href);if(login.classList.contains('s-sign'))url.searchParams.set('signup','1');window.location.assign(url.href);return;}
    var account=event.target.closest('#site [data-account-mode]');
    if(account){event.preventDefault();event.stopImmediatePropagation();try{localStorage.setItem('pf-client-account-mode',account.dataset.accountMode)}catch(ignore){}renderAccount(account.dataset.accountMode);if(frame)frame.src=frame.src;return;}
    var target=event.target.closest('#stabs [data-tab]');
    if(target && current==='bld' && target.dataset.tab!=='bld' && botRunning){
      if(!window.confirm('Leave Bot Builder and stop its strategy? Existing open contracts remain on your Deriv account.')){event.preventDefault();event.stopImmediatePropagation();}
      else botRunning=false;
    }
  },true);
  window.PipforgeApps = {
    setTheme: function (site) { applyBranding(site); },
    setBlur: function (site) { var blur = getComputedStyle(site).getPropertyValue('--pf-client-blur').trim(); if (frame) frame.style.setProperty('--pf-client-blur', blur); if (frame && frame.contentDocument) frame.contentDocument.documentElement.style.setProperty('--pf-client-blur', blur); },
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
