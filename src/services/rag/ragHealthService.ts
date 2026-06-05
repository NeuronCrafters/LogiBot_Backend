import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragIngestionJobs } from "../../db/schema";
import { createEmbeddingProvider } from "../embeddings/digitalOceanDropletEmbeddingProvider";
import { checkChroma } from "./chromaService";

async function countJobsByStatus(status: "pending" | "running") {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(ragIngestionJobs)
    .where(eq(ragIngestionJobs.status, status));

  return Number(row?.count || 0);
}

export async function getRagHealth() {
  const embeddingProvider = createEmbeddingProvider();
  const [chromaResult, embeddingResult, pendingJobs, runningJobs] =
    await Promise.allSettled([
    checkChroma(),
    embeddingProvider.healthcheck(),
    countJobsByStatus("pending"),
    countJobsByStatus("running"),
    ]);

  const chroma =
    chromaResult.status === "fulfilled"
      ? chromaResult.value
      : {
          status: "error" as const,
          heartbeat: null,
          url: process.env.CHROMA_URL?.trim() || null,
          collection: process.env.CHROMA_COLLECTION || "logibots_rag_chunks",
          error:
            chromaResult.reason instanceof Error
              ? chromaResult.reason.message
              : "erro ao consultar ChromaDB",
        };

  return {
    chroma: chroma.status,
    chromaDetails: chroma,
    embeddingProvider: "digitalocean-droplet",
    embeddingProviderStatus:
      embeddingResult.status === "fulfilled" ? "ok" : "error",
    embeddingProviderDetails:
      embeddingResult.status === "fulfilled"
        ? {
            model: embeddingResult.value.model,
            dimensions: embeddingResult.value.dimensions,
            elapsedMs: embeddingResult.value.elapsedMs,
          }
        : {
            error:
              embeddingResult.reason instanceof Error
                ? embeddingResult.reason.message
                : "erro ao consultar embeddings",
          },
    pendingJobs:
      pendingJobs.status === "fulfilled" ? pendingJobs.value : null,
    runningJobs:
      runningJobs.status === "fulfilled" ? runningJobs.value : null,
  };
}
