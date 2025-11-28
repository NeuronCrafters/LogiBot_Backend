import { Request, Response, NextFunction } from 'express';
import { getCorsInfo } from '../../config/cors/ccorsConfig';

interface CorsErrorResponse {
  error: string;
  origin: string | undefined;
  allowedOrigins: string[];
  timestamp: string;
  help?: string;
}

export const corsErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.message && err.message.includes('não permitido pelo CORS')) {
    console.error('cors error:', {
      message: err.message,
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });

    const corsInfo = getCorsInfo();
    const origin = req.headers.origin;

    const errorResponse: CorsErrorResponse = {
      error: 'Acesso negado pelo CORS',
      origin,
      allowedOrigins: corsInfo.allowedOrigins,
      timestamp: new Date().toISOString(),
      help: origin
        ? `o origin '${origin}' não está na lista de origins permitidos, verifique a configuração do CORS.`
        : 'requisição sem origin, verifique se está enviando o header origin corretamente.'
    };

    return;
  }

  next(err);
};
