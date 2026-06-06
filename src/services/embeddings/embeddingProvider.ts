export type EmbeddingResult = {
  model: string | null;
  embeddings: number[][];
  dimensions: number;
  elapsedMs: number;
};

export interface EmbeddingProvider {
  embedTexts(texts: string[], options?: { timeoutMs?: number }): Promise<EmbeddingResult>;
  healthcheck(): Promise<EmbeddingResult>;
}
