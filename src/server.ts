import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { screenshotRouter } from './routes/screenshot';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { BrowserManager } from './services/BrowserManager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for error pages
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Compression for better performance
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/health', healthRouter);
app.use('/api/v1/screenshot', screenshotRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Screenshot API',
    version: '1.0.0',
    description: 'Fast, lightweight screenshot API service optimized for Google Cloud Run',
    endpoints: {
      health: '/health',
      screenshot: '/api/v1/screenshot',
    },
    documentation: 'https://github.com/your-repo/screenshot-api#readme',
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist.`,
  });
});

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Screenshot API server running on port ${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  console.log(`📸 Screenshot endpoint at http://localhost:${PORT}/api/v1/screenshot`);
});

// Initialize browser manager for warm-up
BrowserManager.getInstance().warmUp().catch(console.error);

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  server.close(async () => {
    console.log('📴 HTTP server closed');
    
    try {
      await BrowserManager.getInstance().cleanup();
      console.log('🧹 Browser cleanup completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      process.exit(1);
    }
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  
  server.close(async () => {
    console.log('📴 HTTP server closed');
    
    try {
      await BrowserManager.getInstance().cleanup();
      console.log('🧹 Browser cleanup completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      process.exit(1);
    }
  });
});

export default app;
