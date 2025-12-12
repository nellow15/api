const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const logger = require('../../lib/logger');
const db = require('../../utils/json-db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST'
    });
  }

  try {
    const { url, customSlug = '', expires = null, password = null, apiKey } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'shorturl_create');

    // Generate short code
    let shortCode;
    
    if (customSlug && customSlug.trim() !== '') {
      // Use custom slug if provided
      shortCode = customSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      
      // Check if custom slug already exists
      const existingUrl = db.getShortUrlBySlug(shortCode);
      if (existingUrl) {
        return res.status(400).json({
          success: false,
          error: 'Custom slug already in use'
        });
      }
    } else {
      // Generate random short code
      shortCode = crypto.randomBytes(4).toString('hex');
    }

    // Calculate expiration date
    let expiresAt = null;
    if (expires) {
      expiresAt = new Date();
      if (expires === '1h') expiresAt.setHours(expiresAt.getHours() + 1);
      else if (expires === '24h') expiresAt.setHours(expiresAt.getHours() + 24);
      else if (expires === '7d') expiresAt.setDate(expiresAt.getDate() + 7);
      else if (expires === '30d') expiresAt.setDate(expiresAt.getDate() + 30);
      else expiresAt = new Date(expires);
    }

    // Create short URL data
    const shortUrlData = {
      id: uuidv4(),
      shortCode: shortCode,
      originalUrl: url,
      shortUrl: `${process.env.BASE_URL || 'https://your-api.vercel.app'}/s/${shortCode}`,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      password: password ? crypto.createHash('sha256').update(password).digest('hex') : null,
      clickCount: 0,
      createdBy: apiKey,
      isActive: true
    };

    // Save to database
    db.createShortUrl(shortUrlData);

    logger.info('Short URL created', {
      shortCode: shortCode,
      originalUrl: url.substring(0, 50) + '...'
    });

    res.json({
      success: true,
      data: {
        id: shortUrlData.id,
        shortCode: shortCode,
        originalUrl: url,
        shortUrl: shortUrlData.shortUrl,
        createdAt: shortUrlData.createdAt,
        expiresAt: shortUrlData.expiresAt,
        hasPassword: !!password,
        clickCount: 0,
        qrCode: `${process.env.BASE_URL || 'https://your-api.vercel.app'}/api/tools/qrcode?text=${encodeURIComponent(shortUrlData.shortUrl)}`
      }
    });

  } catch (error) {
    logger.error('Short URL creation error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create short URL'
    });
  }
};

// Get short URL info
module.exports.getInfo = async function(req, res) {
  try {
    const { shortCode, apiKey } = req.query;
    
    if (!shortCode) {
      return res.status(400).json({
        success: false,
        error: 'Short code is required'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'shorturl_info');

    const shortUrl = db.getShortUrlBySlug(shortCode);
    
    if (!shortUrl) {
      return res.status(404).json({
        success: false,
        error: 'Short URL not found'
      });
    }

    // Check if expired
    if (shortUrl.expiresAt && new Date(shortUrl.expiresAt) < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'Short URL has expired'
      });
    }

    // Check if active
    if (!shortUrl.isActive) {
      return res.status(410).json({
        success: false,
        error: 'Short URL is inactive'
      });
    }

    res.json({
      success: true,
      data: {
        id: shortUrl.id,
        shortCode: shortUrl.shortCode,
        originalUrl: shortUrl.originalUrl,
        shortUrl: shortUrl.shortUrl,
        createdAt: shortUrl.createdAt,
        expiresAt: shortUrl.expiresAt,
        clickCount: shortUrl.clickCount,
        hasPassword: !!shortUrl.password,
        isActive: shortUrl.isActive,
        lastAccessed: shortUrl.lastAccessed
      }
    });

  } catch (error) {
    logger.error('Short URL info error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get short URL info'
    });
  }
};

// Redirect endpoint (for actual URL redirection)
module.exports.redirect = async function(req, res) {
  try {
    const { shortCode } = req.params;
    
    if (!shortCode) {
      return res.status(400).json({
        success: false,
        error: 'Short code is required'
      });
    }

    const shortUrl = db.getShortUrlBySlug(shortCode);
    
    if (!shortUrl) {
      return res.status(404).render('error', {
        title: '404 - Not Found',
        message: 'Short URL not found'
      });
    }

    // Check if expired
    if (shortUrl.expiresAt && new Date(shortUrl.expiresAt) < new Date()) {
      return res.status(410).render('error', {
        title: '410 - Expired',
        message: 'This short URL has expired'
      });
    }

    // Check if active
    if (!shortUrl.isActive) {
      return res.status(410).render('error', {
        title: '410 - Inactive',
        message: 'This short URL is inactive'
      });
    }

    // Check password if required
    if (shortUrl.password) {
      // This would require password verification
      // For now, just redirect if no password provided in query
      if (!req.query.password) {
        return res.render('password', {
          title: 'Password Required',
          shortCode: shortCode
        });
      }
    }

    // Update click count
    db.incrementShortUrlClick(shortCode);

    // Redirect to original URL
    res.redirect(shortUrl.originalUrl);

  } catch (error) {
    logger.error('Short URL redirect error', {
      error: error.message,
      shortCode: req.params.shortCode
    });

    res.status(500).render('error', {
      title: '500 - Error',
      message: 'Failed to redirect'
    });
  }
};

// List user's short URLs
module.exports.list = async function(req, res) {
  try {
    const { apiKey } = req.query;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'shorturl_list');

    const shortUrls = db.getShortUrlsByApiKey(apiKey);
    
    res.json({
      success: true,
      data: {
        count: shortUrls.length,
        urls: shortUrls.map(url => ({
          id: url.id,
          shortCode: url.shortCode,
          originalUrl: url.originalUrl,
          shortUrl: url.shortUrl,
          createdAt: url.createdAt,
          expiresAt: url.expiresAt,
          clickCount: url.clickCount,
          isActive: url.isActive
        }))
      }
    });

  } catch (error) {
    logger.error('Short URL list error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list short URLs'
    });
  }
};