import type { AgentMessage } from "../ai/digitalOceanAgentService";
import type { RagMode } from "../rag/ragTypes";

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
};

export type GenerationResult = {
  text: string;
  provider: string;
  retrievedChunks: RetrievedRagChunk[];
};

