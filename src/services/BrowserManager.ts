import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { BannerHandler } from './BannerHandler';
import { VideoThumbnailDetector, VideoDetectionResult } from './VideoThumbnailDetector';

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  handleBanners?: boolean;
  bannerTimeout?: number;
  customBannerSelectors?: string[];
  injectBannerBlockingCSS?: boolean;
  detectVideoThumbnails?: boolean;
}

export interface ScreenshotResult {
  image?: Buffer;
  thumbnailUrl?: string;
  isVideoThumbnail: boolean;
  videoDetectionResult?: VideoDetectionResult;
}

export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private isInitializing = false;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public async warmUp(): Promise<void> {
    if (this.browser || this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    try {
      console.log('🔥 Warming up browser instance...');
      await this.getBrowser();
      console.log('✅ Browser warmed up successfully');
    } catch (error) {
      console.error('❌ Browser warm-up failed:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log('🚀 Launching new browser instance...');

      const userDataDir = '/tmp/chrome-user-data';
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // ignore — directory may not exist
      }

      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-features=BlinkGenPropertyTrees',
          '--run-all-compositor-stages-before-draw',
          '--disable-ipc-flooding-protection',
          '--disable-crash-reporter',
          '--no-crash-upload',
          '--crash-dumps-dir=/tmp',
          '--user-data-dir=/tmp/chrome-user-data',
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
        timeout: 30000,
        protocolTimeout: 120000,
        ignoreDefaultArgs: ['--disable-extensions'],
      });

      this.browser.on('disconnected', () => {
        console.log('🔌 Browser disconnected');
        this.browser = null;
      });

      console.log('✅ Browser launched successfully');
    }

    return this.browser;
  }

  public async takeIntelligentScreenshot(
    url: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    // Wrap entire operation with 30-second absolute maximum timeout
    const maxProcessingTime = 30000; // 30 seconds
    const startTime = Date.now();

    const timeoutPromise = new Promise<ScreenshotResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Screenshot processing exceeded ${maxProcessingTime}ms maximum time limit`));
      }, maxProcessingTime);
    });

    return Promise.race([
      this._takeIntelligentScreenshotInternal(url, options, startTime),
      timeoutPromise
    ]);
  }

  private async _takeIntelligentScreenshotInternal(
    url: string,
    options: ScreenshotOptions = {},
    overallStartTime: number
  ): Promise<ScreenshotResult> {
    const {
      width = 1920,
      height = 1080,
      format = 'png',
      quality = 80,
      fullPage = false,
      timeout = 30000,
      waitUntil = 'domcontentloaded',
      handleBanners = true,
      bannerTimeout = 3000,  // Reduced from 5000ms to 3000ms
      customBannerSelectors = [],
      injectBannerBlockingCSS = false,
      detectVideoThumbnails = true,
    } = options;

    let browser: Browser;
    let page: Page | null = null;

    try {
      browser = await this.getBrowser();
      page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width, height });

      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set shorter timeouts for faster responses
      await page.setDefaultNavigationTimeout(timeout);
      await page.setDefaultTimeout(timeout);

      // Navigate to the URL
      console.log(`📸 Taking intelligent screenshot of: ${url}`);
      const navigationStart = Date.now();

      await page.goto(url, {
        waitUntil,
        timeout,
      });

      // Reduced wait time for faster performance (500ms instead of 1000ms)
      // This is sufficient for most modern websites with good caching
      await new Promise(resolve => setTimeout(resolve, 500));

      const loadTime = Date.now() - navigationStart;
      console.log(`⏱️ Page loaded in ${loadTime}ms`);

      // Handle banners and overlays if enabled
      if (handleBanners) {
        try {
          // Inject banner blocking CSS if requested
          if (injectBannerBlockingCSS) {
            await BannerHandler.injectBannerBlockingCSS(page);
          }

          // Handle common banners (first pass)
          await BannerHandler.handleBanners(page, bannerTimeout);

          // Handle custom banner selectors if provided
          if (customBannerSelectors.length > 0) {
            await BannerHandler.handleCustomBanners(page, customBannerSelectors);
          }
        } catch (bannerError: any) {
          console.warn(`⚠️ Initial banner handling failed: ${bannerError.message}`);
          // Continue with screenshot even if banner handling fails
        }
      }

      // Second pass for banners - age verification and overlays often appear after initial load
      if (handleBanners) {
        try {
          // Reduced wait time for delayed popups (1000ms instead of 1500ms)
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Handle banners again - catches delayed age verification and popups
          // Reduced timeout for second pass (2000ms max)
          await BannerHandler.handleBanners(page, Math.min(bannerTimeout, 2000));
        } catch (bannerError: any) {
          console.warn(`⚠️ Second pass banner handling failed: ${bannerError.message}`);
          // Continue anyway
        }
      }

      let videoDetectionResult: VideoDetectionResult | undefined;
      let finalImage: Buffer;
      let isVideoThumbnail = false;

      // Try to detect video thumbnails if enabled
      if (detectVideoThumbnails) {
        try {
          console.log('🎬 Detecting video thumbnails...');
          const detectionStartTime = Date.now();
          
          videoDetectionResult = await VideoThumbnailDetector.detectVideoThumbnail(page);
          
          const detectionTime = Date.now() - detectionStartTime;
          console.log(`🔍 Video detection completed in ${detectionTime}ms`);

          // Log detection results
          videoDetectionResult.detectionLog.forEach(log => console.log(log));

          if (videoDetectionResult.thumbnail) {
            // Check if this is from sources that provide thumbnail_url and should be returned directly
            const shouldReturnUrlDirectly = 
              videoDetectionResult.thumbnail.source === 'oEmbed' ||
              videoDetectionResult.thumbnail.source === 'schema.org VideoObject' ||
              videoDetectionResult.thumbnail.url.includes('thumbnail_url') ||
              videoDetectionResult.thumbnail.url.includes('maxresdefault') || // YouTube thumbnails
              videoDetectionResult.thumbnail.url.includes('vimeocdn.com') || // Vimeo thumbnails
              videoDetectionResult.thumbnail.url.includes('dailymotion.com') || // Dailymotion thumbnails
              videoDetectionResult.thumbnail.confidence >= 0.8; // High confidence thumbnails
            
            if (shouldReturnUrlDirectly) {
              // Return thumbnail URL directly without fetching/storing the image
              console.log(`🔗 Returning thumbnail URL directly: ${videoDetectionResult.thumbnail.url}`);
              console.log(`📊 Source: ${videoDetectionResult.thumbnail.source}, Confidence: ${videoDetectionResult.thumbnail.confidence}`);
              const totalTime = Date.now() - overallStartTime;
              console.log(`✅ Intelligent screenshot completed with thumbnail URL in ${totalTime}ms`);
              
              return {
                thumbnailUrl: videoDetectionResult.thumbnail.url,
                isVideoThumbnail: true,
                videoDetectionResult
              };
            }
            
            // For other thumbnail sources, try to fetch the image
            try {
              console.log(`🖼️ Fetching thumbnail: ${videoDetectionResult.thumbnail.url}`);
              const response = await page.evaluate(async (thumbnailUrl: string) => {
                const response = await fetch(thumbnailUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                return Array.from(new Uint8Array(arrayBuffer));
              }, videoDetectionResult.thumbnail.url);

              finalImage = Buffer.from(response);
              isVideoThumbnail = true;
              console.log(`✅ Successfully fetched video thumbnail (${finalImage.length} bytes)`);
            } catch (thumbnailError: any) {
              console.warn(`⚠️ Failed to fetch thumbnail: ${thumbnailError.message}`);
              // Fall back to regular screenshot or video region crop
              const croppedScreenshot = await VideoThumbnailDetector.detectVideoRegionAndCrop(page);
              if (croppedScreenshot) {
                finalImage = croppedScreenshot;
                isVideoThumbnail = true;
                console.log(`✅ Used cropped video region as fallback`);
              } else {
                // Final fallback to regular screenshot
                finalImage = await this.takeRegularScreenshot(page, { format, quality, fullPage });
                console.log(`📸 Used regular screenshot as final fallback`);
              }
            }
          } else if (videoDetectionResult.hasVideo) {
            // Video detected but no thumbnail found, try to crop video region
            console.log('🎥 Video detected but no thumbnail found, trying to crop video region...');
            const croppedScreenshot = await VideoThumbnailDetector.detectVideoRegionAndCrop(page);
            if (croppedScreenshot) {
              finalImage = croppedScreenshot;
              isVideoThumbnail = true;
              console.log(`✅ Successfully cropped video region`);
            } else {
              // Fallback to regular screenshot
              finalImage = await this.takeRegularScreenshot(page, { format, quality, fullPage });
              console.log(`📸 Used regular screenshot as fallback`);
            }
          } else {
            // No video detected, take regular screenshot
            finalImage = await this.takeRegularScreenshot(page, { format, quality, fullPage });
            console.log(`📸 No video detected, took regular screenshot`);
          }
        } catch (detectionError: any) {
          console.warn(`⚠️ Video detection failed: ${detectionError.message}`);
          // Fallback to regular screenshot
          finalImage = await this.takeRegularScreenshot(page, { format, quality, fullPage });
          console.log(`📸 Used regular screenshot due to detection error`);
        }
      } else {
        // Video detection disabled, take regular screenshot
        finalImage = await this.takeRegularScreenshot(page, { format, quality, fullPage });
        console.log(`📸 Video detection disabled, took regular screenshot`);
      }

      const totalTime = Date.now() - overallStartTime;
      console.log(`✅ Intelligent screenshot completed in ${totalTime}ms`);

      return {
        image: finalImage,
        isVideoThumbnail,
        videoDetectionResult
      };

    } catch (error: any) {
      console.error(`❌ Intelligent screenshot failed for ${url}:`, error);
      
      // If browser disconnected, reset it
      if (error.message && (
        error.message.includes('Protocol error') || 
        error.message.includes('Connection closed') ||
        error.message.includes('Target closed') ||
        error.message.includes('Session closed')
      )) {
        console.log('🔄 Browser connection lost, resetting...');
        this.browser = null;
      }
      
      throw new Error(`Intelligent screenshot failed: ${error.message}`);
    } finally {
      // Safely close the page
      if (page) {
        try {
          await page.close();
        } catch (closeError: any) {
          console.warn('⚠️ Failed to close page:', closeError.message || 'Unknown error');
        }
      }
    }
  }

  private async takeRegularScreenshot(
    page: Page,
    options: { format?: 'png' | 'jpeg'; quality?: number; fullPage?: boolean }
  ): Promise<Buffer> {
    const { format = 'png', quality = 80, fullPage = false } = options;

    const screenshotOptions: any = {
      type: format,
      fullPage,
    };

    if (format === 'jpeg') {
      screenshotOptions.quality = quality;
    }

    const screenshotStartTime = Date.now();
    const screenshot = await page.screenshot(screenshotOptions);
    const screenshotTime = Date.now() - screenshotStartTime;
    
    console.log(`📸 Regular screenshot taken in ${screenshotTime}ms`);
    return Buffer.from(screenshot);
  }

  public async takeScreenshot(
    url: string,
    options: ScreenshotOptions = {}
  ): Promise<Buffer> {
    const {
      width = 1920,
      height = 1080,
      format = 'png',
      quality = 80,
      fullPage = false,
      timeout = 30000,
      waitUntil = 'domcontentloaded',
      handleBanners = true,
      bannerTimeout = 3000,  // Reduced from 5000ms to 3000ms
      customBannerSelectors = [],
      injectBannerBlockingCSS = false,
    } = options;

    let browser: Browser;
    let page: Page | null = null;

    try {
      browser = await this.getBrowser();
      page = await browser.newPage();

      // Set viewport
      await page.setViewport({ width, height });

      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set shorter timeouts for faster responses
      await page.setDefaultNavigationTimeout(timeout);
      await page.setDefaultTimeout(timeout);

      // Navigate to the URL
      console.log(`📸 Taking screenshot of: ${url}`);
      const startTime = Date.now();

      await page.goto(url, {
        waitUntil,
        timeout,
      });

      // Reduced wait time for faster performance (500ms instead of 1000ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      const loadTime = Date.now() - startTime;
      console.log(`⏱️ Page loaded in ${loadTime}ms`);

      // Handle banners and overlays if enabled
      if (handleBanners) {
        try {
          // Inject banner blocking CSS if requested
          if (injectBannerBlockingCSS) {
            await BannerHandler.injectBannerBlockingCSS(page);
          }

          // Handle common banners
          await BannerHandler.handleBanners(page, bannerTimeout);

          // Handle custom banner selectors if provided
          if (customBannerSelectors.length > 0) {
            await BannerHandler.handleCustomBanners(page, customBannerSelectors);
          }
        } catch (bannerError: any) {
          console.warn(`⚠️ Banner handling failed: ${bannerError.message}`);
          // Continue with screenshot even if banner handling fails
        }
      }

      // Take screenshot
      const screenshotOptions: any = {
        type: format,
        fullPage,
      };

      if (format === 'jpeg') {
        screenshotOptions.quality = quality;
      }

      const screenshotStartTime = Date.now();
      const screenshot = await page.screenshot(screenshotOptions);
      const screenshotTime = Date.now() - screenshotStartTime;
      
      console.log(`✅ Screenshot taken successfully (${format}) in ${screenshotTime}ms`);

      return Buffer.from(screenshot);
    } catch (error: any) {
      console.error(`❌ Screenshot failed for ${url}:`, error);
      
      // If browser disconnected, reset it
      if (error.message && (
        error.message.includes('Protocol error') || 
        error.message.includes('Connection closed') ||
        error.message.includes('Target closed') ||
        error.message.includes('Session closed')
      )) {
        console.log('🔄 Browser connection lost, resetting...');
        this.browser = null;
      }
      
      throw new Error(`Screenshot failed: ${error.message}`);
    } finally {
      // Safely close the page
      if (page) {
        try {
          await page.close();
        } catch (closeError: any) {
          console.warn('⚠️ Failed to close page:', closeError.message || 'Unknown error');
        }
      }
    }
  }

  public async cleanup(): Promise<void> {
    if (this.browser) {
      console.log('🧹 Closing browser...');
      await this.browser.close();
      this.browser = null;
      console.log('✅ Browser closed');
    }
  }

  public async getStatus(): Promise<{
    isConnected: boolean;
    version?: string;
    userAgent?: string;
  }> {
    try {
      if (!this.browser) {
        return { isConnected: false };
      }

      const version = await this.browser.version();
      const page = await this.browser.newPage();
      const userAgent = await page.evaluate('navigator.userAgent') as string;
      await page.close();

      return {
        isConnected: this.browser.isConnected(),
        version,
        userAgent,
      };
    } catch (error) {
      return { isConnected: false };
    }
  }
}
