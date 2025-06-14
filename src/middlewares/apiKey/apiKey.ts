import { Request, Response, NextFunction } from 'express';

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = req.header('x-api-key');
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const API_KEY = process.env.API_KEY;

    if (NODE_ENV === 'production') {
        if (!key || key !== API_KEY) {
            return res.status(403).json({ message: 'Forbidden: Invalid API Key' });
        }
    }

    next();
}
