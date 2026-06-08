import type { NextFunction, Request, Response } from "express";
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  register,
} from "prom-client";

const DEFAULT_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60,
  120,
];

export type ChatMetricStage =
  | "save_user_message"
  | "topic_count"
  | "load_history"
  | "generate_response"
  | "save_assistant_message"
  | "total";

export type RagMetricStage =
  | "embedding"
  | "chroma_query"
  | "postgres_revalidate"
  | "agent_generation"
  | "total";

collectDefaultMetrics({ prefix: "logibot_" });

const httpRequestsTotal = new Counter({
  name: "logibot_http_requests_total",
  help: "Total HTTP requests handled by the backend.",
  labelNames: ["method", "route", "status_code"] as const,
});

const httpRequestDuration = new Histogram({
  name: "logibot_http_request_duration_seconds",
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: DEFAULT_BUCKETS_SECONDS,
});

const chatStageDuration = new Histogram({
  name: "logibot_chat_stage_duration_seconds",
  help: "Duration of chat pipeline stages in seconds.",
  labelNames: ["stage"] as const,
  buckets: DEFAULT_BUCKETS_SECONDS,
});

const ragStageDuration = new Histogram({
  name: "logibot_rag_stage_duration_seconds",
  help: "Duration of context RAG pipeline stages in seconds.",
  labelNames: ["stage"] as const,
  buckets: DEFAULT_BUCKETS_SECONDS,
});

export const agentRequestDuration = new Histogram({
  name: "logibot_agent_request_duration_seconds",
  help: "DigitalOcean Agent request duration in seconds.",
  labelNames: ["result", "status_code"] as const,
  buckets: DEFAULT_BUCKETS_SECONDS,
});

export const agentRequestsTotal = new Counter({
  name: "logibot_agent_requests_total",
  help: "Total DigitalOcean Agent requests.",
  labelNames: ["result", "status_code"] as const,
});

export const agentInFlight = new Gauge({
  name: "logibot_agent_in_flight",
  help: "DigitalOcean Agent requests currently in flight.",
});

export const agentQueueDepth = new Gauge({
  name: "logibot_agent_queue_depth",
  help: "DigitalOcean Agent requests waiting for an available Agent slot.",
});

export const agentRateLimitLimit = new Gauge({
  name: "logibot_agent_ratelimit_limit",
  help: "Latest DigitalOcean Agent ratelimit-limit header value.",
});

export const agentRateLimitRemaining = new Gauge({
  name: "logibot_agent_ratelimit_remaining",
  help: "Latest DigitalOcean Agent ratelimit-remaining header value.",
});

export const agentRateLimitReset = new Gauge({
  name: "logibot_agent_ratelimit_reset",
  help: "Latest DigitalOcean Agent ratelimit-reset header value.",
});

function isMetricsEnabled() {
  return process.env.METRICS_ENABLED === "true";
}

function getRouteLabel(req: Request) {
  const routePath = req.route?.path;
  if (!routePath) return "unmatched";

  const path =
    typeof routePath === "string" ? routePath : String(routePath || "");
  return `${req.baseUrl || ""}${path}` || "unmatched";
}

function getElapsedSeconds(startedAt: bigint) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
}

function hasValidMetricsAuth(req: Request) {
  const apiKey = process.env.METRICS_API_KEY;
  if (!apiKey) return false;
  const header = req.header("authorization") || "";
  return header === `Bearer ${apiKey}`;
}

export function httpMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, getElapsedSeconds(startedAt));
  });

  return next();
}

export async function metricsHandler(req: Request, res: Response) {
  if (!isMetricsEnabled()) {
    return res.status(404).json({ success: false, message: "not found" });
  }

  if (!process.env.METRICS_API_KEY) {
    return res
      .status(503)
      .json({ success: false, message: "METRICS_API_KEY nao configurado" });
  }

  if (!hasValidMetricsAuth(req)) {
    return res
      .status(401)
      .json({ success: false, message: "metrics auth invalida" });
  }

  res.set("Content-Type", register.contentType);
  return res.send(await register.metrics());
}

export function observeChatStage(stage: ChatMetricStage, startedAt: bigint) {
  chatStageDuration.observe({ stage }, getElapsedSeconds(startedAt));
}

export async function measureChatStage<T>(
  stage: ChatMetricStage,
  fn: () => Promise<T>,
) {
  const startedAt = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    observeChatStage(stage, startedAt);
  }
}

export function observeRagStage(stage: RagMetricStage, startedAt: bigint) {
  ragStageDuration.observe({ stage }, getElapsedSeconds(startedAt));
}

export async function measureRagStage<T>(
  stage: RagMetricStage,
  fn: () => Promise<T>,
) {
  const startedAt = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    observeRagStage(stage, startedAt);
  }
}

export function observeAgentRequest(input: {
  result: string;
  statusCode: string;
  startedAt: bigint;
}) {
  const labels = {
    result: input.result,
    status_code: input.statusCode,
  };
  agentRequestsTotal.inc(labels);
  agentRequestDuration.observe(labels, getElapsedSeconds(input.startedAt));
}
