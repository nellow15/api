const ytdl = require('ytdl-core');
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
    const { url, quality = 'highest', format = 'mp4', apiKey } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required'
      });
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'youtube_download');

    // Get video info
    const videoInfo = await ytdl.getInfo(url);
    
    if (!videoInfo) {
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Get video formats
    let selectedFormat = null;
    
    if (format === 'mp3') {
      // Audio only
      selectedFormat = ytdl.chooseFormat(videoInfo.formats, {
        quality: 'highestaudio',
        filter: 'audioonly'
      });
    } else if (format === 'mp4') {
      // Video with audio
      selectedFormat = ytdl.chooseFormat(videoInfo.formats, {
        quality: quality === 'highest' ? 'highest' : quality,
        filter: format === 'audioonly' ? 'audioonly' : 'audioandvideo'
      });
    }

    if (!selectedFormat) {
      return res.status(404).json({
        success: false,
        error: 'No suitable format found'
      });
    }

    // Construct response data
    const videoData = {
      id: uuidv4(),
      platform: 'youtube',
      url: url,
      downloadUrl: selectedFormat.url,
      title: videoInfo.videoDetails.title,
      description: videoInfo.videoDetails.description,
      duration: parseInt(videoInfo.videoDetails.lengthSeconds),
      thumbnail: videoInfo.videoDetails.thumbnails[0]?.url || '',
      author: {
        name: videoInfo.videoDetails.author.name,
        channelUrl: videoInfo.videoDetails.author.channel_url
      },
      format: selectedFormat.container,
      quality: selectedFormat.qualityLabel || selectedFormat.quality,
      size: selectedFormat.contentLength ? parseInt(selectedFormat.contentLength) : 0,
      hasAudio: selectedFormat.hasAudio,
      hasVideo: selectedFormat.hasVideo,
      timestamp: new Date().toISOString(),
      statistics: {
        views: videoInfo.videoDetails.viewCount,
        likes: videoInfo.videoDetails.likes,
        comments: videoInfo.videoDetails.commentCount
      }
    };

    logger.info('YouTube video info retrieved', {
      videoId: videoInfo.videoDetails.videoId,
      title: videoData.title,
      duration: videoData.duration
    });

    res.json({
      success: true,
      data: videoData
    });

  } catch (error) {
    logger.error('YouTube download error', {
      error: error.message,
      url: req.query.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get YouTube video info',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// YouTube audio only (MP3)
module.exports.downloadAudio = async function(req, res) {
  try {
    const { url, apiKey } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required'
      });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'youtube_audio_download');

    const videoInfo = await ytdl.getInfo(url);
    
    // Get audio format
    const audioFormat = ytdl.chooseFormat(videoInfo.formats, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });

    if (!audioFormat) {
      return res.status(404).json({
        success: false,
        error: 'No audio format available'
      });
    }

    const audioData = {
      id: uuidv4(),
      platform: 'youtube',
      type: 'audio',
      url: url,
      downloadUrl: audioFormat.url,
      title: videoInfo.videoDetails.title,
      duration: parseInt(videoInfo.videoDetails.lengthSeconds),
      thumbnail: videoInfo.videoDetails.thumbnails[0]?.url || '',
      author: {
        name: videoInfo.videoDetails.author.name
      },
      format: 'mp3',
      size: audioFormat.contentLength ? parseInt(audioFormat.contentLength) : 0,
      bitrate: audioFormat.audioBitrate,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: audioData
    });

  } catch (error) {
    logger.error('YouTube audio download error', {
      error: error.message,
      url: req.query.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get YouTube audio'
    });
  }
};

// YouTube video info only (no download)
module.exports.getInfo = async function(req, res) {
  try {
    const { url, apiKey } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required'
      });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'youtube_info');

    const videoInfo = await ytdl.getInfo(url);
    
    const infoData = {
      id: uuidv4(),
      platform: 'youtube',
      url: url,
      videoId: videoInfo.videoDetails.videoId,
      title: videoInfo.videoDetails.title,
      description: videoInfo.videoDetails.description,
      duration: parseInt(videoInfo.videoDetails.lengthSeconds),
      thumbnails: videoInfo.videoDetails.thumbnails,
      author: {
        name: videoInfo.videoDetails.author.name,
        channelUrl: videoInfo.videoDetails.author.channel_url,
        subscriberCount: videoInfo.videoDetails.author.subscriber_count
      },
      formats: videoInfo.formats.map(format => ({
        quality: format.qualityLabel,
        container: format.container,
        hasAudio: format.hasAudio,
        hasVideo: format.hasVideo,
        contentLength: format.contentLength,
        bitrate: format.bitrate
      })),
      keywords: videoInfo.videoDetails.keywords,
      timestamp: new Date().toISOString(),
      statistics: {
        views: videoInfo.videoDetails.viewCount,
        likes: videoInfo.videoDetails.likes,
        comments: videoInfo.videoDetails.commentCount
      }
    };

    res.json({
      success: true,
      data: infoData
    });

  } catch (error) {
    logger.error('YouTube info error', {
      error: error.message,
      url: req.query.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get YouTube video info'
    });
  }
};