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
        error: 'TikTok URL is required'
      });
    }

    // Validate TikTok URL
    if (!isValidTikTokUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid TikTok URL. Must be from tiktok.com or vm.tiktok.com'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'tiktok_download');

    console.log('Fetching TikTok URL:', url);

    // Extract video data
    const videoData = await extractTikTokVideo(url);
    
    if (!videoData) {
      return res.status(404).json({
        success: false,
        error: 'No video found in the TikTok URL'
      });
    }

    logger.info('TikTok video downloaded', {
      url: url,
      username: videoData.author?.username,
      hasAudio: videoData.hasAudio
    });

    res.json({
      success: true,
      data: {
        id: uuidv4(),
        platform: 'tiktok',
        url: url,
        downloadUrl: videoData.url,
        noWatermarkUrl: videoData.noWatermarkUrl,
        thumbnail: videoData.thumbnail,
        musicUrl: videoData.musicUrl,
        title: videoData.title,
        author: videoData.author,
        duration: videoData.duration,
        size: videoData.size,
        hasAudio: videoData.hasAudio,
        dimensions: videoData.dimensions,
        timestamp: new Date().toISOString(),
        statistics: videoData.statistics
      }
    });

  } catch (error) {
    logger.error('TikTok download error', {
      error: error.message,
      url: req.query.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download TikTok video',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

function isValidTikTokUrl(url) {
  const patterns = [
    /https?:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/,
    /https?:\/\/(www\.)?tiktok\.com\/@[^/]+\/video/,
    /https?:\/\/(www\.)?tiktok\.com\/video\/\d+/,
    /https?:\/\/(vm|vt)\.tiktok\.com\/[A-Za-z0-9]+/,
    /https?:\/\/tiktok\.com\/t\/[A-Za-z0-9]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

async function extractTikTokVideo(url) {
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
    // First, try to get the final URL (in case of shortened URLs)
    let finalUrl = url;
    
    if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
      const response = await axios.get(url, { 
        headers,
        maxRedirects: 5,
        validateStatus: null
      });
      
      if (response.request?.res?.responseUrl) {
        finalUrl = response.request.res.responseUrl;
      }
    }
    
    console.log('Final TikTok URL:', finalUrl);
    
    // Fetch the TikTok page
    const response = await axios.get(finalUrl, { 
      headers,
      timeout: 10000
    });
    
    const html = response.data;
    
    // Parse HTML for video data
    const $ = cheerio.load(html);
    
    // Method 1: Look for JSON data in script tags
    let videoData = null;
    
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      
      if (scriptContent && scriptContent.includes('videoData')) {
        try {
          // Extract JSON from script
          const jsonMatch = scriptContent.match(/window\[\'SIGI_STATE\'\]\s*=\s*({.*?});/);
          
          if (jsonMatch && jsonMatch[1]) {
            const sigiState = JSON.parse(jsonMatch[1]);
            
            if (sigiState.ItemModule) {
              const videoId = Object.keys(sigiState.ItemModule)[0];
              const item = sigiState.ItemModule[videoId];
              
              if (item && item.video) {
                videoData = {
                  url: item.video.downloadAddr || item.video.playAddr,
                  noWatermarkUrl: item.video.downloadAddr || item.video.playAddr,
                  thumbnail: item.video.cover,
                  title: item.desc || '',
                  author: {
                    id: item.authorId,
                    username: item.author,
                    nickname: item.nickname
                  },
                  duration: item.video.duration,
                  hasAudio: true,
                  dimensions: {
                    width: item.video.width || 1080,
                    height: item.video.height || 1920
                  },
                  statistics: {
                    likes: item.stats?.diggCount || 0,
                    comments: item.stats?.commentCount || 0,
                    shares: item.stats?.shareCount || 0,
                    plays: item.stats?.playCount || 0
                  }
                };
              }
            }
          }
        } catch (jsonError) {
          console.log('JSON parse error:', jsonError.message);
        }
      }
    });
    
    // Method 2: Look for og:video meta tag
    if (!videoData) {
      $('meta[property="og:video"]').each((i, elem) => {
        const content = $(elem).attr('content');
        if (content && content.includes('.mp4')) {
          videoData = {
            url: content,
            noWatermarkUrl: content,
            thumbnail: $('meta[property="og:image"]').attr('content') || '',
            title: $('meta[property="og:title"]').attr('content') || '',
            author: {
              username: $('meta[property="og:site_name"]').attr('content') || 'TikTok'
            },
            duration: 0,
            hasAudio: true,
            dimensions: { width: 1080, height: 1920 },
            statistics: {}
          };
        }
      });
    }
    
    // Method 3: Try alternative API (using third-party service)
    if (!videoData) {
      videoData = await tryThirdPartyTikTokAPI(url);
    }
    
    if (videoData && videoData.url) {
      // Get video size
      try {
        const headResponse = await axios.head(videoData.url, { headers });
        const contentLength = headResponse.headers['content-length'];
        
        if (contentLength) {
          videoData.size = parseInt(contentLength);
        }
      } catch (headError) {
        console.log('Head request failed:', headError.message);
        videoData.size = 0;
      }
      
      return videoData;
    }
    
    throw new Error('Could not extract TikTok video data');
    
  } catch (error) {
    console.error('TikTok extraction error:', error.message);
    throw new Error(`Failed to extract TikTok video: ${error.message}`);
  }
}

async function tryThirdPartyTikTokAPI(url) {
  // This is where you would integrate with a third-party TikTok API service
  // Example: tiktok-video-no-watermark, tikwm, etc.
  
  // For now, return null - in production, you would implement this
  return null;
}

// TikTok audio/music download
module.exports.downloadAudio = async function(req, res) {
  try {
    const { url, apiKey } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'TikTok URL is required'
      });
    }
    
    // Extract audio from TikTok video
    const videoData = await extractTikTokVideo(url);
    
    if (!videoData || !videoData.musicUrl) {
      return res.status(404).json({
        success: false,
        error: 'No audio found in the TikTok video'
      });
    }
    
    // Log API usage
    db.logApiUsage(apiKey, 'tiktok_audio_download');
    
    res.json({
      success: true,
      data: {
        id: uuidv4(),
        platform: 'tiktok',
        type: 'audio',
        url: url,
        downloadUrl: videoData.musicUrl,
        title: videoData.title,
        author: videoData.author,
        duration: videoData.duration,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('TikTok audio download error', {
      error: error.message,
      url: req.query.url
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download TikTok audio'
    });
  }
};