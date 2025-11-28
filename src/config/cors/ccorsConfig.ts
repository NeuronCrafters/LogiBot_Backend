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

    return true;
  }

  if (allowedOrigins.includes(origin)) {

    return true;
  }



  return false;
};

export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();



    if (isOriginAllowed(origin, allowedOrigins)) {
      return callback(null, true);
    }

    return callback(new Error(`origin '${origin}' não permitido pelo cors`));
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
  optionsSuccessStatus: 200,
  maxAge: 86400
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
};