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
    DASHBOARD:0, BOT_BUILDER:1, TRADING_HUB:2, SMART_TRADING:3, SPEED_BOT:4, CHART:5,
    ANALYSIS_TOOL:6, FREE_BOTS:7, PORTFOLIO:8, FOREX:9, DIGITS:10, ACCUMULATORS:11, RISE_FALL:12,
});
export const MAX_STRATEGIES = 10;
export const TAB_IDS = ['id-dbot-dashboard','id-bot-builder','id-trading-hub','id-smart-trading','id-speed-bot','id-charts','id-analysis-tool','id-free-bots','id-portfolio','id-forex','id-digits','id-accumulators','id-rise-fall'];

export const DEBOUNCE_INTERVAL_TIME = 500;
