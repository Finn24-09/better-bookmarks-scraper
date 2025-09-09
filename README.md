# Better Bookmarks Scraper

A fast, lightweight, and secure screenshot API service optimized for Google Cloud Run. Built with Node.js, Express, TypeScript, and Puppeteer with intelligent video thumbnail detection and automatic banner handling.

## ✨ Features

- 🚀 **Fast Cold Starts** - Optimized for serverless environments with browser warm-up
- 🔒 **Secure** - API key authentication, rate limiting, and input validation
- 🎯 **Flexible** - Support for PNG and JPEG formats with customizable options
- 🛡️ **Smart Banner Handling** - Automatically detects and dismisses cookie banners, age verification, and overlays
- 🎬 **Intelligent Video Thumbnail Detection** - Extracts high-quality thumbnails from video pages instead of raw screenshots
- 📊 **Monitoring** - Built-in health checks and performance metrics
- 🐳 **Docker Ready** - Optimized Docker image for Cloud Run deployment
- 🛡️ **Production Ready** - Rate limiting, error handling, and security features
- ⚡ **Low Resource Usage** - Memory and CPU optimized for serverless environments
- 🌐 **Multi-language Support** - Banner detection works across multiple languages

## 🚀 Quick Start with Docker (Recommended)

The easiest and most reliable way to deploy Better Bookmarks Scraper is using Docker. This method ensures consistent deployment across different environments and includes all necessary security configurations.

### Prerequisites

- Docker and Docker Compose installed
- Basic understanding of API configuration

### 1. Clone and Setup

```bash
git clone https://github.com/Finn24-09/better-bookmarks-scraper.git
cd better-bookmarks-scraper
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# API Security
API_KEY=your-super-secure-api-key
REQUIRE_API_KEY=true
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Rate Limiting
RATE_LIMIT_MAX=100

# Security Settings
BLOCK_PRIVATE_IPS=true

# Logging
LOG_LEVEL=info
```

### 3. Deploy with Docker Compose

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

The service will be available at `http://localhost:8080`

### 4. Production Deployment

For production environments, the Docker Compose setup includes:

```yaml
version: "3.8"

services:
  screenshot-api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - API_KEY=your-secure-api-key
      - REQUIRE_API_KEY=true
      - ALLOWED_ORIGINS=https://yourdomain.com
      - RATE_LIMIT_MAX=100
      - BLOCK_PRIVATE_IPS=true
    volumes:
      - ./screenshots:/tmp/screenshots
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "require('http').get('http://localhost:8080/health/live', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## 🔧 Environment Variables

### Required Variables

| Variable            | Description                              | Default     | Example                  |
| ------------------- | ---------------------------------------- | ----------- | ------------------------ |
| `PORT`              | Server port                              | 8080        | `8080`                   |
| `NODE_ENV`          | Environment mode                         | development | `production`             |
| `API_KEY`           | Required API key for authentication      | -           | `your-super-secure-key`  |
| `REQUIRE_API_KEY`   | Whether API key is required              | false       | `true`                   |
| `ALLOWED_ORIGINS`   | CORS allowed origins (comma-separated)   | \*          | `https://yourdomain.com` |
| `RATE_LIMIT_MAX`    | Max requests per 15 minutes per IP       | 100         | `100`                    |
| `BLOCK_PRIVATE_IPS` | Block private IP addresses               | true        | `true`                   |
| `LOG_LEVEL`         | Logging level (error, warn, info, debug) | info        | `info`                   |

### Environment Variable Details

#### API Security Configuration

- **`API_KEY`**: A secure API key for authentication. Use a strong, randomly generated key for production.
- **`REQUIRE_API_KEY`**: Set to `true` in production to enforce API key authentication.
- **`ALLOWED_ORIGINS`**: Comma-separated list of allowed origins for CORS. Use specific domains in production.

#### Performance Configuration

- **`RATE_LIMIT_MAX`**: Maximum number of requests per IP address per 15-minute window.
- **`BLOCK_PRIVATE_IPS`**: Prevents SSRF attacks by blocking requests to private IP ranges.

## ☁️ Google Cloud Run Deployment

### Performance Estimates

Based on the application architecture and testing, here are the estimated connection limits per Cloud Run instance:

#### Recommended Configuration

- **Memory**: 1 GiB
- **CPU**: 1 vCPU
- **Concurrency**: 10-15 requests
- **Timeout**: 60 seconds

**Note**: Lower resource configurations will reduce costs but may impact performance and concurrent request handling.

#### Connection Estimates

| Scenario        | Concurrent Requests | Response Time | Memory Usage | Notes                               |
| --------------- | ------------------- | ------------- | ------------ | ----------------------------------- |
| **Light Load**  | 5-8 requests        | 2-4 seconds   | ~400-600 MB  | Simple pages, no video detection    |
| **Medium Load** | 8-12 requests       | 3-6 seconds   | ~600-800 MB  | Mixed content, some video detection |
| **Heavy Load**  | 10-15 requests      | 4-8 seconds   | ~800-950 MB  | Complex pages, full video detection |
| **Peak Load**   | 15+ requests        | 6-12 seconds  | ~950+ MB     | Risk of memory exhaustion           |

#### Scaling Triggers

- **New instance spawned when**: Current instances reach 80% of max concurrency (8-12 active requests)
- **Scale-down trigger**: When traffic drops below 60% capacity for 15+ minutes
- **Cold start time**: 3-8 seconds (optimized with browser warm-up)

## 📋 API Documentation

### Base URL

```
# Local development
http://localhost:8080

# Cloud Run deployment
https://your-service-url.run.app
```

### Authentication

All screenshot endpoints require an API key when `REQUIRE_API_KEY=true`. Provide it via:

- **Header**: `X-API-Key: your-api-key`
- **Query Parameter**: `?apiKey=your-api-key`

### Endpoints

#### 📸 Take Screenshot

**POST** `/api/v1/screenshot`

**GET** `/api/v1/screenshot` (for simple requests)

##### Request Body (POST)

```json
{
  "url": "https://example.com",
  "width": 1920,
  "height": 1080,
  "format": "png",
  "quality": 80,
  "fullPage": false,
  "timeout": 30000,
  "waitUntil": "networkidle2",
  "handleBanners": true,
  "detectVideoThumbnails": true
}
```

##### Query Parameters (GET)

```
GET /api/v1/screenshot?url=https://example.com&width=1920&height=1080&format=png&apiKey=your-key
```

##### Parameters

| Parameter                 | Type     | Default        | Description                                          |
| ------------------------- | -------- | -------------- | ---------------------------------------------------- |
| `url`                     | string   | **required**   | The URL to screenshot (HTTP/HTTPS only)              |
| `width`                   | number   | 1920           | Viewport width (100-3840)                            |
| `height`                  | number   | 1080           | Viewport height (100-2160)                           |
| `format`                  | string   | "png"          | Image format ("png" or "jpeg")                       |
| `quality`                 | number   | 80             | JPEG quality (1-100, only for JPEG)                  |
| `fullPage`                | boolean  | false          | Capture full page or just viewport                   |
| `timeout`                 | number   | 30000          | Request timeout in milliseconds (5000-60000)         |
| `waitUntil`               | string   | "networkidle2" | When to consider page loaded                         |
| `handleBanners`           | boolean  | true           | Enable/disable automatic banner handling             |
| `bannerTimeout`           | number   | 5000           | Maximum time (ms) to spend handling banners          |
| `customBannerSelectors`   | string[] | []             | Custom CSS selectors for site-specific banners       |
| `injectBannerBlockingCSS` | boolean  | false          | Inject CSS to hide common banner containers          |
| `detectVideoThumbnails`   | boolean  | true           | Enable/disable intelligent video thumbnail detection |

##### Response Types

**Image Response (Default)**

- **Content-Type**: `image/png` or `image/jpeg`
- **Body**: Binary image data
- **Headers**:
  - `X-Processing-Time`: Processing time in milliseconds
  - `X-Screenshot-Format`: Image format used
  - `X-Screenshot-Dimensions`: Image dimensions
  - `X-Is-Video-Thumbnail`: `true` if a video thumbnail was returned
  - `X-Video-Detection-Method`: Method used to find the thumbnail
  - `Cache-Control`: Caching headers

**Thumbnail URL Response (For High-Quality Video Thumbnails)**

- **Content-Type**: `application/json`
- **Body**: JSON object with thumbnail information

```json
{
  "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "isVideoThumbnail": true,
  "processingTime": "2341ms",
  "source": "og:image",
  "method": "metadata"
}
```

##### Example Requests

**cURL (POST)**

```bash
curl -X POST http://localhost:8080/api/v1/screenshot \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"url": "https://example.com", "format": "png"}' \
  --output screenshot.png
```

**cURL (GET)**

```bash
curl "http://localhost:8080/api/v1/screenshot?url=https://example.com&apiKey=your-api-key" \
  --output screenshot.png
```

**JavaScript (Fetch)**

```javascript
const response = await fetch("http://localhost:8080/api/v1/screenshot", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "your-api-key",
  },
  body: JSON.stringify({
    url: "https://example.com",
    width: 1920,
    height: 1080,
    format: "png",
  }),
});

if (response.headers.get("content-type")?.includes("application/json")) {
  // Video thumbnail URL response
  const data = await response.json();
  console.log("Thumbnail URL:", data.thumbnailUrl);
} else {
  // Image response
  const imageBuffer = await response.arrayBuffer();
  // Process image buffer...
}
```

#### 🏥 Health Check Endpoints

**GET** `/health`

Returns detailed health information including browser status, memory usage, and system info.

**GET** `/health/ready`

Returns readiness status (useful for Kubernetes/Cloud Run readiness probes).

**GET** `/health/live`

Returns liveness status (useful for Kubernetes/Cloud Run liveness probes).

## 🐳 Docker Features

### Security Features

The Docker setup includes comprehensive security best practices:

- ✅ **Multi-stage build** - Reduces final image size and attack surface
- ✅ **Non-root user** - Application runs as unprivileged user
- ✅ **Alpine Linux base** - Minimal image size (~150MB) with smaller attack surface
- ✅ **Security headers** - Comprehensive HTTP security headers
- ✅ **Health checks** - Built-in health monitoring with automatic restarts
- ✅ **Signal handling** - Proper signal handling for graceful shutdowns
- ✅ **Resource limits** - CPU and memory constraints in production
- ✅ **No new privileges** - Prevents privilege escalation

### Health Monitoring

The Docker container includes comprehensive health checks:

```bash
# Check container health
docker ps

# View health check logs
docker inspect --format='{{json .State.Health}}' screenshot-api

# Manual health check
curl http://localhost:8080/health
```

### Container Management

```bash
# View container logs
docker-compose logs -f

# Restart the application
docker-compose restart screenshot-api

# Update the application
docker-compose pull
docker-compose up -d

# Scale the application (production)
docker-compose up -d --scale screenshot-api=3
```

## 🏗️ Alternative Deployment Methods

### Traditional Node.js Deployment

If you prefer not to use Docker:

#### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

#### Installation

1. **Clone and install:**

   ```bash
   git clone https://github.com/Finn24-09/better-bookmarks-scraper.git
   cd better-bookmarks-scraper
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and serve:**
   ```bash
   npm run build
   npm start
   ```

### Deploy to Cloud Platforms

The built application can be deployed to various platforms:

#### Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT-ID/better-bookmarks-scraper
gcloud run deploy --image gcr.io/PROJECT-ID/better-bookmarks-scraper --platform managed
```

#### AWS Lambda

Use the Serverless Framework or AWS SAM for Lambda deployment.

#### Azure Container Instances

```bash
az container create --resource-group myResourceGroup --name better-bookmarks-scraper --image your-registry/better-bookmarks-scraper
```

## 🛡️ Banner Handling

The Screenshot API includes intelligent banner and overlay handling to capture clean screenshots without cookie consent banners, age verification modals, newsletter popups, and other overlays.

### Automatic Banner Detection

The system automatically detects and handles common banner patterns including:

- **Cookie Consent Banners**: "Accept all", "Alle akzeptieren", "OK", "I agree"
- **Age Verification**: "I am 18 or older", "Enter", "Yes, I am 18+"
- **YouTube Cookie Banners**: YouTube-specific cookie consent dialogs
- **GDPR/Privacy Banners**: "Accept and continue", privacy notices
- **Modal Close Buttons**: Generic close buttons and modal dismissals
- **Newsletter Popups**: "No thanks", "Maybe later", subscription dismissals

### Multi-language Support

Banner detection works across multiple languages:

- English, German (Deutsch), French (Français), Spanish (Español), Italian (Italiano)

### Usage Examples

**Basic Usage (Default Behavior)**

```bash
curl -X POST "http://localhost:8080/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com"}'
```

**Custom Banner Selectors**

```bash
curl -X POST "http://localhost:8080/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "customBannerSelectors": [
      "#custom-popup-close",
      ".site-specific-banner button"
    ]
  }'
```

## 🎬 Video Thumbnail Detection

The Screenshot API includes intelligent video thumbnail detection that automatically extracts high-quality thumbnail images from video pages.

### Detection Strategies (in priority order)

1. **Metadata Extraction** - Open Graph images, Twitter Card images, Schema.org VideoObject
2. **Video Element Analysis** - `<video>` tags with `poster` attributes
3. **DOM Traversal** - Images within video containers
4. **CSS Background Images** - Background images on video player elements
5. **Embedded Player Detection** - YouTube, Vimeo, Dailymotion, Twitch iframes
6. **oEmbed Integration** - oEmbed discovery and thumbnail URLs

### Supported Sites

- **YouTube** (all video pages)
- **Vimeo** (embedded and direct)
- **Dailymotion** (embedded and direct)
- **Twitch** (clips and videos)
- **Custom video players** (with proper metadata)
- **HTML5 video** (with poster attributes)
- **Most video hosting platforms** (with Open Graph tags)

### Performance Impact

- **Additional overhead**: ~500-2000ms for video detection
- **Memory efficient**: Returns URLs directly when possible
- **Storage optimization**: Saves bandwidth by returning URLs for high-quality thumbnails

## 🎨 Tech Stack

- **Runtime:** Node.js 18+ with TypeScript
- **Framework:** Express.js with middleware
- **Browser Automation:** Puppeteer with Chromium
- **Validation:** Joi for request validation
- **Security:** Helmet.js, rate limiting, CORS
- **Logging:** Structured logging with Winston
- **Containerization:** Docker with Alpine Linux
- **Development:** ESLint, TypeScript, nodemon
- **Deployment:** Google Cloud Run, Docker Compose

## 🔐 Security Features

### Application Security

- ✅ **API Key Authentication** - Secure your API with custom keys
- ✅ **Rate Limiting** - Prevent abuse with configurable rate limits (100 requests per 15 minutes by default)
- ✅ **Input Validation** - Comprehensive request validation with Joi
- ✅ **Private IP Blocking** - Prevent SSRF attacks by blocking private IPs
- ✅ **CORS Protection** - Configurable CORS policies
- ✅ **Security Headers** - Helmet.js for security headers
- ✅ **Error Handling** - Secure error responses without information leakage

### Infrastructure Security

- ✅ **HTTPS Enforcement** - All traffic encrypted in transit
- ✅ **Container Security** - Non-root execution, minimal attack surface
- ✅ **Network Isolation** - Docker network segmentation
- ✅ **Resource Limits** - CPU and memory constraints
- ✅ **Health Monitoring** - Automatic restart on failures
- ✅ **Secure Defaults** - Security-first configuration

## 📊 Performance Optimizations

### Cold Start Optimization

- **Browser Warm-up** - Pre-launches browser instance on startup
- **Minimal Dependencies** - Only essential packages included
- **Alpine Linux** - Smaller Docker image (~150MB)
- **Single Process** - Optimized Puppeteer configuration

### Memory Optimization

- **Shared Browser Instance** - Reuses browser across requests
- **Page Cleanup** - Automatic page closure after screenshots
- **Memory Monitoring** - Built-in memory usage tracking
- **Resource Limits** - Configurable memory and CPU limits

### Network Optimization

- **Compression** - Gzip compression for responses
- **Caching Headers** - Appropriate cache control
- **Connection Reuse** - HTTP keep-alive
- **Thumbnail URL Returns** - Direct URL returns for high-quality video thumbnails

## 🚨 Error Handling

The API returns structured error responses:

```json
{
  "error": "Screenshot failed",
  "message": "Navigation timeout exceeded",
  "statusCode": 500,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/screenshot"
}
```

### Common Error Codes

| Code | Description                               |
| ---- | ----------------------------------------- |
| 400  | Bad Request - Invalid parameters          |
| 401  | Unauthorized - Invalid or missing API key |
| 429  | Too Many Requests - Rate limit exceeded   |
| 500  | Internal Server Error - Screenshot failed |
| 503  | Service Unavailable - Browser not ready   |

## 📈 Monitoring

### Health Endpoints

- `/health` - Detailed health information including browser status and memory usage
- `/health/ready` - Readiness probe for container orchestration
- `/health/live` - Liveness probe for container orchestration

### Metrics

- Processing time (via `X-Processing-Time` header)
- Memory usage (in health endpoint)
- Browser status and version
- Request success/failure rates
- Video detection statistics

### Logging

Structured logging with request details:

```json
{
  "level": "info",
  "message": "Screenshot taken successfully",
  "url": "https://example.com",
  "format": "png",
  "processingTime": 1250,
  "isVideoThumbnail": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🧪 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production with TypeScript compilation
- `npm start` - Start production server
- `npm run lint` - Run ESLint with TypeScript support
- `npm test` - Run test suite (if available)

### Development Setup

1. **Clone and install:**

   ```bash
   git clone https://github.com/Finn24-09/better-bookmarks-scraper.git
   cd better-bookmarks-scraper
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your development configuration
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

4. **Test the API:**
   ```bash
   curl "http://localhost:8080/api/v1/screenshot?url=https://example.com"
   ```

### Development Environment Variables

For development, you can use relaxed security settings:

```env
NODE_ENV=development
API_KEY=dev-api-key-123
REQUIRE_API_KEY=false
ALLOWED_ORIGINS=*
RATE_LIMIT_MAX=1000
BLOCK_PRIVATE_IPS=false
LOG_LEVEL=debug
```

## 🆘 Support

If you encounter any issues:

1. **Check Configuration:** Ensure all environment variables are correctly set
2. **Verify Dependencies:** Check that Node.js and Docker are properly installed
3. **Check Logs:** Use `docker-compose logs -f` or `npm run dev` to view application logs
4. **Browser Console:** Check for any client-side errors when testing
5. **Health Checks:** Verify the application health at `/health` endpoint
6. **API Testing:** Use the provided cURL examples to test API functionality

### Common Issues

- **Browser launch failures:** Check Docker memory limits and system resources
- **Authentication errors:** Verify `API_KEY` and `REQUIRE_API_KEY` configuration
- **Network timeouts:** Adjust `timeout` parameter for slow-loading pages
- **Memory issues:** Increase Docker memory limits or reduce concurrent requests
- **CORS errors:** Check `ALLOWED_ORIGINS` configuration

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/Finn24-09/better-bookmarks-scraper/issues)
- **Documentation**: This README and inline code comments
- **Health Checks**: Use `/health` endpoint for debugging

## 🙏 Acknowledgments

- Puppeteer team for the excellent browser automation library
- Express.js community for the robust web framework
- Alpine Linux for providing secure, minimal container images
- Google Cloud Run for serverless container hosting
- The open-source community for continuous improvements and feedback

---

**Better Bookmarks Scraper** - Fast, secure, and intelligent screenshot generation for modern web applications.
