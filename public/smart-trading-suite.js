(function () {
  'use strict';
  var shell, runner, engine, markets = new Map(), subscriptions = new Set(), panel, generation = 0, loading = false, visible = false, tab = 'hub', hub = 'o5u4', activeArea, unsubscribe, journal = [], destroyed = false;
  var core = window.PipforgeSmartCore, retryAfter = 0;
  var hubChoices = {
    o5u4: ['🎯', 'O5U4', 'Over 5 / Under 4 Strategy', 'Dual digit contracts on the same volatility market.', 'Waits for digit 4 or 5, a least appearing digit of 4 or 5, and a most appearing digit outside that range. Buys Over 5 and Under 4; a round uses two stakes.'],
    matches: ['🔢', 'Matches', 'Auto Matches Strategy', 'Five most frequent digits across volatility markets.', 'Buys one Matches contract for each of the five most frequent digits. A round uses five stakes.'],
    'over-under': ['📊', 'Over/Under', 'Auto Over/Under Strategy', 'Live digit frequency and last-digit conditions.', 'Buys Under 7 when the most frequent digit is 0–2 and the current digit is 7–9; buys Over 2 for the opposite pattern.'],
    differ: ['⚖️', 'Differ', 'Auto Differ Strategy', 'Digit difference analysis.', 'Buys a Differs contract using the least frequent digit in the current sample.']
  };
  var families = [['rise-fall', 'Rise/Fall'], ['even-odd', 'Even/Odd · percentage'], ['even-odd-pattern', 'Even/Odd · pattern'], ['over-under-threshold', 'Over/Under · percentage'], ['over-under-pattern', 'Over/Under · pattern'], ['matches-differs', 'Matches/Differs']];
  var contracts = [['CALL', 'Rise'], ['PUT', 'Fall'], ['DIGITEVEN', 'Even'], ['DIGITODD', 'Odd'], ['DIGITOVER', 'Over'], ['DIGITUNDER', 'Under'], ['DIGITMATCH', 'Matches'], ['DIGITDIFF', 'Differs']];
  function q(s) { return shell && shell.querySelector(s); }
  function text(s, v) { var el = q(s); if (el) el.textContent = v; }
  function input(key, label, value, min, step, max) { return '<label>' + label + '<input data-setting="' + key + '" type="number" value="' + value + '" min="' + min + '" step="' + (step || 1) + '"' + (max != null ? ' max="' + max + '"' : '') + '></label>'; }
  function options(items) { return items.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join(''); }
  function select(key, label, items) { return '<label>' + label + '<select data-setting="' + key + '">' + options(items) + '</select></label>'; }
  function marketSelect() { return '<select data-setting="symbol" aria-label="Market"><option value="R_100">Loading volatility markets…</option></select>'; }
  function fields() { return input('stake', 'Stake per contract', .35, .01, .01) + input('martingale', 'Martingale', 2, 1, .1) + input('stopLoss', 'Stop loss', 5, .01, .01) + input('takeProfit', 'Take profit', 10, .01, .01); }
  function limits() { return input('maxStake', 'Maximum stake', 5, .01, .01) + input('maxTrades', 'Contract limit', 50, 1, 1, 1000) + input('duration', 'Duration (ticks)', 1, 1, 1); }
  function actions(name) { return '<div class="pf-run-actions"><button type="button" class="pf-activate" data-activate="' + name + '">Activate strategy</button><button type="button" class="pf-start" data-start="' + name + '" disabled>▶ START TRADING</button></div>'; }
  function statsMarkup() { return '<div class="pf-live-analysis"><h3>Current Analysis</h3><div class="pf-analysis-grid">' + [['market', 'Market'], ['price', 'Price'], ['least', 'Least appearing'], ['most', 'Most appearing'], ['last', 'Last digit'], ['sample', 'Sample']].map(function (x) { return '<div><small>' + x[1] + '</small><b data-stat="' + x[0] + '">—</b></div>'; }).join('') + '</div><div class="pf-digit-frequencies" data-digit-frequencies></div></div>'; }
  function hubContent() {
    return '<section class="pf-hub-header pf-glass"><div class="pf-hub-settings"><div class="pf-hub-logo"><span>ϟ</span><div><h2>Trading Hub</h2><small>Live strategy analysis</small></div></div><div class="pf-settings">' + fields() + '</div></div><div class="pf-market-status"><i></i><span data-feed-state>Connecting live markets…</span><span data-session-state>Not running</span></div><details class="pf-run-limits"><summary>Run limits and market selection</summary><div class="pf-settings">' + limits() + '<label>Market' + marketSelect() + '</label><label class="pf-check"><input type="checkbox" data-setting="scanAll" checked> Scan all volatility markets</label></div></details></section><section class="pf-hub-card pf-glass"><nav class="pf-strategy-tabs" role="tablist" aria-label="Trading Hub strategies">' + Object.keys(hubChoices).map(function (key) { var x = hubChoices[key]; return '<button type="button" role="tab" data-hub="' + key + '" aria-selected="' + (key === hub) + '">' + x[0] + ' ' + x[1] + '</button>'; }).join('') + '</nav><div class="pf-hub-body">' + actions('hub') + '<div class="pf-strategy-heading"><div><h2 data-hub-title></h2><p data-hub-subtitle></p></div><span class="pf-strategy-badge" data-hub-badge>INACTIVE</span></div><p class="pf-strategy-info" data-hub-description></p>' + statsMarkup() + '<details><summary>Market overview</summary><div class="pf-table-wrap"><table><thead><tr><th>Market</th><th>Last digit</th><th>Most / least</th><th>Sample</th><th>Condition</th></tr></thead><tbody data-markets-table></tbody></table></div></details></div></section>';
  }
  function smartContent() {
    return '<section class="pf-glass pf-smart-configuration"><h2>Smart Trading</h2><div class="pf-settings"><label>Market' + marketSelect() + '</label>' + input('sample', 'Analysis ticks', 120, 30, 1, 500) + fields() + limits() + '</div><nav class="pf-strategy-family" role="tablist" aria-label="Smart Trading strategies">' + families.map(function (x, i) { return '<button type="button" role="tab" data-family="' + x[0] + '" aria-selected="' + !i + '">' + x[1] + '</button>'; }).join('') + '</nav><div class="pf-settings pf-condition-fields">' + select('observe', 'Observe', [['rise', 'Rising prices'], ['fall', 'Falling prices']]) + select('operator', 'Condition', [['>', 'More than'], ['<', 'Less than'], ['>=', 'At least'], ['<=', 'At most']]) + input('threshold', 'Percentage (%)', 65, 0, 1, 100) + input('patternCount', 'Consecutive ticks', 3, 1, 1, 20) + input('compareBarrier', 'Observation barrier', 5, 0, 1, 9) + select('contract', 'Buy', contracts.slice(0, 2)) + input('barrier', 'Trading digit', 5, 0, 1, 9) + '<label class="pf-check"><input type="checkbox" data-setting="usePattern"> Also require consecutive ticks</label></div><p>Percentage rules use the recent tick sample. Pattern rules wait for consecutive qualifying ticks.</p>' + actions('smart') + statsMarkup() + '</section>';
  }
  function speedContent() {
    return '<section class="pf-glass pf-speed-configuration"><h2>Speed Bot</h2><p>Choose a market and contract, set the number of trades, and start. Each round waits for its contract to settle.</p><div class="pf-settings"><label>Market' + marketSelect() + '</label>' + select('contract', 'Contract type', contracts) + input('stake', 'Stake', 1, .01, .01) + input('duration', 'Duration (ticks)', 1, 1, 1) + input('maxTrades', 'Number of trades', 1, 1, 1, 1000) + input('barrier', 'Digit barrier', 5, 0, 1, 9) + input('martingale', 'Martingale', 1, 1, .1) + input('maxStake', 'Maximum stake', 5, .01, .01) + input('stopLoss', 'Stop loss', 5, .01, .01) + input('takeProfit', 'Take profit', 10, .01, .01) + '</div>' + actions('speed') + statsMarkup() + '</section>';
  }
  function chartContent() { return '<section class="pf-glass pf-native-chart"><div class="pf-section-title"><h2>Charts</h2><label>Market' + marketSelect() + '</label><strong data-chart-price>—</strong></div><svg viewBox="0 0 1000 400" preserveAspectRatio="none" aria-label="Live tick price chart" role="img"><path data-chart-fill></path><path data-chart-path></path></svg><div class="pf-chart-range"><span data-chart-low></span><span data-chart-high></span><span>Live ticks · latest 120 prices</span></div></section>'; }
  function renderHub() { var x = hubChoices[hub]; text('[data-hub-title]', x[2]); text('[data-hub-subtitle]', x[3]); text('[data-hub-description]', x[4]); shell.querySelectorAll('[data-hub]').forEach(function (el) { el.setAttribute('aria-selected', String(el.dataset.hub === hub)); }); }
  function settings(area) {
    var result = { barrier: 5, patternCount: 3, compareBarrier: 5, threshold: 65, operator: '>', observe: 'rise', usePattern: false, scanAll: false, sample: 100 };
    area.querySelectorAll('[data-setting]').forEach(function (el) { result[el.dataset.setting] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value; }); return result;
  }
  function configFor(name) { var config = settings(q('[data-panel="' + name + '"]')); config.strategy = name === 'hub' ? hub : name === 'smart' ? q('[data-family][aria-selected="true"]').dataset.family : 'speed'; return config; }
  function disarm(name) { var button = q('[data-start="' + name + '"]'); if (!button) return; delete button.dataset.armed; button.disabled = true; q('[data-activate="' + name + '"]').textContent = 'Activate strategy'; if (name === 'hub') text('[data-hub-badge]', 'INACTIVE'); }
  function setTab(name) { tab = name; shell.querySelectorAll('[data-tab-tool]').forEach(function (el) { el.setAttribute('aria-selected', String(el.dataset.tabTool === name)); }); shell.querySelectorAll('[data-panel]').forEach(function (el) { el.hidden = el.dataset.panel !== name; }); renderAnalysis(); }
  function updateFamily(id) {
    var rise = id === 'rise-fall', parity = id.startsWith('even-odd'), range = id.startsWith('over-under'), pattern = id.endsWith('-pattern');
    q('[data-panel="smart"] [data-setting="observe"]').innerHTML = options(rise ? [['rise', 'Rising prices'], ['fall', 'Falling prices']] : parity ? [['even', 'Even digits'], ['odd', 'Odd digits']] : range ? [['over', 'Digits over barrier'], ['under', 'Digits under barrier']] : [['matches', 'Matching digit'], ['differs', 'Differing digit']]);
    q('[data-panel="smart"] [data-setting="contract"]').innerHTML = options(rise ? contracts.slice(0, 2) : parity ? contracts.slice(2, 4) : range ? contracts.slice(4, 6) : contracts.slice(6));
    ['threshold', 'operator', 'usePattern'].forEach(function (key) { q('[data-panel="smart"] [data-setting="' + key + '"]').closest('label').hidden = pattern; });
    q('[data-panel="smart"] [data-setting="compareBarrier"]').closest('label').hidden = !range;
    q('[data-panel="smart"] [data-setting="barrier"]').closest('label').hidden = rise || parity;
    shell.querySelectorAll('[data-family]').forEach(function (el) { el.setAttribute('aria-selected', String(el.dataset.family === id)); });
  }
  function log(message) { if (journal[0] && journal[0].endsWith(message)) return; journal.unshift(new Date().toLocaleTimeString() + ' · ' + message); journal = journal.slice(0, 100); var box = q('[data-journal]'); box.replaceChildren(); journal.forEach(function (line) { var p = document.createElement('p'); p.textContent = line; box.appendChild(p); }); }
  function update(state) {
    text('[data-run-status]', state.message || 'Ready');
    [['total-stake', state.spent.toFixed(2)], ['profit', state.profit.toFixed(2)], ['total-runs', state.trades.length], ['wins', state.wins], ['losses', state.losses], ['open', state.positions.size]].forEach(function (x) { text('[data-' + x[0] + ']', x[1]); });
    text('[data-session-state]', state.active ? 'Running · next stake ' + state.nextStake.toFixed(2) : 'Not running');
    shell.querySelectorAll('[data-start]').forEach(function (button) { var own = activeArea === button.dataset.start; button.textContent = own && state.active ? '■ STOP TRADING' : '▶ START TRADING'; button.disabled = state.active ? !own : state.pending || state.positions.size > 0 || state.unresolved || !button.dataset.armed; });
    shell.querySelectorAll('[data-setting], [data-activate], [data-hub], [data-family]').forEach(function (el) { el.disabled = state.active || state.pending || state.positions.size > 0; });
    var body = q('[data-trades]'); body.replaceChildren(); state.trades.slice().reverse().forEach(function (trade) { var row = document.createElement('tr'); [trade.id, trade.type + (trade.barrier != null ? ' ' + trade.barrier : ''), trade.symbol, (trade.entry || '—') + ' / ' + (trade.exit || '—'), trade.stake.toFixed(2), trade.status, trade.profit == null ? '—' : trade.profit.toFixed(2)].forEach(function (value) { var cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); }); body.appendChild(row); });
    if (state.message) log(state.message);
  }
  function forgetMarkets() { generation++; subscriptions.forEach(function (id) { engine.request({ forget: id }).catch(function () {}); }); subscriptions.clear(); }
  async function loadMarkets() {
    if (loading || !visible || destroyed) return;
    loading = true; var version = generation;
    try {
      var result = await engine.request({ active_symbols: 'brief' }); if (version !== generation || !visible) return;
      var symbols = (result.active_symbols || []).filter(function (m) { return m.is_trading_suspended !== 1 && /^(R_\d+|1HZ\d+V|RDBULL|RDBEAR)$/.test(m.underlying_symbol); });
      if (!symbols.length) throw new Error('No active volatility markets were returned.');
      shell.querySelectorAll('[data-setting="symbol"]').forEach(function (select) { var old = select.value; select.replaceChildren(); symbols.forEach(function (m) { select.appendChild(new Option(m.underlying_symbol_name, m.underlying_symbol)); }); select.value = symbols.some(function (m) { return m.underlying_symbol === old; }) ? old : symbols[0].underlying_symbol; });
      for (var m of symbols) {
        if (version !== generation || !visible) break;
        var historyRequest = { ticks_history: m.underlying_symbol, count: 500, end: 'latest', style: 'ticks' };
        if (!engine.getMarketSymbol || engine.getMarketSymbol() !== m.underlying_symbol) historyRequest.subscribe = 1;
        var response = await engine.request(historyRequest);
        if (version !== generation || !visible) { if (response.subscription) engine.request({ forget: response.subscription.id }).catch(function () {}); break; }
        if (response.subscription) subscriptions.add(response.subscription.id);
        if (response.history) markets.set(m.underlying_symbol, { name: m.underlying_symbol_name, prices: response.history.prices.map(Number), epochs: response.history.times || [], pip: response.pip_size, last: Date.now() });
        renderAnalysis();
      }
      text('[data-feed-state]', 'Market connected · ' + markets.size + ' markets');
    } catch (error) { retryAfter = Date.now() + 15000; text('[data-feed-state]', error.message + ' · Reconnect to retry'); }
    finally { loading = false; }
  }
  function sampleFor(symbol, count) { var data = markets.get(symbol); return data && Number.isInteger(data.pip) ? core.analyze(data.prices.slice(-(count || 100)), data.pip) : null; }
  function bestMarket(config) {
    var eligible = Array.from(markets.keys()).map(function (symbol) { var sample = sampleFor(symbol); return { symbol: symbol, sample: sample, score: sample ? Math.max.apply(null, sample.counts) - Math.min.apply(null, sample.counts) : -1 }; }).filter(function (x) { return x.sample && core.plan(config.strategy, x.sample, config).length; }).sort(function (a, b) { return b.score - a.score; });
    return eligible.length ? eligible[0].symbol : config.symbol;
  }
  function renderAnalysis() {
    if (!shell) return;
    var config = tab === 'chart' ? settings(q('[data-panel="chart"]')) : configFor(tab), symbol = config.scanAll ? bestMarket(config) : config.symbol, data = markets.get(symbol), sample = sampleFor(symbol, config.sample);
    if (!sample || !sample.size) return;
    var values = { market: symbol, price: sample.prices[sample.prices.length - 1].toFixed(data.pip), least: sample.least, most: sample.most, last: sample.last, sample: sample.size + ' ticks' };
    q('[data-panel="' + tab + '"]').querySelectorAll('[data-stat]').forEach(function (el) { el.textContent = values[el.dataset.stat]; });
    shell.querySelectorAll('[data-digit-frequencies]').forEach(function (box) { box.innerHTML = sample.counts.map(function (n, digit) { return '<div class="' + (digit === sample.last ? 'is-current' : '') + '"><b>' + digit + '</b><small>' + (n / sample.size * 100).toFixed(1) + '%</small></div>'; }).join(''); });
    var table = q('[data-markets-table]'); table.replaceChildren(); markets.forEach(function (item, key) { var s = sampleFor(key); if (!s) return; var row = document.createElement('tr'); [key, s.last, s.most + ' / ' + s.least, s.size, core.plan(hub, s, configFor('hub')).length ? 'Ready' : 'Waiting'].forEach(function (value) { var cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); }); table.appendChild(row); });
    var prices = data.prices.slice(-120), low = Math.min.apply(null, prices), high = Math.max.apply(null, prices), span = high - low || 1, path = prices.map(function (p, i) { return (i ? 'L' : 'M') + (i * 1000 / Math.max(prices.length - 1, 1)).toFixed(2) + ' ' + (375 - (p - low) / span * 350).toFixed(2); }).join(' ');
    q('[data-chart-path]').setAttribute('d', path); q('[data-chart-fill]').setAttribute('d', path + ' L1000 400 L0 400 Z'); text('[data-chart-price]', values.price); text('[data-chart-low]', 'Low ' + low.toFixed(data.pip)); text('[data-chart-high]', 'High ' + high.toFixed(data.pip));
  }
  function onMessage(message) {
    if (message.pf_connection === 'closed') { subscriptions.clear(); generation++; markets.clear(); runner.stop('Connection changed · run stopped; reconnect to review open contracts'); if (runner.positions.size) runner.unresolved = true; return; }
    runner.contract(message);
    var tick = message.tick, data = tick && markets.get(tick.symbol);
    if (!data || !visible || !tick || !Number.isFinite(Number(tick.quote))) return;
    if (data.epochs.length && tick.epoch <= data.epochs[data.epochs.length - 1]) return;
    data.pip = tick.pip_size; data.prices.push(Number(tick.quote)); data.epochs.push(tick.epoch); data.prices = data.prices.slice(-500); data.epochs = data.epochs.slice(-500); data.last = Date.now();
    renderAnalysis();
    if (runner.active && (!runner.config.scanAll || bestMarket(runner.config) === tick.symbol)) runner.tick(tick.symbol, sampleFor(tick.symbol, runner.config.sample));
  }
  function exportTrades() { var rows = [['Contract ID', 'Type', 'Market', 'Stake', 'Status', 'Profit']].concat(runner.trades.map(function (t) { return [t.id, t.type, t.symbol, t.stake, t.status, t.profit]; })); var blob = new Blob([rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n')], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'trading-session.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); }
  function mount() {
    var target = document.querySelector('#site [data-pn="smt"]'); if (!target || panel === target || !window.PipforgeSmartTradingEngine || !core) return;
    panel = target; engine = window.PipforgeSmartTradingEngine; var original = panel.querySelector('.automation-center'); if (!original) return;
    shell = document.createElement('div'); shell.className = 'pf-smart-suite';
    shell.innerHTML = '<nav class="pf-smart-tabs" role="tablist" aria-label="Smart trading tools">' + [['hub', 'Trading Hub'], ['smart', 'Smart Trading'], ['speed', 'Speed Bot'], ['chart', 'Charts']].map(function (x, i) { return '<button type="button" role="tab" data-tab-tool="' + x[0] + '" aria-selected="' + !i + '">' + x[1] + '</button>'; }).join('') + '<button type="button" class="pf-reconnect" data-reconnect>↻ Reconnect</button></nav><div class="pf-suite-layout"><div class="pf-suite-workspace"><div data-panel="hub">' + hubContent() + '</div><div data-panel="smart" hidden>' + smartContent() + '</div><div data-panel="speed" hidden>' + speedContent() + '</div><div data-panel="chart" hidden>' + chartContent() + '</div></div><aside class="pf-session pf-glass"><div class="pf-session-head"><h2>Trading session</h2><button type="button" data-stop-all>■ Stop</button></div><p data-run-status role="status" aria-live="polite">Choose and activate a strategy to begin.</p><div class="pf-session-summary">' + [['total-stake', 'Total stake', '0.00'], ['profit', 'Profit / loss', '0.00'], ['total-runs', 'Contracts', '0'], ['wins', 'Won', '0'], ['losses', 'Lost', '0'], ['open', 'Open', '0']].map(function (x) { return '<div><small>' + x[1] + '</small><b data-' + x[0] + '>' + x[2] + '</b></div>'; }).join('') + '</div><details open><summary>Transactions</summary><button type="button" data-export>Download CSV</button><div class="pf-table-wrap"><table><thead><tr><th>ID</th><th>Type</th><th>Market</th><th>Entry / exit</th><th>Stake</th><th>Status</th><th>P/L</th></tr></thead><tbody data-trades></tbody></table></div></details><details><summary>Journal</summary><div data-journal></div></details><p class="pf-session-note">Keep this page open while running. Stop prevents new purchases; open contracts still settle. Martingale increases exposure after losses. Frequencies do not predict the next tick.</p></aside></div>';
    panel.insertBefore(shell, original); var server = document.createElement('details'); server.className = 'pf-server-automation'; server.innerHTML = '<summary>Deriv server automation</summary>'; server.appendChild(original); panel.appendChild(server);
    runner = new core.Runner(engine, function () { return localStorage.getItem('active_loginid'); }, update); unsubscribe = engine.subscribe(onMessage);
    shell.addEventListener('click', function (event) {
      var button = event.target.closest('button'); if (!button) return; var d = button.dataset;
      if (d.tabTool) setTab(d.tabTool);
      if (d.hub) { hub = d.hub; disarm('hub'); renderHub(); renderAnalysis(); }
      if (d.family) { disarm('smart'); updateFamily(d.family); renderAnalysis(); }
      if (d.activate) { try { core.validate(configFor(d.activate)); var start = q('[data-start="' + d.activate + '"]'); start.dataset.armed = '1'; start.disabled = false; button.textContent = '✓ Activated'; if (d.activate === 'hub') text('[data-hub-badge]', 'ACTIVE'); } catch (error) { text('[data-run-status]', error.message); } }
      if (d.start) {
        if (runner.active) { runner.stop(); return; }
        activeArea = d.start; var config = configFor(activeArea);
        runner.start(config).then(function () { forgetMarkets(); markets.clear(); loadMarkets(); }).catch(function (error) { text('[data-run-status]', error.message); log(error.message); });
      }
      if ('stopAll' in d) runner.stop();
      if ('reconnect' in d) { runner.stop('Reconnecting · start again when ready'); forgetMarkets(); markets.clear(); loadMarkets(); }
      if ('export' in d) exportTrades();
    });
    shell.addEventListener('change', function (event) { var area = event.target.closest('[data-panel]'); if (area && area.dataset.panel !== 'chart') disarm(area.dataset.panel); renderAnalysis(); });
    shell.addEventListener('keydown', function (event) { var button = event.target.closest('[role="tab"]'); if (!button || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; var buttons = Array.from(button.parentNode.querySelectorAll('[role="tab"]')), i = buttons.indexOf(button), next = buttons[(i + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]; next.click(); next.focus(); event.preventDefault(); });
    renderHub(); updateFamily('rise-fall'); setTab('hub');
  }
  var observer = new MutationObserver(mount); observer.observe(document.documentElement, { childList: true, subtree: true }); mount();
  var watch = setInterval(function () {
    mount(); if (!panel) return;
    var nowVisible = panel.classList.contains('on');
    if (runner.account && runner.account.account_id !== localStorage.getItem('active_loginid') && runner.active) runner.stop('Account changed · run stopped');
    if (nowVisible !== visible) { visible = nowVisible; if (visible) loadMarkets(); else { runner.stop('Left Smart Trading · new purchases stopped'); forgetMarkets(); } }
    if (visible && !loading && !markets.size && Date.now() >= retryAfter) loadMarkets();
  }, 1000);
  window.addEventListener('pagehide', function () { destroyed = true; observer.disconnect(); clearInterval(watch); if (runner) runner.stop(); if (engine) forgetMarkets(); if (unsubscribe) unsubscribe(); });
})();
