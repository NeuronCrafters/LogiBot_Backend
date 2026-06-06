import axios from "axios";
import { logger } from "../../logger";

const SCOPE = "RagWorkerClient";

function getWorkerUrl() {
  return process.env.RAG_WORKER_URL?.trim().replace(/\/+$/, "") ?? null;
}

export async function triggerWorkerJob() {
  const workerUrl = getWorkerUrl();
  if (!workerUrl) {
    logger.warn(SCOPE, "RAG_WORKER_URL not configured; skipping trigger.");
    return;
  }

  try {
    await axios.post(`${workerUrl}/jobs/process`, null, { timeout: 5_000 });
    logger.info(SCOPE, "Worker job trigger sent.", { workerUrl });
  } catch (error: any) {
    logger.warn(SCOPE, "Failed to trigger worker job; it will pick up on next poll.", {
      workerUrl,
      status: error?.response?.status,
      message: error?.message,
    });
  }
}
