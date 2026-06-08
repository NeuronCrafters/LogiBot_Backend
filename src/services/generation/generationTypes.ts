import type { AgentMessage } from "../ai/digitalOceanAgentService";
import type { RagMode } from "../rag/ragTypes";

export type ChatTimings = Record<string, number>;

export type RuntimeRagSettings = {
  classId: string;
  ragMode: RagMode;
  topK: number;
  minScore: number;
  systemPrompt: string | null;
};

export type RetrievedRagChunk = {
  chromaId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  score: number;
  content: string;
};

export type GenerationInput = {
  message: string;
  history: AgentMessage[];
  settings?: RuntimeRagSettings | null;
  timings?: ChatTimings;
  agentTimeoutMs?: number;
  agentQueueTimeoutMs?: number;
  agentTimingStage?: string;
};

export type GenerationResult = {
  text: string;
  provider: string;
  retrievedChunks: RetrievedRagChunk[];
  usage?: unknown;
};

export type GenerationStreamCallbacks = {
  signal?: AbortSignal;
  onStatus?: (stage: "history" | "rag" | "agent") => void | Promise<void>;
  onToken?: (text: string) => void | Promise<void>;
  onRetrieval?: (chunks: RetrievedRagChunk[]) => void | Promise<void>;
};

function elapsedMs(startedAt: bigint) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

export function addChatTiming(
  timings: ChatTimings | undefined,
  stage: string,
  startedAt: bigint,
) {
  if (!timings) return;
  timings[stage] = Number(((timings[stage] || 0) + elapsedMs(startedAt)).toFixed(2));
}

export async function measureChatTiming<T>(
  timings: ChatTimings | undefined,
  stage: string,
  fn: () => Promise<T>,
) {
  const startedAt = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    addChatTiming(timings, stage, startedAt);
  }
}
