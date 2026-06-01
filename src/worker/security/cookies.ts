import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { AppBindings } from "../types";

function isProductionRequest(c: Context<AppBindings>) {
  const origin = c.req.header("origin") || "";
  const host = c.req.header("host") || "";
  return origin.includes("saellogibot.com") || host.includes("saellogibot.com");
}

export function setAuthCookie(c: Context<AppBindings>, token: string) {
  const isProduction = isProductionRequest(c);
  setCookie(c, "token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    maxAge: 60 * 60 * 2,
    domain: isProduction ? c.env.COOKIE_DOMAIN : undefined,
    path: "/",
  });
}

export function clearAuthCookie(c: Context<AppBindings>) {
  deleteCookie(c, "token", {
    domain: isProductionRequest(c) ? c.env.COOKIE_DOMAIN : undefined,
    path: "/",
  });
}
