import { cors } from "hono/cors";
import type { AppBindings } from "../types";

const staticAllowedOrigins = [
  "https://saellogibot.com",
  "https://www.saellogibot.com",
  "http://localhost:3001",
  "http://localhost:5173",
];

export function corsMiddleware() {
  return cors({
    origin: (origin, c) => {
      const allowedOrigins = new Set(
        [...staticAllowedOrigins, c.env.FRONT_URL].filter(Boolean) as string[],
      );

      if (!origin || allowedOrigins.has(origin)) {
        return origin || c.env.FRONT_URL || "http://localhost:5173";
      }

      return null;
    },
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With", "x-api-key", "X-API-Key"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    exposeHeaders: ["Set-Cookie"],
    credentials: true,
    maxAge: 86400,
  });
}
