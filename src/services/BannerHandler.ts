import { Page } from 'puppeteer';

export interface BannerPattern {
  name: string;
  selectors: string[];
  action: 'click' | 'remove';
  waitAfter?: number;
}

export class BannerHandler {
  private static readonly COMMON_BANNER_PATTERNS: BannerPattern[] = [
    // Adult site age verification (run first, highest priority)
    {
      name: 'Adult Site Age Verification',
      selectors: [
        'button:contains("I am 18 or older - Enter")',
        'a:contains("I am 18 or older - Enter")',
        'button:contains("I am 18 or older")',
        'a:contains("I am 18 or older")',
        'button:contains("Enter Site")',
        'a:contains("Enter Site")',
        'button:contains("Enter")',
        'a:contains("Enter")',
        // Adult site specific patterns
        '.agegate-enter',
        '.age-verification-enter',
        '[class*="agegate"] button',
        '[class*="agegate"] a',
        '[class*="age-verification"] button',
        '[class*="age-verification"] a',
        // Generic adult site patterns
        '[href*="enter"]',
        '[onclick*="enter"]',
        '[data-action*="enter"]'
      ],
      action: 'click',
      waitAfter: 3000
    },
    // Cookie consent banners
    {
      name: 'Cookie Accept All',
      selectors: [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button:contains("Accept all")',
        'button:contains("Alle akzeptieren")',
        'button:contains("Alle Cookies akzeptieren")',
        'button:contains("Cookies verwenden")',
        'button:contains("Accepter tout")',
        'button:contains("Aceptar todo")',
        'button:contains("Accetta tutto")',
        '[data-testid*="accept"]',
        '[aria-label*="accept"]',
        '.cookie-accept',
        '#cookie-accept',
        '.accept-cookies',
        '#accept-cookies',
        '.consent-accept',
        '#consent-accept'
      ],
      action: 'click',
      waitAfter: 1000
    },
    // German cookie banners (common on adult sites)
    {
      name: 'German Cookie Accept',
      selectors: [
        'button:contains("Alle Cookies akzeptieren")',
        'button:contains("Cookies verwenden")',
        'button:contains("Cookies akzeptieren")',
        'button:contains("Alle akzeptieren")',
        'button:contains("Einverstanden")',
        'button:contains("Zustimmen")',
        'button:contains("Cookies zulassen")',
        'button:contains("Alle zulassen")',
        // More generic German patterns
        '[data-action*="accept"]:contains("Cookies")',
        '[onclick*="accept"]:contains("Cookies")',
        '.cookie-button:contains("akzeptieren")',
        '.consent-button:contains("akzeptieren")'
      ],
      action: 'click',
      waitAfter: 1000
    },
    {
      name: 'Cookie OK/Agree',
      selectors: [
        'button:contains("OK")',
        'button:contains("Agree")',
        'button:contains("I agree")',
        'button:contains("Zustimmen")',
        'button:contains("Einverstanden")',
        'button:contains("D\'accord")',
        'button:contains("De acuerdo")',
        'button:contains("Sono d\'accordo")',
        '.cookie-ok',
        '#cookie-ok',
        '.agree-button',
        '#agree-button'
      ],
      action: 'click',
      waitAfter: 1000
    },
    // Age verification
    {
      name: 'Age Verification - 18+',
      selectors: [
        'button:contains("I am 18 or older")',
        'button:contains("I am 18 or older - Enter")',
        'button:contains("Enter")',
        'button:contains("Yes, I am 18+")',
        'button:contains("I am over 18")',
        'button:contains("Ich bin 18 oder älter")',
        'button:contains("J\'ai 18 ans ou plus")',
        'button:contains("Tengo 18 años o más")',
        'button:contains("Ho 18 anni o più")',
        // More specific selectors for common age verification patterns
        'a:contains("I am 18 or older")',
        'a:contains("I am 18 or older - Enter")',
        'a:contains("Enter")',
        '[href*="enter"]:contains("18")',
        '[href*="enter"]:contains("older")',
        '[data-testid*="age-verify"]',
        '[data-testid*="enter-site"]',
        '.age-verify-enter',
        '#age-verify-enter',
        '.enter-site',
        '#enter-site',
        // Generic age verification patterns
        '*:contains("I am 18 or older - Enter")',
        '*:contains("I am 18 or older")',
        // Adult site specific patterns
        '.agegate button',
        '.age-verification button',
        '[class*="age"] button:contains("Enter")',
        '[class*="age"] a:contains("Enter")'
      ],
      action: 'click',
      waitAfter: 2000
    },
    // YouTube specific
    {
      name: 'YouTube Cookie Accept',
      selectors: [
        'button[aria-label*="Accept the use of cookies"]',
        'button:contains("Alle akzeptieren")',
        'button:contains("Accept all")',
        'ytd-button-renderer button[aria-label*="Accept"]',
        '[data-testid="accept-button"]',
        // More specific YouTube selectors
        'ytd-button-renderer:contains("Alle akzeptieren") button',
        'ytd-button-renderer:contains("Accept all") button',
        'c3-material-button:contains("Alle akzeptieren")',
        'c3-material-button:contains("Accept all")',
        '[role="button"]:contains("Alle akzeptieren")',
        '[role="button"]:contains("Accept all")',
        // Generic accept buttons in YouTube context
        'button[jsname]:contains("Alle akzeptieren")',
        'button[jsname]:contains("Accept all")'
      ],
      action: 'click',
      waitAfter: 1500
    },
    // Generic modal close buttons
    {
      name: 'Modal Close',
      selectors: [
        'button[aria-label="Close"]',
        'button[aria-label="Schließen"]',
        'button[aria-label="Fermer"]',
        'button[aria-label="Cerrar"]',
        'button[aria-label="Chiudi"]',
        '.modal-close',
        '.close-modal',
        '.popup-close',
        '.overlay-close',
        '[data-dismiss="modal"]'
      ],
      action: 'click',
      waitAfter: 500
    },
    // GDPR/Privacy banners
    {
      name: 'GDPR Accept',
      selectors: [
        'button:contains("Accept and continue")',
        'button:contains("Akzeptieren und fortfahren")',
        'button:contains("Accepter et continuer")',
        'button:contains("Aceptar y continuar")',
        'button:contains("Accetta e continua")',
        '.gdpr-accept',
        '#gdpr-accept',
        '.privacy-accept',
        '#privacy-accept'
      ],
      action: 'click',
      waitAfter: 1000
    },
    // Newsletter/subscription popups
    {
      name: 'Newsletter Close',
      selectors: [
        'button:contains("No thanks")',
        'button:contains("Maybe later")',
        'button:contains("Skip")',
        'button:contains("Nein danke")',
        'button:contains("Später")',
        'button:contains("Non merci")',
        'button:contains("Plus tard")',
        'button:contains("No gracias")',
        'button:contains("Más tarde")',
        'button:contains("No grazie")',
        'button:contains("Più tardi")',
        '.newsletter-close',
        '.subscription-close',
        '.popup-dismiss'
      ],
      action: 'click',
      waitAfter: 500
    }
  ];

  public static async handleBanners(page: Page, timeout: number = 10000): Promise<void> {
    console.log('🔍 Checking for banners and overlays...');
    
    const startTime = Date.now();
    const maxTime = startTime + timeout;
    
    try {
      // Wait a bit for any dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 800));
      
      
      let bannersHandled = 0;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (Date.now() < maxTime && attempts < maxAttempts) {
        attempts++;
        let foundBanner = false;
        
        for (const pattern of this.COMMON_BANNER_PATTERNS) {
          if (Date.now() >= maxTime) break;
          
          try {
            const handled = await this.handleBannerPattern(page, pattern);
            if (handled) {
              bannersHandled++;
              foundBanner = true;
              console.log(`✅ Handled banner: ${pattern.name}`);
              
              // Wait after handling banner
              if (pattern.waitAfter) {
                await new Promise(resolve => setTimeout(resolve, pattern.waitAfter));
              }
              
              break; // Handle one banner at a time
            }
          } catch (error) {
            // Continue to next pattern if this one fails
            continue;
          }
        }
        
        // If no banners found in this iteration, we're likely done
        if (!foundBanner) {
          break;
        }
        
        // Small delay between attempts
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const totalTime = Date.now() - startTime;
      
      if (bannersHandled > 0) {
        console.log(`🎯 Successfully handled ${bannersHandled} banner(s) in ${totalTime}ms`);
      } else {
        console.log(`ℹ️ No banners detected in ${totalTime}ms`);
      }
      
      // Final wait to ensure page is stable
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.warn(`⚠️ Banner handling completed with warnings: ${error.message}`);
    }
  }

  private static async handleBannerPattern(page: Page, pattern: BannerPattern): Promise<boolean> {
    for (const selector of pattern.selectors) {
      try {
        let element = null;
        
        // Handle :contains() selectors differently
        if (selector.includes(':contains(')) {
          const match = selector.match(/^([^:]+):contains\("([^"]+)"\)(.*)$/);
          if (match) {
            const [, baseSelector, text, suffix] = match;
            element = await page.evaluateHandle((baseSelector: string, text: string, suffix: string) => {
              const elements = (globalThis as any).document.querySelectorAll(baseSelector + (suffix || ''));
              for (const el of elements) {
                if (el.textContent && el.textContent.includes(text)) {
                  return el;
                }
              }
              return null;
            }, baseSelector, text, suffix);
            
            if (!element || !element.asElement()) {
              continue;
            }
            element = element.asElement();
          }
        } else {
          // Regular selector
          element = await page.$(selector);
        }
        
        if (!element) continue;
        
        // Check if element is visible
        const isVisible = await page.evaluate((el) => {
          if (!el) return false;
          const win = (globalThis as any).window || (globalThis as any);
          const style = win.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          );
        }, element);
        
        if (!isVisible) continue;
        
        // Handle the banner based on action type
        if (pattern.action === 'click') {
          // Scroll element into view if needed
          await page.evaluate((el) => {
            (el as any).scrollIntoView({ behavior: 'instant', block: 'center' });
          }, element);
          
          // Wait a bit for any animations
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Try to click the element
          await element.click();
          
          console.log(`🖱️ Clicked banner element: ${selector}`);
          return true;
          
        } else if (pattern.action === 'remove') {
          // Remove the element from DOM
          await page.evaluate((el) => {
            (el as any).remove();
          }, element);
          
          console.log(`🗑️ Removed banner element: ${selector}`);
          return true;
        }
        
      } catch (error) {
        // Continue to next selector if this one fails
        continue;
      }
    }
    
    return false;
  }

  public static async handleCustomBanners(page: Page, customSelectors: string[]): Promise<void> {
    console.log('🔧 Handling custom banner selectors...');
    
    for (const selector of customSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await page.evaluate((el) => {
            if (!el) return false;
            const win = (globalThis as any).window || (globalThis as any);
            const style = win.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              rect.width > 0 &&
              rect.height > 0
            );
          }, element);
          
          if (isVisible) {
            await element.click();
            console.log(`✅ Clicked custom banner: ${selector}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to handle custom selector ${selector}:`, error);
      }
    }
  }

  public static async injectBannerBlockingCSS(page: Page): Promise<void> {
    console.log('🎨 Injecting banner blocking CSS...');
    
    try {
      await page.addStyleTag({
        content: `
          /* Hide common banner containers */
          [id*="cookie-banner"],
          [class*="cookie-banner"],
          [id*="cookie-notice"],
          [class*="cookie-notice"],
          [id*="gdpr-banner"],
          [class*="gdpr-banner"],
          [id*="consent-banner"],
          [class*="consent-banner"],
          [id*="privacy-banner"],
          [class*="privacy-banner"],
          .cookie-bar,
          .gdpr-bar,
          .consent-bar,
          .privacy-bar,
          .newsletter-popup,
          .subscription-popup,
          .age-verification-overlay,
          .modal-backdrop,
          .overlay-backdrop {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            z-index: -9999 !important;
          }
          
          /* Restore body scroll if it was disabled by modals */
          body {
            overflow: auto !important;
          }
        `
      });
      
      console.log('✅ Banner blocking CSS injected');
    } catch (error) {
      console.warn('⚠️ Failed to inject banner blocking CSS:', error);
    }
  }
}
