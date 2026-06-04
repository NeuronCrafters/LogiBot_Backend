import { Router } from "express";
import { checkDatabase } from "../../db/client";
import { asyncHandler } from "../../http/asyncHandler";

export const healthRouter = Router();

healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now();
    let database = "ok";
    try {
      await checkDatabase();
    } catch {
      database = "error";
    }
    return res.status(database === "ok" ? 200 : 503).json({
      status: database === "ok" ? "ok" : "degraded",
      runtime: "node-express",
      database,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  }),
);

healthRouter.get("/simple", (_req, res) => res.send("OK"));
healthRouter.get(
  "/ready",
  asyncHandler(async (_req, res) => {
    await checkDatabase();
    return res.json({ ready: true });
  }),
);
healthRouter.get("/ping", (_req, res) => res.send("pong"));
