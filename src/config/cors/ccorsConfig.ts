import { CorsOptions } from 'cors';

const getAllowedOrigins = (): string[] => {
  const origins = [
    process.env.FRONT_URL,
    process.env.FRONT_URL_TESTE,
    'https://www.saellogibot.com',
    'https://saellogibot.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
  ].filter(Boolean) as string[];

  return origins;
};

// Função para verificar se um origin é permitido
const isOriginAllowed = (origin: string | undefined, allowedOrigins: string[]): boolean => {
  // Permite requisições sem origin (Postman, apps mobile, etc.)
  if (!origin) {
    console.log('✅ Requisição sem origin permitida');
    return true;
  }

  // Verifica se o origin está na lista permitida
  if (allowedOrigins.includes(origin)) {
    console.log('✅ Origin permitido:', origin);
    return true;
  }

  console.warn('❌ Origin NÃO permitido:', origin);
  console.warn('📋 Origins válidos:', allowedOrigins);
  return false;
};

// Configuração principal do CORS
export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Log de debug
    console.log(`📨 Origin da requisição: ${origin || 'sem origin'}`);

    // Verifica se o origin é permitido
    if (isOriginAllowed(origin, allowedOrigins)) {
      return callback(null, true);
    }

    // Rejeita origins não permitidos
    return callback(new Error(`Origin '${origin}' não permitido pelo CORS`));
  },

  credentials: true, // Permite cookies e headers de autenticação

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "x-api-key",
    "Cache-Control",
    "Pragma"
  ],

  exposedHeaders: [
    "Set-Cookie",
    "Content-Length",
    "Content-Range"
  ],

  preflightContinue: false,
  optionsSuccessStatus: 200, // Para browsers legados
  maxAge: 86400 // Cache preflight por 24 horas
};

// Função utilitária para obter informações sobre CORS
export const getCorsInfo = () => {
  const allowedOrigins = getAllowedOrigins();

  return {
    allowedOrigins,
    totalOrigins: allowedOrigins.length,
    environment: process.env.NODE_ENV || 'development',
    status: 'configured'
  };
};

// Log das configurações CORS na inicialização
export const logCorsConfig = () => {
  const corsInfo = getCorsInfo();

  console.log('🌐 CORS configurado');
  console.log('📍 Origins permitidas:', corsInfo.allowedOrigins);
  console.log(`🔢 Total de origins: ${corsInfo.totalOrigins}`);
  console.log(`🏷️ Ambiente: ${corsInfo.environment}`);
};