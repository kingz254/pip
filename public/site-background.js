(function () {
  var SETTINGS_TABLE = 'pipforge_site_background';
  var BUCKET = 'pipforge-backgrounds';
  var started = false;

  function isPlatformHost() {
    var config = window.PF_CONFIG || {};
    var hostname = location.hostname.toLowerCase().replace(/^www\./, '');
    var appHosts = (config.APP_HOSTS || []).map(function (host) {
      return String(host).toLowerCase().replace(/^www\./, '');
    });
    return hostname === 'localhost' || hostname === '127.0.0.1' || appHosts.indexOf(hostname) >= 0;
  }

  function clear() {
    var layer = document.getElementById('pf-site-background');
    if (layer) layer.remove();
    document.documentElement.classList.remove('pf-site-background-active');
  }

  function render(client, settings) {
    if (!settings || !settings.object_path || !['image', 'video'].includes(settings.media_kind)) {
      clear();
      return;
    }

    var layer = document.getElementById('pf-site-background');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'pf-site-background';
      layer.setAttribute('aria-hidden', 'true');
      document.body.prepend(layer);
    }

    var url = client.storage.from(BUCKET).getPublicUrl(settings.object_path).data.publicUrl;
    var media = document.createElement(settings.media_kind === 'video' ? 'video' : 'img');
    media.className = 'pf-site-background-media';
    if (settings.media_kind === 'video') {
      media.autoplay = true;
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.preload = 'metadata';
      media.addEventListener('canplay', function () { media.play().catch(function () {}); }, { once: true });
    } else {
      media.alt = '';
      media.decoding = 'async';
    }
    media.addEventListener('error', clear, { once: true });
    media.src = url;
    layer.replaceChildren(media);
    document.documentElement.classList.add('pf-site-background-active');
  }

  function load(client) {
    if (!client || !isPlatformHost()) return Promise.resolve();
    return client.from(SETTINGS_TABLE)
      .select('object_path,media_kind')
      .eq('id', true)
      .maybeSingle()
      .then(function (result) {
        if (result.error) throw result.error;
        render(client, result.data);
        return result.data;
      });
  }

  window.PF_SITE_BACKGROUND = { load: load, render: render, clear: clear };

  function start() {
    if (started || !window.PF_SB || !isPlatformHost()) return;
    started = true;
    load(window.PF_SB).catch(function () { clear(); });
  }

  if (window.PF_SB) start();
  window.addEventListener('pf:ready', start);

  var style = document.createElement('style');
  style.textContent = [
    'html.pf-site-background-active,html.pf-site-background-active body{background:transparent!important}',
    'html.pf-site-background-active body{isolation:isolate}',
    '#pf-site-background{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;background:#101116}',
    '#pf-site-background:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,10,15,.48),rgba(9,10,15,.6))}',
    '#pf-site-background .pf-site-background-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}',
    'html.pf-site-background-active body>.orbs{display:none!important}',
    'html.pf-site-background-active body .panel,html.pf-site-background-active body .masthead{background:rgba(250,247,243,.84)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}'
  ].join('');
  document.head.appendChild(style);
})();
