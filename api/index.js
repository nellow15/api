const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import JSON database
const db = require('../utils/json-db');

// Import middleware
const { authenticateApiKey, authenticateJWT } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');

// Import routes
const downloadRoutes = require('./download');
const toolsRoutes = require('./tools');
const mediaRoutes = require('./media');
const authRoutes = require('./auth');
const healthRoutes = require('./health');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'shardox-downloader-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests from this IP'
  }
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many login attempts'
  }
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Static files
app.use('/public', express.static(path.join(__dirname, '../public')));

// Global variables
app.use((req, res, next) => {
  res.locals.appName = 'ShardoX API';
  res.locals.appVersion = '3.0.0';
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// Routes
app.get('/', (req, res) => {
  res.render('index', {
    title: 'ShardoX API',
    description: 'Social Media Downloader & Tools API',
    user: req.session.user || null
  });
});

app.get('/dashboard', authenticateJWT, (req, res) => {
  const userApiKeys = db.getApiKeysByUser(req.user.id);
  const usageStats = db.getUserUsage(req.user.id);
  
  res.render('dashboard', {
    title: 'Dashboard',
    user: req.user,
    apiKeys: userApiKeys,
    usage: usageStats
  });
});

app.get('/admin', authenticateJWT, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/dashboard');
  }
  
  const stats = db.getAdminStats();
  
  res.render('admin', {
    title: 'Admin Panel',
    user: req.user,
    stats: stats
  });
});

app.get('/api-docs', (req, res) => {
  res.render('api', {
    title: 'API Documentation',
    endpoints: getEndpoints()
  });
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login' });
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/download', apiLimiter, authenticateApiKey, downloadRoutes);
app.use('/api/tools', apiLimiter, authenticateApiKey, toolsRoutes);
app.use('/api/media', apiLimiter, authenticateApiKey, mediaRoutes);
app.use('/api/health', healthRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Not Found',
    message: 'The requested resource was not found.',
    statusCode: 404
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred.' 
    : err.message;
  
  res.status(statusCode).render('error', {
    title: `${statusCode} - Error`,
    message: message,
    statusCode: statusCode
  });
});

// Helper function
function getEndpoints() {
  return [
    {
      category: 'Download',
      endpoints: [
        { method: 'GET', path: '/api/download/instagram', description: 'Download Instagram video' },
        { method: 'GET', path: '/api/download/tiktok', description: 'Download TikTok video' },
        { method: 'GET', path: '/api/download/youtube', description: 'Download YouTube video' },
        { method: 'GET', path: '/api/download/twitter', description: 'Download Twitter video' },
        { method: 'GET', path: '/api/download/facebook', description: 'Download Facebook video' },
        { method: 'GET', path: '/api/download/pinterest', description: 'Download Pinterest video' }
      ]
    },
    {
      category: 'Tools',
      endpoints: [
        { method: 'POST', path: '/api/tools/qrcode', description: 'Generate QR code' },
        { method: 'POST', path: '/api/tools/shorturl', description: 'Create short URL' },
        { method: 'POST', path: '/api/tools/screenshot', description: 'Take webpage screenshot' },
        { method: 'POST', path: '/api/tools/text-to-speech', description: 'Convert text to speech' }
      ]
    },
    {
      category: 'Media Processing',
      endpoints: [
        { method: 'POST', path: '/api/media/resize', description: 'Resize image' },
        { method: 'POST', path: '/api/media/compress', description: 'Compress image' },
        { method: 'POST', path: '/api/media/convert', description: 'Convert image format' },
        { method: 'POST', path: '/api/media/watermark', description: 'Add watermark to image' }
      ]
    }
  ];
}

// Start server if not in Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`ShardoX API running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;