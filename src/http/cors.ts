import type { CorsOptions } from "cors";
import type { NextFunction, Request, Response } from "express";

export function getAllowedOrigins() {
  return [
    "https://saellogibot.com",
    "https://www.saellogibot.com",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3004",
    "http://localhost:5173",
    "http://localhost:5174",
    process.env.FRONT_URL,
  ].filter(Boolean) as string[];
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`origin '${origin}' nao permitido pelo cors`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With", "x-api-key", "X-API-Key"],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400,
};

export function corsAccessLogger(req: Request, _res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && !getAllowedOrigins().includes(origin)) {
    console.warn("tentativa de acesso de origin nao autorizado:", {
      origin,
      method: req.method,
      path: req.path,
      userAgent: req.headers["user-agent"],
      ip: req.ip || req.socket.remoteAddress,
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

