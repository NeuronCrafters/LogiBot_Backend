import { t } from "../i18n";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../exceptions/AppError";
import { logger } from "../logger";
import { getAllowedOrigins } from "./cors";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.code ? t(err.code, err.params, req.language) : err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }

  if (
    err instanceof Error &&
    err.message.toLowerCase().includes("not allowed by cors")
  ) {
    return res.status(403).json({
      error: t("common.corsDenied", {}, req.language),
      origin: req.headers.origin,
      allowedOrigins: getAllowedOrigins(),
      timestamp: new Date().toISOString(),
    });
  }

  logger.error("HTTP", "Unhandled error.", {
    method: req.method,
    path: req.path,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return res.status(500).json({ message: t("common.internalError", {}, req.language) });
}
