import type { NextFunction, Request, Response } from "express";
import { AppError } from "../exceptions/AppError";
import { getAllowedOrigins } from "./cors";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, message: err.message });
  }

  if (err instanceof Error && err.message.toLowerCase().includes("not allowed by cors")) {
    return res.status(403).json({
      error: "Access denied by CORS",
      origin: req.headers.origin,
      allowedOrigins: getAllowedOrigins(),
      timestamp: new Date().toISOString(),
    });
  }

  if (err instanceof Error) {
    return res.status(400).json({ error: err.message, message: err.message });
  }

  return res.status(500).json({ error: "Internal server error", message: "Internal server error" });
}
