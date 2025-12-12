const express = require('express');
const router = express.Router();

// Import all download handlers
const instagramHandler = require('./instagram');
const tiktokHandler = require('./tiktok');
const youtubeHandler = require('./youtube');
const twitterHandler = require('./twitter');
const facebookHandler = require('./facebook');
const pinterestHandler = require('./pinterest');

// Instagram routes
router.get('/instagram', instagramHandler);
router.get('/instagram/story', instagramHandler.downloadStory);

// TikTok routes
router.get('/tiktok', tiktokHandler);
router.get('/tiktok/audio', tiktokHandler.downloadAudio);

// YouTube routes
router.get('/youtube', youtubeHandler);
router.get('/youtube/audio', youtubeHandler.downloadAudio);
router.get('/youtube/info', youtubeHandler.getInfo);

// Twitter routes
router.get('/twitter', twitterHandler);
router.get('/twitter/video', twitterHandler.downloadVideo);

// Facebook routes
router.get('/facebook', facebookHandler);
router.get('/facebook/video', facebookHandler.downloadVideo);

// Pinterest routes
router.get('/pinterest', pinterestHandler);
router.get('/pinterest/image', pinterestHandler.downloadImage);

// Universal download endpoint
router.get('/universal', async (req, res) => {
  try {
    const { url, apiKey } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Detect platform from URL
    let platform = 'unknown';
    
    if (url.includes('instagram.com')) platform = 'instagram';
    else if (url.includes('tiktok.com')) platform = 'tiktok';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
    else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
    else if (url.includes('facebook.com') || url.includes('fb.watch')) platform = 'facebook';
    else if (url.includes('pinterest.com')) platform = 'pinterest';
    else if (url.includes('pixiv.net')) platform = 'pixiv';
    else if (url.includes('reddit.com')) platform = 'reddit';

    // Redirect to appropriate handler
    switch (platform) {
      case 'instagram':
        req.query.url = url;
        return await instagramHandler(req, res);
      case 'tiktok':
        req.query.url = url;
        return await tiktokHandler(req, res);
      case 'youtube':
        req.query.url = url;
        return await youtubeHandler(req, res);
      case 'twitter':
        req.query.url = url;
        return await twitterHandler(req, res);
      case 'facebook':
        req.query.url = url;
        return await facebookHandler(req, res);
      case 'pinterest':
        req.query.url = url;
        return await pinterestHandler(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported platform or invalid URL',
          supported_platforms: [
            'instagram',
            'tiktok', 
            'youtube',
            'twitter',
            'facebook',
            'pinterest'
          ]
        });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process download request'
    });
  }
});

// Supported platforms endpoint
router.get('/platforms', (req, res) => {
  res.json({
    success: true,
    data: {
      platforms: [
        {
          name: 'Instagram',
          endpoints: ['/api/download/instagram', '/api/download/instagram/story'],
          formats: ['mp4', 'jpg'],
          features: ['Video download', 'Story download']
        },
        {
          name: 'TikTok',
          endpoints: ['/api/download/tiktok', '/api/download/tiktok/audio'],
          formats: ['mp4', 'mp3'],
          features: ['Video download', 'Audio extract', 'No watermark']
        },
        {
          name: 'YouTube',
          endpoints: ['/api/download/youtube', '/api/download/youtube/audio', '/api/download/youtube/info'],
          formats: ['mp4', 'mp3', 'webm'],
          features: ['Video download', 'Audio extract', 'Multiple qualities', 'Video info']
        },
        {
          name: 'Twitter',
          endpoints: ['/api/download/twitter', '/api/download/twitter/video'],
          formats: ['mp4'],
          features: ['Video download', 'GIF download']
        },
        {
          name: 'Facebook',
          endpoints: ['/api/download/facebook', '/api/download/facebook/video'],
          formats: ['mp4'],
          features: ['Video download']
        },
        {
          name: 'Pinterest',
          endpoints: ['/api/download/pinterest', '/api/download/pinterest/image'],
          formats: ['jpg', 'png', 'mp4'],
          features: ['Image download', 'Video download']
        }
      ],
      universal_endpoint: '/api/download/universal?url=YOUR_URL'
    }
  });
});

module.exports = router;