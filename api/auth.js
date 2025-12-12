const express = require('express');
const router = express.Router();
const db = require('../utils/json-db');
const { generateToken } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    // Create user
    const user = await db.createUser(username, email, password);
    
    // Generate JWT token
    const token = generateToken(user.id);
    
    // Create session for web interface
    if (req.accepts('html')) {
      req.session.user = user;
      return res.redirect('/dashboard');
    }
    
    res.json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token: token
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    // Authenticate user
    const user = await db.authenticateUser(email, password);
    
    // Generate JWT token
    const token = generateToken(user.id);
    
    // Create session for web interface
    if (req.accepts('html')) {
      req.session.user = user;
      return res.redirect('/dashboard');
    }
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token: token
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  
  if (req.accepts('html')) {
    return res.redirect('/login');
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Create API key
router.post('/api-key', async (req, res) => {
  try {
    const { name } = req.body;
    
    // Get user from session or token
    let userId;
    
    if (req.user) {
      userId = req.user.id;
    } else if (req.body.token) {
      // Decode token to get userId
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(
        req.body.token,
        process.env.JWT_SECRET || 'shardox-secret'
      );
      userId = decoded.userId;
    } else {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Create API key
    const apiKeyData = await db.createApiKey(userId, name || 'Default Key');
    
    res.json({
      success: true,
      message: 'API key created successfully',
      data: apiKeyData,
      warning: 'Save this API key now. It will not be shown again.'
    });
    
  } catch (error) {
    console.error('API key creation error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create API key'
    });
  }
});

// Get user's API keys
router.get('/api-keys', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const apiKeys = await db.getApiKeysByUser(req.user.id);
    
    res.json({
      success: true,
      data: {
        count: apiKeys.length,
        apiKeys: apiKeys
      }
    });
    
  } catch (error) {
    console.error('Get API keys error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get API keys'
    });
  }
});

// Revoke API key
router.delete('/api-key/:keyId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { keyId } = req.params;
    
    await db.revokeApiKey(keyId, req.user.id);
    
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
    
  } catch (error) {
    console.error('Revoke API key error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revoke API key'
    });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const usageStats = await db.getUserUsage(req.user.id);
    
    res.json({
      success: true,
      data: {
        user: req.user,
        usage: usageStats
      }
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get profile'
    });
  }
});

module.exports = router;