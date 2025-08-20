import { Router, Request, Response } from 'express';
import { BrowserManager } from '../services/BrowserManager';

const router = Router();

// GET /health
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const browserManager = BrowserManager.getInstance();
    const browserStatus = await browserManager.getStatus();
    
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      browser: browserStatus,
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
        external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
    };

    res.status(200).json(healthCheck);
  } catch (error: any) {
    const healthCheck = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      error: error.message,
      browser: {
        isConnected: false,
      },
    };

    res.status(503).json(healthCheck);
  }
});

// GET /health/ready
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const browserManager = BrowserManager.getInstance();
    const browserStatus = await browserManager.getStatus();
    
    if (browserStatus.isConnected) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        browser: browserStatus,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        message: 'Browser is not ready',
        browser: browserStatus,
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      message: error.message,
      browser: {
        isConnected: false,
      },
    });
  }
});

// GET /health/live
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export { router as healthRouter };
