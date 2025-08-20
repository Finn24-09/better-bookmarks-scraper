import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

export const validateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;
  
  // If no API key is required (for development)
  if (!process.env.API_KEY && !process.env.REQUIRE_API_KEY) {
    return next();
  }

  // If API key is required but not provided
  if (!apiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Provide it via X-API-Key header or apiKey query parameter.',
    });
    return;
  }

  // Validate API key
  const validApiKey = process.env.API_KEY;
  if (validApiKey && apiKey !== validApiKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key provided.',
    });
    return;
  }

  // Store API key in request for potential logging
  req.apiKey = apiKey;
  next();
};

export const optionalApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;
  
  if (apiKey) {
    const validApiKey = process.env.API_KEY;
    if (validApiKey && apiKey !== validApiKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key provided.',
      });
      return;
    }
    req.apiKey = apiKey;
  }
  
  next();
};
