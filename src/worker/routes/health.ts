import { Hono } from "hono";
import { checkDatabase } from "../../db/client";
import { getDb } from "../db/client";
import type { AppBindings } from "../types";

export const healthRoutes = new Hono<AppBindings>();

healthRoutes.get("/health", async (c) => {
  const startedAt = Date.now();
  let database = "unknown";

  try {
    await checkDatabase(getDb(c.env));
    database = "ok";
  } catch {
    database = "error";
  }

  return c.json({
    status: database === "ok" ? "ok" : "degraded",
    runtime: "cloudflare-workers",
    database,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  }, database === "ok" ? 200 : 503);
});

healthRoutes.get("/health/simple", (c) => c.text("OK"));
healthRoutes.get("/health/ready", async (c) => {
  await checkDatabase(getDb(c.env));
  return c.json({ ready: true });
});
healthRoutes.get("/ping", (c) => c.text("pong"));
