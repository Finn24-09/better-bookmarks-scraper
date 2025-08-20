# Banner Handling Documentation

## Overview

The screenshot API now includes automatic banner and overlay handling to capture clean screenshots of web pages without cookie consent banners, age verification modals, newsletter popups, and other overlays that typically block content.

## Features

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

- English
- German (Deutsch)
- French (Français)
- Spanish (Español)
- Italian (Italiano)

## API Parameters

### New Screenshot Options

| Parameter                 | Type     | Default | Description                                    |
| ------------------------- | -------- | ------- | ---------------------------------------------- |
| `handleBanners`           | boolean  | `true`  | Enable/disable automatic banner handling       |
| `bannerTimeout`           | number   | `10000` | Maximum time (ms) to spend handling banners    |
| `customBannerSelectors`   | string[] | `[]`    | Custom CSS selectors for site-specific banners |
| `injectBannerBlockingCSS` | boolean  | `false` | Inject CSS to hide common banner containers    |

## Usage Examples

### Basic Usage (Default Behavior)

```bash
# Banner handling is enabled by default
curl -X POST "http://localhost:3000/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Disable Banner Handling

```bash
curl -X POST "http://localhost:3000/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "handleBanners": false
  }'
```

### Custom Banner Selectors

```bash
curl -X POST "http://localhost:3000/api/v1/screenshot" \
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

### With CSS Banner Blocking

```bash
curl -X POST "http://localhost:3000/api/v1/screenshot" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "injectBannerBlockingCSS": true,
    "bannerTimeout": 15000
  }'
```

### GET Request with Banner Options

```bash
curl "http://localhost:3000/api/v1/screenshot?url=https://example.com&handleBanners=true&bannerTimeout=5000" \
  -H "X-API-Key: your-api-key"
```

## How It Works

### Detection Process

1. **Page Load**: Wait for initial page load completion
2. **Dynamic Content**: Allow time for dynamic content and banners to appear
3. **Pattern Matching**: Scan for known banner patterns using CSS selectors
4. **Visibility Check**: Verify elements are actually visible on screen
5. **Interaction**: Click accept buttons or remove banner elements
6. **Stabilization**: Wait for page to stabilize after banner removal
7. **Screenshot**: Capture the clean page content

### Banner Patterns

The system uses sophisticated pattern matching including:

- Element IDs and classes containing keywords like "accept", "cookie", "consent"
- Text content matching in multiple languages
- ARIA labels and data attributes
- Site-specific selectors (YouTube, etc.)

### Fallback Mechanisms

- If banner handling fails, screenshot continues normally
- Multiple detection attempts with timeouts
- Graceful degradation for unknown banner types
- CSS injection as backup for stubborn banners

## Troubleshooting

### Common Issues

**Banner not detected:**

- Add custom selectors for site-specific banners
- Increase `bannerTimeout` for slow-loading sites
- Enable `injectBannerBlockingCSS` for CSS-based hiding

**Screenshot takes too long:**

- Reduce `bannerTimeout` value
- Disable banner handling for simple sites
- Use `networkidle0` waitUntil condition

**Banner partially visible:**

- Increase wait time after banner handling
- Use custom selectors for better targeting
- Enable CSS injection for additional hiding

### Debugging

Enable detailed logging by checking server console output:

```
🔍 Checking for banners and overlays...
✅ Handled banner: Cookie Accept All
🖱️ Clicked banner element: button:contains("Accept all")
🎯 Successfully handled 1 banner(s) in 2341ms
```

## Performance Impact

- **Typical overhead**: 2-5 seconds for banner detection and handling
- **Configurable timeout**: Adjust `bannerTimeout` based on needs
- **Parallel processing**: Banner handling doesn't block other operations
- **Caching**: Browser instances are reused for efficiency

## Best Practices

1. **Use defaults**: Banner handling is optimized for most common cases
2. **Custom selectors**: Add site-specific selectors for better coverage
3. **Timeout tuning**: Balance thoroughness vs. speed based on use case
4. **CSS injection**: Use as last resort for stubborn banners
5. **Testing**: Verify banner handling works for your target sites

## Supported Banner Types

### Cookie Consent

- GDPR compliance banners
- Cookie policy notifications
- Privacy preference centers
- Tracking consent dialogs

### Age Verification

- Adult content warnings
- Age gate modals
- Terms acceptance screens

### Marketing Overlays

- Newsletter signups
- Promotional popups
- Subscription offers
- App download prompts

### Navigation Overlays

- Mobile menu overlays
- Search overlays
- Login/signup modals
- Help/tutorial overlays

## Future Enhancements

- Machine learning-based banner detection
- Additional language support
- Site-specific optimization profiles
- Advanced CSS selector generation
- Banner type classification and reporting
