module.exports = async function handler(req, res) {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ShardoX Downloader API',
    version: '3.0.0',
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(process.memoryUsage().external / 1024 / 1024)}MB`
    },
    environment: process.env.NODE_ENV || 'development',
    node: process.version,
    platform: process.platform,
    features: {
      instagram: true,
      tiktok: true,
      youtube: true,
      twitter: true,
      facebook: true,
      pinterest: true,
      qrcode: true,
      shorturl: true,
      screenshot: true,
      textToSpeech: true
    }
  };

  res.status(200).json(healthCheck);
};