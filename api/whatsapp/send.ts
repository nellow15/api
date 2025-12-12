import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';

// In-memory client storage (in production use Redis)
const clients = new Map();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { apiKey, to, message, type = 'text', mediaUrl } = req.body;

    // Validate API key
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Validate required fields
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Recipient number is required'
      });
    }

    if (!message && type === 'text') {
      return res.status(400).json({
        success: false,
        error: 'Message is required for text type'
      });
    }

    // Format number
    const formattedNumber = to.replace(/\D/g, '') + '@c.us';

    // Get or create WhatsApp client
    let client = clients.get(apiKey);
    
    if (!client) {
      client = new Client({
        authStrategy: new LocalAuth({ clientId: apiKey }),
        puppeteer: {
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      client.initialize();
      clients.set(apiKey, client);

      // QR code generation
      client.on('qr', async (qr) => {
        const qrPath = path.join('/tmp', `qr-${apiKey}.png`);
        await qrcode.toFile(qrPath, qr);
      });

      client.on('ready', () => {
        console.log(`Client ${apiKey} is ready`);
      });

      client.on('disconnected', () => {
        clients.delete(apiKey);
      });
    }

    // Wait for client to be ready
    if (!client.info) {
      await new Promise(resolve => client.once('ready', resolve));
    }

    // Check if number exists
    const isRegistered = await client.isRegisteredUser(formattedNumber);
    if (!isRegistered) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is not registered on WhatsApp'
      });
    }

    let sentMessage;
    
    if (type === 'text') {
      sentMessage = await client.sendMessage(formattedNumber, message);
    } else if (type === 'media' && mediaUrl) {
      const media = await MessageMedia.fromUrl(mediaUrl);
      sentMessage = await client.sendMessage(formattedNumber, media, { caption: message });
    } else if (type === 'document' && mediaUrl) {
      const document = await MessageMedia.fromUrl(mediaUrl);
      sentMessage = await client.sendMessage(formattedNumber, document, { sendMediaAsDocument: true });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid message type or missing media URL'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: sentMessage.id.id,
        timestamp: sentMessage.timestamp,
        to: sentMessage.to,
        from: sentMessage.from,
        type: sentMessage.type
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message'
    });
  }
}