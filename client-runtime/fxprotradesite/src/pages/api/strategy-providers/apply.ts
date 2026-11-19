import { NextApiRequest, NextApiResponse } from 'next';
import { testConnection } from '../../../lib/api-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        // Test API connection first
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('API connection failed');
        }

        const {
            full_name,
            login_id,
            min_balance,
            win_rate,
            profit_percentage,
            total_trades,
            profile_picture,
            currency,
            email,
        } = req.body;

        // Validate required fields
        if (!full_name || !login_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: full_name and login_id are required',
            });
        }

        // Forward the data to Bubble API
        const response = await fetch('https://database.binaryfx.site/api/1.1/wf/copy trading', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                full_name,
                login_id,
                min_balance: parseFloat(min_balance) || 50.0,
                win_rate: parseFloat(win_rate) || 0,
                profit_percentage: parseFloat(profit_percentage) || 0,
                total_trades: parseInt(total_trades) || 0,
                profile_picture: profile_picture || null,
                status: 'pending',
                currency: currency || 'USD',
                email: email || 'none@example.com',
            }),
        });

        if (!response.ok) {
            throw new Error(`Bubble API error: ${response.status}`);
        }

        const bubbleResponse = await response.json();

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully!',
            response: bubbleResponse,
        });
    } catch (error) {
        console.error('Error submitting provider application:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while submitting your application',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
        });
    }
}
