import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../../exceptions/AppError';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {



  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e: any) => e.message);
    return res.status(422).json({
      error: 'validation error',
      details,
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: `invalid ${err.path}: ${err.value}`,
    });
  }

  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: 'internal server error' });
};
