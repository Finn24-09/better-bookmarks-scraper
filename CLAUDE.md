# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Better Bookmarks Scraper is a fast, lightweight screenshot API service optimized for serverless environments (Google Cloud Run). It uses Puppeteer to capture screenshots with intelligent video thumbnail detection and automatic banner handling.

## Development Commands

### Building and Running
- `npm run build` - Compile TypeScript to JavaScript (outputs to dist/)
- `npm start` - Start production server (requires build first)
- `npm run dev` - Start development server with hot reload using ts-node

### Docker Commands
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container locally on port 8080
- `npm run docker:compose:up` - Start with docker-compose (recommended for development)
- `npm run docker:compose:down` - Stop docker-compose services
- `npm run docker:compose:logs` - View docker-compose logs

### Testing
- `npm test` - Run Jest test suite

## Architecture Overview

### Core Components

**BrowserManager** (`src/services/BrowserManager.ts`)
- Singleton pattern manages a shared Puppeteer browser instance across requests
- Implements browser warm-up on server startup to reduce cold start latency
- Provides two main methods:
  - `takeScreenshot()` - Basic screenshot capture with banner handling
  - `takeIntelligentScreenshot()` - Advanced screenshot with video thumbnail detection
- Automatically handles browser disconnections and reconnections
- Pages are created per-request and closed after use, browser instance is reused

**VideoThumbnailDetector** (`src/services/VideoThumbnailDetector.ts`)
- 6-strategy detection system with priority-based early exit for optimal performance:
  1. **Metadata extraction** (HIGHEST PRIORITY) - og:image, twitter:image, schema.org VideoObject - exits early on confidence ≥0.85
  2. **oEmbed integration** (SECOND PRIORITY) - Returns direct thumbnail URLs when available - exits early when found
  3. **Video element analysis** - poster attributes on `<video>` tags
  4. **Embedded player detection** - YouTube, Vimeo, Dailymotion, Twitch iframes
  5. **CSS background images** (conditional) - Only runs if confidence <0.75 from previous strategies
  6. **DOM traversal** (last resort) - Only runs if confidence <0.7 from previous strategies
- Returns thumbnail URLs directly for high-quality sources (YouTube maxresdefault, Vimeo CDN) to save bandwidth
- Smart early-exit: skips remaining strategies when high-confidence results are found (reduces processing by ~60%)
- Advanced multi-level ad detection prevents false positives while filtering advertisement videos
- Falls back to regular screenshots if no suitable thumbnail found

**BannerHandler** (`src/services/BannerHandler.ts`)
- Pattern-based banner detection using CSS selectors and text content matching
- Multi-language support (English, German, French, Spanish, Italian)
- Handles cookie consent, age verification, GDPR notices, newsletter popups
- Two-pass banner handling: initial load + delayed popups (age verification often appears after page load)
- Actions: click (for accept buttons) or remove (for overlay elements)
- Optional CSS injection to forcibly hide banner containers

### Request Flow

1. Request received at `/api/v1/screenshot` (GET or POST)
2. API key validation (`src/middleware/auth.ts`)
3. Request validation with Joi schema (`src/middleware/validation.ts`)
4. Private IP blocking check (configurable via BLOCK_PRIVATE_IPS env var)
5. BrowserManager creates new page with configured viewport
6. Page navigation with specified waitUntil condition
7. Banner handling (if enabled):
   - Optional CSS injection for banner blocking
   - First pass banner detection and removal
   - 1.5s delay for delayed popups
   - Second pass banner detection (catches age verification)
8. Video thumbnail detection (if enabled):
   - Runs 6 detection strategies
   - Validates and scores candidates by size, aspect ratio, confidence
   - Returns thumbnail URL directly for high-quality sources
   - Falls back to fetching thumbnail or cropping video region
9. Response with image buffer or thumbnail URL JSON

### Middleware Stack

**Order in server.ts:**
1. Helmet (security headers)
2. CORS (configurable origins)
3. Compression (gzip)
4. Rate limiting (15-minute windows, configurable max requests)
5. Body parsing (JSON/urlencoded, 10mb limit)
6. Routes (health, screenshot)
7. Error handler
8. 404 handler

### Configuration

Environment variables control all runtime behavior:
- Security: API_KEY, REQUIRE_API_KEY, ALLOWED_ORIGINS, BLOCK_PRIVATE_IPS (defaults to true for SSRF protection)
- Performance: RATE_LIMIT_MAX, PORT
- Logging: LOG_LEVEL
- Environment: NODE_ENV

**IMPORTANT**: BLOCK_PRIVATE_IPS defaults to enabled if not explicitly set, providing SSRF protection by default.

See README.md for complete environment variable documentation.

## Key Implementation Details

### Singleton Browser Management
The BrowserManager uses a singleton pattern to maintain one shared browser instance. This is critical for serverless performance - browser launch takes 3-8 seconds, so the warm-up on startup significantly reduces cold start times. Pages are created and destroyed per-request, but the browser stays alive.

### Graceful Shutdown
Server.ts implements SIGTERM and SIGINT handlers that:
1. Stop accepting new HTTP connections
2. Close existing HTTP server
3. Clean up browser instance via BrowserManager.cleanup()
4. Exit process

This ensures proper cleanup in container environments like Cloud Run.

### SSRF Protection (Enhanced)
Screenshot services are vulnerable to SSRF attacks. The route handlers implement comprehensive protection:
- **IPv4 Private Ranges**: 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12, 169.254.0.0/16 (link-local)
- **IPv6 Private Ranges**: fc00::/7 (ULA), fe80::/10 (link-local)
- **Localhost**: 127.0.0.1, ::1, 0.0.0.0, localhost hostname
- **URL Validation**: Prevents authentication credentials in URLs (username:password@)
- **Protocol Restriction**: Only HTTP and HTTPS allowed
- **Default Enabled**: BLOCK_PRIVATE_IPS defaults to true if not explicitly configured

### Two Response Types
The screenshot endpoint can return:
1. Image buffer (Content-Type: image/png or image/jpeg) - standard screenshot
2. JSON with thumbnail URL (Content-Type: application/json) - when high-quality video thumbnail detected

Clients must check Content-Type header to handle both cases.

### Video Thumbnail Optimization
For high-confidence video thumbnails (YouTube maxresdefault, Vimeo CDN, etc.), the service returns the URL directly rather than fetching and re-serving the image. This saves:
- Bandwidth (no download/upload of large images)
- Memory (no image buffering)
- Processing time (no image manipulation)
- Storage (no caching needed)

### Banner Handling Timing (Optimized with Strict Timeouts)
Banners are handled in two passes with strict timeout enforcement:
1. Initial pass: After 500ms page settle time, max 3000ms timeout (reduced from 5000ms)
2. Delay: 1000ms wait for delayed popups (reduced from 1500ms)
3. Second pass: Maximum 2000ms timeout (reduced from 5000ms)
4. Inter-attempt delay: 300ms between banner detection attempts
5. Maximum attempts: 3 per pass (reduced from 5)
6. Pattern timeout: 3000ms max per banner pattern with Promise.race()

**Timeout Enforcement**: All banner operations now use `Promise.race()` to prevent indefinite hangs. If a banner click triggers a slow navigation, the timeout will abort and continue processing.

### Performance Optimizations (New)
Multiple optimizations reduce processing time by 40-60%:
- **Early exit strategies**: Video detection stops when high-confidence results found (confidence ≥0.85 for metadata, any oEmbed result)
- **Reduced wait times**: Page load settling time reduced to 500ms, banner delays reduced to 300ms
- **Conditional strategy execution**: CSS and DOM traversal only run if previous strategies have low confidence
- **Smart banner detection**: Initial wait reduced to 500ms, inter-attempt delays reduced to 300ms
- **Priority ordering**: High-value strategies (metadata, oEmbed) run first

### Error Handling (Enhanced)
Comprehensive error handling with context-aware messages:
- **400 errors**: Invalid URL format, missing parameters, authentication credentials in URL
- **502 errors**: Network failures, unreachable websites (net::ERR patterns)
- **503 errors**: Browser service unavailable (Target closed, Session closed)
- **504 errors**: Navigation timeouts, slow-loading websites
- **Detailed logging**: Error type, URL, processing time, stack traces for debugging

## Common Development Tasks

### Adding New Banner Patterns
Edit `COMMON_BANNER_PATTERNS` array in `src/services/BannerHandler.ts`. Each pattern includes:
- `name`: Description for logging
- `selectors`: Array of CSS selectors (supports `:contains()` pseudo-selector)
- `action`: 'click' or 'remove'
- `waitAfter`: Optional delay in ms after handling

Patterns are processed in order, so put high-priority patterns (like age verification) first.

### Adding New Video Detection Strategies
Add new extraction method in `VideoThumbnailDetector` class following the pattern:
1. Create private `extractXxxThumbnails(page: Page)` method
2. Return `ThumbnailCandidate[]` with url, source, confidence, method
3. Call from `detectVideoThumbnail()` main method
4. Candidates are automatically validated and scored

### Modifying Screenshot Options
1. Update `ScreenshotOptions` interface in `src/services/BrowserManager.ts`
2. Add Joi validation in `screenshotSchema` in `src/routes/screenshot.ts`
3. Pass option to appropriate service method

### Deployment to Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/better-bookmarks-scraper
gcloud run deploy --image gcr.io/PROJECT-ID/better-bookmarks-scraper --platform managed
```

Set environment variables in Cloud Run console or via `--set-env-vars` flag. Recommended settings:
- Memory: 1 GiB
- CPU: 1 vCPU
- Concurrency: 10-15 requests
- Timeout: 60 seconds

## Important Notes

- Never commit `.env` file - it contains API keys
- Browser args in BrowserManager include `--no-sandbox` and `--disable-setuid-sandbox` which are required for Docker/containerized environments but reduce security
- The application uses `domcontentloaded` by default for faster page loads, but this may miss delayed content on some sites - use `waitUntil: 'networkidle0'` for more thorough loading
- TypeScript strict mode is enabled - all code must have proper type annotations
- Node.js 18+ is required (specified in package.json engines)
- BLOCK_PRIVATE_IPS defaults to true for security - explicitly set to false only in development/testing
- Video detection uses early-exit optimization - modify confidence thresholds carefully to balance speed vs thoroughness
- Ad detection uses multi-level filtering - strong indicators trigger immediately, weak indicators require multiple matches
