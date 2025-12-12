const puppeteer = require('puppeteer');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../lib/logger');
const db = require('../../utils/json-db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST'
    });
  }

  try {
    const { url, width = 1920, height = 1080, fullPage = false, delay = 0, apiKey } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'screenshot');

    console.log(`Taking screenshot of: ${url}`);

    let browser = null;
    let screenshotData = null;

    try {
      // Launch browser with Vercel-compatible settings
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport({
        width: parseInt(width),
        height: parseInt(height),
        deviceScaleFactor: 1
      });

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for delay if specified
      if (parseInt(delay) > 0) {
        await page.waitForTimeout(parseInt(delay));
      }

      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage: fullPage === 'true' || fullPage === true,
        type: 'png',
        encoding: 'base64'
      });

      screenshotData = `data:image/png;base64,${screenshot}`;

      // Get page info
      const pageTitle = await page.title();
      const pageUrl = page.url();

      await browser.close();

      logger.info('Screenshot taken', {
        url: url,
        width: width,
        height: height,
        fullPage: fullPage
      });

      res.json({
        success: true,
        data: {
          id: uuidv4(),
          type: 'screenshot',
          url: pageUrl,
          originalUrl: url,
          title: pageTitle,
          screenshot: screenshotData,
          width: parseInt(width),
          height: parseInt(height),
          fullPage: fullPage === 'true' || fullPage === true,
          timestamp: new Date().toISOString(),
          formats: {
            png: screenshotData,
            base64: screenshot
          }
        }
      });

    } catch (browserError) {
      if (browser) {
        await browser.close();
      }
      
      throw browserError;
    }

  } catch (error) {
    logger.error('Screenshot error', {
      error: error.message,
      url: req.body?.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to take screenshot',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// PDF generation
module.exports.pdf = async function(req, res) {
  try {
    const { url, format = 'A4', landscape = false, apiKey } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'pdf_generate');

    console.log(`Generating PDF of: ${url}`);

    let browser = null;

    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      const page = await browser.newPage();
      
      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Generate PDF
      const pdf = await page.pdf({
        format: format,
        landscape: landscape === 'true' || landscape === true,
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      });

      await browser.close();

      const pdfBase64 = pdf.toString('base64');

      logger.info('PDF generated', {
        url: url,
        format: format,
        landscape: landscape
      });

      res.json({
        success: true,
        data: {
          id: uuidv4(),
          type: 'pdf',
          url: url,
          format: format,
          landscape: landscape === 'true' || landscape === true,
          pdf: `data:application/pdf;base64,${pdfBase64}`,
          size: pdf.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (browserError) {
      if (browser) {
        await browser.close();
      }
      
      throw browserError;
    }

  } catch (error) {
    logger.error('PDF generation error', {
      error: error.message,
      url: req.body?.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate PDF'
    });
  }
};

// Mobile screenshot simulation
module.exports.mobile = async function(req, res) {
  try {
    const { url, device = 'iPhone 12', delay = 0, apiKey } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Log API usage
    db.logApiUsage(apiKey, 'mobile_screenshot');

    const deviceProfiles = {
      'iPhone 12': { width: 390, height: 844 },
      'iPhone SE': { width: 375, height: 667 },
      'Samsung Galaxy S20': { width: 360, height: 800 },
      'iPad Pro': { width: 1024, height: 1366 },
      'Pixel 5': { width: 393, height: 851 }
    };

    const profile = deviceProfiles[device] || deviceProfiles['iPhone 12'];

    // Use the main screenshot function with mobile dimensions
    req.body.width = profile.width;
    req.body.height = profile.height;
    req.body.fullPage = false;
    req.body.delay = delay;

    return await module.exports.handler(req, res);

  } catch (error) {
    logger.error('Mobile screenshot error', {
      error: error.message,
      url: req.body?.url
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to take mobile screenshot'
    });
  }
};