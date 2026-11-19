import { EmailTemplateData } from './types';

/**
 * Welcome Email Template
 * Sent when a user creates a new account in the community
 */
export const welcomeEmailTemplate = (data: EmailTemplateData['welcome']): string => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to FxProTrades Bot Community</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            color: #ffcd44;
            margin-bottom: 10px;
        }
        h1 {
            color: #4c502c;
            font-size: 24px;
            margin-bottom: 20px;
        }
        .welcome-message {
            font-size: 16px;
            margin-bottom: 20px;
            color: #555;
        }
        .user-info {
            background-color: #f8f9fa;
            border-left: 4px solid #ffcd44;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .user-info strong {
            color: #2c3e50;
        }
        .features {
            margin: 30px 0;
        }
        .feature-item {
            margin: 15px 0;
            padding-left: 30px;
            position: relative;
        }
        .feature-item::before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #ffc144;
            font-weight: bold;
            font-size: 20px;
        }
        .cta-button {
            display: inline-block;
            background-color: #dcad20;
            color: #ffffff;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            font-size: 14px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">🤖 FxProTrades Bot</div>
        </div>
        
        <h1>Welcome to the FxProTrades Bot Community, ${data.userName}! 🎉</h1>
        
        <div class="welcome-message">
            <p>We're thrilled to have you join our community of traders and bot enthusiasts!</p>
            <p>You've taken the first step towards automated trading excellence.</p>
        </div>
        
        <div class="user-info">
            <p><strong>Your Account Details:</strong></p>
            <p>Username: ${data.userName}</p>
            <p>Login ID: ${data.loginId}</p>
        </div>
        
        <div class="features">
            <h2 style="color: #2c3e50; font-size: 18px;">What You Can Do:</h2>
            <div class="feature-item">
                <strong>Join Discussions:</strong> Connect with other traders and share strategies
            </div>
            <div class="feature-item">
                <strong>Share Insights:</strong> Post your trading experiences and learn from others
            </div>
            <div class="feature-item">
                <strong>Get Support:</strong> Ask questions and get help from the community
            </div>
            <div class="feature-item">
                <strong>Stay Updated:</strong> Get the latest news and updates about FxProTrades Bot
            </div>
            <div class="feature-item">
                <strong>Copy Trading:</strong> Follow successful traders and copy their strategies
            </div>
        </div>
        
        <div style="text-align: center;">
            <a href="${process.env.APP_URL || 'https://fxprotrades.site'}/?tab=id-community" class="cta-button">
                Start Exploring →
            </a>
        </div>
        
        <div class="footer">
            <p>Happy Trading! 📈</p>
            <p style="margin-top: 10px;">
                If you have any questions, feel free to reach out to our community moderators.
            </p>
            <p style="margin-top: 20px; font-size: 12px;">
                This email was sent to you because you created an account on FxProTrades Bot.<br>
                © ${new Date().getFullYear()} FxProTrades Bot. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
};

/**
 * Plain text version of welcome email for email clients that don't support HTML
 */
export const welcomeEmailTextTemplate = (data: EmailTemplateData['welcome']): string => {
    return `
Welcome to FxProTrades Bot Community, ${data.userName}!

We're thrilled to have you join our community of traders and bot enthusiasts!

Your Account Details:
Username: ${data.userName}
Login ID: ${data.loginId}

What You Can Do:
✓ Join Discussions: Connect with other traders and share strategies
✓ Share Insights: Post your trading experiences and learn from others
✓ Get Support: Ask questions and get help from the community
✓ Stay Updated: Get the latest news and updates about FxProTrades Bot
✓ Copy Trading: Follow successful traders and copy their strategies

Visit the community: ${process.env.APP_URL || 'https://fxprotrades.site'}/community

Happy Trading! 📈

If you have any questions, feel free to reach out to our community moderators.

© ${new Date().getFullYear()} FxProTrades Bot. All rights reserved.
    `.trim();
};
