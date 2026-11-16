import React from 'react';
import { toast } from 'react-toastify';
import { getNotificationStyle, TAction, TNotificationContent, TNotificationStyle } from './bot-notification-utils';

export const NotificationContent: React.FC<TNotificationContent> = ({ message, primary_action, closeToast }) => {
    React.useEffect(() => {
        const handleToastVisibility = () => {
            if (document.visibilityState === 'hidden') {
                toast.dismiss();
            }
        };

        document.addEventListener('visibilitychange', handleToastVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleToastVisibility);
        };
    }, []);

    return (
        <div className='notification-content' data-testid='dt_bot_notification'>
            <div>{message}</div>
            {primary_action && (
                <button onClick={() => primary_action.onClick(closeToast)}>{primary_action.label}</button>
            )}
        </div>
    );
};

export const botNotification = (
    message: string,
    primary_action?: TAction,
    custom_style?: Partial<TNotificationStyle>
) => {
    const defaults = getNotificationStyle();
    return toast(
        ({ closeToast }) => (
            <NotificationContent message={message} primary_action={primary_action} closeToast={closeToast} />
        ),
        {
            type: custom_style?.type ?? defaults.type,
            position: custom_style?.position ?? defaults.position,
            autoClose: custom_style?.autoClose ?? defaults.autoClose,
            hideProgressBar: custom_style?.hideProgressBar ?? defaults.hideProgressBar,
            closeOnClick: custom_style?.closeOnClick ?? defaults.closeOnClick,
            pauseOnHover: custom_style?.pauseOnHover ?? defaults.pauseOnHover,
            pauseOnFocusLoss: custom_style?.pauseOnFocusLoss ?? defaults.pauseOnFocusLoss,
            closeButton: custom_style?.closeButton ?? defaults.closeButton,
            className: custom_style?.className ?? defaults.className,
        }
    );
};
