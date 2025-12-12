const db = require('../utils/json-db');
const jwt = require('jsonwebtoken');

// API Key Authentication Middleware
async function authenticateApiKey(req, res, next) {
  try {
    // Get API key from header, query, or body
    const apiKey = req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required'
      });
    }
    
    // Validate API key
    const validation = await db.validateApiKey(apiKey);
    
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired API key'
      });
    }
    
    // Check rate limit (simplified)
    if (validation.user && validation.user.usageToday >= validation.user.apiLimit) {
      return res.status(429).json({
        success: false,
        error: 'Daily API limit exceeded'
      });
    }
    
    // Attach user and key info to request
    req.user = validation.user;
    req.apiKey = apiKey;
    req.apiKeyData = validation;
    
    // Add API key to response headers for debugging
    res.set('X-API-Key-ID', validation.keyId);
    
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

// JWT Authentication Middleware
function authenticateJWT(req, res, next) {
  // First check session
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  
  // Then check JWT token
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET || 'shardox-secret', async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      
      // Get user from database
      const user = await db.getUserById(decoded.userId);
      
      if (!user || !user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'User not found or inactive'
        });
      }
      
      req.user = user;
      next();
    });
  } else {
    // Redirect to login for web interface
    if (req.accepts('html')) {
      return res.redirect('/login');
    }
    
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  if (req.accepts('html')) {
    return res.redirect('/dashboard');
  }
  
  res.status(403).json({
    success: false,
    error: 'Admin access required'
  });
}

// Generate JWT token
function generateToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'shardox-secret',
    { expiresIn: '24h' }
  );
}

module.exports = {
  authenticateApiKey,
  authenticateJWT,
  requireAdmin,
  generateToken
};