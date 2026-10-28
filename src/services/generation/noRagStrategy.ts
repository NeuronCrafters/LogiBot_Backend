import { t } from "../../i18n";
import { logger } from "../../logger";
import {
  askOpenRouter,
  streamOpenRouter,
} from "../ai/openRouterService";
import type { AgentMessage } from "../ai/openRouterService";
import {
  measureChatTiming,
  type GenerationInput,
  type GenerationResult,
  type GenerationStreamCallbacks,
} from "./generationTypes";

function buildMessages(input: GenerationInput): AgentMessage[] {
  const professorInstruction = input.settings?.systemPrompt;
  if (!professorInstruction) return input.history;
  return [{ role: "system", content: professorInstruction }, ...input.history];
}

export async function generateNoRagResponse(
  input: GenerationInput,
): Promise<GenerationResult> {
  logger.info("NoRAG", "Generating response without retrieval.", {
    classId: input.settings?.classId ?? null,
  });

  const agentResponse = await measureChatTiming(
    input.timings,
    input.agentTimingStage || "agent",
    () =>
      askOpenRouter(buildMessages(input), {
        timeoutMs: input.agentTimeoutMs,
        queueTimeoutMs: input.agentQueueTimeoutMs,
      }),
  );

  return {
    text: agentResponse?.text ?? t("chat.fallback"),
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks: [],
  };
}

export async function streamNoRagResponse(
  input: GenerationInput,
  callbacks: GenerationStreamCallbacks = {},
): Promise<GenerationResult> {
  logger.info("NoRAG", "Streaming response without retrieval.", {
    classId: input.settings?.classId ?? null,
  });

  await callbacks.onStatus?.("agent");

  const agentResponse = await measureChatTiming(
    input.timings,
    input.agentTimingStage || "agent",
    () =>
      streamOpenRouter(buildMessages(input), {
        signal: callbacks.signal,
        onToken: callbacks.onToken,
        timeoutMs: input.agentTimeoutMs,
        queueTimeoutMs: input.agentQueueTimeoutMs,
      }),
  );

  return {
    text: agentResponse?.text ?? t("chat.fallback"),
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks: [],
    usage: agentResponse?.usage,
  };
}
