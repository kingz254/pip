const ticksStorage = {
    R_10: [],
    R_25: [],
    R_50: [],
    R_75: [],
    R_100: [],
    '1HZ10V': [],
    '1HZ15V': [],
    '1HZ25V': [],
    '1HZ30V': [],
    '1HZ50V': [],
    '1HZ75V': [],
    '1HZ90V': [],
    '1HZ100V': [],
};

// Telegram configuration
const TELEGRAM_CONFIG = {
    BOT_TOKEN: "8195895610:AAHgAnGd5R_hx7BU3jO8Mc8fkrV3_qp2ONg", // Replace with your bot token
    CHAT_ID: "@binaryfxsignalcenter", // Replace with your channel username or chat ID
};

// Track sent signals to avoid duplicates
const sentSignals = new Set();

// Global rate limiting - prevent more than 1 signal within 4 minutes
let lastSignalTime = 0;
const SIGNAL_COOLDOWN = 4 * 60 * 1000; // 4 minutes in milliseconds

// Store the latest signal to send (pick the last one if multiple signals occur)
let latestSignal = null;

// Track if signals are active (starts after 2 minutes)
let signalsActive = false;

const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

const subscribeTicks = symbol => {
    ws.send(
        JSON.stringify({
            ticks_history: symbol,
            count: 255,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
        })
    );
};

ws.onopen = () => {
    ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V'].forEach(
        subscribeTicks
    );
};

const calculateTrendPercentage = (symbol, ticksCount) => {
    const ticks = ticksStorage[symbol].slice(-ticksCount);
    if (ticks.length < 2) return { risePercentage: 0, fallPercentage: 0 };

    let riseCount = 0;
    let fallCount = 0;

    for (let i = 1; i < ticks.length; i++) {
        if (ticks[i] > ticks[i - 1]) riseCount++;
        else if (ticks[i] < ticks[i - 1]) fallCount++;
    }

    const total = riseCount + fallCount;
    return {
        risePercentage: total > 0 ? (riseCount / total) * 100 : 0,
        fallPercentage: total > 0 ? (fallCount / total) * 100 : 0,
    };
};

// Telegram messaging function
function sendTelegramMessage(message, chatId = null, replyMarkup = null) {
    const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`;

    // Use custom chat ID if provided, otherwise use default
    const targetChatId = chatId || TELEGRAM_CONFIG.CHAT_ID;
    
    // Use custom reply markup if provided, otherwise use default
    const defaultReplyMarkup = {
        inline_keyboard: [[
            {
                text: "🤖 LOAD BOT",
                url: "https://bot.binaryfx.site"
            }
        ]]
    };

    const data = {
        chat_id: targetChatId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: replyMarkup || defaultReplyMarkup
    };

    console.log('Sending message to:', targetChatId, 'with reply_markup:', JSON.stringify(data.reply_markup, null, 2));

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log("Telegram message sent:", result);
        if (!result.ok) {
            console.error("Telegram API error:", result);
        }
    })
    .catch(error => {
        console.error("Error sending Telegram message:", error);
    });
}

// Telegram file sending function
function sendTelegramFile(fileName, caption = "") {
    const url = `http://localhost:3001/send-telegram-file`;

    const data = {
        botToken: TELEGRAM_CONFIG.BOT_TOKEN,
        chatId: TELEGRAM_CONFIG.CHAT_ID,
        fileName: fileName,
        caption: caption,
        replyMarkup: {
            inline_keyboard: [[
                {
                    text: "🤖 LOAD BOT",
                    url: "https://bot.binaryfx.site"
                }
            ]]
        }
    };

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            console.log("Telegram file sent successfully:", result.result);
        } else {
            console.error("Telegram file sending failed:", result.error);
        }
    })
    .catch(error => {
        console.error("Error sending Telegram file:", error);
    });
}

ws.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.history && data.history.prices) {
        const symbol = data.echo_req.ticks_history;
        ticksStorage[symbol] = data.history.prices.map(price => parseFloat(price));
    } else if (data.tick) {
        const symbol = data.tick.symbol;
        ticksStorage[symbol].push(parseFloat(data.tick.quote));
        if (ticksStorage[symbol].length > 255) ticksStorage[symbol].shift();
    }
};

function updateTables() {
    const riseFallTable = document.getElementById('riseFallTable');
    const overUnderTable = document.getElementById('overUnderTable');
    const combinedTable = document.getElementById('combinedTable');

    riseFallTable.innerHTML = '';
    overUnderTable.innerHTML = '';
    combinedTable.innerHTML = '';

    console.log(`🔍 Processing ${Object.keys(ticksStorage).length} symbols, signalsActive: ${signalsActive}`);

    Object.keys(ticksStorage).forEach(symbol => {
        const ticks = ticksStorage[symbol];
        if (ticks.length < 255) {
            console.log(`⏳ ${symbol}: Only ${ticks.length}/255 ticks received`);
            return;
        }

        // Calculate rise/fall percentages for 255 and 55 ticks
        const { risePercentage: rise255, fallPercentage: fall255 } = calculateTrendPercentage(symbol, 255);
        const { risePercentage: rise55, fallPercentage: fall55 } = calculateTrendPercentage(symbol, 55);

        // Check if both conditions are met for a buy/sell signal
        const isBuy = rise255 > 57 && rise55 > 55;
        const isSell = fall255 > 57 && fall55 > 55;

        // Debug signal conditions for the first few symbols
        if (['R_75', 'R_100', '1HZ75V'].includes(symbol)) {
            console.log(`📊 ${symbol}: Rise255=${rise255.toFixed(1)}% (>57), Rise55=${rise55.toFixed(1)}% (>55) → Buy=${isBuy}`);
            console.log(`📊 ${symbol}: Fall255=${fall255.toFixed(1)}% (>57), Fall55=${fall55.toFixed(1)}% (>55) → Sell=${isSell}`);
        }

        // Define status classes for signals
        const riseClass = isBuy ? 'rise' : 'neutral';
        const fallClass = isSell ? 'fall' : 'neutral';

        // Generate rise/fall table row
        const displayName = symbol.startsWith('1HZ')
            ? `Volatility ${symbol.replace('1HZ', '').replace('V', '')} (1s) Index`
            : `Volatility ${symbol.replace('R_', '')} Index`;
        riseFallTable.innerHTML += `<tr>
            <td>${displayName} index</td>
            <td><span class="signal-box ${riseClass}">${isBuy ? 'Rise' : '----'}</span></td>
            <td><span class="signal-box ${fallClass}">${isSell ? 'Fall' : '----'}</span></td>
        </tr>`;

        // Send Telegram message for Rise/Fall signals
        const signalKey = `${symbol}_${isBuy ? 'rise' : isSell ? 'fall' : 'none'}`;
        
        // Debug logging for signal detection
        if (isBuy || isSell) {
            const signalType = isBuy ? 'RISE 📈' : 'FALL 📉';
            console.log(`🎯 Signal detected: ${signalType} for ${displayName}`);
            console.log(`📊 Signals Active: ${signalsActive}`);
            console.log(`🔄 Already Sent: ${sentSignals.has(signalKey)}`);
            
            if (!signalsActive) {
                console.log(`⏸️ Signals not active yet - waiting for activation`);
            }
            if (sentSignals.has(signalKey)) {
                console.log(`⏭️ Signal already sent for ${signalKey}`);
            }
        }
        
        if ((isBuy || isSell) && !sentSignals.has(signalKey) && signalsActive) {
            const signalType = isBuy ? 'RISE 📈' : 'FALL 📉';
            console.log(`📊 Signal detected: ${signalType} for ${displayName} - Sending to Telegram`);
            const currentTime = Date.now();
            
            // Check global rate limit
            if (currentTime - lastSignalTime < SIGNAL_COOLDOWN) {
                console.log(`Signal rate limited. Last signal was ${Math.round((currentTime - lastSignalTime) / 1000)} seconds ago.`);
                return; // Skip sending this signal
            }
            
            // Send single message with file containing all information
            const fileCaption = `🚀 <b>${signalType} SIGNAL</b>\n\n` +
                              `🏦 <b>Market:</b> ${displayName}\n` +
                              `⏰ <b>Trade Until:</b> 3 minutes max\n\n` +
                              `📝 <b>Instructions:</b>\n` +
                              `1. Download and import this bot file\n` +
                              `2. Configure your stake amount\n` +
                              `3. Start the bot on ${displayName}\n` +
                              `4. Monitor trades carefully\n\n` +
                              '5. Load the bot on <a href="https://bot.binaryfx.site">bot.binaryfx.site</a>\n\n' +
                              `⚠️ <i>Trade responsibly!</i>`;
            
            // Store this signal as the latest one (will override previous if multiple signals occur)
            latestSignal = {
                type: 'rise_fall',
                signalKey: signalKey,
                fileName: 'Market Legend v2.xml',
                caption: fileCaption
            };
        }

        // Last digit analysis
        const digitCounts = new Array(10).fill(0);
        ticks.forEach(tick => {
            const lastDigit = parseInt(tick.toString().slice(-1));
            digitCounts[lastDigit]++;
        });

        const totalTicks = ticks.length;
        const digitPercentages = digitCounts.map(count => (count / totalTicks) * 100);

        const overClass =
            digitPercentages[7] < 10 && digitPercentages[8] < 10 && digitPercentages[9] < 10 ? 'over' : 'neutral';
        const underClass =
            digitPercentages[0] < 10 && digitPercentages[1] < 10 && digitPercentages[2] < 10 ? 'under' : 'neutral';

        // Debug digit conditions for the first few symbols
        if (['R_75', 'R_100', '1HZ75V'].includes(symbol)) {
            console.log(`🎲 ${symbol}: Digits 7,8,9: ${digitPercentages[7].toFixed(1)}%, ${digitPercentages[8].toFixed(1)}%, ${digitPercentages[9].toFixed(1)}% → Over=${overClass === 'over'}`);
            console.log(`🎲 ${symbol}: Digits 0,1,2: ${digitPercentages[0].toFixed(1)}%, ${digitPercentages[1].toFixed(1)}%, ${digitPercentages[2].toFixed(1)}% → Under=${underClass === 'under'}`);
        }

        // Generate over/under table row
        overUnderTable.innerHTML += `<tr>
            <td>${displayName} index</td>
            <td><span class="signal-box ${overClass}">${overClass === 'over' ? 'Over 2' : '----'}</span></td>
            <td><span class="signal-box ${underClass}">${underClass === 'under' ? 'Under 7' : '----'}</span></td>
        </tr>`;

        // Generate combined table row for desktop (Over/Under first, then Rise/Fall)
        combinedTable.innerHTML += `<tr>
            <td>${displayName}</td>
            <td><span class="signal-box ${overClass}">${overClass === 'over' ? 'Over 2' : '----'}</span></td>
            <td><span class="signal-box ${underClass}">${underClass === 'under' ? 'Under 7' : '----'}</span></td>
            <td><span class="signal-box ${riseClass}">${isBuy ? 'Rise' : '----'}</span></td>
            <td><span class="signal-box ${fallClass}">${isSell ? 'Fall' : '----'}</span></td>
        </tr>`;

        // Send Telegram message for Over/Under signals
        const overSignalKey = `${symbol}_over`;
        const underSignalKey = `${symbol}_under`;
        
        // Debug logging for over signals
        if (overClass === 'over') {
            console.log(`🎯 OVER 2 signal detected for ${displayName}`);
            console.log(`📊 Signals Active: ${signalsActive}`);
            console.log(`🔄 Already Sent: ${sentSignals.has(overSignalKey)}`);
            
            if (!signalsActive) {
                console.log(`⏸️ Signals not active yet - waiting for activation`);
            }
        }
        
        // Debug logging for under signals  
        if (underClass === 'under') {
            console.log(`🎯 UNDER 7 signal detected for ${displayName}`);
            console.log(`📊 Signals Active: ${signalsActive}`);
            console.log(`🔄 Already Sent: ${sentSignals.has(underSignalKey)}`);
            
            if (!signalsActive) {
                console.log(`⏸️ Signals not active yet - waiting for activation`);
            }
        }
        
        if (overClass === 'over' && !sentSignals.has(overSignalKey) && signalsActive) {
            console.log(`📊 OVER 2 signal for ${displayName} - Sending to Telegram`);
            const currentTime = Date.now();
            
            // Check global rate limit
            if (currentTime - lastSignalTime < SIGNAL_COOLDOWN) {
                console.log(`Signal rate limited. Last signal was ${Math.round((currentTime - lastSignalTime) / 1000)} seconds ago.`);
                return; // Skip sending this signal
            }
            
            // Send single message with file containing all information
            const fileCaption = `🎯 <b>OVER 2 SIGNAL</b>\n\n` +
                              `🏦 <b>Market:</b> ${displayName}\n` +
                              `⏰ <b>Trade Until:</b> 3 minutes max\n\n` +
                              `📝 <b>Instructions:</b>\n` +
                              `1. Download and import this bot file\n` +
                              `2. Set contract type to "Digits Over"\n` +
                              `3. Set barrier to 2\n` +
                              `4. Start the bot on ${displayName}\n` +
                              `5. Load the bot on <a href='https://bot.binaryfx.site'>bot.binaryfx.site</a>\n\n` +
                              `⚠️ <i>Trade responsibly!</i>`;
            
            // Store this signal as the latest one (will override previous if multiple signals occur)
            latestSignal = {
                type: 'over',
                signalKey: overSignalKey,
                fileName: 'signals over bot.xml',
                caption: fileCaption
            };
        }

        if (underClass === 'under' && !sentSignals.has(underSignalKey) && signalsActive) {
            console.log(`📊 UNDER 7 signal for ${displayName} - Sending to Telegram`);
            const currentTime = Date.now();
            
            // Check global rate limit
            if (currentTime - lastSignalTime < SIGNAL_COOLDOWN) {
                console.log(`Signal rate limited. Last signal was ${Math.round((currentTime - lastSignalTime) / 1000)} seconds ago.`);
                return; // Skip sending this signal
            }
            
            // Send single message with file containing all information
            const fileCaption = `🎯 <b>UNDER 7 SIGNAL</b>\n\n` +
                              `🏦 <b>Market:</b> ${displayName}\n` +
                              `⏰ <b>Trade Until:</b> 3 minutes max\n\n` +
                              `📝 <b>Instructions:</b>\n` +
                              `1. Download and import this bot file\n` +
                              `2. Set contract type to "Digits Under"\n` +
                              `3. Set barrier to 7\n` +
                              `4. Start the bot on ${displayName}\n` +
                              `5. Load the bot on <a href='https://bot.binaryfx.site'>bot.binaryfx.site</a>\n\n` +
                              `⚠️ <i>Trade responsibly!</i>`;
            
            // Store this signal as the latest one (will override previous if multiple signals occur)
            latestSignal = {
                type: 'under',
                signalKey: underSignalKey,
                fileName: 'signals under bot.xml',
                caption: fileCaption
            };
        }
    });

    // After processing all markets, send the latest signal if one exists
    if (latestSignal) {
        const currentTime = Date.now();
        sendTelegramFile(latestSignal.fileName, latestSignal.caption);
        
        sentSignals.add(latestSignal.signalKey);
        lastSignalTime = currentTime;
        
        // Remove from sent signals after 5 minutes to allow re-triggering
        setTimeout(() => {
            sentSignals.delete(latestSignal.signalKey);
        }, 5 * 60 * 1000);
        
        // Clear the latest signal
        latestSignal = null;
    }
}

setInterval(updateTables, 1000); // Update every second

// Configuration functions for the UI
function updateTelegramConfig() {
    const botToken = document.getElementById('botToken').value.trim();
    const chatId = document.getElementById('chatId').value.trim();
    const status = document.getElementById('configStatus');
    
    if (!botToken || !chatId) {
        status.textContent = '❌ Please fill in both fields';
        status.style.color = 'red';
        return;
    }
    
    TELEGRAM_CONFIG.BOT_TOKEN = botToken;
    TELEGRAM_CONFIG.CHAT_ID = chatId;
    
    status.textContent = '✅ Configuration updated';
    status.style.color = 'green';
    
    // Store in localStorage for persistence
    localStorage.setItem('telegramConfig', JSON.stringify(TELEGRAM_CONFIG));
    
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}

function testTelegramMessage() {
    const status = document.getElementById('configStatus');
    
    if (!TELEGRAM_CONFIG.BOT_TOKEN || TELEGRAM_CONFIG.BOT_TOKEN === "123456789:ABCdefGhIjklMnOpQrStUvWxYz") {
        status.textContent = '❌ Please configure your bot token first';
        status.style.color = 'red';
        return;
    }
    
    const testMessage = `🤖 <b>Test Message from Trading Bot</b>\n\n` +
                       `✅ Your Telegram integration is working correctly!\n` +
                       `⏰ <b>Time:</b> ${new Date().toLocaleString()}\n\n` +
                       `🚀 Ready to receive trading signals!`;
    
    sendTelegramMessage(testMessage);
    
    status.textContent = '📤 Test message sent!';
    status.style.color = 'blue';
    
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}

function testTelegramFile() {
    const status = document.getElementById('configStatus');
    
    if (!TELEGRAM_CONFIG.BOT_TOKEN || TELEGRAM_CONFIG.BOT_TOKEN === "123456789:ABCdefGhIjklMnOpQrStUvWxYz") {
        status.textContent = '❌ Please configure your bot token first';
        status.style.color = 'red';
        return;
    }
    
    const fileCaption = `🤖 <b>TEST SIGNAL WITH BUTTON</b>\n\n` +
                       `🏦 <b>Market:</b> Test Market\n` +
                       `⏰ <b>Trade Until:</b> 3 minutes max\n\n` +
                       `📝 <b>Instructions:</b>\n` +
                       `1. Download and import this bot file\n` +
                       `2. Configure your trade settings\n` +
                       `3. Start the bot on your preferred market\n\n` +
                       `⚠️ <i>Trade responsibly!</i>\n\n` +
                       `🔘 Click the button below to load the bot!`;
    
    console.log('Testing file with button...', {
        replyMarkup: {
            inline_keyboard: [[
                {
                    text: "🤖 LOAD BOT",
                    url: "https://bot.binaryfx.site"
                }
            ]]
        }
    });
    
    sendTelegramFile('Market Legend v2.xml', fileCaption);
    
    status.textContent = '📄 Test file with button sent!';
    status.style.color = 'green';
    
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}

function binaryfxsignalcenterChannel() {
    const status = document.getElementById('configStatus');
    
    if (!TELEGRAM_CONFIG.BOT_TOKEN || TELEGRAM_CONFIG.BOT_TOKEN === "123456789:ABCdefGhIjklMnOpQrStUvWxYz") {
        status.textContent = '❌ Please configure your bot token first';
        status.style.color = 'red';
        return;
    }
    
    const testMessage = `🧪 <b>Testing @binaryfx_site access</b>\n\n` +
                       `⏰ <b>Time:</b> ${new Date().toLocaleString()}\n\n` +
                       `🔗 This is a test to verify bot permissions`;
    
    const testButton = {
        inline_keyboard: [[
            {
                text: "📡 Join Signal Channel",
                url: "https://t.me/binaryfxsignalcenter"
            }
        ]]
    };
    
    console.log('Testing @binaryfx_site channel access...');
    sendTelegramMessage(testMessage, "@binaryfx_site", testButton);
    
    status.textContent = '🧪 Testing @binaryfx_site access...';
    status.style.color = 'orange';
    
    setTimeout(() => {
        status.textContent = '';
    }, 5000);
}

function activateSignalsNow() {
    const status = document.getElementById('configStatus');
    const signalStatus = document.getElementById('signalStatus');
    
    signalsActive = true;
    console.log('🚀 Signals manually activated!');
    
    status.textContent = '🚀 Signals activated immediately!';
    status.style.color = 'green';
    
    if (signalStatus) {
        signalStatus.textContent = '🚀 ACTIVE';
        signalStatus.style.color = '#4CAF50';
    }
    
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}

function sendTestSignal() {
    const status = document.getElementById('configStatus');
    
    if (!TELEGRAM_CONFIG.BOT_TOKEN || TELEGRAM_CONFIG.BOT_TOKEN === "123456789:ABCdefGhIjklMnOpQrStUvWxYz") {
        status.textContent = '❌ Please configure your bot token first';
        status.style.color = 'red';
        return;
    }
    
    console.log('🧪 Sending test signal...');
    
    const testSignalCaption = `🧪 <b>TEST RISE SIGNAL</b>\n\n` +
                              `🏦 <b>Market:</b> Volatility 75 Index\n` +
                              `⏰ <b>Trade Until:</b> 3 minutes max\n\n` +
                              `📝 <b>Instructions:</b>\n` +
                              `1. Download and import this bot file\n` +
                              `2. Configure your stake amount\n` +
                              `3. Start the bot on Volatility 75 Index\n` +
                              `4. Monitor trades carefully\n\n` +
                              '5. Load the bot on <a href="https://bot.binaryfx.site">bot.binaryfx.site</a>\n\n' +
                              `⚠️ <i>This is a test signal - Trade responsibly!</i>`;
    
    sendTelegramFile('Market Legend v2.xml', testSignalCaption);
    
    status.textContent = '🧪 Test signal sent!';
    status.style.color = 'purple';
    
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}

// Load saved configuration on page load
window.addEventListener('load', () => {
    const savedConfig = localStorage.getItem('telegramConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        TELEGRAM_CONFIG.BOT_TOKEN = config.BOT_TOKEN;
        TELEGRAM_CONFIG.CHAT_ID = config.CHAT_ID;
        
        // Populate input fields
        document.getElementById('botToken').value = config.BOT_TOKEN;
        document.getElementById('chatId').value = config.CHAT_ID;
    }
    
    // Send welcome message and prepare for signals
    setTimeout(() => {
        sendWelcomeMessage();
    }, 1000); // Wait 1 second for page to fully load
});

// Send welcome message when page loads
function sendWelcomeMessage() {
    if (!TELEGRAM_CONFIG.BOT_TOKEN || TELEGRAM_CONFIG.BOT_TOKEN === "123456789:ABCdefGhIjklMnOpQrStUvWxYz") {
        console.log('Bot token not configured, skipping welcome message');
        return;
    }
    
    // First send alert to @binaryfx_site
    const binaryfxAlert = `🚨 <b>SIGNAL ALERT!</b>\n\n` +
                         `📡 I'm about to send some profitable signals!\n\n` +
                         `🎯 Don't miss out on the signals in our signal channel\n\n` +
                         `🤖 Trade on <a href="https://bot.binaryfx.site">bot.binaryfx.site</a>\n\n` +
                         `⚡ Join our signal channel now for instant updates!`;
    
    const binaryfxButton = {
        inline_keyboard: [[
            {
                text: "📡 Join Signal Channel",
                url: "https://t.me/binaryfxsignalcenter"
            }
        ]]
    };
    
    // Send to @binaryfx_site with debugging
    console.log('Sending to @binaryfx_site with button:', binaryfxButton);
    
    // Try to send to @binaryfx_site, but don't let it block the main welcome message
    try {
        // Send message and capture response for auto-deletion
        const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`;
        const data = {
            chat_id: "@binaryfx_site",
            text: binaryfxAlert,
            parse_mode: 'HTML',
            reply_markup: binaryfxButton
        };

        fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            console.log("@binaryfx_site message sent:", result);
            if (result.ok && result.result.message_id) {
                const messageId = result.result.message_id;
                console.log(`Message sent to @binaryfx_site with ID: ${messageId}, will delete in 10 minutes`);
                
                // Auto-delete after 10 minutes
                setTimeout(() => {
                    fetch(`https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/deleteMessage`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            chat_id: "@binaryfx_site",
                            message_id: messageId
                        })
                    })
                    .then(res => res.json())
                    .then(result => console.log("@binaryfx_site message deleted:", result))
                    .catch(err => console.error("Delete failed:", err));
                }, 10 * 60 * 1000); // 10 minutes in ms
            }
        })
        .catch(err => {
            console.error("@binaryfx_site message send failed:", err);
        });
    } catch (error) {
        console.error('Failed to send to @binaryfx_site:', error);
    }
    
    const welcomeMessage = `🚀 <b>TRADING SIGNALS ACTIVATED</b>\n\n` +
                          `🎯 <b>Get Ready for Profitable Signals!</b>\n\n` +
                          `📋 <b>PREPARATION STEPS:</b>\n` +
                          `1. Visit <a href="https://bot.binaryfx.site">bot.binaryfx.site</a>\n` +
                          `2. Download the Market Wizard bot file (sent below)\n` +
                          `3. Import the bot to your platform\n` +
                          `4. Configure your stake amount\n` +
                          `5. Keep your platform ready\n\n` +
                          `⏰ <b>Signals will start in 2 minutes!</b>\n\n` +
                          `💡 <i>Stay alert for incoming signals with detailed trading instructions</i>\n\n` +
                          `⚠️ <b>Trade responsibly and manage your risk!</b>`;
    
    // Send welcome message to main channel
    sendTelegramMessage(welcomeMessage);
    
    // Send bot file after 3 seconds
    setTimeout(() => {
        const fileCaption = `🤖 <b>MARKET WIZARD BOT FILE</b>\n\n` +
                           `📥 <b>Download this bot file now!</b>\n\n` +
                           `📝 <b>Setup Instructions:</b>\n` +
                           `1. Download this XML file\n` +
                           `2. Go to <a href="https://bot.binaryfx.site">bot.binaryfx.site</a>\n` +
                           `3. Import this bot file\n` +
                           `4. Configure your settings\n` +
                           `5. Wait for our signals!\n\n` +
                           `⏰ <b>Signals starting soon...</b>`;
        
        sendTelegramFile('Market Legend v2.xml', fileCaption);
    }, 3000); // Send file 3 seconds after welcome message
    
    // Activate signals after 2 minutes
    setTimeout(() => {
        signalsActive = true;
        
        const signalStatus = document.getElementById('signalStatus');
        if (signalStatus) {
            signalStatus.textContent = '🚀 ACTIVE';
            signalStatus.style.color = '#4CAF50';
        }
        
        const activationMessage = `✅ <b>SIGNALS NOW ACTIVE!</b>\n\n` +
                                 `🎯 <b>Ready to detect profitable opportunities</b>\n\n` +
                                 `📊 Monitoring all volatility indices...\n` +
                                 `🔍 Analyzing market patterns...\n` +
                                 `⚡ You'll receive signals when conditions are perfect!\n\n` +
                                 `💰 <b>Let's make some profits!</b>`;
        
        sendTelegramMessage(activationMessage);
        console.log('🚀 Trading signals are now active!');
    }, 2 * 60 * 1000); // 2 minutes
}
