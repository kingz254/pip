import { ToastContainer, toast } from 'react-toastify';
import { act, fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { botNotification } from '../bot-notification';

jest.mock('@/external/bot-skeleton/utils/workspace', () => ({
    isDbotRTL: jest.fn(() => false),
}));

const mockIsDbotRTL = jest.mocked(isDbotRTL);

const BOT_STOP_MESSAGE = 'Bot stopped. Check Reports for contract history';
const IMPORT_MESSAGE = 'You’ve successfully imported a bot.';

const renderContainer = () => render(<ToastContainer limit={3} draggable={false} />);

const getToast = (message: string) => screen.getByText(message).closest('.Toastify__toast');

describe('botNotification', () => {
    let console_error_spy: jest.SpyInstance;

    beforeEach(() => {
        mockIsDbotRTL.mockReturnValue(false);
        console_error_spy = jest.spyOn(console, 'error');
    });

    afterEach(() => {
        act(() => {
            toast.dismiss();
        });
        const console_error_calls = [...console_error_spy.mock.calls];
        console_error_spy.mockRestore();
        expect(console_error_calls).toHaveLength(0);
    });

    it('[BTN-001] shows a plain toast without a render error', async () => {
        renderContainer();
        act(() => {
            botNotification(IMPORT_MESSAGE);
        });

        expect(await screen.findByText(IMPORT_MESSAGE)).toBeInTheDocument();
        expect(document.querySelector('.Toastify__close-button')).toBeInTheDocument();
    });

    it('[BTN-001] shows the bot-stopped toast with its Reports action', async () => {
        renderContainer();
        act(() => {
            botNotification(BOT_STOP_MESSAGE, { label: 'Reports', onClick: jest.fn() });
        });

        expect(await screen.findByText(BOT_STOP_MESSAGE)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument();
    });

    it('[BTN-001] shows a toast with a custom type, class name and no close button', async () => {
        renderContainer();
        act(() => {
            botNotification(IMPORT_MESSAGE, undefined, {
                type: 'warning',
                className: 'error-toast',
                closeButton: false,
            });
        });

        expect(await screen.findByText(IMPORT_MESSAGE)).toBeInTheDocument();
        expect(getToast(IMPORT_MESSAGE)).toHaveClass('error-toast');
        expect(getToast(IMPORT_MESSAGE)).toHaveClass('Toastify__toast--warning');
        expect(document.querySelector('.Toastify__close-button')).not.toBeInTheDocument();
    });

    it('[BTN-002] calls the action handler once with a close function that removes the toast', async () => {
        const onClick = jest.fn((close?: () => void) => close?.());
        renderContainer();
        act(() => {
            botNotification(BOT_STOP_MESSAGE, { label: 'Reports', onClick });
        });

        const reports_button = await screen.findByRole('button', { name: 'Reports' });
        const toast_element = getToast(BOT_STOP_MESSAGE);
        if (!toast_element) throw new Error('Bot-stopped toast element (.Toastify__toast) not found');
        await act(async () => {
            await userEvent.click(reports_button);
        });

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith(expect.any(Function));
        fireEvent.animationEnd(toast_element); // jsdom does not run CSS animations
        await waitForElementToBeRemoved(() => screen.queryByText(BOT_STOP_MESSAGE));
    });

    it('[BTN-003] places a default toast at the bottom left for a left-to-right workspace', async () => {
        renderContainer();
        act(() => {
            botNotification(IMPORT_MESSAGE);
        });

        await screen.findByText(IMPORT_MESSAGE);
        const toast_element = getToast(IMPORT_MESSAGE);
        expect(toast_element).toHaveClass('Toastify__toast--default');
        expect(toast_element?.closest('.Toastify__toast-container--bottom-left')).toBeInTheDocument();
    });

    it('[BTN-003] places a default toast at the bottom right for a right-to-left workspace', async () => {
        mockIsDbotRTL.mockReturnValue(true);
        renderContainer();
        act(() => {
            botNotification(IMPORT_MESSAGE);
        });

        await screen.findByText(IMPORT_MESSAGE);
        expect(
            getToast(IMPORT_MESSAGE)?.closest('.Toastify__toast-container--bottom-right')
        ).toBeInTheDocument();
    });

    it('[BTN-003] lets the caller override the toast position', async () => {
        renderContainer();
        act(() => {
            botNotification(IMPORT_MESSAGE, undefined, { position: 'top-center' });
        });

        await screen.findByText(IMPORT_MESSAGE);
        expect(getToast(IMPORT_MESSAGE)?.closest('.Toastify__toast-container--top-center')).toBeInTheDocument();
    });

    it('[BTN-003] lets the caller override the toast type', async () => {
        renderContainer();
        act(() => {
            botNotification(IMPORT_MESSAGE, undefined, { type: 'info' });
        });

        await screen.findByText(IMPORT_MESSAGE);
        expect(getToast(IMPORT_MESSAGE)).toHaveClass('Toastify__toast--info');
    });
});
