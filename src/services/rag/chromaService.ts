import { ChromaClient } from "chromadb";
import { logger } from "../../logger";

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

export function getChromaCollectionName() {
  return process.env.CHROMA_COLLECTION?.trim() || DEFAULT_CHROMA_COLLECTION;
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
  });
}
