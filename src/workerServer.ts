import "express-async-errors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { connectDB } from "./config/database";
import { closeDatabasePool } from "./db/client";
import { asyncHandler } from "./http/asyncHandler";
import { errorHandler } from "./http/errorHandler";
import { requestLogger } from "./http/requestLogger";
import { logger } from "./logger";
import { startLogForwarding } from "./observability/logForwarder";
import { processNextChatGenerationJob } from "./services/chat/chatService";
import { processNextRagJob } from "./services/rag/ragIngestionWorkerService";
import { getRagHealth } from "./services/rag/ragHealthService";
import { parsePort } from "./config/env";

const SCOPE = "RagWorkerServer";
const DEFAULT_WORKER_PORT = 43188;

const pollMs = Math.max(1000, Number(process.env.RAG_WORKER_POLL_MS || 5000));

const chatWorkerConcurrency = Math.max(
  1,
  Number(process.env.CHAT_WORKER_CONCURRENCY || 5),
);

const workerPort = process.env.RAG_WORKER_PORT
  ? parsePort(process.env.RAG_WORKER_PORT, "RAG_WORKER_PORT")
  : DEFAULT_WORKER_PORT;

type WorkerState = {
  running: boolean;
  shuttingDown: boolean;
  jobsProcessed: number;
  lastError: string | null;
  lastJobAt: Date | null;
};

const workerState: WorkerState = {
  running: false,
  shuttingDown: false,
  jobsProcessed: 0,
  lastError: null,
  lastJobAt: null,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runJobLoop(label: string, processJob: () => Promise<boolean>) {
  while (!workerState.shuttingDown) {
    try {
      const processed = await processJob();
      if (processed) {
        workerState.jobsProcessed += 1;
        workerState.lastJobAt = new Date();
        workerState.lastError = null;
      } else {
        await sleep(pollMs);
      }
    } catch (error) {
      workerState.lastError =
        error instanceof Error ? error.message : String(error);
      logger.error(SCOPE, "Unexpected worker loop error.", {
        label,
        message: workerState.lastError,
      });
      await sleep(pollMs);
    }
  }
}

async function runWorkerLoop() {
  workerState.running = true;
  logger.info(SCOPE, "Worker loops started.", { pollMs, chatWorkerConcurrency });

  // Each loop locks its next job via `FOR UPDATE SKIP LOCKED`, so running
  // several chat loops concurrently lets that many generations run in
  // parallel against the agent pool instead of serializing on one job at a
  // time. RAG ingestion runs in its own loop so a slow document import never
  // blocks chat responses (and vice versa).
  const loops: Promise<void>[] = [];
  for (let index = 0; index < chatWorkerConcurrency; index += 1) {
    loops.push(runJobLoop(`chat-${index + 1}`, processNextChatGenerationJob));
  }
  loops.push(runJobLoop("rag-ingestion", processNextRagJob));

  await Promise.all(loops);

  workerState.running = false;
  logger.info(SCOPE, "Worker loops stopped.");
}

const app = express();

app.use(express.json());
app.use(requestLogger);

app.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const ragHealth = await getRagHealth();
    const degraded =
      ragHealth.chroma === "error" || ragHealth.embeddingProviderStatus === "error";
    return res.status(degraded ? 503 : 200).json({
      status: degraded ? "degraded" : "ok",
      worker: {
        running: workerState.running,
        shuttingDown: workerState.shuttingDown,
        chatWorkerConcurrency,
        jobsProcessed: workerState.jobsProcessed,
        lastError: workerState.lastError,
        lastJobAt: workerState.lastJobAt,
      },
      rag: ragHealth,
    });
  }),
);

app.get("/health/simple", (_req, res) => res.send("OK"));

app.post(
  "/jobs/process",
  asyncHandler(async (_req, res) => {
    logger.info(SCOPE, "Manual job trigger received via API.");
    const processed =
      (await processNextChatGenerationJob()) || (await processNextRagJob());
    if (processed) {
      workerState.jobsProcessed += 1;
      workerState.lastJobAt = new Date();
      workerState.lastError = null;
    }
    return res.json({ processed });
  }),
);

app.use(errorHandler);

async function bootstrap() {
  startLogForwarding();
  logger.info(SCOPE, "Starting RAG Worker Server.");
  logger.info("Database", "Connecting to PostgreSQL.");
  await connectDB();
  logger.info("Database", "PostgreSQL connection established.");

  const server = createServer(app);

  server.listen(workerPort, () => {
    logger.info(SCOPE, "Worker HTTP server is listening.", {
      port: workerPort,
      healthcheck: "/health/simple",
    });
  });

  const loopPromise = runWorkerLoop().catch(async (error) => {
    logger.error(SCOPE, "Fatal worker loop failure.", error);
    await closeDatabasePool();
    process.exit(1);
  });

  async function gracefulShutdown(signal: string) {
    logger.info(SCOPE, `${signal} received. Waiting for current job to finish.`);
    workerState.shuttingDown = true;

    await loopPromise;

    logger.info(SCOPE, "Worker loop drained. Closing server.");
    server.close();
    await closeDatabasePool();
    logger.info(SCOPE, "Shutdown complete.");
    process.exit(0);
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) =>
    logger.error("Process", "Unhandled promise rejection.", reason),
  );
  process.on("uncaughtException", (error) =>
    logger.error("Process", "Uncaught exception.", error),
  );
}

bootstrap().catch(async (error) => {
  logger.error(SCOPE, "Critical startup failure.", error);
  await closeDatabasePool();
  process.exit(1);
});
