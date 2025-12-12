import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, LocalAuth } from 'whatsapp-web.js';

const clients = new Map();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGetContacts(req, res);
  } else if (req.method === 'POST') {
    return handleCheckContact(req, res);
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
}

async function handleGetContacts(req: VercelRequest, res: VercelResponse) {
  try {
    const { apiKey, limit = 50, offset = 0 } = req.query;

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const client = await getClient(apiKey as string);
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp client not initialized'
      });
    }

    const contacts = await client.getContacts();
    const formattedContacts = contacts
      .filter(contact => contact.id.user)
      .map(contact => ({
        id: contact.id.user,
        name: contact.name || contact.pushname || contact.shortName || 'Unknown',
        isBusiness: contact.isBusiness,
        isEnterprise: contact.isEnterprise,
        isMyContact: contact.isMyContact
      }))
      .slice(Number(offset), Number(offset) + Number(limit));

    res.status(200).json({
      success: true,
      data: {
        total: contacts.length,
        limit: Number(limit),
        offset: Number(offset),
        contacts: formattedContacts
      }
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get contacts'
    });
  }
}

async function handleCheckContact(req: VercelRequest, res: VercelResponse) {
  try {
    const { apiKey, number } = req.body;

    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    if (!number) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const client = await getClient(apiKey);
    if (!client) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp client not initialized'
      });
    }

    const formattedNumber = number.replace(/\D/g, '') + '@c.us';
    const isRegistered = await client.isRegisteredUser(formattedNumber);

    res.status(200).json({
      success: true,
      data: {
        number: formattedNumber,
        isRegistered: isRegistered,
        exists: isRegistered
      }
    });

  } catch (error) {
    console.error('Check contact error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check contact'
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