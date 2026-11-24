/**
 * Email Service for Server-side
 * This is the Node.js compatible version for use in Express backend
 */

const { Resend } = require('resend');

// Email configuration
const emailConfig = {
    apiKey: process.env.RESEND_API_KEY || '',
    defaultFrom: process.env.EMAIL_FROM || 'FxProTrades Bot <noreply@binaryfx.site>',
    isProduction: process.env.NODE_ENV === 'production',
    enabled: process.env.ENABLE_EMAILS !== 'false',
};

// Log configuration on startup (hide API key)
console.log('📧 Email Service Configuration:');
console.log('  - API Key:', emailConfig.apiKey ? `${emailConfig.apiKey.substring(0, 10)}...` : '❌ NOT SET');
console.log('  - From:', emailConfig.defaultFrom);
console.log('  - Enabled:', emailConfig.enabled);
console.log('  - Environment:', process.env.NODE_ENV || 'development');

// Initialize Resend client
const resend = new Resend(emailConfig.apiKey);

/**
 * Validate email configuration
 */
const validateEmailConfig = () => {
    const errors = [];
    
    if (!emailConfig.apiKey) {
        errors.push('RESEND_API_KEY is not set in environment variables');
    }
    
    if (!emailConfig.defaultFrom) {
        errors.push('EMAIL_FROM is not set in environment variables');
    }
    
    return {
        valid: errors.length === 0,
        errors,
    };
};

/**
 * Welcome Email Template
 */
const welcomeEmailTemplate = (data) => {
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
            color: #ff444f;
            margin-bottom: 10px;
        }
        h1 {
            color: #2c3e50;
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
            border-left: 4px solid #ff444f;
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
            color: #ff444f;
            font-weight: bold;
            font-size: 20px;
        }
        .cta-button {
            display: inline-block;
            background-color: #ff444f;
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
            <a href="${process.env.APP_URL || 'https://bot.binaryfx.site'}/community" class="cta-button">
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
 * Plain text version of welcome email
 */
const welcomeEmailTextTemplate = (data) => {
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

Visit the community: ${process.env.APP_URL || 'https://bot.binaryfx.site'}/community

Happy Trading! 📈

If you have any questions, feel free to reach out to our community moderators.

© ${new Date().getFullYear()} FxProTrades Bot. All rights reserved.
    `.trim();
};

/**
 * Get email template based on type
 */
const getEmailTemplate = (type, data) => {
    switch (type) {
        case 'welcome':
            return {
                html: welcomeEmailTemplate(data),
                text: welcomeEmailTextTemplate(data),
                subject: `Welcome to FxProTrades Bot Community, ${data.userName}! 🎉`,
            };
        
        case 'notification':
            return {
                html: `<p>${data.message}</p>`,
                text: data.message,
                subject: data.title,
            };
        
        default:
            throw new Error(`Unknown email template type: ${type}`);
    }
};

/**
 * Send an email
 */
const sendEmail = async (options) => {
    try {
        console.log('📧 [EMAIL] Attempting to send email:', {
            to: options.to,
            templateType: options.templateType,
            from: options.from || emailConfig.defaultFrom,
        });

        // Validate configuration
        const configValidation = validateEmailConfig();
        if (!configValidation.valid) {
            console.error('❌ [EMAIL] Configuration is invalid:', configValidation.errors);
            return {
                success: false,
                error: `Email configuration error: ${configValidation.errors.join(', ')}`,
            };
        }

        console.log('✅ [EMAIL] Configuration valid');

        // Check if emails are enabled
        if (!emailConfig.enabled) {
            console.log('⚠️ [EMAIL] Email sending is disabled. Email would have been sent:', {
                to: options.to,
                templateType: options.templateType,
            });
            return {
                success: true,
                messageId: 'disabled',
            };
        }

        console.log('✅ [EMAIL] Emails are enabled');

        // Get the email template
        const template = getEmailTemplate(options.templateType, options.templateData);
        console.log('✅ [EMAIL] Template generated:', {
            subject: template.subject,
            hasHtml: !!template.html,
            hasText: !!template.text,
        });

        // Prepare email payload
        const emailPayload = {
            from: options.from || emailConfig.defaultFrom,
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: template.subject,
            html: template.html,
            text: template.text,
            replyTo: options.replyTo,
            cc: options.cc,
            bcc: options.bcc,
        };

        console.log('📤 [EMAIL] Sending via Resend API...');

        // Send the email
        const result = await resend.emails.send(emailPayload);

        console.log('📬 [EMAIL] Resend API response:', {
            hasError: !!result.error,
            hasData: !!result.data,
            result: result,
        });

        // Check if the result contains an error
        if (result.error) {
            console.error('❌ [EMAIL] Error from Resend API:', result.error);
            return {
                success: false,
                error: result.error.message || 'Failed to send email',
            };
        }

        console.log('✅ [EMAIL] Email sent successfully:', {
            messageId: result.data?.id,
            to: options.to,
            templateType: options.templateType,
        });

        return {
            success: true,
            messageId: result.data?.id,
        };
    } catch (error) {
        console.error('Error sending email:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred',
        };
    }
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (email, userName, loginId) => {
    return sendEmail({
        to: email,
        templateType: 'welcome',
        templateData: {
            userName,
            loginId,
        },
    });
};

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    emailConfig,
    validateEmailConfig,
};
