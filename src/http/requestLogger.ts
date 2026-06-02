import type { NextFunction, Request, Response } from "express";
import { logger } from "../logger";

const SKIPPED_PATHS = new Set(["/health", "/health/simple", "/health/ready", "/ping"]);

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (process.env.HTTP_REQUEST_LOGS === "false" || SKIPPED_PATHS.has(req.path)) {
    return next();
  }

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const details = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    if (res.statusCode >= 500) {
      logger.error("HTTP", "Request completed with server error.", details);
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn("HTTP", "Request completed with client error.", details);
      return;
    }

    logger.info("HTTP", "Request completed successfully.", details);
  });

  return next();
}
