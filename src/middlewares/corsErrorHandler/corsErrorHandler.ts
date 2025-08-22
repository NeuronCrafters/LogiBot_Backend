import { Request, Response, NextFunction } from 'express';
import { getCorsInfo } from '../../config/cors/ccorsConfig';

/**
 * Middleware especializado para tratamento de erros CORS
 * 
 * Captura erros relacionados a CORS e retorna uma resposta
 * estruturada com informações úteis para debugging.
 */

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
  // Verifica se o erro é relacionado ao CORS
  if (err.message && err.message.includes('não permitido pelo CORS')) {
    console.error('🚫 CORS Error:', {
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
        ? `O origin '${origin}' não está na lista de origins permitidos. Verifique a configuração do CORS.`
        : 'Requisição sem origin. Verifique se está enviando o header Origin corretamente.'
    };

    return;
  }

  // Se não for erro de CORS, passa para o próximo middleware (no caso o corsAcessLogger)
  next(err);
};
