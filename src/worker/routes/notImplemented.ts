import { Hono } from "hono";
import type { AppBindings } from "../types";

export const notImplementedRoutes = new Hono<AppBindings>();

const pendingPrefixes = [
  "/password",
  "/admin",
  "/logs",
  "/academic-institution",
  "/dashboard",
  "/feedbacks",
];

for (const prefix of pendingPrefixes) {
  notImplementedRoutes.all(`${prefix}/*`, (c) => c.json({
    success: false,
    message: `rota ${prefix} ainda nao foi portada para o Worker Hono`,
    migrationStatus: "pending",
  }, 501));
  notImplementedRoutes.all(prefix, (c) => c.json({
    success: false,
    message: `rota ${prefix} ainda nao foi portada para o Worker Hono`,
    migrationStatus: "pending",
  }, 501));
}
