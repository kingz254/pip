// Determine API base URL based on environment
const getApiBaseUrl = () => {
    // Check if we're on localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    // Production - use the same domain with /api path
    return `${window.location.origin}/api`;
};

const API_BASE_URL = getApiBaseUrl();

console.log('🔧 Community API Base URL:', API_BASE_URL);
console.log('🌐 Current hostname:', window.location.hostname);
console.log('🌐 Current origin:', window.location.origin);

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const handleGetCategories = async (): Promise<ApiResponse<any[]>> => {
    try {
        console.log('Fetching categories from:', `${API_BASE_URL}/categories`);
        const response = await fetch(`${API_BASE_URL}/categories`);
        console.log('Categories response status:', response.status);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('Categories error response:', text);
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        
        const data = await response.json();
        console.log('Categories data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return { success: false, error: String(error) };
    }
};

export const handleGetMessages = async (categoryId: string, limit = 50): Promise<ApiResponse<any[]>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${categoryId}?limit=${limit}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching messages:', error);
        return { success: false, error: String(error) };
    }
};

export const handleCreateMessage = async (
    userId: string,
    categoryId: string,
    content: string,
    replyToId?: string,
    attachments?: { type: string; url: string }[]
): Promise<ApiResponse<any>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                categoryId,
                content,
                replyToId,
                attachments,
            }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating message:', error);
        return { success: false, error: String(error) };
    }
};

export const handleRegisterUser = async (
    loginId: string,
    fullName: string,
    avatar?: string,
    email?: string
): Promise<ApiResponse<any>> => {
    try {
        console.log('Registering user:', { loginId, fullName, avatar, email });
        console.log('API URL:', `${API_BASE_URL}/users/register`);
        
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                loginId,
                fullName,
                avatar,
                email,
            }),
        });
        
        console.log('Register response status:', response.status);
        
        if (!response.ok) {
            const text = await response.text();
            console.error('Register error response:', text);
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        
        const data = await response.json();
        console.log('Register response data:', data);
        return data;
    } catch (error) {
        console.error('Error registering user:', error);
        return { success: false, error: String(error) };
    }
};

export const handleUpdateUserStatus = async (
    loginId: string,
    status: string
): Promise<ApiResponse<any>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${loginId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating user status:', error);
        return { success: false, error: String(error) };
    }
};

export const handleGetUserStats = async (loginId: string): Promise<ApiResponse<any>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${loginId}/stats`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return { success: false, error: String(error) };
    }
};

export const handleToggleReaction = async (
    messageId: string,
    emoji: string,
    userId: string
): Promise<ApiResponse<any>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/reactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messageId,
                emoji,
                userId,
            }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error toggling reaction:', error);
        return { success: false, error: String(error) };
    }
};

export const handleGetOnlineUsersCount = async (): Promise<ApiResponse<{ count: number }>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/users/online/count`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching online users count:', error);
        return { success: false, error: String(error) };
    }
};

export const handleUpdateMessage = async (
    messageId: string,
    content: string
): Promise<ApiResponse<any>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating message:', error);
        return { success: false, error: String(error) };
    }
};

export const handleDeleteMessage = async (messageId: string): Promise<ApiResponse<any>> => {
    try {
        const response = await fetch(`${API_BASE_URL}/messages/${messageId}`, {
            method: 'DELETE',
        });
        return await response.json();
    } catch (error) {
        console.error('Error deleting message:', error);
        return { success: false, error: String(error) };
    }
};
