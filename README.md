# 📸 Screenshot API

A fast, lightweight, and secure screenshot API service optimized for Google Cloud Run. Built with Node.js, Express, TypeScript, and Puppeteer.

## ✨ Features

- 🚀 **Fast Cold Starts** - Optimized for serverless environments
- 🔒 **Secure** - API key authentication and input validation
- 🎯 **Flexible** - Support for PNG and JPEG formats with customizable options
- 🛡️ **Smart Banner Handling** - Automatically detects and dismisses cookie banners, age verification, and overlays
- 📊 **Monitoring** - Built-in health checks and performance metrics
- 🐳 **Docker Ready** - Optimized Docker image for Cloud Run
- 🛡️ **Production Ready** - Rate limiting, error handling, and security features
- ⚡ **Low Resource Usage** - Memory and CPU optimized

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd screenshot-api

# Build the Docker image
docker build -t screenshot-api .

# Run the container
docker run -p 8080:8080 -e API_KEY=your-secret-key screenshot-api
```

### Local Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Start development server
npm run dev

# Or build and run production
npm run build
npm start
```

## 📋 API Documentation

### Base URL

```
http://localhost:8080
```

### Authentication

All screenshot endpoints require an API key. Provide it via:

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
  "waitUntil": "networkidle2"
}
```

##### Query Parameters (GET)

```
GET /api/v1/screenshot?url=https://example.com&width=1920&height=1080&format=png
```

##### Parameters

| Parameter                 | Type     | Default        | Description                                    |
| ------------------------- | -------- | -------------- | ---------------------------------------------- |
| `url`                     | string   | **required**   | The URL to screenshot (HTTP/HTTPS only)        |
| `width`                   | number   | 1920           | Viewport width (100-3840)                      |
| `height`                  | number   | 1080           | Viewport height (100-2160)                     |
| `format`                  | string   | "png"          | Image format ("png" or "jpeg")                 |
| `quality`                 | number   | 80             | JPEG quality (1-100, only for JPEG)            |
| `fullPage`                | boolean  | false          | Capture full page or just viewport             |
| `timeout`                 | number   | 30000          | Request timeout in milliseconds (5000-60000)   |
| `waitUntil`               | string   | "networkidle2" | When to consider page loaded                   |
| `handleBanners`           | boolean  | true           | Enable/disable automatic banner handling       |
| `bannerTimeout`           | number   | 5000           | Maximum time (ms) to spend handling banners    |
| `customBannerSelectors`   | string[] | []             | Custom CSS selectors for site-specific banners |
| `injectBannerBlockingCSS` | boolean  | false          | Inject CSS to hide common banner containers    |

##### Response

- **Content-Type**: `image/png` or `image/jpeg`
- **Headers**:
  - `X-Processing-Time`: Processing time in milliseconds
  - `X-Screenshot-Format`: Image format used
  - `X-Screenshot-Dimensions`: Image dimensions
  - `Cache-Control`: Caching headers

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

const imageBuffer = await response.arrayBuffer();
```

#### 🏥 Health Check

**GET** `/health`

Returns detailed health information including browser status, memory usage, and system info.

**GET** `/health/ready`

Returns readiness status (useful for Kubernetes readiness probes).

**GET** `/health/live`

Returns liveness status (useful for Kubernetes liveness probes).

## 🛡️ Banner Handling

The Screenshot API includes intelligent banner and overlay handling to capture clean screenshots without cookie consent banners, age verification modals, newsletter popups, and other overlays that typically block content.

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

### Banner Handling Parameters

| Parameter                 | Type     | Default | Description                                    |
| ------------------------- | -------- | ------- | ---------------------------------------------- |
| `handleBanners`           | boolean  | `true`  | Enable/disable automatic banner handling       |
| `bannerTimeout`           | number   | `5000`  | Maximum time (ms) to spend handling banners    |
| `customBannerSelectors`   | string[] | `[]`    | Custom CSS selectors for site-specific banners |
| `injectBannerBlockingCSS` | boolean  | `false` | Inject CSS to hide common banner containers    |

### Usage Examples

**Basic Usage (Default Behavior)**

```bash
curl -X POST "http://localhost:8080/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com"}'
```

**Disable Banner Handling**

```bash
curl -X POST "http://localhost:8080/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "handleBanners": false
  }'
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
      ".site-specific-banner button",
      "[data-dismiss=\"notification\"]"
    ]
  }'
```

**With CSS Banner Blocking**

```bash
curl -X POST "http://localhost:8080/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "injectBannerBlockingCSS": true,
    "bannerTimeout": 8000
  }'
```

### How It Works

1. **Page Load**: Wait for initial page load completion
2. **Dynamic Content**: Allow time for dynamic content and banners to appear
3. **Pattern Matching**: Scan for known banner patterns using CSS selectors
4. **Visibility Check**: Verify elements are actually visible on screen
5. **Interaction**: Click accept buttons or remove banner elements
6. **Stabilization**: Wait for page to stabilize after banner removal
7. **Screenshot**: Capture the clean page content

### Supported Banner Types

- **Cookie Consent**: GDPR compliance banners, cookie policy notifications
- **Age Verification**: Adult content warnings, age gate modals
- **Marketing Overlays**: Newsletter signups, promotional popups
- **Navigation Overlays**: Mobile menu overlays, search overlays

### Performance Impact

- **Typical overhead**: 1-3 seconds for banner detection and handling
- **Configurable timeout**: Adjust `bannerTimeout` based on needs
- **Graceful fallback**: Screenshot continues even if banner handling fails

## ⚙️ Configuration

### Environment Variables

| Variable            | Default     | Description                            |
| ------------------- | ----------- | -------------------------------------- |
| `PORT`              | 8080        | Server port                            |
| `NODE_ENV`          | development | Environment mode                       |
| `API_KEY`           | -           | Required API key for authentication    |
| `REQUIRE_API_KEY`   | false       | Whether API key is required            |
| `ALLOWED_ORIGINS`   | \*          | CORS allowed origins (comma-separated) |
| `RATE_LIMIT_MAX`    | 100         | Max requests per 15 minutes per IP     |
| `BLOCK_PRIVATE_IPS` | true        | Block private IP addresses             |

### Example .env file

```env
PORT=8080
NODE_ENV=production
API_KEY=your-super-secret-api-key
REQUIRE_API_KEY=true
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
RATE_LIMIT_MAX=100
BLOCK_PRIVATE_IPS=true
```

## 🐳 Docker Deployment

### Building the Image

```bash
docker build -t screenshot-api .
```

### Running Locally

```bash
docker run -p 8080:8080 \
  -e API_KEY=your-secret-key \
  -e NODE_ENV=production \
  screenshot-api
```

### Google Cloud Run Deployment

1. **Build and push to Google Container Registry:**

```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Build and tag
docker build -t gcr.io/YOUR_PROJECT_ID/screenshot-api .

# Push to registry
docker push gcr.io/YOUR_PROJECT_ID/screenshot-api
```

2. **Deploy to Cloud Run:**

```bash
gcloud run deploy screenshot-api \
  --image gcr.io/YOUR_PROJECT_ID/screenshot-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 60 \
  --concurrency 10 \
  --set-env-vars API_KEY=your-secret-key,NODE_ENV=production
```

3. **Using Cloud Run YAML:**

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: screenshot-api
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/memory: "1Gi"
        run.googleapis.com/cpu: "1"
    spec:
      containerConcurrency: 10
      timeoutSeconds: 60
      containers:
        - image: gcr.io/YOUR_PROJECT_ID/screenshot-api
          env:
            - name: API_KEY
              value: "your-secret-key"
            - name: NODE_ENV
              value: "production"
            - name: BLOCK_PRIVATE_IPS
              value: "true"
          resources:
            limits:
              memory: "1Gi"
              cpu: "1"
          ports:
            - containerPort: 8080
```

## 🔒 Security Features

- **API Key Authentication** - Secure your API with custom keys
- **Rate Limiting** - Prevent abuse with configurable rate limits
- **Input Validation** - Comprehensive request validation with Joi
- **Private IP Blocking** - Prevent SSRF attacks by blocking private IPs
- **CORS Protection** - Configurable CORS policies
- **Security Headers** - Helmet.js for security headers
- **Error Handling** - Secure error responses without information leakage

## 📊 Performance Optimizations

### Cold Start Optimization

- **Browser Warm-up** - Pre-launches browser instance
- **Minimal Dependencies** - Only essential packages
- **Alpine Linux** - Smaller Docker image
- **Single Process** - Optimized Puppeteer configuration

### Memory Optimization

- **Shared Browser Instance** - Reuses browser across requests
- **Page Cleanup** - Automatic page closure after screenshots
- **Memory Monitoring** - Built-in memory usage tracking

### Network Optimization

- **Compression** - Gzip compression for responses
- **Caching Headers** - Appropriate cache control
- **Connection Reuse** - HTTP keep-alive

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional)

### Setup

```bash
# Clone repository
git clone <your-repo-url>
cd screenshot-api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build TypeScript to JavaScript
npm run start    # Start production server
npm test         # Run tests
npm run docker:build  # Build Docker image
npm run docker:run    # Run Docker container
```

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

- `/health` - Detailed health information
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe

### Metrics

- Processing time (via `X-Processing-Time` header)
- Memory usage (in health endpoint)
- Browser status
- Request success/failure rates

### Logging

Structured logging with request details:

```json
{
  "level": "info",
  "message": "Screenshot taken successfully",
  "url": "https://example.com",
  "format": "png",
  "processingTime": 1250,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```
