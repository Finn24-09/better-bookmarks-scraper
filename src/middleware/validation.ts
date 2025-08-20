import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

export const validateRequest = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      });
      return;
    }

    // Replace request query with validated and sanitized data
    req.query = value;
    next();
  };
};
