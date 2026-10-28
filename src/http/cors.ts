import type { CorsOptions } from "cors";
import type { NextFunction, Request, Response } from "express";
import {
  getAllowedFrontendOrigins,
  getLocalBackendOrigin,
} from "../config/env";
import { logger } from "../logger";

export function getAllowedOrigins() {
  return [...getAllowedFrontendOrigins(), getLocalBackendOrigin()].filter(
    Boolean,
  ) as string[];
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin '${origin}' is not allowed by CORS.`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cookie",
    "X-Requested-With",
    "x-api-key",
    "X-API-Key",
    "Accept-Language",
    "X-Language",
  ],
  exposedHeaders: ["Set-Cookie", "Content-Language"],
  maxAge: 86400,
};

export function corsAccessLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const origin = req.headers.origin;
  if (origin && !getAllowedOrigins().includes(origin)) {
    logger.warn("CORS", "Blocked request from unauthorized origin.", {
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
