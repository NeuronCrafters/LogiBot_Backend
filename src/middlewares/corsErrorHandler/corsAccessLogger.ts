import { Request, Response, NextFunction } from 'express';
import { getCorsInfo } from '../../config/cors/ccorsConfig';

/**
 * Middleware para log detalhado de tentativas de acesso negadas
 */
export const corsAccessLogger = (req: Request, res: Response, next: NextFunction): void => {
  const origin = req.headers.origin;
  const corsInfo = getCorsInfo();

  // Log apenas para origins não permitidos (para monitoramento de segurança)
  if (origin && !corsInfo.allowedOrigins.includes(origin)) {
    console.warn('🔒 Tentativa de acesso de origin não autorizado:', {
      origin,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    });
  }

  next();
};