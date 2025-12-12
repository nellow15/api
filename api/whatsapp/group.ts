import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, LocalAuth } from 'whatsapp-web.js';

const clients = new Map();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    return handleCreateGroup(req, res);
  } else if (req.method === 'GET') {
    return handleGetGroups(req, res);
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
}

async function handleCreateGroup(req: VercelRequest, res: VercelResponse) {
  try {
    const { apiKey, name, participants } = req.body;

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (!name || !participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        error: 'Group name and participants array are required'
      });
    }

    const client = await getClient(apiKey);
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp client not initialized'
      });
    }

    // Format participant numbers
    const formattedParticipants = participants.map(p => p.replace(/\D/g, '') + '@c.us');

    const group = await client.createGroup(name, formattedParticipants);
    
    res.status(200).json({
      success: true,
      message: 'Group created successfully',
      data: {
        groupId: group.id.id,
        name: group.name,
        participants: group.participants.map(p => ({
          id: p.id.id,
          isAdmin: p.isAdmin
        }))
      }
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create group'
    });
  }
}

async function handleGetGroups(req: VercelRequest, res: VercelResponse) {
  try {
    const { apiKey } = req.query;

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const client = await getClient(apiKey);
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp client not initialized'
      });
    }

    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);

    res.status(200).json({
      success: true,
      data: groups.map(group => ({
        id: group.id.id,
        name: group.name,
        participants: group.participants.length,
        isReadOnly: group.isReadOnly,
        timestamp: group.timestamp
      }))
    });

  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get groups'
    });
  }
}

async function getClient(apiKey: string) {
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

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 30000);
      client.once('ready', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });
  }

  return client;
}