import type { Request, Response, NextFunction } from "express";
import { applyPreferredLanguage, getLanguage, negotiateLanguage, normalizeLanguage, withRequestLanguage } from ".";

export function languageMiddleware(req: Request, res: Response, next: NextFunction) {
  const browserLanguage = negotiateLanguage(req.get("Accept-Language"));
  const explicit = normalizeLanguage(req.get("X-Language"));
  const language = explicit || browserLanguage;
  req.language = language;
  res.setHeader("Content-Language", language);
  if (!req.path.startsWith("/health")) {
    res.vary("Accept-Language");
    res.vary("X-Language");
  }
  withRequestLanguage(language, browserLanguage, Boolean(explicit), next);
}

export function accountLanguage(req: Request, res: Response, preference: unknown) {
  applyPreferredLanguage(preference);
  req.language = getLanguage();
  res.setHeader("Content-Language", req.language);
  res.vary("Cookie");
}
