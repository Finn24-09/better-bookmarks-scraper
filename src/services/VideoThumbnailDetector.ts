import { Page } from 'puppeteer';

export interface ThumbnailCandidate {
  url: string;
  source: string;
  confidence: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  method: string;
  element?: string;
}

export interface VideoDetectionResult {
  hasVideo: boolean;
  thumbnail?: ThumbnailCandidate;
  candidates: ThumbnailCandidate[];
  detectionLog: string[];
}

export class VideoThumbnailDetector {
  private static readonly MIN_THUMBNAIL_WIDTH = 200;
  private static readonly MIN_THUMBNAIL_HEIGHT = 150;
  private static readonly PREFERRED_ASPECT_RATIOS = [16/9, 4/3, 3/2, 1.85, 2.35];
  private static readonly MAX_ASPECT_RATIO_DEVIATION = 0.3;

  public static async detectVideoThumbnail(page: Page): Promise<VideoDetectionResult> {
    const log: string[] = [];
    const candidates: ThumbnailCandidate[] = [];

    log.push('🎬 Starting video thumbnail detection...');

    try {
      // Strategy 1: Check metadata (og:image, twitter:image, schema.org)
      log.push('📋 Strategy 1: Checking page metadata...');
      const metadataCandidates = await this.extractMetadataThumbnails(page);
      candidates.push(...metadataCandidates);
      log.push(`Found ${metadataCandidates.length} metadata candidates`);

      // Strategy 2: Look for <video> tags with poster attributes
      log.push('🎥 Strategy 2: Checking video elements...');
      const videoCandidates = await this.extractVideoElementThumbnails(page);
      candidates.push(...videoCandidates);
      log.push(`Found ${videoCandidates.length} video element candidates`);

      // Strategy 3: Traverse DOM for nearby images around video containers
      log.push('🔍 Strategy 3: Checking DOM around video containers...');
      const domCandidates = await this.extractDOMThumbnails(page);
      candidates.push(...domCandidates);
      log.push(`Found ${domCandidates.length} DOM traversal candidates`);

      // Strategy 4: Check CSS background images
      log.push('🎨 Strategy 4: Checking CSS background images...');
      const cssCandidates = await this.extractCSSBackgroundThumbnails(page);
      candidates.push(...cssCandidates);
      log.push(`Found ${cssCandidates.length} CSS background candidates`);

      // Strategy 5: Check iframes for embedded players
      log.push('🖼️ Strategy 5: Checking embedded iframes...');
      const iframeCandidates = await this.extractIframeThumbnails(page);
      candidates.push(...iframeCandidates);
      log.push(`Found ${iframeCandidates.length} iframe candidates`);

      // Strategy 6: Check for oEmbed or manifest links
      log.push('🔗 Strategy 6: Checking oEmbed and manifest links...');
      const oembedCandidates = await this.extractOEmbedThumbnails(page);
      candidates.push(...oembedCandidates);
      log.push(`Found ${oembedCandidates.length} oEmbed candidates`);

      // Validate and score all candidates
      log.push('⚖️ Validating and scoring candidates...');
      const validCandidates = await this.validateAndScoreCandidates(page, candidates);
      log.push(`${validCandidates.length} candidates passed validation`);

      // Select the best candidate
      const bestCandidate = this.selectBestCandidate(validCandidates);
      
      const hasVideo = candidates.length > 0 || await this.detectVideoPresence(page);
      
      if (bestCandidate) {
        log.push(`✅ Selected best candidate: ${bestCandidate.method} (confidence: ${bestCandidate.confidence})`);
      } else if (hasVideo) {
        log.push('⚠️ Video detected but no suitable thumbnail found');
      } else {
        log.push('ℹ️ No video content detected');
      }

      return {
        hasVideo,
        thumbnail: bestCandidate,
        candidates: validCandidates,
        detectionLog: log
      };

    } catch (error: any) {
      log.push(`❌ Error during detection: ${error.message}`);
      return {
        hasVideo: false,
        candidates: [],
        detectionLog: log
      };
    }
  }

  private static async extractMetadataThumbnails(page: Page): Promise<ThumbnailCandidate[]> {
    return await page.evaluate(() => {
      const candidates: any[] = [];

      // Open Graph image
      const ogImage = (globalThis as any).document.querySelector('meta[property="og:image"]') as any;
      if (ogImage?.content) {
        candidates.push({
          url: ogImage.content,
          source: 'og:image',
          confidence: 0.8,
          method: 'metadata',
          element: 'meta[property="og:image"]'
        });
      }

      // Twitter image
      const twitterImage = (globalThis as any).document.querySelector('meta[name="twitter:image"]') as any;
      if (twitterImage?.content) {
        candidates.push({
          url: twitterImage.content,
          source: 'twitter:image',
          confidence: 0.7,
          method: 'metadata',
          element: 'meta[name="twitter:image"]'
        });
      }

      // Schema.org VideoObject thumbnailUrl
      const schemaScripts = (globalThis as any).document.querySelectorAll('script[type="application/ld+json"]');
      schemaScripts.forEach((script: any, index: number) => {
        try {
          const data = JSON.parse(script.textContent || '');
          const findThumbnails = (obj: any): void => {
            if (obj && typeof obj === 'object') {
              if (obj['@type'] === 'VideoObject' && obj.thumbnailUrl) {
                const thumbnailUrl = Array.isArray(obj.thumbnailUrl) ? obj.thumbnailUrl[0] : obj.thumbnailUrl;
                if (typeof thumbnailUrl === 'string') {
                  candidates.push({
                    url: thumbnailUrl,
                    source: 'schema.org VideoObject',
                    confidence: 0.9,
                    method: 'metadata',
                    element: `script[type="application/ld+json"]:nth-child(${index + 1})`
                  });
                }
              }
              Object.values(obj).forEach(findThumbnails);
            }
          };
          findThumbnails(data);
        } catch (e) {
          // Invalid JSON, skip
        }
      });

      return candidates;
    });
  }

  private static async extractVideoElementThumbnails(page: Page): Promise<ThumbnailCandidate[]> {
    return await page.evaluate(() => {
      const candidates: any[] = [];
      const videos = (globalThis as any).document.querySelectorAll('video');

      videos.forEach((video: any, index: number) => {
        // Check poster attribute
        if (video.poster) {
          candidates.push({
            url: video.poster,
            source: 'video poster',
            confidence: 0.9,
            method: 'video-element',
            element: `video:nth-child(${index + 1})`
          });
        }

        // Check data attributes for lazy-loaded posters
        const dataAttrs = ['data-thumb', 'data-poster', 'data-thumbnail', 'data-preview', 'data-image'];
        dataAttrs.forEach(attr => {
          const value = video.getAttribute(attr);
          if (value) {
            candidates.push({
              url: value,
              source: `video ${attr}`,
              confidence: 0.8,
              method: 'video-element',
              element: `video:nth-child(${index + 1})`
            });
          }
        });
      });

      return candidates;
    });
  }

  private static async extractDOMThumbnails(page: Page): Promise<ThumbnailCandidate[]> {
    return await page.evaluate(() => {
      const candidates: any[] = [];
      
      // Look for video containers and nearby images
      const videoContainerSelectors = [
        '[class*="video"]', '[id*="video"]',
        '[class*="player"]', '[id*="player"]',
        '[class*="media"]', '[id*="media"]',
        '[class*="embed"]', '[id*="embed"]',
        '[data-video]', '[data-player]'
      ];

      videoContainerSelectors.forEach(selector => {
        const containers = (globalThis as any).document.querySelectorAll(selector);
        containers.forEach((container: any, containerIndex: number) => {
          // Check for images within the container
          const images = container.querySelectorAll('img');
          images.forEach((img: any, imgIndex: number) => {
            if (img.src || img.dataset.src) {
              const url = img.src || img.dataset.src || '';
              candidates.push({
                url,
                source: 'container image',
                confidence: 0.6,
                method: 'dom-traversal',
                element: `${selector}:nth-child(${containerIndex + 1}) img:nth-child(${imgIndex + 1})`
              });
            }
          });

          // Check siblings for thumbnail images
          const siblings = Array.from(container.parentElement?.children || []);
          siblings.forEach((sibling: any, siblingIndex: number) => {
            if (sibling !== container) {
              const siblingImages = sibling.querySelectorAll('img');
              siblingImages.forEach((img: any, imgIndex: number) => {
                if (img.src || img.dataset.src) {
                  const url = img.src || img.dataset.src || '';
                  candidates.push({
                    url,
                    source: 'sibling image',
                    confidence: 0.5,
                    method: 'dom-traversal',
                    element: `${selector}:nth-child(${containerIndex + 1}) ~ *:nth-child(${siblingIndex + 1}) img:nth-child(${imgIndex + 1})`
                  });
                }
              });
            }
          });
        });
      });

      return candidates;
    });
  }

  private static async extractCSSBackgroundThumbnails(page: Page): Promise<ThumbnailCandidate[]> {
    return await page.evaluate(() => {
      const candidates: any[] = [];
      
      // Look for elements with background images that might be video thumbnails
      const potentialVideoElements = (globalThis as any).document.querySelectorAll('*');
      
      potentialVideoElements.forEach((element: any, index: number) => {
        const computedStyle = (globalThis as any).window.getComputedStyle(element);
        const backgroundImage = computedStyle.backgroundImage;
        
        if (backgroundImage && backgroundImage !== 'none') {
          const urlMatch = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (urlMatch) {
            const url = urlMatch[1];
            
            // Check if element looks like a video player or thumbnail
            const className = element.className.toLowerCase();
            const id = element.id.toLowerCase();
            const isVideoRelated = 
              className.includes('video') || className.includes('player') || 
              className.includes('thumb') || className.includes('preview') ||
              id.includes('video') || id.includes('player') || 
              id.includes('thumb') || id.includes('preview');
            
            if (isVideoRelated) {
              candidates.push({
                url,
                source: 'CSS background',
                confidence: 0.7,
                method: 'css-background',
                element: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '') + 
                        (element.className ? `.${element.className.split(' ').join('.')}` : '')
              });
            }
          }
        }
      });

      return candidates;
    });
  }

  private static async extractIframeThumbnails(page: Page): Promise<ThumbnailCandidate[]> {
    const candidates: ThumbnailCandidate[] = [];
    
    try {
      const iframes = await page.$$('iframe');
      
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        const src = await iframe.evaluate(el => el.src);
        
        // Check if iframe looks like a video player
        if (src && (
          src.includes('youtube') || src.includes('vimeo') || 
          src.includes('dailymotion') || src.includes('twitch') ||
          src.includes('player') || src.includes('embed')
        )) {
          try {
            // Try to access iframe content (may fail due to CORS)
            const frame = await iframe.contentFrame();
            if (frame) {
              // Note: Frame detection is limited due to CORS restrictions
              // For now, we'll skip recursive detection in iframes
              console.log('Found iframe with video content, but skipping due to CORS restrictions');
            }
          } catch (error) {
            // CORS or other access issues, try to extract from iframe attributes
            const poster = await iframe.evaluate(el => 
              el.getAttribute('data-poster') || 
              el.getAttribute('data-thumb') || 
              el.getAttribute('data-thumbnail')
            );
            
            if (poster) {
              candidates.push({
                url: poster,
                source: 'iframe data attribute',
                confidence: 0.6,
                method: 'iframe',
                element: `iframe:nth-child(${i + 1})`
              });
            }
          }
        }
      }
    } catch (error) {
      // Iframe access failed, continue
    }
    
    return candidates;
  }

  private static async extractOEmbedThumbnails(page: Page): Promise<ThumbnailCandidate[]> {
    return await page.evaluate(async () => {
      const candidates: any[] = [];
      
      // Look for oEmbed discovery links
      const oembedLinks = (globalThis as any).document.querySelectorAll('link[type="application/json+oembed"]');
      
      for (const link of oembedLinks) {
        const href = (link as any).href;
        if (href) {
          try {
            const response = await fetch(href);
            const data = await response.json() as any;
            
            if (data.thumbnail_url) {
              candidates.push({
                url: data.thumbnail_url,
                source: 'oEmbed',
                confidence: 0.8,
                width: data.thumbnail_width,
                height: data.thumbnail_height,
                method: 'oembed',
                element: 'link[type="application/json+oembed"]'
              });
            }
          } catch (error) {
            // oEmbed fetch failed, continue
          }
        }
      }
      
      return candidates;
    });
  }

  private static async validateAndScoreCandidates(
    page: Page, 
    candidates: ThumbnailCandidate[]
  ): Promise<ThumbnailCandidate[]> {
    const validCandidates: ThumbnailCandidate[] = [];
    
    for (const candidate of candidates) {
      try {
        // Resolve relative URLs
        const absoluteUrl = await page.evaluate((url) => {
          try {
            return new URL(url, (globalThis as any).window.location.href).href;
          } catch {
            return url;
          }
        }, candidate.url);
        
        candidate.url = absoluteUrl;
        
        // Get image dimensions if not already available
        if (!candidate.width || !candidate.height) {
          const dimensions = await page.evaluate(async (url) => {
            return new Promise<{width: number, height: number}>((resolve) => {
              const img = new (globalThis as any).Image();
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => resolve({ width: 0, height: 0 });
              img.src = url;
              
              // Timeout after 5 seconds
              setTimeout(() => resolve({ width: 0, height: 0 }), 5000);
            });
          }, absoluteUrl);
          
          candidate.width = dimensions.width;
          candidate.height = dimensions.height;
        }
        
        // Calculate aspect ratio
        if (candidate.width && candidate.height) {
          candidate.aspectRatio = candidate.width / candidate.height;
        }
        
        // Validate candidate
        if (this.isValidThumbnail(candidate)) {
          // Adjust confidence based on image properties
          candidate.confidence = this.calculateFinalConfidence(candidate);
          validCandidates.push(candidate);
        }
        
      } catch (error) {
        // Skip invalid candidates
        continue;
      }
    }
    
    return validCandidates;
  }

  private static isValidThumbnail(candidate: ThumbnailCandidate): boolean {
    // Check minimum dimensions
    if (candidate.width && candidate.width < this.MIN_THUMBNAIL_WIDTH) return false;
    if (candidate.height && candidate.height < this.MIN_THUMBNAIL_HEIGHT) return false;
    
    // Check for common non-thumbnail patterns
    const url = candidate.url.toLowerCase();
    const rejectPatterns = [
      'icon', 'favicon', 'logo', 'sprite', 'avatar', 'profile',
      'button', 'arrow', 'close', 'play-button', 'controls'
    ];
    
    if (rejectPatterns.some(pattern => url.includes(pattern))) {
      return false;
    }
    
    // Check aspect ratio (should be reasonable for video thumbnails)
    if (candidate.aspectRatio) {
      const isReasonableAspectRatio = this.PREFERRED_ASPECT_RATIOS.some(ratio => 
        Math.abs(candidate.aspectRatio! - ratio) <= this.MAX_ASPECT_RATIO_DEVIATION
      );
      if (!isReasonableAspectRatio && candidate.aspectRatio < 0.5) return false;
    }
    
    return true;
  }

  private static calculateFinalConfidence(candidate: ThumbnailCandidate): number {
    let confidence = candidate.confidence;
    
    // Boost confidence for larger images
    if (candidate.width && candidate.height) {
      const area = candidate.width * candidate.height;
      if (area > 500000) confidence += 0.1; // Large image
      else if (area > 200000) confidence += 0.05; // Medium image
    }
    
    // Boost confidence for good aspect ratios
    if (candidate.aspectRatio) {
      const hasGoodAspectRatio = this.PREFERRED_ASPECT_RATIOS.some(ratio => 
        Math.abs(candidate.aspectRatio! - ratio) <= 0.1
      );
      if (hasGoodAspectRatio) confidence += 0.1;
    }
    
    // Boost confidence for video-related sources
    if (candidate.source.includes('video') || candidate.source.includes('poster')) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  private static selectBestCandidate(candidates: ThumbnailCandidate[]): ThumbnailCandidate | undefined {
    if (candidates.length === 0) return undefined;
    
    // Sort by confidence (descending)
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    return candidates[0];
  }

  private static async detectVideoPresence(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      // Check for video elements
      if ((globalThis as any).document.querySelectorAll('video').length > 0) return true;
      
      // Check for common video player indicators
      const videoIndicators = [
        '[class*="video"]', '[id*="video"]',
        '[class*="player"]', '[id*="player"]',
        'iframe[src*="youtube"]', 'iframe[src*="vimeo"]',
        'iframe[src*="dailymotion"]', 'iframe[src*="twitch"]'
      ];
      
      return videoIndicators.some(selector => 
        (globalThis as any).document.querySelectorAll(selector).length > 0
      );
    });
  }

  public static async detectVideoRegionAndCrop(page: Page): Promise<Buffer | null> {
    try {
      // Find the main video region
      const videoRegion = await page.evaluate(() => {
        // Look for video elements first
        const videos = (globalThis as any).document.querySelectorAll('video');
        if (videos.length > 0) {
          const video = videos[0];
          const rect = video.getBoundingClientRect();
          return {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        }
        
        // Look for video containers with play icons or 16:9 aspect ratio
        const containers = (globalThis as any).document.querySelectorAll('[class*="video"], [class*="player"], [id*="video"], [id*="player"]');
        for (const container of containers) {
          const rect = container.getBoundingClientRect();
          const aspectRatio = rect.width / rect.height;
          
          // Check if it's a reasonable video aspect ratio and size
          if (aspectRatio > 1.3 && aspectRatio < 2.5 && rect.width > 300 && rect.height > 200) {
            return {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          }
        }
        
        return null;
      });
      
      if (videoRegion && videoRegion.width > 0 && videoRegion.height > 0) {
        // Take a screenshot of just the video region
        const screenshot = await page.screenshot({
          type: 'png',
          clip: videoRegion
        });
        
        return Buffer.from(screenshot);
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}
