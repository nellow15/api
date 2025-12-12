const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../lib/logger');
const db = require('../../utils/json-db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use GET'
    });
  }

  try {
    const { url, apiKey } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Instagram URL is required'
      });
    }

    // Validate Instagram URL
    if (!isValidInstagramUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Instagram URL. Must be from instagram.com'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'instagram_download');

    console.log('Fetching Instagram URL:', url);

    // Try different methods to extract video
    const videoData = await extractInstagramVideo(url);
    
    if (!videoData) {
      return res.status(404).json({
        success: false,
        error: 'No video found in the Instagram post'
      });
    }

    logger.info('Instagram video downloaded', {
      url: url,
      type: videoData.type,
      hasAudio: videoData.hasAudio
    });

    res.json({
      success: true,
      data: {
        id: uuidv4(),
        platform: 'instagram',
        url: url,
        downloadUrl: videoData.url,
        thumbnail: videoData.thumbnail,
        type: videoData.type,
        duration: videoData.duration,
        size: videoData.size,
        hasAudio: videoData.hasAudio,
        dimensions: videoData.dimensions,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Instagram download error', {
      error: error.message,
      url: req.query.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download Instagram video',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

function isValidInstagramUrl(url) {
  const patterns = [
    /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/,
    /https?:\/\/(www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+/,
    /https?:\/\/(www\.)?instagram\.com\/tv\/[A-Za-z0-9_-]+/,
    /https?:\/\/(www\.)?instagram\.com\/stories\/[A-Za-z0-9_-]+\/[0-9]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

async function extractInstagramVideo(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  };

  try {
    // Method 1: Try to fetch from instagram.com
    const response = await axios.get(url, { headers });
    const html = response.data;
    
    // Parse HTML for video URLs
    const $ = cheerio.load(html);
    
    // Look for video URLs in meta tags
    let videoUrl = null;
    let thumbnail = null;
    let videoType = 'video/mp4';
    
    // Check for og:video meta tag
    $('meta[property="og:video"]').each((i, elem) => {
      const content = $(elem).attr('content');
      if (content && content.includes('.mp4')) {
        videoUrl = content;
      }
    });
    
    // Check for og:video:secure_url
    if (!videoUrl) {
      $('meta[property="og:video:secure_url"]').each((i, elem) => {
        const content = $(elem).attr('content');
        if (content && content.includes('.mp4')) {
          videoUrl = content;
        }
      });
    }
    
    // Check for og:image for thumbnail
    $('meta[property="og:image"]').each((i, elem) => {
      const content = $(elem).attr('content');
      if (content && !thumbnail) {
        thumbnail = content;
      }
    });
    
    // If no video found in meta tags, look for video in script tags
    if (!videoUrl) {
      const scriptTags = $('script[type="text/javascript"]');
      
      scriptTags.each((i, elem) => {
        const scriptContent = $(elem).html();
        if (scriptContent && scriptContent.includes('video_url')) {
          // Try to parse JSON from script
          const jsonMatch = scriptContent.match(/"video_url":"([^"]+)"/);
          if (jsonMatch && jsonMatch[1]) {
            videoUrl = jsonMatch[1].replace(/\\\//g, '/');
          }
        }
      });
    }
    
    if (videoUrl) {
      // Get video info
      let dimensions = { width: 1080, height: 1920 };
      let duration = 0;
      let size = 0;
      
      // Try to get additional video info
      try {
        const headResponse = await axios.head(videoUrl, { headers });
        const contentLength = headResponse.headers['content-length'];
        const contentType = headResponse.headers['content-type'];
        
        if (contentLength) {
          size = parseInt(contentLength);
        }
        
        if (contentType) {
          videoType = contentType;
        }
      } catch (headError) {
        // Head request might fail, continue without size info
        console.log('Head request failed:', headError.message);
      }
      
      return {
        url: videoUrl,
        thumbnail: thumbnail,
        type: videoType,
        duration: duration,
        size: size,
        hasAudio: true,
        dimensions: dimensions
      };
    }
    
    // If still no video, return null
    return null;
    
  } catch (error) {
    console.error('Instagram extraction error:', error.message);
    
    // Method 2: Try alternative API (if you have one)
    // You can implement third-party API calls here
    
    throw new Error('Failed to extract video from Instagram');
  }
}

// Instagram stories download
module.exports.downloadStory = async function(req, res) {
  try {
    const { username, apiKey } = req.query;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Instagram username is required'
      });
    }
    
    // This would require Instagram API access or web scraping
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Instagram story download endpoint',
      note: 'This feature requires Instagram API access',
      data: {
        username: username,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Instagram story download error', {
      error: error.message,
      username: req.query.username
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download Instagram story'
    });
  }
};