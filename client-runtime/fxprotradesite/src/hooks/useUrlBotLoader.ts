import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DBOT_TABS } from '@/constants/bot-contents';
import { botNotification } from '@/components/bot-notification/bot-notification';

interface Bot {
    title: string;
    image: string;
    filePath: string;
    xmlContent: string;
    category: string;
    popularity: number;
    description: string;
}

interface UseUrlBotLoaderProps {
    bots: Bot[];
    setActiveTab: (tab: number) => void;
    loadModal: any;
}

export const useUrlBotLoader = ({ bots, setActiveTab, loadModal }: UseUrlBotLoaderProps) => {
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        const loadBotFromUrl = async () => {
            const botParam = searchParams.get('bot');
            const tabParam = searchParams.get('tab');
            
            // Only proceed if we have a bot parameter
            if (!botParam) {
                return;
            }

            console.log('🚀 URL Bot Loading started');
            console.log('📋 Bot parameter:', botParam);
            console.log('🎯 Tab parameter:', tabParam);
            
            // Switch to bot builder tab if tab parameter is set correctly
            if (tabParam === 'id-bot-builder') {
                console.log('⚡ Switching to Bot Builder tab');
                setActiveTab(DBOT_TABS.BOT_BUILDER);
            }

            try {
                const decodedBotName = decodeURIComponent(botParam);
                console.log('🔍 Looking for bot:', decodedBotName);
                
                // Try to fetch the bot file directly by name
                const possibleFilenames = [
                    `${decodedBotName}.xml`,
                    decodedBotName.endsWith('.xml') ? decodedBotName : `${decodedBotName}.xml`
                ];
                
                let xmlContent = null;
                let fileName = null;
                
                // Try different filename variations
                for (const filename of possibleFilenames) {
                    try {
                        console.log(`🔄 Trying to fetch: /${filename}`);
                        const response = await fetch(`/${filename}`);
                        if (response.ok) {
                            xmlContent = await response.text();
                            fileName = filename;
                            console.log(`✅ Successfully fetched ${filename}`);
                            break;
                        }
                    } catch (error) {
                        console.log(`❌ Failed to fetch ${filename}:`, (error as Error).message);
                    }
                }
                
                // If direct fetch failed, try to find in our bots array
                if (!xmlContent && bots.length > 0) {
                    console.log('🔍 Searching in loaded bots array...');
                    const foundBot = bots.find(bot => {
                        const titleMatch = bot.title.toLowerCase() === decodedBotName.toLowerCase();
                        const fileMatch = bot.filePath.toLowerCase().includes(decodedBotName.toLowerCase());
                        return titleMatch || fileMatch;
                    });
                    
                    if (foundBot && foundBot.xmlContent) {
                        xmlContent = foundBot.xmlContent;
                        fileName = foundBot.filePath;
                        console.log(`✅ Found bot in array: ${foundBot.title}`);
                    }
                }
                
                if (xmlContent) {
                    console.log('📄 XML content loaded, length:', xmlContent.length);
                    
                    // Wait a moment for the bot builder to be ready
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Create a temporary strategy object
                    const strategy = {
                        id: `url_bot_${Date.now()}`,
                        xml: xmlContent,
                        name: decodedBotName,
                        save_type: 'local',
                        timestamp: Date.now()
                    };
                    
                    // Load the strategy using the load modal store method
                    if (loadModal?.loadStrategyToBuilder) {
                        console.log('🔄 Loading strategy to builder...');
                        await loadModal.loadStrategyToBuilder(strategy);
                        console.log('🎉 Bot loaded successfully from URL!');
                        
                        // Show success notification
                        botNotification(`${decodedBotName} loaded successfully`, undefined, {
                            type: 'success',
                            autoClose: 3000
                        });
                        
                        // Clear the URL parameters after successful load
                        const newSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.delete('bot');
                        setSearchParams(newSearchParams);
                    } else {
                        console.error('❌ loadStrategyToBuilder method not available');
                    }
                } else {
                    console.error('❌ Could not find or load bot:', decodedBotName);
                }
            } catch (error) {
                console.error('💥 Error in URL bot loading:', error);
            }
        };

        // Only run if we have a bot parameter
        const botParam = searchParams.get('bot');
        if (botParam) {
            loadBotFromUrl();
        }
    }, [searchParams, setActiveTab, loadModal, bots, setSearchParams]);
};
