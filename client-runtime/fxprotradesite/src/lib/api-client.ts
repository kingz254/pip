/**
 * API client for external services
 */

/**
 * Test the API connection
 * @returns {Promise<boolean>} Whether the connection was successful
 */
export async function testConnection(): Promise<boolean> {
    try {
        const response = await fetch('https://fxprotrades.site/api/1.1/wf/ping', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        return response.ok;
    } catch (error) {
        console.error('API connection test failed:', error);
        return false;
    }
}

/**
 * Submit application data to the Bubble API
 * @param data The application data to submit - can include a File object for profile_picture
 * @returns {Promise<any>} The API response
 */
export async function submitApplication(data: any): Promise<any> {
    // Determine if we're dealing with a File object or other data
    const hasFileObject = data.profile_picture instanceof File;

    if (hasFileObject) {
        // Handle direct file upload with FormData
        const formData = new FormData();

        // Add all text fields
        Object.entries(data).forEach(([key, value]) => {
            if (key !== 'profile_picture') {
                formData.append(key, String(value));
            }
        });

        // Add the file with original name and type
        formData.append('profile_picture', data.profile_picture, data.profile_picture.name);

        // Log file details for debugging
        console.log(
            `Uploading file: ${data.profile_picture.name} (${data.profile_picture.size} bytes, ${data.profile_picture.type})`
        );

        // Send as multipart/form-data (Content-Type header is automatically set by browser)
        const response = await fetch('https://database.binaryfx.site/api/1.1/wf/copy trading/initialize', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } else {
        // Regular JSON submission for requests without file uploads
        const response = await fetch('https://database.binaryfx.site/api/1.1/wf/copy trading/initialize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    }
}
