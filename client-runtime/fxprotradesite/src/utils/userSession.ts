/**
 * User Session Utilities
 * Helper functions to manage user session data including email
 */

// Storage key for user email
const USER_EMAIL_KEY = 'userEmail';

/**
 * Get the current user's email from session storage
 * @returns The user's email or null if not found
 */
export const getUserEmail = (): string | null => {
    try {
        return localStorage.getItem(USER_EMAIL_KEY);
    } catch (error) {
        console.error('Error retrieving user email:', error);
        return null;
    }
};

/**
 * Store the user's email in session storage
 * @param email - The user's email address
 */
export const setUserEmail = (email: string): void => {
    try {
        localStorage.setItem(USER_EMAIL_KEY, email);
        console.log('User email stored successfully:', email);
    } catch (error) {
        console.error('Error storing user email:', error);
    }
};

/**
 * Clear the user's email from session storage
 */
export const clearUserEmail = (): void => {
    try {
        localStorage.removeItem(USER_EMAIL_KEY);
        console.log('User email cleared from storage');
    } catch (error) {
        console.error('Error clearing user email:', error);
    }
};

/**
 * Check if a user email is stored in the session
 * @returns true if email exists, false otherwise
 */
export const hasUserEmail = (): boolean => {
    return getUserEmail() !== null;
};
