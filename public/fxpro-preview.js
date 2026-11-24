(function () {
  'use strict';
  var frame, profile;
  function send() {
    if (profile) {
      var site=document.getElementById('site'), style=getComputedStyle(site);
      profile.palette.ink=style.getPropertyValue('--st').trim();profile.palette.muted=style.getPropertyValue('--sm').trim();
      profile.palette.glass=style.getPropertyValue('--sb').trim();profile.palette.edge=style.getPropertyValue('--sl').trim();
      profile.palette.light=site.dataset.clientTheme==='light';profile.palette.page=style.backgroundImage!=='none'?style.backgroundImage:style.backgroundColor;
      var blur=parseFloat(style.getPropertyValue('--pf-client-blur'));if(Number.isFinite(blur))profile.blur=blur/0.24;
    }
    if(frame&&profile)frame.style.colorScheme=profile.palette.light?'light':'dark';
    if (frame && profile) frame.contentWindow.postMessage({ type: 'PF_RUNTIME_PROFILE', profile: profile }, location.origin);
  }
  window.addEventListener('message', function (event) {
    if (!frame || event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if(event.data?.type === 'PF_RUNTIME_READY') send();
    if(event.data?.type === 'PF_RUNTIME_THEME' && ['light','dark'].includes(event.data.theme)) window.dispatchEvent(new CustomEvent('pf:runtime-theme',{detail:event.data.theme}));
  });
  function mount(site) {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.className = 'pf-full-app';
    frame.title = 'Your complete trading website';
    frame.src = '/fxpro.html?preview=1';
    frame.allow = 'fullscreen; clipboard-write';
    frame.addEventListener('load', send);
    site.appendChild(frame);
    site.classList.add('pf-full-runtime');
  }
  window.PipforgeRuntime = {
    update: function (state) {
      var site = document.getElementById('site');
      if (!site) return;
      var style = getComputedStyle(site);
      profile = { name: state.n || 'Your site', logo_data: state.logo || null, template: state.t,
        background: state.b, blur: state.blur, header: state.h, font_theme: state.ft,
        premium_enabled: !!state.premium_enabled, loader_style: state.ld, announcement: state.ann || '', icon_shape: state.sh,
        icon_place: state.sp, social: state.soc || {}, menu: Object.assign({}, state.menu, { account_style: state.as, account_display: state.accountDisplay }),
        palette: { accent: style.getPropertyValue('--a1').trim(), secondary: style.getPropertyValue('--a2').trim(),
          ink: style.getPropertyValue('--st').trim(), muted: style.getPropertyValue('--sm').trim(),
          glass: style.getPropertyValue('--sb').trim(), edge: style.getPropertyValue('--sl').trim(),
          page: style.backgroundImage !== 'none' ? style.backgroundImage : style.backgroundColor,
          font: style.fontFamily, light: site.dataset.clientTheme === 'light' } };
      mount(site); send();
      if (window.__pfSetEmbeddedActive) window.__pfSetEmbeddedActive(true);
    }
  };
  window.PipforgeApps = { show: function () { return true; }, setTheme: function () { send(); }, setBlur: function () { send(); } };
  var css = document.createElement('style');
  css.textContent = '.pf-full-runtime{position:relative!important;overflow:hidden!important}.pf-full-runtime>:not(.pf-full-app):not(canvas):not(.imgbg){display:none!important}.pf-full-app{display:block;position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;z-index:20}.pf-full-runtime [class*=loader-overlay]{display:none!important}';
  if(document.head)document.head.appendChild(css);else document.addEventListener('DOMContentLoaded',function(){document.head.appendChild(css)});
})();
