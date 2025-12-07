import { Request, Response, NextFunction } from "express";

export function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    return next();
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      message: "api key inválida"
    });
  }

  next();
}