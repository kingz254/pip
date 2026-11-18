(function () {
  'use strict';
  var mounted = false, points = [], lastPrice = '', timer;
  function $(root, selector) { return root.querySelector(selector); }
  function setTab(root, name) {
    root.querySelectorAll('[data-pf-smart-tab]').forEach(function (button) {
      var active = button.dataset.pfSmartTab === name;
      button.setAttribute('aria-selected', String(active));
    });
    root.querySelectorAll('[data-pf-smart-panel]').forEach(function (panel) {
      panel.hidden = panel.dataset.pfSmartPanel !== name;
    });
    if (name === 'chart') drawChart(root);
  }
  function drawChart(root) {
    var path = $(root, '#pf-smart-chart-path');
    var svg = $(root, '#pf-smart-chart-svg');
    if (!path || !svg || points.length < 2) return;
    var low = Math.min.apply(null, points), high = Math.max.apply(null, points), span = high - low || Math.max(Math.abs(high) * 0.0005, 0.01);
    var coords = points.map(function (price, index) { return [18 + index * 964 / (points.length - 1), 300 - (price - low) * 276 / span]; });
    path.setAttribute('d', coords.map(function (point, index) { return (index ? 'L' : 'M') + point[0].toFixed(1) + ' ' + point[1].toFixed(1); }).join(' '));
    svg.setAttribute('aria-label', 'Live price chart from ' + points.length + ' Deriv ticks');
  }
  function configure(root, strategyId, fromSpeed) {
    var strategy = $(root, '#auto-strategy'), market = $(root, '#auto-market'), contract = $(root, '#auto-contract');
    if (!strategy || !Array.from(strategy.options).some(function (option) { return option.value === strategyId; })) return;
    strategy.value = strategyId;
    strategy.dispatchEvent(new Event('change', { bubbles: true }));
    if (fromSpeed) {
      var speedMarket = $(root, '#pf-speed-market'), speedContract = $(root, '#pf-speed-contract');
      var speedStake = $(root, '#pf-speed-stake'), speedDuration = $(root, '#pf-speed-duration'), speedUnit = $(root, '#pf-speed-unit');
      if (market && speedMarket.value) market.value = speedMarket.value;
      if (contract && speedContract.value && Array.from(contract.options).some(function (option) { return option.value === speedContract.value; })) contract.value = speedContract.value;
      if ($(root, '#auto-stake') && speedStake.value) $(root, '#auto-stake').value = speedStake.value;
      if ($(root, '#auto-duration') && speedDuration.value) $(root, '#auto-duration').value = speedDuration.value;
      if ($(root, '#auto-duration-unit') && speedUnit.value) $(root, '#auto-duration-unit').value = speedUnit.value;
      var risk = { stop_loss: $(root, '#pf-speed-stop').value, take_profit: $(root, '#pf-speed-take').value, max_stake: $(root, '#pf-speed-max').value };
      root.querySelectorAll('[data-auto-param]').forEach(function (input) { if (risk[input.dataset.autoParam]) input.value = risk[input.dataset.autoParam]; });
    }
    setTab(root, 'smart');
    var setup = $(root, '#auto-strategy');
    if (setup) setup.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function updateStrategies(root) {
    var source = $(root, '#auto-strategy');
    if (!source) return;
    ['#pf-hub-strategies', '#pf-speed-strategy'].forEach(function (selector) {
      var target = $(root, selector);
      if (!target) return;
      var old = target.value;
      target.replaceChildren();
      Array.from(source.options).filter(function (option) { return option.value; }).forEach(function (option) {
        target.appendChild(new Option(option.textContent, option.value));
      });
      if (old && Array.from(target.options).some(function (option) { return option.value === old; })) target.value = old;
      else if (target.options.length) target.selectedIndex = 0;
    });
    var cards = $(root, '#pf-hub-cards');
    if (cards) {
      cards.replaceChildren();
      Array.from(source.options).filter(function (option) { return option.value; }).forEach(function (option) {
        var card = document.createElement('article'), title = document.createElement('h3'), copy = document.createElement('p'), button = document.createElement('button');
        card.className = 'pf-smart-card'; title.textContent = option.textContent;
        copy.textContent = 'Deriv-supported strategy. Review its markets, contract types, and risk limits before running.';
        button.type = 'button'; button.textContent = 'Configure strategy'; button.dataset.pfConfigure = option.value;
        card.append(title, copy, button); cards.appendChild(card);
      });
      if (!cards.children.length) cards.textContent = 'Loading strategy choices from Deriv…';
    }
  }
  function mount() {
    if (mounted) return;
    var panel = document.querySelector('#site [data-pn="smt"]'), center = panel && $(panel, '.automation-center');
    if (!center) return;
    mounted = true;
    var shell = document.createElement('div'); shell.className = 'pf-smart-suite';
    shell.innerHTML = '<nav class="pf-smart-tabs" role="tablist" aria-label="Smart trading tools"><button type="button" class="pf-smart-tab" role="tab" aria-selected="true" data-pf-smart-tab="hub">Trading Hub</button><button type="button" class="pf-smart-tab" role="tab" aria-selected="false" data-pf-smart-tab="smart">Smart Trading</button><button type="button" class="pf-smart-tab" role="tab" aria-selected="false" data-pf-smart-tab="speed">Speed Bot</button><button type="button" class="pf-smart-tab" role="tab" aria-selected="false" data-pf-smart-tab="chart">Charts</button></nav><section class="pf-smart-panel pf-smart-overview" data-pf-smart-panel="hub"><header class="pf-smart-overview-head"><div><span class="dash-kicker">STRATEGY WORKSPACE</span><h2>Trading Hub</h2><p>Pick a strategy that Deriv currently supports. Check the live market sample, configure your limits, then review before you start.</p></div><span class="feed-chip"><i></i><span id="pf-hub-state">Waiting for live market</span></span></header><div class="signal-live-grid"><article class="analysis-card"><small>Selected market</small><b id="pf-hub-market">—</b></article><article class="analysis-card"><small>Live price</small><b id="pf-hub-price">—</b></article><article class="analysis-card"><small>Recent sample</small><b id="pf-hub-sample">—</b></article></div><section class="analysis-card"><div class="section-heading"><div><h3>Available strategies</h3><p>Choices are loaded from Deriv’s current strategy list.</p></div><select id="pf-hub-strategies" class="s-input" aria-label="Choose a strategy"></select></div><div class="pf-smart-cards" id="pf-hub-cards"></div><p class="automation-notice">Signals describe recent observations. They do not predict the next tick or guarantee a trade outcome.</p></section></section><section class="pf-smart-panel" data-pf-smart-panel="smart" hidden></section><section class="pf-smart-panel pf-smart-overview" data-pf-smart-panel="speed" hidden><header><span class="dash-kicker">QUICK, GUARDED SETUP</span><h2>Speed Bot</h2><p class="mini">Configure a Deriv-supported run quickly. It still uses the same account session, mandatory limits, and review confirmation as Smart Trading.</p></header><section class="analysis-card"><div class="pf-speed-form"><label>Strategy<select id="pf-speed-strategy" class="s-input"></select></label><label>Market<select id="pf-speed-market" class="s-input market-select"></select></label><label>Contract<select id="pf-speed-contract" class="s-input"></select></label><label>Stake<input id="pf-speed-stake" class="s-input" type="number" min="0.35" step="0.01" value="1"></label><label>Duration<input id="pf-speed-duration" class="s-input" type="number" min="1" step="1" value="1"></label><label>Unit<select id="pf-speed-unit" class="s-input"><option value="t">Ticks</option><option value="s">Seconds</option><option value="m">Minutes</option></select></label><label>Maximum stake<input id="pf-speed-max" class="s-input" type="number" min="0.35" step="0.01" value="5"></label><label>Stop loss<input id="pf-speed-stop" class="s-input" type="number" min="0.01" step="0.01" value="5"></label><label>Take profit<input id="pf-speed-take" class="s-input" type="number" min="0.01" step="0.01" value="10"></label></div><div class="pf-speed-actions"><button type="button" class="s-btn" id="pf-speed-review">Review and configure</button><p>Review and start the run from Smart Trading. Nothing starts from this shortcut.</p></div></section><p class="automation-notice">Speed Bot uses Deriv’s supported strategy runner. It does not send rapid repeat purchases from your browser.</p></section><section class="pf-smart-panel pf-smart-chart" data-pf-smart-panel="chart" hidden><div class="pf-smart-chart-head"><div><span class="dash-kicker">LIVE DERIV TICKS</span><h2>Charts</h2><b id="pf-smart-chart-price">Waiting for ticks…</b></div><label>Market<select id="pf-chart-market" class="s-input market-select"></select></label></div><svg id="pf-smart-chart-svg" viewBox="0 0 1000 330" preserveAspectRatio="none" role="img" aria-label="Live market price chart"><g class="pf-smart-chart-grid"><line x1="0" y1="25" x2="1000" y2="25"/><line x1="0" y1="95" x2="1000" y2="95"/><line x1="0" y1="165" x2="1000" y2="165"/><line x1="0" y1="235" x2="1000" y2="235"/><line x1="0" y1="305" x2="1000" y2="305"/></g><path id="pf-smart-chart-path" class="pf-smart-chart-path" d=""/></svg><p class="pf-smart-chart-hint">The chart follows the client site’s live market selection and visual theme.</p></section>';
    center.parentNode.insertBefore(shell, center);
    var smartPanel = $(shell, '[data-pf-smart-panel="smart"]'); smartPanel.appendChild(center);
    shell.addEventListener('click', function (event) {
      var tab = event.target.closest('[data-pf-smart-tab]');
      if (tab) { setTab(shell, tab.dataset.pfSmartTab); return; }
      var configureButton = event.target.closest('[data-pf-configure]');
      if (configureButton) { configure(document.querySelector('#site'), configureButton.dataset.pfConfigure, false); return; }
      if (event.target.closest('#pf-speed-review')) configure(document.querySelector('#site'), $('#pf-speed-strategy', shell).value, true);
      if (event.target.closest('#pf-hub-configure')) configure(document.querySelector('#site'), $('#pf-hub-strategies', shell).value, false);
    });
    shell.addEventListener('change', function (event) {
      if (event.target.id === 'pf-hub-strategies') updateStrategies(shell);
      if (event.target.id === 'pf-speed-strategy') {
        var primary = $('#auto-strategy', document.querySelector('#site'));
        if (primary) { primary.value = event.target.value; primary.dispatchEvent(new Event('change', { bubbles: true })); }
        var primaryContract = $('#auto-contract', document.querySelector('#site')), options = primaryContract && Array.from(primaryContract.options);
        var target = $('#pf-speed-contract', shell); if (target && options) { target.replaceChildren(); options.filter(function (option) { return option.value; }).forEach(function (option) { target.appendChild(new Option(option.textContent, option.value)); }); }
      }
      if (event.target.id === 'pf-speed-market') document.querySelectorAll('#site .market-select').forEach(function (select) { select.value = event.target.value; select.dispatchEvent(new Event('change', { bubbles: true })); });
      if (event.target.id === 'pf-chart-market') document.querySelectorAll('#site .market-select').forEach(function (select) { select.value = event.target.value; select.dispatchEvent(new Event('change', { bubbles: true })); });
    });
    var primarySelect = $('#auto-strategy', document.querySelector('#site'));
    if (primarySelect) { updateStrategies(shell); new MutationObserver(function () { updateStrategies(shell); syncContracts(); }).observe(primarySelect, { childList: true }); }
    function syncContracts() {
      var primary = $('#auto-contract', document.querySelector('#site')), speed = $('#pf-speed-contract', shell);
      if (!primary || !speed) return; var old = speed.value; speed.replaceChildren();
      Array.from(primary.options).filter(function (option) { return option.value; }).forEach(function (option) { speed.appendChild(new Option(option.textContent, option.value)); });
      if (old && Array.from(speed.options).some(function (option) { return option.value === old; })) speed.value = old;
    }
    syncContracts();
    timer = window.setInterval(function () {
      var site = document.querySelector('#site'); if (!site) return;
      var price = ($('#db-price', site) || {}).textContent || '', market = ($('#db-market', site) || {}).textContent || '', status = ($('#db-conn', site) || {}).textContent || '';
      if (price && price !== '—' && price !== lastPrice) { var value = Number(price.replace(/,/g, '')); if (Number.isFinite(value)) { points.push(value); if (points.length > 120) points.shift(); lastPrice = price; } }
      if ($('#pf-hub-price', shell)) $('#pf-hub-price', shell).textContent = price || '—';
      if ($('#pf-smart-chart-price', shell)) $('#pf-smart-chart-price', shell).textContent = price || 'Waiting for ticks…';
      if ($('#pf-hub-market', shell)) $('#pf-hub-market', shell).textContent = market || '—';
      if ($('#pf-hub-sample', shell)) $('#pf-hub-sample', shell).textContent = points.length + ' recent ticks';
      if ($('#pf-hub-state', shell)) $('#pf-hub-state', shell).textContent = status || 'Connecting';
      drawChart(shell);
    }, 800);
    var marketSource = $('#auto-market', document.querySelector('#site'));
    if (marketSource) {
      var syncMarkets = function () { ['#pf-speed-market', '#pf-chart-market'].forEach(function (selector) { var select = $(shell, selector), old = select.value; select.replaceChildren(); Array.from(marketSource.options).forEach(function (option) { select.appendChild(new Option(option.textContent, option.value)); }); if (old && Array.from(select.options).some(function (option) { return option.value === old; })) select.value = old; }); };
      syncMarkets(); new MutationObserver(syncMarkets).observe(marketSource, { childList: true });
    }
    setTab(shell, 'hub');
  }
  var observer = new MutationObserver(mount); observer.observe(document.documentElement, { childList: true, subtree: true }); mount();
  window.addEventListener('pagehide', function () { observer.disconnect(); if (timer) clearInterval(timer); });
})();
