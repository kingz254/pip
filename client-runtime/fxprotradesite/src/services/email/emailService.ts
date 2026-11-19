/**
 * Universal Email Service
 * Reusable email sending service that can be used across the entire application
 * Supports community features, copy trading notifications, and more
 */

import { Resend } from 'resend';
import { emailConfig, validateEmailConfig } from './config';
import { getEmailTemplate, EmailTemplateData } from './templates';

// Initialize Resend client
const resend = new Resend(emailConfig.apiKey);

/**
 * Email sending options
 */
export interface SendEmailOptions {
    to: string | string[];
    templateType: keyof EmailTemplateData;
    templateData: any;
    from?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
}

/**
 * Email sending result
 */
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Send an email using a template
 */
export const sendEmail = async (
    options: SendEmailOptions
): Promise<SendEmailResult> => {
    try {
        // Validate configuration
        const configValidation = validateEmailConfig();
        if (!configValidation.valid) {
            console.error('Email configuration is invalid:', configValidation.errors);
            return {
                success: false,
                error: `Email configuration error: ${configValidation.errors.join(', ')}`,
            };
        }

        // Check if emails are enabled
        if (!emailConfig.enabled) {
            console.log('Email sending is disabled. Email would have been sent:', {
                to: options.to,
                templateType: options.templateType,
            });
            return {
                success: true,
                messageId: 'disabled',
            };
        }

        // Get the email template
        const template = getEmailTemplate(options.templateType, options.templateData);

        // Send the email
        const result = await resend.emails.send({
            from: options.from || emailConfig.defaultFrom,
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: template.subject,
            html: template.html,
            text: template.text,
            replyTo: options.replyTo,
            cc: options.cc,
            bcc: options.bcc,
        });

        // Check if the result contains an error
        if ('error' in result) {
            console.error('Error sending email via Resend:', result.error);
            return {
                success: false,
                error: result.error.message || 'Failed to send email',
            };
        }

        console.log('Email sent successfully:', {
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
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
};

/**
 * Send welcome email to a new community member
 */
export const sendWelcomeEmail = async (
    email: string,
    userName: string,
    loginId: string
): Promise<SendEmailResult> => {
    return sendEmail({
        to: email,
        templateType: 'welcome',
        templateData: {
            userName,
            loginId,
        },
    });
};

/**
 * Send notification email
 */
export const sendNotificationEmail = async (
    email: string,
    userName: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
): Promise<SendEmailResult> => {
    return sendEmail({
        to: email,
        templateType: 'notification',
        templateData: {
            userName,
            title,
            message,
            actionUrl,
            actionText,
        },
    });
};

/**
 * Batch send emails (for multiple recipients with same template)
 */
export const sendBatchEmails = async (
    recipients: { email: string; templateData: any }[],
    templateType: keyof EmailTemplateData
): Promise<{ total: number; successful: number; failed: number }> => {
    const results = await Promise.allSettled(
        recipients.map((recipient) =>
            sendEmail({
                to: recipient.email,
                templateType,
                templateData: recipient.templateData,
            })
        )
    );

    const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.length - successful;

    return {
        total: results.length,
        successful,
        failed,
    };
};

/**
 * Export all email functions
 */
export default {
    sendEmail,
    sendWelcomeEmail,
    sendNotificationEmail,
    sendBatchEmails,
};
