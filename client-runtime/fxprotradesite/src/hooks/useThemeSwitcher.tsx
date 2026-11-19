import { useCallback, useEffect } from 'react';
import { useStore } from './useStore';

const useThemeSwitcher = () => {
    const { ui } = useStore() ?? {
        ui: {
            setDarkMode: () => {},
            is_dark_mode_on: false,
        },
    };
    const { setDarkMode, is_dark_mode_on } = ui;

    // Initialize theme from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const isDarkMode = savedTheme === 'dark';

        // Make sure UI state matches localStorage
        if (isDarkMode !== is_dark_mode_on) {
            setDarkMode(isDarkMode);
        }

        // Make sure body classes match
        const body = document.querySelector('body');
        if (body) {
            if (isDarkMode) {
                body.classList.remove('theme--light');
                body.classList.add('theme--dark');
            } else {
                body.classList.remove('theme--dark');
                body.classList.add('theme--light');
            }
        }
    }, [is_dark_mode_on, setDarkMode]);

    const toggleTheme = useCallback(() => {
        const body = document.querySelector('body');
        if (!body) return;

        const newIsDarkMode = !is_dark_mode_on;
        const newTheme = newIsDarkMode ? 'dark' : 'light';

        // Update localStorage
        localStorage.setItem('theme', newTheme);

        // Update body classes
        body.classList.remove(`theme--${is_dark_mode_on ? 'dark' : 'light'}`);
        body.classList.add(`theme--${newTheme}`);

        // Update store
        setDarkMode(newIsDarkMode);

        // Dispatch custom event for other parts of the app
        window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: newTheme } }));
    }, [is_dark_mode_on, setDarkMode]);

    return {
        toggleTheme,
        is_dark_mode_on,
        setDarkMode,
    };
};

export default useThemeSwitcher;
