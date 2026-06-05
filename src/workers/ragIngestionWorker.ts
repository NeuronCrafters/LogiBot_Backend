import "dotenv/config";
import { closeDatabasePool } from "../db/client";
import { logger } from "../logger";
import { processNextRagJob } from "../services/rag/ragIngestionWorkerService";

const SCOPE = "RagWorker";
const pollMs = Number(process.env.RAG_WORKER_POLL_MS || 5000);
const idleSleepMs = Number.isFinite(pollMs) && pollMs > 0 ? pollMs : 5000;
const once = process.env.RAG_WORKER_ONCE === "true";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let shuttingDown = false;

async function runLoop() {
  logger.info(SCOPE, "RAG ingestion worker started.", {
    pollMs: idleSleepMs,
    once,
  });

  while (!shuttingDown) {
    try {
      const processed = await processNextRagJob();
      if (once) break;
      if (!processed) await sleep(idleSleepMs);
    } catch (error) {
      logger.error(SCOPE, "Unexpected worker loop failure.", {
        message: error instanceof Error ? error.message : String(error),
      });
      if (once) break;
      await sleep(idleSleepMs);
    }
  }

  await closeDatabasePool();
  logger.info(SCOPE, "RAG ingestion worker stopped.");
}

process.on("SIGINT", () => {
  shuttingDown = true;
  logger.info(SCOPE, "SIGINT received. Stopping after current job.");
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  logger.info(SCOPE, "SIGTERM received. Stopping after current job.");
});

runLoop().catch(async (error) => {
  logger.error(SCOPE, "Critical worker failure.", error);
  await closeDatabasePool();
  process.exit(1);
});
