import puppeteer, { Browser, Page } from 'puppeteer';
import { BannerHandler } from './BannerHandler';

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
      bannerTimeout = 5000,
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

      // Wait a shorter time for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 1000));

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
