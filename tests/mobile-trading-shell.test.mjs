import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('mobile trading tabs follow the requested order and expose Signals in the main navigation', async () => {
    const [main, constants] = await Promise.all([
        read('../client-runtime/fxprotradesite/src/pages/main/main.tsx'),
        read('../client-runtime/fxprotradesite/src/constants/bot-contents.ts'),
    ]);
    const tabsStart = main.lastIndexOf('<Tabs', main.indexOf("className='main__tabs'"));
    const tabs = main.slice(tabsStart, main.indexOf('</Tabs>', tabsStart));
    const expected = ['dashboard', 'bot-builder', 'speed-bot', 'free-bots', 'smart-trading', 'trading-hub', 'signals', 'analysis-tool', 'forex', 'accumulators', 'digits', 'rise-fall', 'charts', 'portfolio', 'risk-management', 'strategies', 'markup', 'premium-bots'].map(id => `id-${id === 'dashboard' ? 'dbot-dashboard' : id}`);
    assert.deepEqual([...tabs.matchAll(/id='(id-[^']+)'/g)].map(match => match[1]), expected);
    assert.match(tabs, /id='id-signals'.*Signals/s);
    assert.match(constants, /SIGNALS:\s*6/);
});

test('risk notice only opens by pressing the footer control', async () => {
    const [button, footer, tenantStyles] = await Promise.all([
        read('../client-runtime/fxprotradesite/src/components/disclaimer/disclaimer-button.tsx'),
        read('../client-runtime/fxprotradesite/src/components/layout/footer/index.tsx'),
        read('../client-runtime/fxprotradesite/src/styles/pipforge-tenant.scss'),
    ]);
    assert.match(button, /onClick=\{\(\) => setIsOpen\(true\)\}/);
    assert.doesNotMatch(button, /localStorage|active_tab|useEffect/);
    assert.match(footer, /<DisclaimerButton\s*\/>/);
    assert.match(tenantStyles, /\.controls__section\{position:fixed!important;bottom:52px!important/);
});
