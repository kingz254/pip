(function (root) {
  'use strict';
  function analyze(prices, pipSize) {
    var digits = prices.map(function (p) { return Number(Number(p).toFixed(pipSize).slice(-1)); });
    var counts = Array(10).fill(0), rise = 0, fall = 0;
    digits.forEach(function (d, i) { counts[d]++; if (i) { if (prices[i] > prices[i - 1]) rise++; if (prices[i] < prices[i - 1]) fall++; } });
    var rank = counts.map(function (n, digit) { return { digit: digit, count: n }; }).sort(function (a, b) { return b.count - a.count || a.digit - b.digit; });
    return { prices: prices, digits: digits, counts: counts, most: rank[0].digit, least: rank[9].digit, top: rank.slice(0, 5).map(function (x) { return x.digit; }), last: digits[digits.length - 1], rise: rise, fall: fall, size: digits.length };
  }
  function plan(strategy, sample, settings) {
    if (sample.size < 30) return [];
    var one = function (type, barrier) { var x = { contract_type: type }; if (barrier != null) x.barrier = String(barrier); return x; };
    if (strategy === 'o5u4') {
      var seen = sample.counts.map(function (count, digit) { return { count: count, digit: digit }; }).filter(function (x) { return x.count > 0; }).sort(function (a, b) { return a.count - b.count || a.digit - b.digit; });
      var least = seen[0].digit, most = seen[seen.length - 1].digit;
      return [4, 5].includes(sample.last) && [4, 5].includes(least) && ![4, 5].includes(most) ? [one('DIGITOVER', 5), one('DIGITUNDER', 4)] : [];
    }
    if (strategy === 'matches') return sample.top.map(function (d) { return one('DIGITMATCH', d); });
    if (strategy === 'differ') return [one('DIGITDIFF', sample.least)];
    if (strategy === 'over-under') {
      if (sample.most <= 2 && sample.last >= 7) return [one('DIGITUNDER', 7)];
      if (sample.most >= 7 && sample.last <= 2) return [one('DIGITOVER', 2)];
      return [];
    }
    if (strategy === 'speed') return [one(settings.contract, /^DIGIT(OVER|UNDER|MATCH|DIFF)$/.test(settings.contract) ? settings.barrier : null)];
    var count = settings.patternCount, values = sample.digits, direction = settings.observe;
    var predicate = direction === 'even' ? function (d) { return d % 2 === 0; } : direction === 'odd' ? function (d) { return d % 2 === 1; } : direction === 'over' ? function (d) { return d > settings.compareBarrier; } : direction === 'under' ? function (d) { return d < settings.compareBarrier; } : direction === 'matches' ? function (d) { return d === settings.barrier; } : function (d) { return d !== settings.barrier; };
    if (strategy === 'rise-fall') {
      values = sample.prices.slice(1).map(function (p, i) { return p - sample.prices[i]; });
      predicate = direction === 'rise' ? function (d) { return d > 0; } : function (d) { return d < 0; };
    }
    if (strategy.endsWith('-pattern')) { if (!values.slice(-count).every(predicate) || values.length < count) return []; }
    else {
      var percentage = values.filter(predicate).length / values.length * 100;
      if (!(settings.operator === '<' ? percentage < settings.threshold : settings.operator === '>=' ? percentage >= settings.threshold : settings.operator === '<=' ? percentage <= settings.threshold : percentage > settings.threshold)) return [];
      if (settings.usePattern && (!values.slice(-count).every(predicate) || values.length < count)) return [];
    }
    return [one(settings.contract, /^DIGIT(OVER|UNDER|MATCH|DIFF)$/.test(settings.contract) ? settings.barrier : null)];
  }
  function validate(config) {
    if (!['o5u4', 'matches', 'differ', 'over-under', 'speed', 'rise-fall', 'even-odd', 'even-odd-pattern', 'over-under-threshold', 'over-under-pattern', 'matches-differs'].includes(config.strategy)) throw new Error('Choose a supported strategy.');
    ['stake', 'maxStake', 'stopLoss', 'takeProfit'].forEach(function (key) { if (!(Number.isFinite(config[key]) && config[key] > 0)) throw new Error('Enter positive stake and risk limits.'); });
    if (config.maxStake < config.stake || !Number.isFinite(config.martingale) || config.martingale < 1) throw new Error('Maximum stake must cover the initial stake; martingale must be at least 1.');
    if (!Number.isInteger(config.duration) || config.duration < 1 || !Number.isInteger(config.maxTrades) || config.maxTrades < 1 || config.maxTrades > 1000) throw new Error('Enter whole-number duration and a trade limit from 1 to 1000.');
    if (!Number.isInteger(config.barrier) || config.barrier < 0 || config.barrier > 9) throw new Error('Choose a digit from 0 to 9.');
    if (config.strategy === 'speed' || config.strategy.includes('threshold') || config.strategy.includes('pattern') || ['rise-fall', 'even-odd', 'matches-differs'].includes(config.strategy)) {
      if (!['CALL', 'PUT', 'DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD', 'DIGITMATCH', 'DIGITDIFF'].includes(config.contract)) throw new Error('Choose a supported contract.');
      if (!Number.isFinite(config.threshold) || config.threshold < 0 || config.threshold > 100 || !Number.isInteger(config.patternCount) || config.patternCount < 1 || config.patternCount > 20 || !Number.isInteger(config.compareBarrier) || config.compareBarrier < 0 || config.compareBarrier > 9) throw new Error('Check the percentage, pattern length, and observation digit.');
    }
  }
  class Runner {
    constructor(engine, accountId, update) { this.engine = engine; this.accountId = accountId; this.update = update; this.active = false; this.pending = false; this.unresolved = false; this.profit = 0; this.spent = 0; this.wins = 0; this.losses = 0; this.trades = []; this.positions = new Map(); this.nextStake = 0; this.generation = 0; }
    emit(message) { this.message = message || this.message; this.update(this); }
    async start(config) {
      if (this.active || this.pending || this.positions.size || this.unresolved) throw new Error('Wait for the current contracts to settle before starting another run.');
      validate(config);
      var generation = ++this.generation;
      this.pending = true; this.emit('Connecting the selected account…');
      try {
        var account = await this.engine.connect(false, false);
        if (generation !== this.generation) throw new Error('Start cancelled.');
        if (account.account_id !== this.accountId()) throw new Error('Account changed. Start again with the selected account.');
        this.config = Object.freeze(Object.assign({}, config)); this.account = account; this.profit = 0; this.spent = 0; this.wins = 0; this.losses = 0; this.trades = []; this.roundEnd = 0; this.nextStake = config.stake; this.active = true;
        this.emit('Running · waiting for a fresh qualifying tick');
      } finally { this.pending = false; this.emit(); }
    }
    stop(message) { this.generation++; this.active = false; this.emit(message || 'Stopped · open contracts will finish settling'); }
    async tick(symbol, sample) {
      if (!this.active || this.pending || this.positions.size) return;
      if (this.account.account_id !== this.accountId()) { this.stop('Account changed · run stopped'); return; }
      var c = this.config;
      if (!c.scanAll && c.symbol !== symbol) return;
      var contracts = plan(c.strategy, sample, c);
      if (!contracts.length) { this.emit('Running · waiting for the configured condition'); return; }
      var exposure = this.nextStake * contracts.length;
      if (this.nextStake > c.maxStake || this.profit - exposure < -c.stopLoss || this.trades.length + contracts.length > c.maxTrades) { this.stop('Run limit reached · no new contracts purchased'); return; }
      this.pending = true;
      var roundStart = this.trades.length;
      try {
        var funds = await this.engine.request({ balance: 1 }), balance = Number(funds.balance && funds.balance.balance);
        if (!Number.isFinite(balance) || balance < exposure) throw new Error('The selected account does not have enough available balance for this round.');
        var available = await this.engine.request({ contracts_for: symbol }), allowed = available.contracts_for && available.contracts_for.available || [];
        if (!contracts.every(function (item) { return allowed.some(function (entry) { return entry.contract_type === item.contract_type; }); })) throw new Error('This market does not currently offer the selected contracts.');
        // Quote the complete round before its first buy; a failed leg stops all remaining purchases.
        var quotes = [], total = 0;
        try {
          for (var item of contracts) {
            var quote = await this.engine.quote(Object.assign({ amount: this.nextStake, basis: 'stake', currency: this.account.currency, underlying_symbol: symbol, duration: c.duration, duration_unit: 't' }, item));
            quotes.push(quote); total += Number(quote.ask_price);
          }
          if (total > exposure + 0.000001) throw new Error('Quoted round exceeds the approved stake.');
          for (var i = 0; i < quotes.length; i++) {
            if (!this.active || this.accountId() !== this.account.account_id) break;
            var purchase;
            try { purchase = await this.engine.buy(quotes[i], this.nextStake); }
            catch (error) { if (/timed out|did not respond|did not confirm|connection/i.test(error.message)) this.unresolved = true; throw error; }
            var trade = { id: purchase.contract_id, type: contracts[i].contract_type, barrier: contracts[i].barrier, symbol: symbol, stake: Number(purchase.buy_price), status: 'open', profit: null, currency: this.account.currency, time: purchase.purchase_time };
            this.trades.push(trade); this.positions.set(String(trade.id), trade); this.spent += trade.stake; this.emit('Contract #' + trade.id + ' purchased · waiting for settlement');
            try { var result = await this.engine.request({ proposal_open_contract: 1, contract_id: trade.id, subscribe: 1 }); this.contract(result); }
            catch (error) { this.unresolved = true; throw new Error('Purchase confirmed, but monitoring failed. Check contract #' + trade.id + ' before restarting. ' + error.message); }
          }
        } finally { quotes.forEach((quote) => this.engine.discardQuote(quote)); }
      } catch (error) { this.stop(error.message + ' Remaining purchases stopped.'); }
      finally { this.pending = false; if (this.trades.length > roundStart && !this.positions.size) this.roundComplete(roundStart); this.emit(); }
    }
    contract(message) {
      var contract = message.proposal_open_contract;
      if (!contract) return;
      var trade = this.positions.get(String(contract.contract_id));
      if (!trade) return;
      if (message.subscription) trade.subscription = message.subscription.id;
      trade.entry = contract.entry_spot; trade.exit = contract.exit_spot || contract.current_spot;
      if (!contract.is_sold && !['won', 'lost', 'sold', 'cancelled'].includes(contract.status)) { this.emit(); return; }
      var profit = Number(contract.profit);
      if (!Number.isFinite(profit)) { this.unresolved = true; this.stop('Settlement did not include a valid profit. Check Deriv transaction history.'); return; }
      trade.profit = profit; trade.status = contract.status; this.profit += profit;
      if (profit > 0) this.wins++; else if (profit < 0) this.losses++;
      this.positions.delete(String(trade.id));
      if (trade.subscription) this.engine.request({ forget: trade.subscription }).catch(function () {});
      if (!this.positions.size && !this.pending) this.roundComplete();
      this.emit();
    }
    roundComplete(start) {
      var round = this.trades.slice(start == null ? this.roundEnd || 0 : start), result = round.reduce(function (n, t) { return n + (t.profit || 0); }, 0);
      this.roundEnd = this.trades.length;
      this.nextStake = result < 0 ? Number((this.nextStake * this.config.martingale).toFixed(2)) : this.config.stake;
      if (this.profit >= this.config.takeProfit || this.profit <= -this.config.stopLoss || this.trades.length >= this.config.maxTrades) this.stop('Run limit reached · trading stopped');
      else this.emit(this.active ? 'Round settled · waiting for the next qualifying tick' : 'Stopped · contracts settled');
    }
  }
  root.PipforgeSmartCore = { analyze: analyze, plan: plan, validate: validate, Runner: Runner };
})(typeof window === 'undefined' ? globalThis : window);
