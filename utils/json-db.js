const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

class JSONDatabase {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.init();
  }

  async init() {
    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Initialize JSON files if they don't exist
    await this.ensureFile('users.json', { users: [], lastId: 0 });
    await this.ensureFile('api-keys.json', { apiKeys: [] });
    await this.ensureFile('logs.json', { logs: [] });
    await this.ensureFile('shorturls.json', { urls: [] });
    await this.ensureFile('downloads.json', { downloads: [] });
  }

  async ensureFile(filename, defaultData) {
    const filePath = path.join(this.dataDir, filename);
    
    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist, create it
      await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
    }
  }

  async readFile(filename) {
    const filePath = path.join(this.dataDir, filename);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  }

  async writeFile(filename, data) {
    const filePath = path.join(this.dataDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // User Management
  async createUser(username, email, password) {
    const data = await this.readFile('users.json');
    
    // Check if user already exists
    const existingUser = data.users.find(u => 
      u.email === email || u.username === username
    );
    
    if (existingUser) {
      throw new Error('User already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true,
      apiLimit: 1000, // Requests per day
      usageToday: 0
    };
    
    data.users.push(newUser);
    await this.writeFile('users.json', data);
    
    // Remove password from returned object
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  async authenticateUser(email, password) {
    const data = await this.readFile('users.json');
    const user = data.users.find(u => u.email === email && u.isActive);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      throw new Error('Invalid credentials');
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    await this.writeFile('users.json', data);
    
    // Remove password from returned object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUserById(userId) {
    const data = await this.readFile('users.json');
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
      return null;
    }
    
    // Remove password from returned object
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // API Key Management
  async createApiKey(userId, name = 'Default Key') {
    const apiKeysData = await this.readFile('api-keys.json');
    
    // Generate API key
    const apiKey = `shd_${uuidv4().replace(/-/g, '')}`;
    const hashedKey = await bcrypt.hash(apiKey, 10);
    
    const newApiKey = {
      id: uuidv4(),
      userId,
      name,
      key: hashedKey, // Store hashed key
      plainKey: apiKey, // Store plain key only for initial response
      createdAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0,
      isActive: true,
      rateLimit: 100, // Requests per minute
      endpoints: ['*'] // Allowed endpoints
    };
    
    apiKeysData.apiKeys.push(newApiKey);
    await this.writeFile('api-keys.json', apiKeysData);
    
    return {
      id: newApiKey.id,
      name: newApiKey.name,
      apiKey: apiKey, // Return plain key only once
      createdAt: newApiKey.createdAt
    };
  }

  async validateApiKey(apiKey) {
    const data = await this.readFile('api-keys.json');
    
    // Find the API key
    for (const keyData of data.apiKeys) {
      const isValid = await bcrypt.compare(apiKey, keyData.key);
      
      if (isValid && keyData.isActive) {
        // Update last used
        keyData.lastUsed = new Date().toISOString();
        keyData.usageCount = (keyData.usageCount || 0) + 1;
        await this.writeFile('api-keys.json', data);
        
        // Get user info
        const user = await this.getUserById(keyData.userId);
        
        return {
          valid: true,
          userId: keyData.userId,
          keyId: keyData.id,
          user: user,
          permissions: keyData.endpoints,
          rateLimit: keyData.rateLimit
        };
      }
    }
    
    return { valid: false };
  }

  async getApiKeysByUser(userId) {
    const data = await this.readFile('api-keys.json');
    return data.apiKeys
      .filter(k => k.userId === userId && k.isActive)
      .map(k => ({
        id: k.id,
        name: k.name,
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
        usageCount: k.usageCount
      }));
  }

  async revokeApiKey(keyId, userId) {
    const data = await this.readFile('api-keys.json');
    const keyIndex = data.apiKeys.findIndex(k => k.id === keyId && k.userId === userId);
    
    if (keyIndex === -1) {
      throw new Error('API key not found');
    }
    
    data.apiKeys[keyIndex].isActive = false;
    data.apiKeys[keyIndex].revokedAt = new Date().toISOString();
    
    await this.writeFile('api-keys.json', data);
    
    return true;
  }

  // API Usage Logging
  async logApiUsage(apiKey, endpoint, data = {}) {
    const logsData = await this.readFile('logs.json');
    
    const logEntry = {
      id: uuidv4(),
      apiKey: apiKey.substring(0, 8) + '...', // Store partial for privacy
      endpoint,
      timestamp: new Date().toISOString(),
      data,
      ip: data.ip || 'unknown',
      userAgent: data.userAgent || 'unknown'
    };
    
    logsData.logs.unshift(logEntry);
    
    // Keep only last 1000 logs
    if (logsData.logs.length > 1000) {
      logsData.logs = logsData.logs.slice(0, 1000);
    }
    
    await this.writeFile('logs.json', logsData);
    
    // Also update user's daily usage
    const keyData = await this.validateApiKey(apiKey);
    if (keyData.valid) {
      await this.updateUserUsage(keyData.userId);
    }
    
    return logEntry;
  }

  async updateUserUsage(userId) {
    const data = await this.readFile('users.json');
    const userIndex = data.users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      // Reset daily usage if it's a new day
      const today = new Date().toDateString();
      const lastReset = data.users[userIndex].lastResetDate;
      
      if (lastReset !== today) {
        data.users[userIndex].usageToday = 0;
        data.users[userIndex].lastResetDate = today;
      }
      
      // Increment usage
      data.users[userIndex].usageToday = (data.users[userIndex].usageToday || 0) + 1;
      
      await this.writeFile('users.json', data);
    }
  }

  async getUserUsage(userId) {
    const data = await this.readFile('users.json');
    const user = data.users.find(u => u.id === userId);
    
    if (!user) {
      return null;
    }
    
    // Get logs for this user's API keys
    const apiKeysData = await this.readFile('api-keys.json');
    const userApiKeys = apiKeysData.apiKeys
      .filter(k => k.userId === userId)
      .map(k => k.key);
    
    const logsData = await this.readFile('logs.json');
    const userLogs = logsData.logs.filter(log => 
      userApiKeys.some(key => log.apiKey.startsWith(key.substring(0, 8)))
    );
    
    // Calculate usage stats
    const today = new Date().toDateString();
    const todayLogs = userLogs.filter(log => 
      new Date(log.timestamp).toDateString() === today
    );
    
    return {
      totalRequests: userLogs.length,
      todayRequests: todayLogs.length,
      dailyLimit: user.apiLimit || 1000,
      usageToday: user.usageToday || 0,
      lastRequest: userLogs[0]?.timestamp || null
    };
  }

  // Short URL Management
  async createShortUrl(shortUrlData) {
    const data = await this.readFile('shorturls.json');
    data.urls.push(shortUrlData);
    await this.writeFile('shorturls.json', data);
    return shortUrlData;
  }

  async getShortUrlBySlug(shortCode) {
    const data = await this.readFile('shorturls.json');
    return data.urls.find(url => url.shortCode === shortCode);
  }

  async getShortUrlsByApiKey(apiKey) {
    const data = await this.readFile('shorturls.json');
    return data.urls.filter(url => url.createdBy === apiKey);
  }

  async incrementShortUrlClick(shortCode) {
    const data = await this.readFile('shorturls.json');
    const urlIndex = data.urls.findIndex(url => url.shortCode === shortCode);
    
    if (urlIndex !== -1) {
      data.urls[urlIndex].clickCount = (data.urls[urlIndex].clickCount || 0) + 1;
      data.urls[urlIndex].lastAccessed = new Date().toISOString();
      await this.writeFile('shorturls.json', data);
    }
  }

  // Download History
  async logDownload(userId, platform, url, result) {
    const data = await this.readFile('downloads.json');
    
    const downloadEntry = {
      id: uuidv4(),
      userId,
      platform,
      url,
      result: {
        success: result.success,
        type: result.type,
        size: result.size
      },
      timestamp: new Date().toISOString()
    };
    
    data.downloads.unshift(downloadEntry);
    
    // Keep only last 500 downloads
    if (data.downloads.length > 500) {
      data.downloads = data.downloads.slice(0, 500);
    }
    
    await this.writeFile('downloads.json', data);
    
    return downloadEntry;
  }

  async getUserDownloads(userId, limit = 50) {
    const data = await this.readFile('downloads.json');
    return data.downloads
      .filter(d => d.userId === userId)
      .slice(0, limit);
  }

  // Admin Stats
  async getAdminStats() {
    const usersData = await this.readFile('users.json');
    const apiKeysData = await this.readFile('api-keys.json');
    const logsData = await this.readFile('logs.json');
    const downloadsData = await this.readFile('downloads.json');
    const shorturlsData = await this.readFile('shorturls.json');
    
    // Calculate daily usage
    const today = new Date().toDateString();
    const todayLogs = logsData.logs.filter(log => 
      new Date(log.timestamp).toDateString() === today
    );
    
    // Group logs by endpoint
    const endpointStats = {};
    logsData.logs.forEach(log => {
      endpointStats[log.endpoint] = (endpointStats[log.endpoint] || 0) + 1;
    });
    
    return {
      totalUsers: usersData.users.length,
      activeUsers: usersData.users.filter(u => u.isActive).length,
      totalApiKeys: apiKeysData.apiKeys.length,
      activeApiKeys: apiKeysData.apiKeys.filter(k => k.isActive).length,
      totalRequests: logsData.logs.length,
      todayRequests: todayLogs.length,
      totalDownloads: downloadsData.downloads.length,
      totalShortUrls: shorturlsData.urls.length,
      endpointStats: endpointStats,
      recentActivity: logsData.logs.slice(0, 20)
    };
  }
}

// Create singleton instance
const db = new JSONDatabase();
module.exports = db;