const express = require('express');
const router = express.Router();

// Import all tools handlers
const qrcodeHandler = require('./qrcode');
const shorturlHandler = require('./shorturl');
const screenshotHandler = require('./screenshot');
const textToSpeechHandler = require('./text-to-speech');

// QR Code routes
router.post('/qrcode', qrcodeHandler);
router.post('/qrcode/with-logo', qrcodeHandler.withLogo);
router.post('/qrcode/read', qrcodeHandler.read);
router.get('/qrcode', (req, res) => {
  const { text, size = 300 } = req.query;
  
  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Text parameter is required'
    });
  }
  
  // Redirect to POST endpoint
  req.body = { text, size, apiKey: req.query.apiKey };
  return qrcodeHandler(req, res);
});

// Short URL routes
router.post('/shorturl', shorturlHandler);
router.get('/shorturl/info', shorturlHandler.getInfo);
router.get('/shorturl/list', shorturlHandler.list);
router.get('/s/:shortCode', shorturlHandler.redirect);

// Screenshot routes
router.post('/screenshot', screenshotHandler);
router.post('/screenshot/pdf', screenshotHandler.pdf);
router.post('/screenshot/mobile', screenshotHandler.mobile);

// Text to Speech routes
router.post('/text-to-speech', textToSpeechHandler);
router.post('/tts', textToSpeechHandler); // Alias

// Tools list endpoint
router.get('/list', (req, res) => {
  res.json({
    success: true,
    data: {
      tools: [
        {
          name: 'QR Code Generator',
          endpoint: '/api/tools/qrcode',
          methods: ['POST', 'GET'],
          description: 'Generate QR codes from text/URL',
          features: ['Custom colors', 'Size control', 'Logo support', 'SVG/PNG output']
        },
        {
          name: 'URL Shortener',
          endpoint: '/api/tools/shorturl',
          methods: ['POST'],
          description: 'Create short URLs with analytics',
          features: ['Custom slugs', 'Password protection', 'Expiration dates', 'Click tracking']
        },
        {
          name: 'Webpage Screenshot',
          endpoint: '/api/tools/screenshot',
          methods: ['POST'],
          description: 'Take screenshots of webpages',
          features: ['Full page capture', 'Mobile simulation', 'PDF export', 'Custom dimensions']
        },
        {
          name: 'Text to Speech',
          endpoint: '/api/tools/text-to-speech',
          methods: ['POST'],
          description: 'Convert text to speech audio',
          features: ['Multiple languages', 'Voice selection', 'Speed control', 'MP3 output']
        }
      ]
    }
  });
});

module.exports = router;