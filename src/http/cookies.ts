import type { Request, Response } from "express";

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
    maxAge: 1000 * 60 * 60 * 2,
    domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
    path: "/",
  });
}

export function clearAuthCookie(req: Request, res: Response) {
  res.clearCookie("token", {
    domain: isProductionRequest(req) ? process.env.COOKIE_DOMAIN : undefined,
    path: "/",
  });
}

