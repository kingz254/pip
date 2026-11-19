/**
 * User Session Example
 * 
 * This file demonstrates how to use the stored user email throughout the application.
 * The email is automatically fetched and stored during authorization.
 */

import { getUserEmail, hasUserEmail } from '../utils/userSession';

// Example 1: Get user email in any component
export const exampleGetUserEmail = () => {
    const userEmail = getUserEmail();
    
    if (userEmail) {
        console.log('Current user email:', userEmail);
        return userEmail;
    } else {
        console.log('No user email found - user may not be authenticated');
        return null;
    }
};

// Example 2: Check if user has email stored
export const exampleCheckUserEmail = () => {
    if (hasUserEmail()) {
        console.log('User is authenticated and email is stored');
        return true;
    } else {
        console.log('User email not found');
        return false;
    }
};

// Example 3: Display user email in a component
export const displayUserEmail = () => {
    const email = getUserEmail();
    return email || 'Not authenticated';
};

// Example 4: Use in API calls or logging
export const logUserAction = (action: string) => {
    const email = getUserEmail();
    console.log(`User ${email || 'Unknown'} performed action: ${action}`);
};

/**
 * NOTE: The email is automatically stored during authorization in:
 * - src/components/trading-hub/advanced-display.tsx (verifyToken function)
 * - src/hooks/useDerivAuth.ts (authorize response handler)
 * - src/components/layout/header/header.tsx (multiple authorization points)
 * 
 * You don't need to manually store the email - it happens automatically
 * when the user authenticates.
 */
