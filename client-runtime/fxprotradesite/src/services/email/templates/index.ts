import { EmailTemplateData } from './types';
import { welcomeEmailTemplate, welcomeEmailTextTemplate } from './welcome';

/**
 * Email Templates Index
 * Central export point for all email templates
 */

export interface EmailTemplateResult {
    html: string;
    text: string;
    subject: string;
}

/**
 * Get the appropriate email template based on type and data
 */
export const getEmailTemplate = (
    type: keyof EmailTemplateData,
    data: any
): EmailTemplateResult => {
    switch (type) {
        case 'welcome':
            return {
                html: welcomeEmailTemplate(data),
                text: welcomeEmailTextTemplate(data),
                subject: `Welcome to FxProTrades Bot Community, ${data.userName}! 🎉`,
            };
        
        // Add more templates here as they are created
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

export * from './types';
export * from './welcome';
