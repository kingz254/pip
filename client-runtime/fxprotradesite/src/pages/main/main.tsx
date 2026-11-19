import React, { lazy, Suspense, useCallback,useEffect, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AnalysistoolModal from '@/components/analysistool/analysistool-modal';
import { botNotification } from '@/components/bot-notification/bot-notification';
import PortfolioIcon from '@/components/icons/portfolio-icon';
import ChunkLoader from '@/components/loader/chunk-loader';
import AdvancedDisplayModal from '@/components/modals/advanced-display-modal';
import PortfolioDisplay from '@/components/portfolio/portfolio-display';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import SignalsModal from '@/components/signals/signals-modal';
import InstancesAnalysis from '@/components/trading-hub/instances-analysis';
import AdvancedDisplay from '@/components/trading-hub/advanced-display';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { api_base } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { useUrlBotLoader } from '@/hooks/useUrlBotLoader';
import StandaloneChartModal from '@/pages/chart/standalone-chart-modal';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import './main.scss';
import './free-bots.scss';

// Extend Window interface for Blockly
declare global {
    interface Window {
        Blockly: any;
    }
}

const Chart = lazy(() => import('../chart'));
const DTrader = lazy(() => import('../dtrader'));
const Forex = lazy(() => import('../forex'));

const DashboardIcon = () => (
    <svg width='20' height='20' fill='var(--text-general)' viewBox='0 0 24 24'>
        <path d='M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' />
    </svg>
);

const BotBuilderIcon = () => (
    <svg fill='var(--text-general)' width='24px' height='24px' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'>
        <path
            fillRule='evenodd'
            d='M20,9.85714286 L20,14.1428571 C20,15.2056811 19.0732946,16 18,16 L6,16 C4.92670537,16 4,15.2056811 4,14.1428571 L4,9.85714286 C4,8.79431889 4.92670537,8 6,8 L18,8 C19.0732946,8 20,8.79431889 20,9.85714286 Z M6,10 L6,14 L18,14 L18,10 L6,10 Z M2,19 L2,17 L22,17 L22,19 L2,19 Z M2,7 L2,5 L22,5 L22,7 L2,7 Z'
        />
    </svg>
);

const AutoTraderIcon = () => (
    <svg
        width='20px'
        height='20px'
        viewBox='0 0 64 64'
        fill='none'
        stroke='var(--text-general)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        xmlns='http://www.w3.org/2000/svg'
    >
        <rect x='14' y='14' width='36' height='36' rx='4' ry='4' />
        <rect x='23' y='23' width='5' height='5' />
        <rect x='36' y='23' width='5' height='5' />
        <line x1='18' y1='14' x2='18' y2='6' />
        <line x1='46' y1='14' x2='46' y2='6' />
        <line x1='26' y1='50' x2='26' y2='58' />
        <line x1='38' y1='50' x2='38' y2='58' />
        <line x1='23' y1='35' x2='41' y2='35' />
    </svg>
);

const ChartsIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M4 20L10 14L14 16L20 10'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <rect x='8' y='3' width='8' height='8' rx='2' stroke='var(--text-general)' strokeWidth='2' />
        <path d='M12 5V9' stroke='var(--text-general)' strokeWidth='2' strokeLinecap='round' />
        <path d='M10 7H14' stroke='var(--text-general)' strokeWidth='2' strokeLinecap='round' />
    </svg>
);

const AnalysisToolIcon = () => (
    <svg width='24px' height='24px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d='M7.5 3.5V6.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path d='M7.5 14.5V18.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path
            d='M6.8 6.5C6.08203 6.5 5.5 7.08203 5.5 7.8V13.2C5.5 13.918 6.08203 14.5 6.8 14.5H8.2C8.91797 14.5 9.5 13.918 9.5 13.2V7.8C9.5 7.08203 8.91797 6.5 8.2 6.5H6.8Z'
            stroke='var(--text-general)'
        />
        <path d='M16.5 6.5V11.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path d='M16.5 16.5V20.5' stroke='var(--text-general)' strokeLinecap='round' />
        <path
            d='M15.8 11.5C15.082 11.5 14.5 12.082 14.5 12.8V15.2C14.5 15.918 15.082 16.5 15.8 16.5H17.2C17.918 16.5 18.5 15.918 18.5 15.2V12.8C18.5 12.082 17.918 11.5 17.2 11.5H15.8Z'
            stroke='var(--text-general)'
        />
    </svg>
);

const SignalsIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M8 6.00067L21 6.00139M8 12.0007L21 12.0015M8 18.0007L21 18.0015M3.5 6H3.51M3.5 12H3.51M3.5 18H3.51M4 6C4 6.27614 3.77614 6.5 3.5 6.5C3.22386 6.5 3 6.27614 3 6C3 5.72386 3.22386 5.5 3.5 5.5C3.77614 5.5 4 5.72386 4 6ZM4 12C4 12.2761 3.77614 12.5 3.5 12.5C3.22386 12.5 3 12.2761 3 12C3 11.7239 3.22386 11.5 3.5 11.5C3.77614 11.5 4 11.7239 4 12ZM4 18C4 18.2761 3.77614 18.5 3.5 18.5C3.22386 18.5 3 18.2761 3 18C3 17.7239 3.22386 17.5 3.5 17.5C3.77614 17.5 4 17.7239 4 18Z'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const FreeBotsIcon = () => (
    <svg
        fill='var(--text-general)'
        width='20px'
        height='20px'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
        data-name='Layer 1'
    >
        <path d='M10,13H4a1,1,0,0,0-1,1v6a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1V14A1,1,0,0,0,10,13ZM9,19H5V15H9ZM20,3H14a1,1,0,0,0-1,1v6a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1V4A1,1,0,0,0,20,3ZM19,9H15V5h4Zm1,7H18V14a1,1,0,0,0-2,0v2H14a1,1,0,0,0,0,2h2v2a1,1,0,0,0,2,0V18h2a1,1,0,0,0,0-2ZM10,3H4A1,1,0,0,0,3,4v6a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1V4A1,1,0,0,0,10,3ZM9,9H5V5H9Z' />
    </svg>
);

const BotIcon = () => (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <rect x='5' y='8' width='14' height='11' rx='2' stroke='var(--text-general)' strokeWidth='1.5' fill='none' />
        <rect x='8.5' y='12' width='2' height='2' rx='0.5' fill='var(--text-general)' />
        <rect x='13.5' y='12' width='2' height='2' rx='0.5' fill='var(--text-general)' />
        <path d='M12 8V5' stroke='var(--text-general)' strokeWidth='1.5' strokeLinecap='round' />
        <path d='M8 21L9 19H15L16 21' stroke='var(--text-general)' strokeWidth='1.5' strokeLinecap='round' />
        <path d='M7 15H17' stroke='var(--text-general)' strokeWidth='1.5' strokeLinecap='round' />
        <circle cx='12' cy='4' r='1' fill='var(--text-general)' />
        <path d='M4 11H2' stroke='var(--text-general)' strokeWidth='1.5' strokeLinecap='round' />
        <path d='M22 11H20' stroke='var(--text-general)' strokeWidth='1.5' strokeLinecap='round' />
    </svg>
);

const DTraderIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M3 13L7 9L11 13L17 7L21 11'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M17 7H21V11'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <rect
            x='2'
            y='17'
            width='20'
            height='5'
            rx='1'
            stroke='var(--text-general)'
            strokeWidth='2'
            fill='none'
        />
        <path d='M6 19H6.01' stroke='var(--text-general)' strokeWidth='2' strokeLinecap='round' />
        <path d='M10 19H10.01' stroke='var(--text-general)' strokeWidth='2' strokeLinecap='round' />
    </svg>
);

const ForexIcon = () => (
    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path
            d='M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M12 6V12L16 14'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M8 16H16'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M10 18H14'
            stroke='var(--text-general)'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const { dashboard, load_modal, run_panel, summary_card } = useStore();
    const { active_tab, is_chart_modal_visible, setActiveTab } = dashboard;
    const {
        is_dialog_open,
        dialog_options,
        onCancelButtonClick,
        onCloseDialog,
        onOkButtonClick,
        stopBot,
        is_drawer_open,
    } = run_panel;
    const { cancel_button_text, ok_button_text, title, message } = dialog_options as { [key: string]: string };
    const { clear } = summary_card;
    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Create a history-like object for the Tabs component
    const history = {
        location,
        replace: (path: string) => navigate(path, { replace: true }),
        length: window.history.length,
        scrollRestoration: 'auto' as ScrollRestoration,
        state: null,
        back: () => window.history.back(),
        forward: () => window.history.forward(),
        go: (delta?: number) => window.history.go(delta),
        pushState: (data: any, title: string, url?: string | null) => window.history.pushState(data, title, url),
        replaceState: (data: any, title: string, url?: string | null) => window.history.replaceState(data, title, url),
    };

    interface Bot {
        title: string;
        image: string;
        filePath: string;
        xmlContent: string;
        category: string;
        popularity: number;
        description: string;
        premium?: boolean;
    }

    const [bots, setBots] = useState<Bot[]>([]);
    const [analysisToolUrl, setAnalysisToolUrl] = useState('advanced'); // Changed default to 'advanced'
    const [botsCategory, setBotsCategory] = useState('automated');
    const [searchQuery, setSearchQuery] = useState('');
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [showPremiumPopup, setShowPremiumPopup] = useState(false);
    const [selectedPremiumBot, setSelectedPremiumBot] = useState<Bot | null>(null);
    const [premiumEmails, setPremiumEmails] = useState<string[]>([]);
    const [isCurrentUserPremium, setIsCurrentUserPremium] = useState<boolean>(false);
    const [premiumDataLoaded, setPremiumDataLoaded] = useState<boolean>(false);
    const [premiumUsers, setPremiumUsers] = useState<any[]>([]);
    useUrlBotLoader({
        bots,
        setActiveTab,
        loadModal: load_modal,
    });

    useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) {
                clear();
                stopBot();
                api_base.setIsRunning(false);
            }
        }
    }, [clear, connectionStatus, stopBot]);

    useEffect(() => {
        const tab_param = searchParams.get('tab');
        const subtab_param = searchParams.get('subtab');
        
        if (tab_param !== null) {
            const tab_index = TAB_IDS.findIndex(id => id === tab_param);
            if (tab_index >= 0) {
                setActiveTab(tab_index);
                
                // Handle subtab parameter for Analysis Tool
                if (tab_param === 'id-analysis-tool' && subtab_param) {
                    const validSubtabs = ['ai', 'ldpanalyzer', 'arbitrage', 'instances'];
                    if (validSubtabs.includes(subtab_param)) {
                        setAnalysisToolUrl(subtab_param);
                    }
                }
            }
        }

        // Set overunder state to "no" on page load
        localStorage.setItem('is_auto_overunder', 'false');
    }, [searchParams, setActiveTab, setSearchParams]);

    useEffect(() => {
        const fetchBots = async () => {
            const botFiles = [
                {
                    file: 'Legacy 2026 Over.xml',
                    title: 'Legacy 2026 Over',
                    category: 'automated',
                    description:
                        'Trades digit over, after a loss, it increases prediction to maintain same stake. Best for accounts with $50+ balance.',
                    premium: false,
    },
                {
                    file: 'Ultra Recovery.xml',
                    category: 'automated',
                    popularity: 100,
                    premium: false,
                    description:
                        'Advanced recovery system with smart frequency analysis, dual prediction targeting, and dynamic risk management for consistent profitability.',
                },
                {
                    file: 'Elite Startrader.xml',
                    category: 'automated',
                    popularity: 99,
                    description:
                        'High-performance trading bot with frequency analysis, dynamic predictions, and advanced risk management system.',
                },
                {
                    file: 'Oracle OverUnder Pro.xml',
                    category: 'automated',
                    popularity: 98,
                    description:
                        'Advanced Over/Under Oracle with smart martingale, dual prediction system, and configurable take profit/stop loss management.',
                },
                {
                    file: '2025 Bot  Over Under.xml',
                    category: 'automated',
                    popularity: 97,
                    description:
                        'Advanced 2025 Over/Under bot with digit analysis, frequency tracking, and intelligent prediction system for optimal market timing.',
                },
                {
                    file: '2025 Original Version.xml',
                    category: 'popular',
                    popularity: 96,
                    description:
                        'Advanced 2025 Even/Odd digit bot with smart profit targeting, loss management, and adaptive stake adjustment for maximum profitability.',
                },
                {
                    file: 'Turbo O_U Accelerator.xml',
                    category: 'automated',
                    popularity: 95,
                    premium: false,
                    description:
                        'Advanced over/under trading strategy with turbo speed execution and intelligent market prediction.',
                },
                {
                    file: 'Market Legend v2.xml',
                    category: 'automated',
                    popularity: 92,
                    description:
                        'Community favorite with proven track record in various market conditions and excellent risk management.',
                },
                {
                    file: 'Auto Differ Recovery O_U.xml',
                    category: 'automated',
                    popularity: 90,
                    description:
                        'Automated difference recovery strategy for over/under markets with adaptive risk management.',
                },
                {
                    file: 'Godzilla.xml',
                    category: 'automated',
                    popularity: 88,
                    premium: false,
                    description:
                        'Powerful automated trading beast that adapts to market volatility with machine learning algorithms.',
                },
                {
                    file: 'Envy Pro Differ.xml',
                    category: 'popular',
                    popularity: 85,
                    description:
                        'Reliable difference-based trading strategy perfect for beginners and steady profit seekers.',
                },
                {
                    file: 'H_L Auto Fortress.xml',
                    category: 'automated',
                    popularity: 90,
                    description:
                        'High-Low automated vault system with built-in profit protection and loss prevention mechanisms.',
                },
                {
                    file: 'Top-notch 2.xml',
                    category: 'automated',
                    popularity: 94,
                    description:
                        'Top-rated strategy loved by professional traders for its consistency and impressive performance metrics.',
                },
                {
                    file: 'Core Bot V3.xml',
                    category: 'popular',
                    popularity: 82,
                    description:
                        'Stable and dependable trading bot with conservative approach and long-term profitability focus.',
                },
                {
                    file: '	EvenOdd Dominator.xml',
                    category: 'popular',
                    popularity: 89,
                    premium: false,
                    description:
                        'Highly effective even/odd prediction bot with advanced pattern recognition and statistical analysis.',
                },
                {
                    file: ' 🫰Pro  Differ Bot .xml',
                    category: 'automated',
                    popularity: 91,
                    description:
                        'Unstoppable difference-based trading strategy with advanced digit tracking and smart recovery system for consistent wins.',
                },
                {
                    file: 'Under 9 Bot.xml',
                    category: 'regular',
                    popularity: 84,
                    description:
                        'Sequential digit under strategy targeting digits under 9 with smart prediction rotation and adaptive stake management.',
                },
                {
                    file: '	Accumulator Anti-D Alembert.xml',
                    category: 'advanced',
                    popularity: 87,
                    description:
                        "Advanced accumulator bot with Reverse D'Alembert strategy, featuring profit/loss thresholds, adaptive stake management, and tick-based sell controls.",
                },
            ];

            const botPromises = botFiles.map(async ({ file, category, popularity, description, premium }) => {
                try {
                    console.log(`🔄 Fetching bot file: ${file}`);
                    const response = await fetch(`/${file}`);
                    if (!response.ok) {
                        console.warn(`⚠️ Failed to fetch ${file}: ${response.status} ${response.statusText}`);
                        // For demo purposes, create mock data if file doesn't exist
                        return {
                            title: file.split('/').pop()?.replace('.xml', '') || file,
                            image: 'default_image_path',
                            filePath: file,
                            xmlContent: `<?xml version="1.0" encoding="UTF-8"?><xml><block type="root">${file}</block></xml>`,
                            category,
                            popularity,
                            description,
                            premium,
                        };
                    }
                    const text = await response.text();
                    console.log(`✅ Successfully fetched ${file}, content length: ${text.length}`);
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(text, 'application/xml');
                    return {
                        title: file.split('/').pop()?.replace('.xml', '') || file,
                        image: xml.getElementsByTagName('image')[0]?.textContent || 'default_image_path',
                        filePath: file,
                        xmlContent: text,
                        category,
                        popularity,
                        description,
                        premium,
                    };
                } catch (error) {
                    console.error(`❌ Error fetching ${file}:`, error);
                    // Return mock data for demo
                    return {
                        title: file.split('/').pop()?.replace('.xml', '') || file,
                        image: 'default_image_path',
                        filePath: file,
                        xmlContent: `<?xml version="1.0" encoding="UTF-8"?><xml><block type="root">${file}</block></xml>`,
                        category,
                        popularity,
                        description,
                        premium,
                    };
                }
            });
            const bots = (await Promise.all(botPromises)).filter(Boolean);
            console.log('Bots fetched successfully:', bots.length, 'bots');
            console.log(
                'Bot titles:',
                bots.map(b => b.title)
            );
            setBots(bots);
        };

        fetchBots();
    }, []);

    // Fetch premium emails and user data when free bots section is opened
    useEffect(() => {
        if (active_tab === DBOT_TABS.FREE_BOTS) {
            const fetchPremiumEmails = async () => {
                try {
                    console.log('📧 Fetching premium emails...');
                    
                    const baseUrl = 'https://database.binaryfx.site/api/1.1/obj/premium';
                    console.log(`🔗 GET request to: ${baseUrl}`);

                    const response = await fetch(baseUrl, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        console.error('❌ Failed to fetch premium emails:', response.status);
                        setPremiumDataLoaded(true);
                        return;
                    }

                    const data = await response.json();
                    console.log('✅ Premium API Response:', data);

                    // Extract emails from response structure: data.response.results[].emails
                    let emails: string[] = [];
                    let users: any[] = [];
                    
                    if (data.response?.results && Array.isArray(data.response.results)) {
                        // Store full user data for search enhancement
                        users = data.response.results;
                        
                        // Extract emails from each user record
                        data.response.results.forEach((item: any) => {
                            if (item.emails && Array.isArray(item.emails)) {
                                emails = emails.concat(item.emails);
                            } else if (item.emails && typeof item.emails === 'string') {
                                emails = emails.concat(item.emails.split(',').map((e: string) => e.trim()));
                            }
                        });
                    }
                    
                    // Filter out empty strings and duplicates
                    emails = [...new Set(emails.filter((email: string) => email && email.length > 0))];
                    
                    // Store emails and users in state
                    setPremiumEmails(emails);
                    setPremiumUsers(users);
                    setPremiumDataLoaded(true);
                    
                    // Check if current user's email is in the premium list
                    const userEmail = localStorage.getItem('userEmail');
                    console.log('👤 Current user email:', userEmail);
                    
                    if (userEmail) {
                        const isPremium = emails.some((email: string) => 
                            email.toLowerCase() === userEmail.toLowerCase()
                        );
                        setIsCurrentUserPremium(isPremium);
                        console.log(`${isPremium ? '✅' : '❌'} User is ${isPremium ? 'PREMIUM' : 'NOT PREMIUM'}`);
                    }
                    
                    if (emails.length > 0) {
                        console.log('📋 Premium Emails:', emails);
                        console.log(`🎯 Total Premium Users: ${emails.length}`);
                    } else {
                        console.log('⚠️ No premium emails found in response');
                    }
                } catch (error) {
                    console.error('💥 Error fetching premium emails:', error);
                    setPremiumDataLoaded(true);
                }
            };

            fetchPremiumEmails();
        }
    }, [active_tab]);

    const handlePurchaseClick = useCallback(() => {
        const whatsappNumber = '254735525483'; // Replace with your WhatsApp number (country code + number, no + sign)
        const message = `Hi, I'm interested in purchasing access to all premium bots for $19 (one-time payment). Please provide more details.`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    }, []);

    const handleTabChange = useCallback(
        (index: number) => {
            setActiveTab(index);
            setSearchParams({ tab: TAB_IDS[index] });
        },
        [setActiveTab, setSearchParams]
    );

    const handleShareBot = useCallback((bot: Bot, event: React.MouseEvent) => {
        event.stopPropagation();
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('bot', encodeURIComponent(bot.title));
        currentUrl.searchParams.set('tab', 'id-bot-builder');

        navigator.clipboard
            .writeText(currentUrl.toString())
            .then(() => {
                // Show success notification or toast
                console.log('Bot link copied to clipboard:', currentUrl.toString());
                // You might want to add a toast notification here

                // Create a temporary notification element
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--brand-red-coral);
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    z-index: 10000;
                    animation: slideIn 0.3s ease-out;
                `;
                notification.textContent = 'Bot link copied to clipboard!';
                document.body.appendChild(notification);

                // Add CSS animation
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);

                setTimeout(() => {
                    notification.remove();
                    style.remove();
                }, 3000);
            })
            .catch(err => {
                console.error('Failed to copy bot link:', err);
                // Fallback: show the URL in an alert or modal
                alert(`Copy this link to share the bot:\n${currentUrl.toString()}`);
            });
    }, []);

    const handleBotClick = useCallback(
        async (bot: Bot) => {
            console.log('🚀 Loading bot:', bot.title);

            // Check if bot is premium
            if (bot.premium) {
                console.log('⭐ Premium bot selected:', bot.title);
                
                // If user is premium, allow access
                if (isCurrentUserPremium) {
                    console.log('✅ User is premium - granting access to bot');
                    // Continue to load the bot
                } else {
                    // Show premium popup for non-premium users
                    console.log('🔒 User is not premium - showing premium popup');
                    setSelectedPremiumBot(bot);
                    setShowPremiumPopup(true);
                    return;
                }
            }

            // Switch to bot builder tab first
            setActiveTab(DBOT_TABS.BOT_BUILDER);

            try {
                if (!bot.xmlContent) {
                    throw new Error('No XML content available for this bot');
                }

                // Create a temporary strategy object
                const tempStrategy = {
                    id: `temp_${Date.now()}`,
                    xml: bot.xmlContent,
                    name: bot.title,
                    save_type: 'local',
                    timestamp: Date.now(),
                };

                // Use the load modal's loadStrategyToBuilder method
                if (load_modal?.loadStrategyToBuilder) {
                    console.log('🔄 Loading strategy to builder...');
                    await load_modal.loadStrategyToBuilder(tempStrategy);
                    console.log('✅ Bot loaded successfully!');
                    // Show success notification
                    botNotification(`${bot.title} loaded successfully`, undefined, {
                        type: 'success',
                        autoClose: 3000
                    });
                } else {
                    console.error('❌ loadStrategyToBuilder method not available');
                }
            } catch (error) {
                console.error('💥 Error loading bot:', error);
                throw error;
            }
        },
        [setActiveTab, load_modal, isCurrentUserPremium]
    );

    // Simple URL bot loading - runs when we have bots and a bot parameter
    useEffect(() => {
        const botParam = searchParams.get('bot');

        // Only proceed if we have both bots loaded and a bot parameter
        if (!botParam || bots.length === 0) {
            console.log('⏭️ Skipping URL bot loading:', {
                hasBotParam: !!botParam,
                botsCount: bots.length,
            });
            return;
        }

        console.log('🔍 URL Bot Loading - Starting process...');
        console.log('📋 Bot parameter:', botParam);
        console.log(
            '🤖 Available bots:',
            bots.map(b => b.title)
        );

        const decodedBotName = decodeURIComponent(botParam);
        console.log('� Decoded bot name:', decodedBotName);

        // Find bot with flexible matching
        const foundBot = bots.find(bot => {
            const exactTitleMatch = bot.title === decodedBotName;
            const fileNameMatch = bot.filePath.replace('.xml', '') === decodedBotName;

            console.log(`🔍 Checking "${bot.title}":`, {
                exactTitleMatch,
                fileNameMatch,
                botTitle: bot.title,
                filePath: bot.filePath,
            });

            return exactTitleMatch || fileNameMatch;
        });

        if (foundBot) {
            console.log('✅ Found matching bot:', foundBot.title);
            console.log('📄 Has XML content:', !!foundBot.xmlContent, 'Length:', foundBot.xmlContent?.length);

            // Load the bot immediately
            handleBotClick(foundBot)
                .then(() => {
                    console.log('🎉 Bot loaded successfully from URL!');
                })
                .catch(error => {
                    console.error('� Failed to load bot from URL:', error);
                });
        } else {
            console.log('❌ No matching bot found for:', decodedBotName);
        }
    }, [bots, searchParams, handleBotClick, isCurrentUserPremium]);

    const toggleAnalysisTool = (url: string) => {
        setAnalysisToolUrl(url);
        // Update URL parameter to reflect current subtab
        const currentParams = new URLSearchParams(searchParams);
        currentParams.set('subtab', url);
        setSearchParams(currentParams);
    };

    const renderAnalysisToolContent = () => {
        if (analysisToolUrl === 'instances') {
            return (
                <div style={{ height: '600px', overflow: 'hidden', paddingBottom: '36px' }}>
                    <Suspense fallback={<ChunkLoader message={localize('Loading Analysis Tool...')} />}>
                        <InstancesAnalysis />
                    </Suspense>
                </div>
            );
        }
        
        if (analysisToolUrl === 'advanced') {
            return (
                <div style={{ height: '600px', overflow: 'auto', paddingBottom: '36px' }}>
                    <Suspense fallback={<ChunkLoader message={localize('Loading Advanced Display...')} />}>
                        <AdvancedDisplay />
                    </Suspense>
                </div>
            );
        }
        
        return (
            <iframe
                src={analysisToolUrl}
                width='100%'
                height='600px'
                style={{ border: 'none', display: 'block' }}
                scrolling='yes'
            />
        );
    };

    const showRunPanel = [
        DBOT_TABS.BOT_BUILDER,
        DBOT_TABS.CHART,
        DBOT_TABS.ANALYSIS_TOOL,
        DBOT_TABS.FREE_BOTS,
    ].includes(active_tab);

    // Scroll to top functionality
    useEffect(() => {
        const handleScroll = () => {
            const scrollContainer = document.querySelector('.free-bots-container');
            if (scrollContainer) {
                const scrollTop = scrollContainer.scrollTop;
                setShowScrollTop(scrollTop > 300);
            }
        };

        const scrollContainer = document.querySelector('.free-bots-container');
        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll);
            return () => scrollContainer.removeEventListener('scroll', handleScroll);
        }
    }, [active_tab]);

    const scrollToTop = () => {
        const scrollContainer = document.querySelector('.free-bots-container');
        if (scrollContainer) {
            scrollContainer.scrollTo({
                top: 0,
                behavior: 'smooth',
            });
        }
    };

    return (
        <React.Fragment>
            <div className='main'>
                <div className='main__container'>
                    <Tabs
                        active_index={active_tab}
                        className='main__tabs'
                        onTabItemClick={handleTabChange}
                        history={history}
                        top
                    >
                        <div
                            label={
                                <>
                                    <DashboardIcon />
                                    <Localize i18n_default_text='Dashboard' />
                                </>
                            }
                            id='id-dbot-dashboard'
                        >
                            <Dashboard handleTabChange={handleTabChange} />
                        </div>
                        <div
                            label={
                                <>
                                    <BotBuilderIcon />
                                    <Localize i18n_default_text='Bot Builder' />
                                </>
                            }
                            id='id-bot-builder'
                        />
                        <div
                            label={
                                <>
                                    <DTraderIcon />
                                    <Localize i18n_default_text='DTrader' />
                                </>
                            }
                            id='id-dtrader'
                        >
                            <Suspense fallback={<ChunkLoader message={localize('Loading DTrader...')} />}>
                                <DTrader />
                            </Suspense>
                        </div>
                        <div
                            label={
                                <>
                                    <ChartsIcon />
                                    <Localize i18n_default_text='Smart trading' />
                                </>
                            }
                            id='id-charts'
                        >
                            <Suspense fallback={<ChunkLoader message={localize('Please wait, loading chart...')} />}>
                                <Chart show_digits_stats={true} />
                            </Suspense>
                        </div>
                        <div
                            label={
                                <>
                                    <AnalysisToolIcon />
                                    <Localize i18n_default_text='Analysis Tool' />
                                </>
                            }
                            id='id-analysis-tool'
                        >
                            <div
                                className={classNames('dashboard__chart-wrapper', {
                                    'dashboard__chart-wrapper--expanded': is_drawer_open && isDesktop,
                                    'dashboard__chart-wrapper--modal': is_chart_modal_visible && isDesktop,
                                })}
                            >
                                <div className='analysis-tool-toggle'>
                                    <button
                                        onClick={() => toggleAnalysisTool('advanced')}
                                        className={`analysis-tool-toggle__button ${
                                            analysisToolUrl === 'advanced' ? 'active' : ''
                                        }`}
                                    >
                                        Advanced
                                    </button>
                                    <button
                                        onClick={() => toggleAnalysisTool('instances')}
                                        className={`analysis-tool-toggle__button ${
                                            analysisToolUrl === 'instances' ? 'active' : ''
                                        }`}
                                    >
                                        Instances
                                    </button>
                                    <button
                                        onClick={() => toggleAnalysisTool('ai')}
                                        className={`analysis-tool-toggle__button ${
                                            analysisToolUrl === 'ai' ? 'active' : ''
                                        }`}
                                    >
                                        A Tool
                                    </button>
                                    <button
                                        onClick={() => toggleAnalysisTool('arbitrage')}
                                        className={`analysis-tool-toggle__button ${
                                            analysisToolUrl === 'arbitrage' ? 'active' : ''
                                        }`}
                                    >
                                        Arbitrage
                                    </button>
                                    <button
                                        onClick={() => toggleAnalysisTool('ldpanalyzer')}
                                        className={`analysis-tool-toggle__button ${
                                            analysisToolUrl === 'ldpanalyzer' ? 'active' : ''
                                        }`}
                                    >
                                        LDP Tool
                                    </button>
                                </div>
                                {renderAnalysisToolContent()}
                            </div>
                        </div>
                        <div
                            label={
                                <>
                                    <FreeBotsIcon />
                                    <Localize i18n_default_text='Free Bots' />
                                </>
                            }
                            id='id-free-bots'
                        >
                            <div className='free-bots-container'>
                                <div className='container-content'>
                                    {/* Header Section */}
                                    <div className='free-bots-header'>
                                        <h1 className='free-bots-header__title'>
                                            <Localize i18n_default_text='Premium Trading Bots' />
                                        </h1>
                                        <p className='free-bots-header__subtitle'>
                                            <Localize i18n_default_text='Discover our collection of professionally designed trading bots. Choose from automated strategies, popular community favorites, or reliable everyday trading solutions.' />
                                        </p>

                                        {/* Statistics */}
                                        <div className='free-bots-stats'>
                                            <div className='free-bots-stats__item'>
                                                <div className='free-bots-stats__number'>{bots.length}</div>
                                                <div className='free-bots-stats__label'>
                                                    <Localize i18n_default_text='Available Bots' />
                                                </div>
                                            </div>
                                            <div className='free-bots-stats__item'>
                                                <div className='free-bots-stats__number'>95%</div>
                                                <div className='free-bots-stats__label'>
                                                    <Localize i18n_default_text='Success Rate' />
                                                </div>
                                            </div>
                                            <div className='free-bots-stats__item'>
                                                <div className='free-bots-stats__number'>24/7</div>
                                                <div className='free-bots-stats__label'>
                                                    <Localize i18n_default_text='Trading' />
                                                </div>
                                            </div>
                                            <div className='free-bots-stats__item'>
                                                <div className='free-bots-stats__number'>
                                                    {bots.filter(bot => bot.category === botsCategory).length}
                                                </div>
                                                <div className='free-bots-stats__label'>
                                                    {botsCategory === 'automated' && (
                                                        <Localize i18n_default_text='Auto Bots' />
                                                    )}
                                                    {botsCategory === 'popular' && (
                                                        <Localize i18n_default_text='Popular' />
                                                    )}
                                                    {botsCategory === 'regular' && (
                                                        <Localize i18n_default_text='Regular' />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Search Bar */}
                                    <div className='free-bots-search'>
                                        <input
                                            type='text'
                                            className='free-bots-search__input'
                                            placeholder='Search bots by name or description...'
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>

                                    {/* Category Filters */}
                                    <div className='free-bots-filters'>
                                        {[
                                            { key: 'automated', label: 'Automated Strategies', icon: '🤖' },
                                            { key: 'popular', label: 'Community Favorites', icon: '⭐' },
                                            { key: 'regular', label: 'Reliable Classics', icon: '📊' },
                                        ].map(category => (
                                            <button
                                                key={category.key}
                                                onClick={() => setBotsCategory(category.key)}
                                                className={`free-bots-filters__button ${
                                                    botsCategory === category.key
                                                        ? 'free-bots-filters__button--active'
                                                        : ''
                                                }`}
                                            >
                                                <span style={{ marginRight: '8px' }}>{category.icon}</span>
                                                <Localize i18n_default_text={category.label} />
                                            </button>
                                        ))}
                                    </div>

                                    {/* Bots Grid */}
                                    {bots.length === 0 ? (
                                        <div className='loading-skeleton'>
                                            <div className='free-bots-grid'>
                                                {Array.from({ length: 6 }).map((_, index) => (
                                                    <div key={index} className='bot-card'>
                                                        <div className='bot-card__header'>
                                                            <div className='bot-card__icon'>
                                                                <BotIcon />
                                                            </div>
                                                            <div>
                                                                <h3 className='bot-card__title'>Loading...</h3>
                                                            </div>
                                                        </div>
                                                        <div className='bot-card__content'>
                                                            <p className='bot-card__description'>
                                                                Loading bot details...
                                                            </p>
                                                            <div className='bot-card__features'>
                                                                <span className='bot-card__feature'>Loading</span>
                                                            </div>
                                                            <button className='bot-card__action'>
                                                                <Localize i18n_default_text='Load Bot' />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className='free-bots-grid'>
                                            {bots
                                                .filter(bot => bot.category === botsCategory)
                                                .filter(
                                                    bot =>
                                                        searchQuery === '' ||
                                                        bot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                        bot.description
                                                            .toLowerCase()
                                                            .includes(searchQuery.toLowerCase())
                                                )
                                                .map((bot, index) => (
                                                    <div
                                                        key={index}
                                                        className={`bot-card ${bot.premium ? 'bot-card--premium' : ''} ${bot.premium && isCurrentUserPremium ? 'bot-card--unlocked' : ''}`}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            handleBotClick(bot);
                                                        }}
                                                    >
                                                        {bot.premium && (
                                                            <div className={`bot-card__premium-ribbon ${isCurrentUserPremium ? 'bot-card__premium-ribbon--unlocked' : ''}`}>
                                                                <span>{isCurrentUserPremium ? 'UNLOCKED ✓' : 'PREMIUM ★'}</span>
                                                            </div>
                                                        )}
                                                        <div className='bot-card__header'>
                                                            <div className='bot-card__icon'>
                                                                <BotIcon />
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <h3 className='bot-card__title'>
                                                                    {bot.title
                                                                        .replace('.xml', '')
                                                                        .replace(/[-_]/g, ' ')}
                                                                </h3>
                                                                {bot.popularity && (
                                                                    <div
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            marginTop: '4px',
                                                                        }}
                                                                    >
                                                                        <span
                                                                            style={{
                                                                                fontSize: '0.75rem',
                                                                                color: 'var(--text-general)',
                                                                            }}
                                                                        >
                                                                            Rating:
                                                                        </span>
                                                                        <div
                                                                            style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '2px',
                                                                            }}
                                                                        >
                                                                            {Array.from({ length: 5 }).map((_, i) => (
                                                                                <span
                                                                                    key={i}
                                                                                    style={{
                                                                                        fontSize: '0.75rem',
                                                                                        color:
                                                                                            i <
                                                                                            Math.floor(
                                                                                                bot.popularity / 20
                                                                                            )
                                                                                                ? '#FFD700'
                                                                                                : 'var(--border-normal)',
                                                                                    }}
                                                                                >
                                                                                    ⭐
                                                                                </span>
                                                                            ))}
                                                                            <span
                                                                                style={{
                                                                                    fontSize: '0.7rem',
                                                                                    color: 'var(--text-general)',
                                                                                    marginLeft: '4px',
                                                                                }}
                                                                            >
                                                                                ({bot.popularity}%)
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button
                                                                className='bot-card__share-button'
                                                                onClick={e => handleShareBot(bot, e)}
                                                                title='Share this bot'
                                                                aria-label='Share bot link'
                                                            >
                                                                <svg
                                                                    width='16'
                                                                    height='16'
                                                                    viewBox='0 0 24 24'
                                                                    fill='currentColor'
                                                                >
                                                                    <path d='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z' />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div className='bot-card__content'>
                                                            <p className='bot-card__description'>
                                                                {bot.description || (
                                                                    <>
                                                                        {botsCategory === 'automated' && (
                                                                            <Localize i18n_default_text='Advanced automated trading strategy with intelligent market analysis and risk management.' />
                                                                        )}
                                                                        {botsCategory === 'popular' && (
                                                                            <Localize i18n_default_text='Highly rated bot trusted by thousands of traders worldwide for consistent performance.' />
                                                                        )}
                                                                        {botsCategory === 'regular' && (
                                                                            <Localize i18n_default_text='Stable and reliable trading bot perfect for long-term trading strategies.' />
                                                                        )}
                                                                    </>
                                                                )}
                                                            </p>
                                                            <div className='bot-card__features'>
                                                                {botsCategory === 'automated' && (
                                                                    <>
                                                                        <span className='bot-card__feature'>
                                                                            Auto-Execute
                                                                        </span>
                                                                        <span className='bot-card__feature'>
                                                                            Risk Control
                                                                        </span>
                                                                        <span className='bot-card__feature'>
                                                                            24/7 Trading
                                                                        </span>
                                                                    </>
                                                                )}
                                                                {botsCategory === 'popular' && (
                                                                    <>
                                                                        <span className='bot-card__feature'>
                                                                            Community Tested
                                                                        </span>
                                                                        <span className='bot-card__feature'>
                                                                            High Performance
                                                                        </span>
                                                                        <span className='bot-card__feature'>
                                                                            User Favorite
                                                                        </span>
                                                                    </>
                                                                )}
                                                                {botsCategory === 'regular' && (
                                                                    <>
                                                                        <span className='bot-card__feature'>
                                                                            Stable
                                                                        </span>
                                                                        <span className='bot-card__feature'>
                                                                            Low Risk
                                                                        </span>
                                                                        <span className='bot-card__feature'>
                                                                            Beginner Friendly
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <button
                                                                className='bot-card__action'
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    handleBotClick(bot);
                                                                }}
                                                            >
                                                                <Localize i18n_default_text='Load Bot' />
                                                                <svg viewBox='0 0 24 24' fill='currentColor'>
                                                                    <path d='M8.59 16.59L13.17 12L8.59 7.41L10 6L16 12L10 18L8.59 16.59Z' />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    )}

                                    {/* Empty State */}
                                    {bots.length > 0 &&
                                        bots
                                            .filter(bot => bot.category === botsCategory)
                                            .filter(
                                                bot =>
                                                    searchQuery === '' ||
                                                    bot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    bot.description.toLowerCase().includes(searchQuery.toLowerCase())
                                            ).length === 0 && (
                                            <div className='free-bots-empty'>
                                                <div className='free-bots-empty__icon'>
                                                    <BotIcon />
                                                </div>
                                                <h3 className='free-bots-empty__title'>
                                                    {searchQuery ? (
                                                        <Localize i18n_default_text='No bots found' />
                                                    ) : (
                                                        <Localize i18n_default_text='No bots available' />
                                                    )}
                                                </h3>
                                                <p className='free-bots-empty__description'>
                                                    {searchQuery ? (
                                                        <Localize i18n_default_text='No bots match your search criteria. Try adjusting your search terms.' />
                                                    ) : (
                                                        <Localize i18n_default_text='There are no bots available in this category at the moment. Please try another category.' />
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                </div>

                                {/* Scroll to Top Button */}
                                {showScrollTop && (
                                    <button
                                        className={`scroll-to-top ${showScrollTop ? 'scroll-to-top--visible' : ''}`}
                                        onClick={scrollToTop}
                                        aria-label='Scroll to top'
                                    >
                                        <svg viewBox='0 0 24 24' fill='currentColor'>
                                            <path d='M7.41 15.41L12 10.83L16.59 15.41L18 14L12 8L6 14L7.41 15.41Z' />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            
                        </div>
                        <div
                            label={
                                <>
                                    <PortfolioIcon />
                                    <Localize i18n_default_text='Portfolio' />
                                </>
                            }
                            id='id-portfolio'
                        >
                            <div className='dashboard__portfolio-wrapper'>
                                <PortfolioDisplay />
                            </div>
                        </div>
                        <div
                            label={
                                <>
                                    <ForexIcon />
                                    <Localize i18n_default_text='Forex' />
                                </>
                            }
                            id='id-forex'
                        >
                            <div className='dashboard__forex-wrapper'>
                                <Suspense fallback={<ChunkLoader message={localize('Loading Forex...')} />}>
                                    <Forex />
                                </Suspense>
                            </div>
                        </div>
                    </Tabs>
                </div>
            </div>
            <DesktopWrapper>
                <div className='main__run-strategy-wrapper'>
                    {active_tab !== DBOT_TABS.DTRADER && active_tab !== DBOT_TABS.PORTFOLIO && active_tab !== DBOT_TABS.FOREX && <RunStrategy />}
                    {showRunPanel && <RunPanel />}
                </div>
                <ChartModal />
                <TradingViewModal />
                <AnalysistoolModal />
                <SignalsModal />
                <AdvancedDisplayModal />
                <StandaloneChartModal />
            </DesktopWrapper>
            <MobileWrapper>
                {active_tab !== DBOT_TABS.DTRADER && active_tab !== DBOT_TABS.PORTFOLIO && active_tab !== DBOT_TABS.FOREX && <RunPanel />}
            </MobileWrapper>
            <Dialog
                cancel_button_text={cancel_button_text || localize('Cancel')}
                confirm_button_text={ok_button_text || localize('Ok')}
                has_close_icon
                is_visible={is_dialog_open}
                onCancel={onCancelButtonClick || onCloseDialog}
                onClose={onCloseDialog}
                onConfirm={onOkButtonClick || onCloseDialog}
                title={title}
            >
                {message}
            </Dialog>

            {/* Premium Access Popup */}
            {showPremiumPopup && (
                <div className='premium-popup-overlay'>
                    <div className='premium-popup'>
                        <button
                            className='premium-popup__close'
                            onClick={() => setShowPremiumPopup(false)}
                            aria-label='Close'
                        >
                            ✕
                        </button>
                        <div className='premium-popup__header'>
                            <span className='premium-popup__star'>⭐</span>
                            <h2 className='premium-popup__title'>Premium Bot Access</h2>
                            <span className='premium-popup__star'>⭐</span>
                        </div>
                        <div className='premium-popup__content'>
                            <p className='premium-popup__description'>
                                Get access to all premium bots including <strong>{selectedPremiumBot?.title}</strong> and unlock exclusive trading strategies designed for maximum profitability.
                            </p>
                            <div className='premium-popup__pricing'>
                                <span className='premium-popup__price'>$19</span>
                                <span className='premium-popup__period'>one-time</span>
                            </div>
                            <ul className='premium-popup__features'>
                                <li>✓ Lifetime access to all 5 premium bots</li>
                                <li>✓ Advanced trading strategies</li>
                                <li>✓ Regular updates & improvements</li>
                                <li>✓ Priority support</li>
                                <li>✓ One-time payment</li>
                            </ul>
                        </div>
                        <div className='premium-popup__actions'>
                            <button
                                className='premium-popup__purchase-btn'
                                onClick={handlePurchaseClick}
                            >
                                <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                                    <path d='M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z' />
                                </svg>
                                Contact via WhatsApp
                            </button>
                            <button
                                className='premium-popup__cancel-btn'
                                onClick={() => setShowPremiumPopup(false)}
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
});

export default AppWrapper;
