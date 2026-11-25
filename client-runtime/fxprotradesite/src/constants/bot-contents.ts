type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0, BOT_BUILDER: 1, SPEED_BOT: 2, FREE_BOTS: 3, SMART_TRADING: 4, TRADING_HUB: 5,
    SIGNALS: 6, ANALYSIS_TOOL: 7, FOREX: 8, ACCUMULATORS: 9, DIGITS: 10, RISE_FALL: 11, CHART: 12, PORTFOLIO: 13, RISK_MANAGEMENT: 14, STRATEGIES: 15, MARKUP: 16, PREMIUM_BOTS: 17, COPY_TRADING: 18,
});
export const MAX_STRATEGIES = 10;
export const TAB_IDS = ['id-dbot-dashboard','id-bot-builder','id-speed-bot','id-free-bots','id-smart-trading','id-trading-hub','id-signals','id-analysis-tool','id-forex','id-accumulators','id-digits','id-rise-fall','id-charts','id-portfolio','id-risk-management','id-strategies','id-markup','id-premium-bots','id-copy-trading'];

export const DEBOUNCE_INTERVAL_TIME = 500;
