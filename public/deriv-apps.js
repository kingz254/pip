(function () {
  'use strict';
  var routes = { home: ['/apps/bot/#dashboard', 'Dashboard'], bld: ['/apps/bot/#bot_builder', 'Bot Builder'],
    ana: ['/apps/digits/', 'Digit Analysis'], smt: ['/apps/digits/?mode=smart', 'Smart Trading'],
    acc: ['/apps/accumulators/', 'Accumulators'], cht: ['/apps/rise-fall/', 'Charts'], tut: ['/apps/bot/#tutorial', 'Tutorials'] };
  var frame = null, current = '', observer = null, botRunning = false;
  var accounts = [];
  function applyBranding(site) {
    if (!frame || !frame.contentDocument || !site) return;
    var doc = frame.contentDocument;
    if (!doc.head) return;
    var style = doc.getElementById('pipforge-client-branding') || doc.createElement('style');
    var brand = getComputedStyle(site), font = brand.fontFamily, accent = brand.getPropertyValue('--a1').trim(), background = brand.background;
    doc.title = site.querySelector('.s-name')?.textContent || 'Client site';
    style.id = 'pipforge-client-branding';
    style.textContent = 'header,.app-header,.dc-tabs__list,footer{display:none!important}html,body,#root,.layout,.main,.main__container,.dc-tabs__content{font-family:'+font+'!important;background:'+background+'!important;color:'+brand.color+'!important;min-height:100%!important}.layout{height:auto!important}:root{--brand-primary:'+accent+';--brand-red-coral:'+accent+';--primary:'+accent+';--a1:'+accent+';--font-family:'+font+'}';
    doc.head.appendChild(style);
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
    show: function (tab, site) {
      var route = routes[tab];
      if (!route) { if (frame) frame.remove(); frame = null; current = ''; return false; }
      var panel = site.querySelector('[data-pn="' + tab + '"]');
      if (!panel) return false;
      if (current === tab && frame && frame.parentNode === panel) { applyBranding(site); return true; }
      if (frame) frame.remove();
      frame = document.createElement('iframe');
      frame.className = 'pf-template-frame'; frame.title = route[1]; frame.src = route[0];
      frame.setAttribute('allow', 'fullscreen; clipboard-write');
      frame.referrerPolicy = 'same-origin';
      frame.addEventListener('load',function(){
        if(window.__pfLoadedFrames)window.__pfLoadedFrames[tab]=true;
        applyBranding(site);
        var loader=document.getElementById('site-loader');if(loader)loader.classList.remove('on');
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
