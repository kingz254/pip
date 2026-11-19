export function requestForOptions(input, account) {
    const request = { ...input };
    if ('authorize' in request || 'loginid' in request || 'tokens' in request || 'buy_contract_for_multiple_accounts' in request) {
        throw new Error('This operation is unavailable. Use the connected account.');
    }
    if (request.proposal || request.parameters) {
        const params = { ...(request.parameters || request) };
        if (params.symbol !== undefined) { params.underlying_symbol = params.symbol; delete params.symbol; }
        delete params.product_type;
        delete params.app_markup_percentage;
        if (account) params.currency = account.currency;
        for (const field of ['amount', 'duration', 'multiplier', 'growth_rate', 'selected_tick']) {
            if (params[field] !== undefined) {
                params[field] = Number(params[field]);
                if (!Number.isFinite(params[field])) throw new Error(`Invalid ${field}.`);
            }
        }
        for (const field of ['barrier', 'barrier2']) if (params[field] !== undefined) params[field] = String(params[field]);
        if (!['TICKHIGH', 'TICKLOW'].includes(params.contract_type)) delete params.selected_tick;
        if (['DIGITEVEN', 'DIGITODD'].includes(params.contract_type)) { delete params.barrier; delete params.barrier2; }
        if (['ACCU', 'MULTUP', 'MULTDOWN'].includes(params.contract_type)) { delete params.duration; delete params.duration_unit; }
        if (request.parameters) request.parameters = params;
        else return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
    }
    if (request.buy !== undefined) { request.buy = String(request.buy); request.price = Number(request.price); }
    if (request.sell !== undefined) { request.sell = Number(request.sell); request.price = Number(request.price); }
    if (request.contracts_for) {
        return { contracts_for: request.contracts_for, ...(request.req_id === undefined ? {} : { req_id: request.req_id }) };
    }
    if (request.balance) delete request.account;
    return Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined));
}

// Keep Blockly's internal view model while using only New API fields on the wire.
export function responseForWorkspace(data) {
    if (data.active_symbols) return { ...data, active_symbols: data.active_symbols.map(s => ({ ...s,
        symbol: s.underlying_symbol, display_name: s.underlying_symbol_name,
        symbol_type: s.underlying_symbol_type, pip: Number(s.pip_size),
        market_display_name: s.market.replaceAll('_', ' '), submarket_display_name: s.submarket.replaceAll('_', ' '),
    })) };
    if (data.proposal_open_contract) {
        const c = data.proposal_open_contract;
        return { ...data, proposal_open_contract: { ...c, underlying: c.underlying_symbol,
            entry_tick: c.entry_spot, entry_tick_time: c.entry_spot_time,
            exit_tick: c.exit_spot, exit_tick_time: c.exit_spot_time,
        } };
    }
    return data;
}

export async function buyOnSelectedAccount(socket, input, account, isCurrent) {
    if (!account || !isCurrent()) throw new Error('Connect your selected account before trading.');
    const request = requestForOptions(input, account);
    if (!Number.isFinite(request.price) || request.price <= 0) throw new Error('Invalid purchase price.');
    if (request.buy !== '1') return socket.send(request);
    let quote;
    const subscription = await socket.subscribe({ ...request.parameters, proposal: 1 }, data => { quote = data; });
    try {
        if (!isCurrent()) throw new Error('Account changed. Get a new quote.');
        if (quote?.error || !quote?.proposal?.id) throw new Error('Quote unavailable.');
        const price = Number(quote.proposal.ask_price);
        if (!Number.isFinite(price) || price <= 0 || price > request.price) throw new Error('Quote exceeds your purchase limit.');
        return await socket.send({ buy: quote.proposal.id, price, ...(request.passthrough ? { passthrough: request.passthrough } : {}) });
    } finally { await subscription.unsubscribe().catch(() => {}); }
}
