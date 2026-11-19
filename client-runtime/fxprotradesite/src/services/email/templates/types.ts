/**
 * Email Template Types
 * Define the structure for different email templates
 */

export interface EmailTemplateData {
    welcome: {
        userName: string;
        loginId: string;
    };
    passwordReset: {
        userName: string;
        resetLink: string;
        expiryTime: string;
    };
    verification: {
        userName: string;
        verificationCode: string;
        expiryTime: string;
    };
    notification: {
        userName: string;
        title: string;
        message: string;
        actionUrl?: string;
        actionText?: string;
    };
    copyTradingRequest: {
        userName: string;
        providerName: string;
        requestDate: string;
    };
    copyTradingAccepted: {
        userName: string;
        providerName: string;
        startDate: string;
    };
    copyTradingRejected: {
        userName: string;
        providerName: string;
        reason?: string;
    };
    communityMention: {
        userName: string;
        mentionedBy: string;
        messagePreview: string;
        categoryName: string;
        messageUrl: string;
    };
    communityReply: {
        userName: string;
        repliedBy: string;
        originalMessage: string;
        replyPreview: string;
        categoryName: string;
        messageUrl: string;
    };
}

export type EmailTemplate = keyof EmailTemplateData;
