import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, LocalAuth } from 'whatsapp-web.js';

const clients = new Map();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { apiKey } = req.query;

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const client = clients.get(apiKey);
    
    if (!client) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'disconnected',
          message: 'Client not initialized',
          timestamp: new Date().toISOString()
        }
      });
    }

    const status = client.info ? 'connected' : 'connecting';
    const phoneNumber = client.info?.wid.user || 'Unknown';
    const platform = client.info?.platform || 'Unknown';

    res.status(200).json({
      success: true,
      data: {
        status: status,
        phoneNumber: phoneNumber,
        platform: platform,
        timestamp: new Date().toISOString(),
        clientInfo: client.info || null
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check status'
    });
  }
}