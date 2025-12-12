const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
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
    const { text, size = 300, margin = 1, dark = '#000000', light = '#ffffff', apiKey } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text/content is required'
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Text too long. Maximum 1000 characters.'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'qrcode_generate');

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(text, {
      width: parseInt(size),
      margin: parseInt(margin),
      color: {
        dark: dark,
        light: light
      },
      errorCorrectionLevel: 'H' // High error correction
    });

    // Also generate as SVG
    const qrCodeSVG = await QRCode.toString(text, {
      type: 'svg',
      width: parseInt(size),
      margin: parseInt(margin),
      color: {
        dark: dark,
        light: light
      }
    });

    logger.info('QR code generated', {
      textLength: text.length,
      size: size
    });

    res.json({
      success: true,
      data: {
        id: uuidv4(),
        type: 'qrcode',
        text: text,
        size: parseInt(size),
        margin: parseInt(margin),
        dataUrl: qrCodeDataURL,
        svg: qrCodeSVG,
        timestamp: new Date().toISOString(),
        formats: {
          png: qrCodeDataURL,
          svg: `data:image/svg+xml;base64,${Buffer.from(qrCodeSVG).toString('base64')}`,
          raw: {
            text: text,
            size: size,
            colors: { dark: dark, light: light }
          }
        }
      }
    });

  } catch (error) {
    logger.error('QR code generation error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate QR code'
    });
  }
};

// Generate QR code with logo
module.exports.withLogo = async function(req, res) {
  try {
    const { text, logoUrl, size = 300, margin = 1, apiKey } = req.body;
    
    if (!text || !logoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Text and logo URL are required'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'qrcode_with_logo');

    // This would require additional image processing
    // For now, return a basic QR code with note about logo feature
    const qrCodeDataURL = await QRCode.toDataURL(text, {
      width: parseInt(size),
      margin: parseInt(margin)
    });

    res.json({
      success: true,
      data: {
        id: uuidv4(),
        type: 'qrcode_with_logo',
        text: text,
        logoUrl: logoUrl,
        size: parseInt(size),
        dataUrl: qrCodeDataURL,
        note: 'Logo feature requires additional image processing',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('QR code with logo error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate QR code with logo'
    });
  }
};

// Read QR code from image (requires image upload)
module.exports.read = async function(req, res) {
  try {
    // This endpoint would require multer for file upload
    // For now, return endpoint info
    res.json({
      success: true,
      message: 'QR code reading endpoint',
      note: 'This endpoint requires image file upload',
      usage: 'POST /api/tools/qrcode/read with image file'
    });

  } catch (error) {
    logger.error('QR code read error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to read QR code'
    });
  }
};