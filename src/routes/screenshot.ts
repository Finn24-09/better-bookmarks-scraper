import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { BrowserManager, ScreenshotOptions } from '../services/BrowserManager';
import { validateApiKey } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Custom URL validator with enhanced security checks
const urlValidator = (value: string, helpers: any) => {
  try {
    const urlObj = new URL(value);

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return helpers.error('url.protocol', { protocol: urlObj.protocol });
    }

    // Ensure URL is properly formatted
    if (!urlObj.hostname) {
      return helpers.error('url.hostname');
    }

    // Prevent URLs with authentication credentials
    if (urlObj.username || urlObj.password) {
      return helpers.error('url.credentials');
    }

    return value;
  } catch (error) {
    return helpers.error('url.invalid');
  }
};

// Validation schema for screenshot requests
const screenshotSchema = Joi.object({
  url: Joi.string()
    .required()
    .trim()
    .min(10)
    .max(2048)
    .custom(urlValidator, 'URL validation')
    .messages({
      'string.empty': 'URL is required',
      'string.min': 'URL is too short',
      'string.max': 'URL exceeds maximum length of 2048 characters',
      'any.required': 'URL is required',
      'url.protocol': 'Only HTTP and HTTPS protocols are allowed',
      'url.hostname': 'URL must have a valid hostname',
      'url.credentials': 'URLs with authentication credentials are not allowed',
      'url.invalid': 'Please provide a valid URL',
    }),
  width: Joi.number()
    .integer()
    .min(100)
    .max(3840)
    .default(1920)
    .messages({
      'number.min': 'Width must be at least 100 pixels',
      'number.max': 'Width cannot exceed 3840 pixels',
      'number.base': 'Width must be a number',
    }),
  height: Joi.number()
    .integer()
    .min(100)
    .max(2160)
    .default(1080)
    .messages({
      'number.min': 'Height must be at least 100 pixels',
      'number.max': 'Height cannot exceed 2160 pixels',
      'number.base': 'Height must be a number',
    }),
  format: Joi.string()
    .valid('png', 'jpeg')
    .default('png')
    .messages({
      'any.only': 'Format must be either "png" or "jpeg"',
    }),
  quality: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(80)
    .when('format', {
      is: 'jpeg',
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      'number.min': 'Quality must be between 1 and 100',
      'number.max': 'Quality must be between 1 and 100',
    }),
  fullPage: Joi.boolean().default(false),
  timeout: Joi.number()
    .integer()
    .min(5000)
    .max(60000)
    .default(30000)
    .messages({
      'number.min': 'Timeout must be at least 5 seconds',
      'number.max': 'Timeout cannot exceed 60 seconds',
    }),
  waitUntil: Joi.string()
    .valid('load', 'domcontentloaded', 'networkidle0', 'networkidle2')
    .default('domcontentloaded')
    .messages({
      'any.only': 'waitUntil must be one of: load, domcontentloaded, networkidle0, networkidle2',
    }),
  handleBanners: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'handleBanners must be a boolean',
    }),
  bannerTimeout: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(5000)
    .messages({
      'number.min': 'bannerTimeout must be at least 1 second',
      'number.max': 'bannerTimeout cannot exceed 30 seconds',
    }),
  customBannerSelectors: Joi.array()
    .items(Joi.string().min(1).max(200))
    .default([])
    .messages({
      'array.base': 'customBannerSelectors must be an array of strings',
      'string.min': 'Each selector must be at least 1 character',
      'string.max': 'Each selector cannot exceed 200 characters',
    }),
  injectBannerBlockingCSS: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'injectBannerBlockingCSS must be a boolean',
    }),
  detectVideoThumbnails: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'detectVideoThumbnails must be a boolean',
    }),
});

// POST /api/v1/screenshot
router.post(
  '/',
  validateApiKey,
  validateRequest(screenshotSchema),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const {
        url,
        width,
        height,
        format,
        quality,
        fullPage,
        timeout,
        waitUntil,
        handleBanners,
        bannerTimeout,
        customBannerSelectors,
        injectBannerBlockingCSS,
        detectVideoThumbnails,
      } = req.body;

      // Additional URL validation for security
      const urlObj = new URL(url);

      // Block localhost and private IPs for security (SSRF protection)
      if (process.env.BLOCK_PRIVATE_IPS === 'true' || process.env.BLOCK_PRIVATE_IPS === undefined) {
        const hostname = urlObj.hostname.toLowerCase();

        // Check for localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Localhost addresses are not allowed for security reasons',
            statusCode: 400,
          });
        }

        // Check for private IP ranges (IPv4)
        const privateIPv4Patterns = [
          /^10\./,                    // 10.0.0.0/8
          /^192\.168\./,              // 192.168.0.0/16
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
          /^169\.254\./,              // 169.254.0.0/16 (link-local)
        ];

        if (privateIPv4Patterns.some(pattern => pattern.test(hostname))) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Private IP addresses are not allowed for security reasons',
            statusCode: 400,
          });
        }

        // Check for private IPv6 ranges
        if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Private IPv6 addresses are not allowed for security reasons',
            statusCode: 400,
          });
        }
      }

      const options: ScreenshotOptions = {
        width,
        height,
        format,
        quality,
        fullPage,
        timeout,
        waitUntil,
        handleBanners,
        bannerTimeout,
        customBannerSelectors,
        injectBannerBlockingCSS,
        detectVideoThumbnails,
      };

      const browserManager = BrowserManager.getInstance();
      const result = await browserManager.takeIntelligentScreenshot(url, options);

      const processingTime = Date.now() - startTime;

      // Check if we got a thumbnail URL instead of an image buffer
      if (result.thumbnailUrl) {
        // Return the thumbnail URL as JSON response
        res.set({
          'Content-Type': 'application/json',
          'X-Processing-Time': `${processingTime}ms`,
          'X-Screenshot-Format': 'url',
          'X-Screenshot-Dimensions': `${width}x${height}`,
          'X-Is-Video-Thumbnail': result.isVideoThumbnail.toString(),
          'X-Video-Detection-Method': result.videoDetectionResult?.thumbnail?.method || 'none',
          'X-Thumbnail-Source': result.videoDetectionResult?.thumbnail?.source || 'unknown',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        });

        res.json({
          thumbnailUrl: result.thumbnailUrl,
          isVideoThumbnail: result.isVideoThumbnail,
          processingTime: `${processingTime}ms`,
          source: result.videoDetectionResult?.thumbnail?.source || 'unknown',
          method: result.videoDetectionResult?.thumbnail?.method || 'none'
        });
      } else if (result.image) {
        // Return the image buffer as before
        res.set({
          'Content-Type': format === 'png' ? 'image/png' : 'image/jpeg',
          'Content-Length': result.image.length.toString(),
          'X-Processing-Time': `${processingTime}ms`,
          'X-Screenshot-Format': format,
          'X-Screenshot-Dimensions': `${width}x${height}`,
          'X-Is-Video-Thumbnail': result.isVideoThumbnail.toString(),
          'X-Video-Detection-Method': result.videoDetectionResult?.thumbnail?.method || 'none',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        });

        res.send(result.image);
      } else {
        // This shouldn't happen, but handle it gracefully
        throw new Error('No image or thumbnail URL returned from screenshot service');
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      console.error('Screenshot error (POST):', {
        message: error.message,
        url: req.body.url,
        processingTime: `${processingTime}ms`,
        stack: error.stack,
      });

      // Provide specific error messages based on error type
      let statusCode = 500;
      let errorMessage = 'An unexpected error occurred while processing your request';

      if (error.message) {
        if (error.message.includes('Navigation timeout') || error.message.includes('timeout')) {
          statusCode = 504;
          errorMessage = 'The website took too long to load. Please try again or increase the timeout parameter.';
        } else if (error.message.includes('net::ERR') || error.message.includes('Network')) {
          statusCode = 502;
          errorMessage = 'Unable to reach the website. Please check the URL and try again.';
        } else if (error.message.includes('Invalid URL') || error.message.includes('Protocol error')) {
          statusCode = 400;
          errorMessage = error.message;
        } else if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
          statusCode = 503;
          errorMessage = 'Browser service unavailable. Please try again in a moment.';
        } else {
          errorMessage = error.message;
        }
      }

      res.status(statusCode).json({
        error: 'Screenshot failed',
        message: errorMessage,
        statusCode,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// GET /api/v1/screenshot (for simple GET requests)
router.get(
  '/',
  validateApiKey,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { error, value } = screenshotSchema.validate(req.query);
      
      if (error) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
      }

      const {
        url,
        width,
        height,
        format,
        quality,
        fullPage,
        timeout,
        waitUntil,
        handleBanners,
        bannerTimeout,
        customBannerSelectors,
        injectBannerBlockingCSS,
        detectVideoThumbnails,
      } = value;

      // Additional URL validation for security (same as POST endpoint)
      const urlObj = new URL(url);

      // Block localhost and private IPs for security (SSRF protection)
      if (process.env.BLOCK_PRIVATE_IPS === 'true' || process.env.BLOCK_PRIVATE_IPS === undefined) {
        const hostname = urlObj.hostname.toLowerCase();

        // Check for localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Localhost addresses are not allowed for security reasons',
            statusCode: 400,
          });
        }

        // Check for private IP ranges (IPv4)
        const privateIPv4Patterns = [
          /^10\./,
          /^192\.168\./,
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
          /^169\.254\./,
        ];

        if (privateIPv4Patterns.some(pattern => pattern.test(hostname))) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Private IP addresses are not allowed for security reasons',
            statusCode: 400,
          });
        }

        // Check for private IPv6 ranges
        if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Private IPv6 addresses are not allowed for security reasons',
            statusCode: 400,
          });
        }
      }

      const options: ScreenshotOptions = {
        width,
        height,
        format,
        quality,
        fullPage,
        timeout,
        waitUntil,
        handleBanners,
        bannerTimeout,
        customBannerSelectors,
        injectBannerBlockingCSS,
        detectVideoThumbnails,
      };

      const browserManager = BrowserManager.getInstance();
      const result = await browserManager.takeIntelligentScreenshot(url, options);

      const processingTime = Date.now() - startTime;

      // Check if we got a thumbnail URL instead of an image buffer
      if (result.thumbnailUrl) {
        // Return the thumbnail URL as JSON response
        res.set({
          'Content-Type': 'application/json',
          'X-Processing-Time': `${processingTime}ms`,
          'X-Screenshot-Format': 'url',
          'X-Screenshot-Dimensions': `${width}x${height}`,
          'X-Is-Video-Thumbnail': result.isVideoThumbnail.toString(),
          'X-Video-Detection-Method': result.videoDetectionResult?.thumbnail?.method || 'none',
          'X-Thumbnail-Source': result.videoDetectionResult?.thumbnail?.source || 'unknown',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        });

        res.json({
          thumbnailUrl: result.thumbnailUrl,
          isVideoThumbnail: result.isVideoThumbnail,
          processingTime: `${processingTime}ms`,
          source: result.videoDetectionResult?.thumbnail?.source || 'unknown',
          method: result.videoDetectionResult?.thumbnail?.method || 'none'
        });
      } else if (result.image) {
        // Return the image buffer as before
        res.set({
          'Content-Type': format === 'png' ? 'image/png' : 'image/jpeg',
          'Content-Length': result.image.length.toString(),
          'X-Processing-Time': `${processingTime}ms`,
          'X-Screenshot-Format': format,
          'X-Screenshot-Dimensions': `${width}x${height}`,
          'X-Is-Video-Thumbnail': result.isVideoThumbnail.toString(),
          'X-Video-Detection-Method': result.videoDetectionResult?.thumbnail?.method || 'none',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        });

        res.send(result.image);
      } else {
        // This shouldn't happen, but handle it gracefully
        throw new Error('No image or thumbnail URL returned from screenshot service');
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      console.error('Screenshot error (GET):', {
        message: error.message,
        url: req.query.url,
        processingTime: `${processingTime}ms`,
        stack: error.stack,
      });

      // Provide specific error messages based on error type
      let statusCode = 500;
      let errorMessage = 'An unexpected error occurred while processing your request';

      if (error.message) {
        if (error.message.includes('Navigation timeout') || error.message.includes('timeout')) {
          statusCode = 504;
          errorMessage = 'The website took too long to load. Please try again or increase the timeout parameter.';
        } else if (error.message.includes('net::ERR') || error.message.includes('Network')) {
          statusCode = 502;
          errorMessage = 'Unable to reach the website. Please check the URL and try again.';
        } else if (error.message.includes('Invalid URL') || error.message.includes('Protocol error')) {
          statusCode = 400;
          errorMessage = error.message;
        } else if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
          statusCode = 503;
          errorMessage = 'Browser service unavailable. Please try again in a moment.';
        } else {
          errorMessage = error.message;
        }
      }

      res.status(statusCode).json({
        error: 'Screenshot failed',
        message: errorMessage,
        statusCode,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export { router as screenshotRouter };
