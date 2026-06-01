import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { getErrorPayload, HttpError } from "./errors";
import { requireApiKey } from "./http/auth";
import { corsMiddleware } from "./http/cors";
import { academicFiltersRoutes } from "./routes/academicFilters";
import { authRoutes } from "./routes/auth";
import { dashboardRoutes } from "./routes/dashboard";
import { healthRoutes } from "./routes/health";
import { historyRoutes } from "./routes/history";
import { logsRoutes } from "./routes/logs";
import { notImplementedRoutes } from "./routes/notImplemented";
import { quizRoutes } from "./routes/quiz";
import { saelRoutes } from "./routes/sael";
import { useranalysisRoutes } from "./routes/useranalysis";
import type { AppBindings } from "./types";

const app = new Hono<AppBindings>();

app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
});

app.use("*", secureHeaders());
app.use("*", corsMiddleware());
app.use("*", requireApiKey);

app.route("/", healthRoutes);
app.route("/", authRoutes);
app.route("/", quizRoutes);
app.route("/", saelRoutes);
app.route("/", historyRoutes);
app.route("/", useranalysisRoutes);
app.route("/", academicFiltersRoutes);
app.route("/", dashboardRoutes);
app.route("/", logsRoutes);
app.route("/", notImplementedRoutes);

app.notFound((c) => c.json({
  success: false,
  message: "rota nao encontrada",
  requestId: c.get("requestId"),
}, 404));

app.onError((error, c) => {
  const payload = getErrorPayload(error);
  const status = payload.status as 400 | 401 | 403 | 404 | 409 | 500 | 501 | 503;

  if (!(error instanceof HttpError)) {
    console.error("worker error", {
      requestId: c.get("requestId"),
      error,
    });
  }

  return c.json({
    ...payload.body,
    requestId: c.get("requestId"),
  }, status);
});

export default app;
