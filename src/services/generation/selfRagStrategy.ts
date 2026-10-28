import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { ragDocuments } from "../../db/schema";
import { logger } from "../../logger";
import {
  askOpenRouter,
  type AgentMessage,
} from "../ai/openRouterService";
import {
  generateContextRagResponse,
  streamContextRagResponse,
} from "./contextRagStrategy";
import type {
  GenerationInput,
  GenerationResult,
  GenerationStreamCallbacks,
  RuntimeRagSettings,
} from "./generationTypes";
import { measureChatTiming } from "./generationTypes";
import { generateNoRagResponse, streamNoRagResponse } from "./noRagStrategy";

type SelfRagDecision = {
  needsRetrieval: boolean;
  reason: string;
};

function getSelfDecisionTimeoutMs() {
  const value = Number(process.env.SELF_RAG_DECISION_TIMEOUT_MS || 60_000);
  return Number.isFinite(value) && value > 0 ? value : 60_000;
}

function getSelfDecisionQueueTimeoutMs() {
  const value = Number(process.env.SELF_RAG_DECISION_QUEUE_TIMEOUT_MS || 600_000);
  return Number.isFinite(value) && value > 0 ? value : 600_000;
}

function getSelfFinalAgentTimeoutMs() {
  const value = Number(process.env.SELF_RAG_FINAL_AGENT_TIMEOUT_MS || 180_000);
  return Number.isFinite(value) && value > 0 ? value : 180_000;
}

function getSelfFinalQueueTimeoutMs() {
  const value = Number(process.env.SELF_RAG_FINAL_QUEUE_TIMEOUT_MS || 600_000);
  return Number.isFinite(value) && value > 0 ? value : 600_000;
}

async function hasReadyDocuments(classId: string) {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(ragDocuments)
    .where(
      and(
        eq(ragDocuments.classId, classId),
        eq(ragDocuments.status, "ready"),
        isNull(ragDocuments.deletedAt),
      ),
    );

  return Number(row?.count || 0) > 0;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseDecision(text: string): SelfRagDecision {
  const jsonText = extractJsonObject(text);
  if (!jsonText) throw new Error("decisao self rag sem JSON");

  const parsed = JSON.parse(jsonText);
  if (typeof parsed?.needsRetrieval !== "boolean") {
    throw new Error("decisao self rag sem needsRetrieval boolean");
  }

  return {
    needsRetrieval: parsed.needsRetrieval,
    reason:
      typeof parsed.reason === "string"
        ? parsed.reason.trim().slice(0, 300)
        : "",
  };
}

function compactHistory(history: AgentMessage[]) {
  return history
    .slice(-6)
    .map((message) => `${message.role}: ${message.content.slice(0, 500)}`)
    .join("\n");
}

async function decideSelfRag(input: {
  message: string;
  history: AgentMessage[];
  hasReadyDocuments: boolean;
  timings?: GenerationInput["timings"];
}) {
  const response = await measureChatTiming(input.timings, "agent/self decision", () =>
    askOpenRouter([
      {
        role: "system",
        content: `Voce decide se um chat educacional deve buscar materiais da turma antes de responder.

Responda somente JSON valido, sem markdown, no formato:
{"needsRetrieval":true,"reason":"motivo curto"}

Use needsRetrieval=true quando a pergunta depender de conteudo de aula, documentos da turma, material enviado, definicoes especificas, exercicios, exemplos ou explicacoes do curso.
Use needsRetrieval=false quando for saudacao, conversa casual, pedido administrativo, ou pergunta geral que nao depende dos materiais da turma.
Se nao houver documentos prontos, use needsRetrieval=false.`,
      },
      {
        role: "user",
        content: `Documentos prontos na turma: ${
          input.hasReadyDocuments ? "sim" : "nao"
        }

Historico recente:
${compactHistory(input.history) || "(sem historico)"}

Pergunta atual:
${input.message}`,
      },
    ], {
      includeChatPrompt: false,
      timeoutMs: getSelfDecisionTimeoutMs(),
      queueTimeoutMs: getSelfDecisionQueueTimeoutMs(),
    }),
  );

  if (!response?.text) throw new Error("Agent nao retornou decisao self rag");
  return parseDecision(response.text);
}

export async function generateSelfRagResponse(
  input: GenerationInput & { settings: RuntimeRagSettings },
): Promise<GenerationResult> {
  const readyDocuments = await hasReadyDocuments(input.settings.classId);
  let decision: SelfRagDecision | null = null;

  // Without ready documents the routing below always falls through to
  // no-retrieval regardless of what the decision agent answers (it's even
  // instructed to return needsRetrieval=false in that case), so the decision
  // round-trip is pure wasted latency — skip it and go straight to no-RAG.
  if (readyDocuments) {
    try {
      decision = await decideSelfRag({
        message: input.message,
        history: input.history,
        hasReadyDocuments: readyDocuments,
        timings: input.timings,
      });
    } catch (error) {
      logger.warn("SelfRAG", "Decision failed; using safe fallback.", {
        classId: input.settings.classId,
        fallback: "context",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const shouldRetrieve = decision?.needsRetrieval ?? readyDocuments;

  logger.info("SelfRAG", "Decision completed.", {
    classId: input.settings.classId,
    needsRetrieval: shouldRetrieve,
    hasReadyDocuments: readyDocuments,
    reason: decision?.reason || null,
  });

  if (shouldRetrieve && readyDocuments) {
    logger.info("SelfRAG", "Routing to context retrieval.", {
      classId: input.settings.classId,
      reason: decision?.reason || null,
    });
    const result = await generateContextRagResponse({
      ...input,
      agentTimeoutMs: getSelfFinalAgentTimeoutMs(),
      agentQueueTimeoutMs: getSelfFinalQueueTimeoutMs(),
      agentTimingStage: "agent/self final",
    });
    return {
      ...result,
      provider: result.provider === "rag-context-empty" ? result.provider : `self-rag:${result.provider}`,
    };
  }

  const noRetrievalReason = shouldRetrieve && !readyDocuments ? "no_ready_documents" : "not_needed";
  logger.info("SelfRAG", "Routing to no-retrieval.", {
    classId: input.settings.classId,
    reason: noRetrievalReason,
    decisionReason: decision?.reason || null,
  });
  const result = await generateNoRagResponse({
    ...input,
    agentTimeoutMs: getSelfFinalAgentTimeoutMs(),
    agentQueueTimeoutMs: getSelfFinalQueueTimeoutMs(),
    agentTimingStage: "agent/self final",
  });
  return {
    ...result,
    provider: `self-rag:${result.provider}`,
  };
}

export async function streamSelfRagResponse(
  input: GenerationInput & { settings: RuntimeRagSettings },
  callbacks: GenerationStreamCallbacks = {},
): Promise<GenerationResult> {
  const readyDocuments = await hasReadyDocuments(input.settings.classId);
  let decision: SelfRagDecision | null = null;

  if (readyDocuments) {
    try {
      decision = await decideSelfRag({
        message: input.message,
        history: input.history,
        hasReadyDocuments: readyDocuments,
        timings: input.timings,
      });
    } catch (error) {
      logger.warn("SelfRAG", "Decision failed; using safe streaming fallback.", {
        classId: input.settings.classId,
        fallback: "context",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const shouldRetrieve = decision?.needsRetrieval ?? readyDocuments;

  logger.info("SelfRAG", "Streaming decision completed.", {
    classId: input.settings.classId,
    needsRetrieval: shouldRetrieve,
    hasReadyDocuments: readyDocuments,
    reason: decision?.reason || null,
  });

  if (shouldRetrieve && readyDocuments) {
    const result = await streamContextRagResponse(
      {
        ...input,
        agentTimeoutMs: getSelfFinalAgentTimeoutMs(),
        agentQueueTimeoutMs: getSelfFinalQueueTimeoutMs(),
        agentTimingStage: "agent/self final",
      },
      callbacks,
    );
    return {
      ...result,
      provider:
        result.provider === "rag-context-empty"
          ? result.provider
          : `self-rag:${result.provider}`,
    };
  }

  const result = await streamNoRagResponse(
    {
      ...input,
      agentTimeoutMs: getSelfFinalAgentTimeoutMs(),
      agentQueueTimeoutMs: getSelfFinalQueueTimeoutMs(),
      agentTimingStage: "agent/self final",
    },
    callbacks,
  );
  return {
    ...result,
    provider: `self-rag:${result.provider}`,
  };
}
