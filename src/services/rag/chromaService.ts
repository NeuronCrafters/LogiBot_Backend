import { ChromaClient } from "chromadb";
import { logger } from "../../logger";
import { currentEnvironment } from "../../db/environment";

const DEFAULT_CHROMA_COLLECTION = "logibots_rag_chunks";

function parseChromaUrl() {
  const rawUrl = process.env.CHROMA_URL?.trim();
  if (!rawUrl) return null;

  const url = new URL(rawUrl);
  return {
    rawUrl,
    host: url.hostname,
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    ssl: url.protocol === "https:",
  };
}

/** The test environment keeps its vectors in a collection of its own, so they never mix with real material. */
export function getChromaCollectionName() {
  const base = process.env.CHROMA_COLLECTION?.trim() || DEFAULT_CHROMA_COLLECTION;
  return currentEnvironment() === "sandbox" ? `${base}_sandbox` : base;
}

/** Drops the test environment's collection (used when the test database is reset). Never touches the real one. */
export async function dropSandboxCollection(): Promise<boolean> {
  const client = getChromaClient();
  if (!client || currentEnvironment() !== "sandbox") return false;
  const name = getChromaCollectionName();
  try {
    await client.deleteCollection({ name });
    return true;
  } catch (error) {
    // A missing collection is fine: nothing was indexed in the test environment yet.
    logger.warn("Chroma", "Sandbox collection not dropped.", { collection: name, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export function isChromaConfigured() {
  return Boolean(parseChromaUrl());
}

export function getChromaClient() {
  const config = parseChromaUrl();
  if (!config) return null;

  return new ChromaClient({
    host: config.host,
    port: config.port,
    ssl: config.ssl,
  });
}

export async function checkChroma() {
  const client = getChromaClient();
  if (!client) {
    return {
      status: "not_configured" as const,
      heartbeat: null,
      url: null,
      collection: getChromaCollectionName(),
    };
  }

  const heartbeat = await client.heartbeat();

  return {
    status: "ok" as const,
    heartbeat,
    url: process.env.CHROMA_URL?.trim() || null,
    collection: getChromaCollectionName(),
  };
}

export async function getOrCreateRagCollection() {
  const client = getChromaClient();
  if (!client) throw new Error("CHROMA_URL nao configurado");

  const collectionName = getChromaCollectionName();
  logger.info("Chroma", "Getting/creating collection.", { collection: collectionName, url: process.env.CHROMA_URL?.trim() });
  return client.getOrCreateCollection({
    name: collectionName,
    metadata: { "hnsw:space": "cosine" },
    embeddingFunction: null,
  });
}
