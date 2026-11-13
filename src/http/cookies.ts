import { sessionPolicy } from "../config/session";
import type { Request, Response } from "express";
import { AUTH_COOKIE_DOMAIN } from "../config/env";

export function isProductionRequest(req: Request) {
  const origin = req.get("origin") || "";
  const host = req.get("host") || "";
  return origin.includes("saellogibot.com") || host.includes("saellogibot.com");
}

export function setAuthCookie(req: Request, res: Response, token: string) {
  const isProduction = isProductionRequest(req);
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * sessionPolicy().absoluteSeconds,
    domain: isProduction ? AUTH_COOKIE_DOMAIN : undefined,
    path: "/",
  });
}

export function clearAuthCookie(req: Request, res: Response) {
  res.clearCookie("token", {
    domain: isProductionRequest(req) ? AUTH_COOKIE_DOMAIN : undefined,
    path: "/",
  });
}
