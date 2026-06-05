import axios from "axios";
import { logger } from "../../logger";
import type { EmbeddingProvider, EmbeddingResult } from "./embeddingProvider";

const DEFAULT_INGESTION_TIMEOUT_MS = 60_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEndpoint() {
  const raw = process.env.EMBEDDING_SERVICE_URL?.trim();

  if (!raw) return null;
  const withoutSlash = raw.replace(/\/+$/, "");
  return withoutSlash.endsWith("/embed") ? withoutSlash : `${withoutSlash}/embed`;
}

function getApiKey() {
  return process.env.EMBEDDING_SERVICE_API_KEY?.trim() || null;
}

function shouldRetry(error: any) {
  const status = error?.response?.status;
  return (
    !status ||
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500)
  );
}

function validateEmbeddings(texts: string[], embeddings: unknown): number[][] {
  if (!Array.isArray(embeddings)) {
    throw new Error("resposta de embeddings invalida");
  }
  if (embeddings.length !== texts.length) {
    throw new Error("quantidade de embeddings diferente da quantidade de textos");
  }

  const dimensions = Array.isArray(embeddings[0]) ? embeddings[0].length : 0;
  if (!dimensions) throw new Error("embedding retornado sem dimensoes");

  for (const vector of embeddings) {
    if (!Array.isArray(vector) || vector.length !== dimensions) {
      throw new Error("embeddings retornados com dimensoes inconsistentes");
    }
    if (vector.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
      throw new Error("embedding retornado contem valores invalidos");
    }
  }

  return embeddings as number[][];
}

export class EmbeddingServiceProvider implements EmbeddingProvider {
  async embedTexts(
    texts: string[],
    options?: { timeoutMs?: number },
  ): Promise<EmbeddingResult> {
    const endpoint = getEndpoint();
    const apiKey = getApiKey();
    if (!endpoint || !apiKey) {
      throw new Error("servico de embeddings nao configurado");
    }

    const normalizedTexts = texts.map((text) => String(text || "").trim());
    if (!normalizedTexts.length || normalizedTexts.some((text) => !text)) {
      throw new Error("texts deve conter pelo menos um texto nao vazio");
    }

    const timeoutMs = options?.timeoutMs || DEFAULT_INGESTION_TIMEOUT_MS;
    let lastError: any;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const startedAt = Date.now();
      try {
        const response = await axios.post(
          endpoint,
          { texts: normalizedTexts },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: timeoutMs,
          },
        );

        const embeddings = validateEmbeddings(
          normalizedTexts,
          response.data?.embeddings,
        );
        const elapsedMs = Date.now() - startedAt;
        const result = {
          model:
            typeof response.data?.model === "string"
              ? response.data.model
              : null,
          embeddings,
          dimensions: embeddings[0].length,
          elapsedMs,
        };

        logger.info("Embeddings", "Embeddings generated.", {
          provider: "embedding-service",
          model: result.model,
          dimensions: result.dimensions,
          textCount: normalizedTexts.length,
          elapsedMs,
        });

        return result;
      } catch (error: any) {
        lastError = error;
        logger.warn("Embeddings", "Embedding request failed.", {
          attempt,
          status: error?.response?.status,
          message: error?.response?.data?.message || error?.message,
        });

        if (attempt >= MAX_ATTEMPTS || !shouldRetry(error)) break;
        await sleep(500 * attempt * attempt);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("falha ao gerar embeddings");
  }

  healthcheck() {
    return this.embedTexts(["healthcheck"], {
      timeoutMs: DEFAULT_HEALTH_TIMEOUT_MS,
    });
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  return new EmbeddingServiceProvider();
}
