/**
 * Email Service Configuration
 * Centralized configuration for email sending using Resend API
 */

export const emailConfig = {
    // Resend API Key - should be set in environment variables
    apiKey: process.env.RESEND_API_KEY || '',
    
    // Default sender email (must be verified in Resend)
    defaultFrom: process.env.EMAIL_FROM || 'FxProTrades Bot <noreply@binaryfx.site>',
    
    // Environment check
    isProduction: process.env.NODE_ENV === 'production',
    
    // Enable/disable email sending (useful for development)
    enabled: process.env.ENABLE_EMAILS !== 'false',
};

/**
 * Email template types for type safety
 */
export enum EmailTemplateType {
    WELCOME = 'welcome',
    PASSWORD_RESET = 'password_reset',
    VERIFICATION = 'verification',
    NOTIFICATION = 'notification',
    COPY_TRADING_REQUEST = 'copy_trading_request',
    COPY_TRADING_ACCEPTED = 'copy_trading_accepted',
    COPY_TRADING_REJECTED = 'copy_trading_rejected',
    COMMUNITY_MENTION = 'community_mention',
    COMMUNITY_REPLY = 'community_reply',
}

/**
 * Validate email configuration
 */
export const validateEmailConfig = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
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
