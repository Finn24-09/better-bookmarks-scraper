import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { BrowserManager, ScreenshotOptions } from '../services/BrowserManager';
import { validateApiKey } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Validation schema for screenshot requests
const screenshotSchema = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required()
    .messages({
      'string.uri': 'URL must be a valid HTTP or HTTPS URL',
      'any.required': 'URL is required',
    }),
  width: Joi.number()
    .integer()
    .min(100)
    .max(3840)
    .default(1920)
    .messages({
      'number.min': 'Width must be at least 100 pixels',
      'number.max': 'Width cannot exceed 3840 pixels',
    }),
  height: Joi.number()
    .integer()
    .min(100)
    .max(2160)
    .default(1080)
    .messages({
      'number.min': 'Height must be at least 100 pixels',
      'number.max': 'Height cannot exceed 2160 pixels',
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
      
      // Block localhost and private IPs for security
      if (process.env.BLOCK_PRIVATE_IPS === 'true') {
        const hostname = urlObj.hostname;
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname.startsWith('172.17.') ||
          hostname.startsWith('172.18.') ||
          hostname.startsWith('172.19.') ||
          hostname.startsWith('172.2') ||
          hostname.startsWith('172.30.') ||
          hostname.startsWith('172.31.')
        ) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Private IP addresses and localhost are not allowed',
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
      
      console.error('Screenshot error:', error);
      
      res.status(500).json({
        error: 'Screenshot failed',
        message: error.message || 'An unexpected error occurred',
        processingTime: `${processingTime}ms`,
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

      // Additional URL validation for security
      const urlObj = new URL(url);
      
      // Block localhost and private IPs for security
      if (process.env.BLOCK_PRIVATE_IPS === 'true') {
        const hostname = urlObj.hostname;
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname.startsWith('172.17.') ||
          hostname.startsWith('172.18.') ||
          hostname.startsWith('172.19.') ||
          hostname.startsWith('172.2') ||
          hostname.startsWith('172.30.') ||
          hostname.startsWith('172.31.')
        ) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: 'Private IP addresses and localhost are not allowed',
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
      
      console.error('Screenshot error:', error);
      
      res.status(500).json({
        error: 'Screenshot failed',
        message: error.message || 'An unexpected error occurred',
        processingTime: `${processingTime}ms`,
      });
    }
  }
);

export { router as screenshotRouter };
