import React, { useCallback, useEffect,useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useShareBot } from '@/hooks/useShareBot';
import { useStore } from '@/hooks/useStore';
import { LabelPairedSearchMdRegularIcon, LabelPairedXmarkMdRegularIcon } from '@deriv/quill-icons/LabelPaired';
import { localize } from '@deriv-com/translations';
import { TStrategy } from 'Types';

// Comprehensive bot files available for search - includes all bots from public directory
const availableBots = [
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
        title: 'Ultra Recovery',
        category: 'automated',
        description: 'Advanced recovery system with smart frequency analysis, dual prediction targeting, and dynamic risk management for consistent profitability.',
        premium: false,
    },
    {
        file: 'Elite Startrader.xml',
        title: 'Elite Startrader',
        category: 'automated',
        description: 'High-performance trading bot with frequency analysis, dynamic predictions, and advanced risk management system.',
        premium: false,
    },
    {
        file: 'Oracle OverUnder Pro.xml',
        title: 'Oracle OverUnder Pro',
        category: 'automated',
        description: 'Advanced Over/Under Oracle with smart martingale, dual prediction system, and configurable take profit/stop loss management.',
    },
    {
        file: '	2025 Bot  Over Under.xml',
        title: '2025 Bot Over Under',
        category: 'automated',
        description: 'Advanced 2025 Over/Under bot with digit analysis, frequency tracking, and intelligent prediction system for optimal market timing.',
    },
    {
        file: '1 tick DIgit Over 2.xml',
        title: '1 Tick Digit Over 2',
        category: 'regular',
        description: 'Single tick digit over strategy with precise timing and statistical edge.',
    },
    {
        file: '2025 Original Version.xml',
        title: '2025 Original Version',
        category: 'popular',
        description:
            'Advanced 2025 Even/Odd digit bot with smart profit targeting, loss management, and adaptive stake adjustment for maximum profitability.',
    },
    {
        file: 'Auto Differ Recovery O_U.xml',
        title: 'Auto Differ Recovery O_U',
        category: 'automated',
        description: 'Automated difference recovery strategy for over/under markets with adaptive risk management.',
    },
    {
        file: 'Core Bot V3.xml',
        title: 'Core Bot V3.xml',
        category: 'popular',
        description: 'Stable and dependable trading bot with conservative approach and long-term profitability focus.',
    },
    {
        file: 'Digit Over 3.xml',
        title: 'Digit Over 3',
        category: 'regular',
        description: 'Specialized digit over strategy targeting number 3 with high accuracy pattern recognition.',
    },
    {
        file: 'Envy Pro Differ.xml',
        title: 'Envy Pro Differ',
        category: 'popular',
        description: 'Reliable difference-based trading strategy perfect for beginners and steady profit seekers.',
    },
    {
        file: '	EvenOdd Dominator.xml',
        title: 'Even Odd Dominator',
        category: 'popular',
        description:
            'Highly effective even/odd prediction bot with advanced pattern recognition and statistical analysis.',
        premium: false,
    },
    {
        file: 'H_L Auto Fortress.xml',
        title: 'H_L Auto Fortress',
        category: 'automated',
        description: 'High-Low automated vault system with built-in profit protection and loss prevention mechanisms.',
    },
    {
        file: 'Market Legend v2.xml',
        title: 'Market Legend v2',
        category: 'automated',
        description:
            'Community favorite with proven track record in various market conditions and excellent risk management.',
        premium: false,
    },
    {
        file: 'Mavic-Air-RF Vix Bot.xml',
        title: 'Mavic Air RF Vix Bot',
        category: 'automated',
        description: 'Advanced volatility index bot with radio frequency pattern analysis for superior market timing.',
    },
    {
        file: 'MD MASTER BOT Pro.  (2).xml',
        title: 'MD Master Bot Pro',
        category: 'automated',
        description:
            'Professional-grade master bot with multi-dimensional analysis and institutional-level strategy execution.',
    },
    {
        file: 'Mega Heist Robot.xml',
        title: 'Mega Heist Robot',
        category: 'automated',
        description: 'Aggressive profit-seeking robot designed for maximum returns with calculated risk management.',
    },
    {
        file: 'Turbo O_U Accelerator.xml',
        title: 'Turbo O_U Accelerator',
        category: 'automated',
        description:
            'Advanced over/under trading strategy with turbo speed execution and intelligent market prediction.',
    },
    {
        file: 'signals over bot.xml',
        title: 'Signals Over Bot',
        category: 'signals',
        description: 'Signal-based over trading bot with advanced market analysis and automated execution.',
    },
    {
        file: 'signals under bot.xml',
        title: 'Signals Under Bot',
        category: 'signals',
        description: 'Signal-based under trading bot with sophisticated market timing and risk management.',
    },
    {
        file: 'Top-notch 2.xml',
        title: 'Top-notch 2',
        category: 'automated',
        description:
            'Top-rated strategy loved by professional traders for its consistency and impressive performance metrics.',
    },
    {
        file: 'Godzilla.xml',
        title: 'Godzilla',
        category: 'automated',
        description:
            'Powerful automated trading beast that adapts to market volatility with machine learning algorithms.',
        premium: false,
    },
    {
        file: 'Upgraded Candlemine.xml',
        title: 'Upgraded Candlemine',
        category: 'advanced',
        description: 'Enhanced candlestick mining strategy with upgraded pattern recognition and market analysis.',
    },
    {
        file: '🫰Pro  Differ Bot .xml',
        title: '🫰Pro Differ Bot',
        category: 'automated',
        description: 'Unstoppable difference-based trading strategy with advanced digit tracking and smart recovery system for consistent wins.',
    },
    {
        file: 'Under 9 Bot.xml',
        title: 'Under 9 Bot',
        category: 'regular',
        description: 'Sequential digit under strategy targeting digits under 9 with smart prediction rotation and adaptive stake management.',
    },
    {
        file: "Accumulator Anti-D Alembert.xml",
        title: "Accumulator Anti-D Alembert",
        category: 'advanced',
        description: "Advanced accumulator bot with Anti-D'Alembert strategy, featuring profit/loss thresholds, adaptive stake management, and tick-based sell controls.",
    },
];

type TFreeBotSearchBar = {
    className?: string;
};

const FreeBotSearchBar = observer(({ className }: TFreeBotSearchBar) => {
    const { dashboard, load_modal } = useStore();
    const { setActiveTab } = dashboard;
    const { shareBot } = useShareBot();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(availableBots);
    const [showResults, setShowResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [premiumEmails, setPremiumEmails] = useState<string[]>([]);
    const [premiumUsers, setPremiumUsers] = useState<any[]>([]);
    const [premiumDataLoaded, setPremiumDataLoaded] = useState(false);
    const [isCurrentUserPremium, setIsCurrentUserPremium] = useState(false);
    const [selectedPremiumBot, setSelectedPremiumBot] = useState<{ title: string; file: string } | null>(null);
    const [showPremiumPopup, setShowPremiumPopup] = useState(false);

    // Fetch premium emails and user data from API when search bar loads
    useEffect(() => {
        const fetchPremiumEmails = async () => {
            try {
                console.log('📧 [Search Bar] Fetching premium users from database...');
                const response = await fetch('https://database.binaryfx.site/api/1.1/obj/premium', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error('❌ [Search Bar] Failed to fetch premium users:', response.status);
                    setPremiumDataLoaded(true);
                    return;
                }

                const data = await response.json();
                console.log('✅ [Search Bar] Premium API Response:', data);

                // Extract emails and store full user data
                let emails: string[] = [];
                let users: any[] = [];
                
                if (data.response?.results && Array.isArray(data.response.results)) {
                    users = data.response.results;
                    
                    data.response.results.forEach((item: any) => {
                        if (item.emails && Array.isArray(item.emails)) {
                            emails = emails.concat(item.emails);
                        } else if (item.emails && typeof item.emails === 'string') {
                            emails = emails.concat(item.emails.split(',').map((e: string) => e.trim()));
                        }
                    });
                }

                // Remove duplicates using Set and trim whitespace
                const uniqueEmails = [...new Set(emails.map((e: string) => e.trim().toLowerCase()))];
                setPremiumEmails(uniqueEmails);
                setPremiumUsers(users);
                setPremiumDataLoaded(true);
                
                console.log('✅ [Search Bar] Premium users loaded:', uniqueEmails.length, 'users');
                console.log('📊 [Search Bar] Premium emails:', uniqueEmails);

                // Check if current user is premium
                const userEmail = localStorage.getItem('userEmail');
                const normalizedUserEmail = userEmail?.trim().toLowerCase();
                
                console.log('👤 [Search Bar] Current user email from storage:', userEmail);
                console.log('👤 [Search Bar] Normalized user email:', normalizedUserEmail);
                
                const isPremium = normalizedUserEmail ? uniqueEmails.some(email => email === normalizedUserEmail) : false;
                
                console.log('🔍 [Search Bar] Email comparison result:', {
                    userEmail: normalizedUserEmail,
                    premiumEmails: uniqueEmails,
                    isPremium: isPremium,
                    foundMatch: isPremium
                });
                
                setIsCurrentUserPremium(isPremium);

                if (isPremium) {
                    console.log('✅ [Search Bar] Current user is PREMIUM - Can access all premium bots');
                } else {
                    console.log('❌ [Search Bar] Current user is NOT PREMIUM - Restricted access');
                }
            } catch (error) {
                console.error('💥 [Search Bar] Error fetching premium users:', error);
                setPremiumDataLoaded(true);
            }
        };

        fetchPremiumEmails();
    }, []);

    // Filter bots based on search query
    const filterBots = useCallback((query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        const lowercaseQuery = query.toLowerCase();
        const filtered = availableBots.filter(
            bot =>
                bot.title.toLowerCase().includes(lowercaseQuery) ||
                bot.description.toLowerCase().includes(lowercaseQuery) ||
                bot.category.toLowerCase().includes(lowercaseQuery) ||
                bot.file.toLowerCase().includes(lowercaseQuery)
        );

        setSearchResults(filtered);
        setShowResults(true);
    }, []);

    // Handle search input change with debouncing
    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setSearchQuery(value);
            setIsSearching(true);

            // Debounce search to avoid too many filter calls
            const timeoutId = setTimeout(() => {
                filterBots(value);
                setIsSearching(false);
            }, 300);

            return () => clearTimeout(timeoutId);
        },
        [filterBots]
    );

    // Handle purchase via WhatsApp
    const handlePurchaseClick = useCallback(() => {
        const whatsappNumber = '254735525483';
        const message = `Hi, I'm interested in purchasing access to all premium bots for $19 (one-time payment). Please provide more details.`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
    }, []);

    // Handle bot selection
    const handleBotSelect = useCallback(
        async (botFile: string, botTitle: string, isPremium?: boolean) => {
            console.log(`🤖 [Search Bar] Selected bot: ${botTitle} (${botFile})`);
            console.log(`🔐 [Search Bar] Bot details:`, {
                botTitle,
                botFile,
                isPremium,
                isCurrentUserPremium,
                premiumDataLoaded,
                canAccess: !isPremium || isCurrentUserPremium
            });

            // Check if bot is premium and user doesn't have access
            if (isPremium && !isCurrentUserPremium) {
                console.log('🔒 [Search Bar] User is not premium - showing premium popup');
                console.log('🔒 [Search Bar] Popup trigger:', {
                    botIsPremium: isPremium,
                    userIsPremium: isCurrentUserPremium,
                    shouldShowPopup: true
                });
                setSelectedPremiumBot({ title: botTitle, file: botFile });
                setShowPremiumPopup(true);
                return;
            }

            try {
                console.log('✅ [Search Bar] Access granted - loading bot...');
                // Navigate to Bot Builder tab first
                setActiveTab(DBOT_TABS.BOT_BUILDER);

                // Fetch the bot's XML content
                const response = await fetch(botFile);
                if (!response.ok) {
                    console.error(`❌ [Search Bar] Failed to fetch bot file: ${botFile}`);
                    return;
                }

                const xmlContent = await response.text();

                // Create a temporary strategy object for loading
                const tempStrategy: TStrategy = {
                    id: `temp_${Date.now()}`,
                    xml: xmlContent,
                    name: botTitle,
                    save_type: 'local',
                    timestamp: Date.now(),
                };

                // Use the load modal store's method to load the strategy into the workspace
                if (load_modal && load_modal.loadStrategyToBuilder) {
                    // Use the method that expects a strategy parameter
                    await load_modal.loadStrategyToBuilder(tempStrategy);
                    console.log(`✅ [Search Bar] Bot "${botTitle}" loaded successfully into Bot Builder!`);
                } else {
                    console.error('❌ [Search Bar] Load modal store not available');
                }
            } catch (error) {
                console.error('💥 [Search Bar] Error loading bot:', error);
            }

            // Clear search
            setSearchQuery('');
            setShowResults(false);
            setSearchResults([]);
        },
        [setActiveTab, dashboard, isCurrentUserPremium, load_modal]
    );

    // Handle clear search
    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        setShowResults(false);
        setSearchResults([]);
        setIsSearching(false);
    }, []);

    // Handle share bot
    const handleShareBot = useCallback(
        (bot: { file: string; title: string }, event: React.MouseEvent) => {
            shareBot(bot, event);
        },
        [shareBot]
    );

    // Hide results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.free-bot-search-bar')) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={classNames('free-bot-search-bar', className)}>
            <div className='free-bot-search-bar__container'>
                <div className='free-bot-search-bar__input-wrapper'>
                    <LabelPairedSearchMdRegularIcon
                        className='free-bot-search-bar__search-icon'
                        height='20px'
                        width='20px'
                    />
                    <input
                        type='text'
                        placeholder={localize('Search free bot files by name or description...')}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className='free-bot-search-bar__input'
                        data-testid='free-bot-search-input'
                    />
                    {(searchQuery || isSearching) && (
                        <button
                            onClick={handleClearSearch}
                            className='free-bot-search-bar__clear-btn'
                            data-testid='free-bot-search-clear'
                        >
                            <LabelPairedXmarkMdRegularIcon height='16px' width='16px' />
                        </button>
                    )}
                </div>

                {/* Search Results Dropdown */}
                {showResults && (
                    <div className='free-bot-search-bar__results'>
                        <div className='free-bot-search-bar__results-header'>
                            <span className='free-bot-search-bar__results-count'>
                                {localize('{{count}} bot(s) found', { count: searchResults.length })}
                            </span>
                        </div>

                        {searchResults.length > 0 ? (
                            <div className='free-bot-search-bar__results-list'>
                                {searchResults.slice(0, 5).map((bot, index) => (
                                    <div
                                        key={bot.file}
                                        className='free-bot-search-bar__result-item'
                                        data-testid={`search-result-${index}`}
                                    >
                                        <button
                                            onClick={() => handleBotSelect(bot.file, bot.title, bot.premium)}
                                            className='free-bot-search-bar__result-content'
                                        >
                                            <div className='free-bot-search-bar__result-title'>
                                                {bot.title}
                                                {bot.premium && (
                                                    <span className={`free-bot-search-bar__premium-badge ${isCurrentUserPremium ? 'free-bot-search-bar__premium-badge--unlocked' : ''}`}>
                                                        {isCurrentUserPremium ? 'UNLOCKED ✓' : 'PREMIUM ★'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className='free-bot-search-bar__result-description'>
                                                {bot.description.length > 80
                                                    ? `${bot.description.substring(0, 80)}...`
                                                    : bot.description}
                                            </div>
                                            <div className='free-bot-search-bar__result-category'>
                                                {bot.category.charAt(0).toUpperCase() + bot.category.slice(1)}
                                            </div>
                                        </button>
                                        <button
                                            onClick={e => handleShareBot(bot, e)}
                                            className='free-bot-search-bar__share-btn'
                                            title='Share this bot'
                                            aria-label='Share bot link'
                                        >
                                            <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
                                                <path d='M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z' />
                                            </svg>
                                        </button>
                                    </div>
                                ))}

                                {searchResults.length > 5 && (
                                    <div className='free-bot-search-bar__show-more'>
                                        <button
                                            onClick={() => {
                                                setActiveTab(DBOT_TABS.FREE_BOTS);
                                                handleClearSearch();
                                            }}
                                            className='free-bot-search-bar__show-more-btn'
                                        >
                                            {localize('View all {{count}} results', { count: searchResults.length })}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className='free-bot-search-bar__no-results'>
                                <div className='free-bot-search-bar__no-results-text'>
                                    {localize('No bots found matching "{{query}}"', { query: searchQuery })}
                                </div>
                                <div className='free-bot-search-bar__no-results-suggestion'>
                                    {localize('Try different keywords or browse all free bots')}
                                </div>
                            </div>
                        )}
                    </div>
                )}

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
                            <h3 className='premium-popup__title'>🔒 Premium Bot</h3>
                            <p className='premium-popup__description'>
                                <strong>{selectedPremiumBot?.title}</strong> - Unlock exclusive trading strategies for maximum profitability
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
                            </ul>
                            <div className='premium-popup__actions'>
                                <button
                                    className='premium-popup__purchase-btn'
                                    onClick={handlePurchaseClick}
                                >
                                    Get Access
                                </button>
                                <button
                                    className='premium-popup__cancel-btn'
                                    onClick={() => setShowPremiumPopup(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

FreeBotSearchBar.displayName = 'FreeBotSearchBar';

export default FreeBotSearchBar;
