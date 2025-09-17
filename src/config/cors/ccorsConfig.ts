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

const isOriginAllowed = (origin: string | undefined, allowedOrigins: string[]): boolean => {
  if (!origin) {
    console.log('✅ Requisição sem origin permitida');
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    console.log('✅ Origin permitido:', origin);
    return true;
  }

  console.warn('❌ Origin NÃO permitido:', origin);
  console.warn('📋 Origins válidos:', allowedOrigins);
  return false;
};

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    console.log(`📨 Origin da requisição: ${origin || 'sem origin'}`);

    if (isOriginAllowed(origin, allowedOrigins)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin '${origin}' não permitido pelo CORS`));
  },

  credentials: true,

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
  optionsSuccessStatus: 200, // para browsers legados
  maxAge: 86400 // cache preflight por 24 horas
};

export const getCorsInfo = () => {
  const allowedOrigins = getAllowedOrigins();

  return {
    allowedOrigins,
    totalOrigins: allowedOrigins.length,
    environment: process.env.NODE_ENV || 'development',
    status: 'configured'
  };
};

export const logCorsConfig = () => {
  const corsInfo = getCorsInfo();

  console.log('🌐 CORS configurado');
  console.log('📍 Origins permitidas:', corsInfo.allowedOrigins);
  console.log(`🔢 Total de origins: ${corsInfo.totalOrigins}`);
  console.log(`🏷️ Ambiente: ${corsInfo.environment}`);
};