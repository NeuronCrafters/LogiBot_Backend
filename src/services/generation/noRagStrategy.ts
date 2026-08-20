import { logger } from "../../logger";
import {
  askDigitalOceanAgent,
  streamDigitalOceanAgent,
} from "../ai/digitalOceanAgentService";
import type { AgentMessage } from "../ai/digitalOceanAgentService";
import {
  measureChatTiming,
  type GenerationInput,
  type GenerationResult,
  type GenerationStreamCallbacks,
} from "./generationTypes";

const FALLBACK_TEXT =
  "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?";

// A identidade/regras fixas do LogiBot vivem no system prompt configurado no
// próprio Agent da DigitalOcean (ver PROMPT_CHAT.md). Aqui só enviamos, quando
// existir, a instrução extra que o professor configurou para a turma.
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
      askDigitalOceanAgent(buildMessages(input), {
        timeoutMs: input.agentTimeoutMs,
        queueTimeoutMs: input.agentQueueTimeoutMs,
      }),
  );

  return {
    text: agentResponse?.text ?? FALLBACK_TEXT,
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
      streamDigitalOceanAgent(buildMessages(input), {
        signal: callbacks.signal,
        onToken: callbacks.onToken,
        timeoutMs: input.agentTimeoutMs,
        queueTimeoutMs: input.agentQueueTimeoutMs,
      }),
  );

  return {
    text: agentResponse?.text ?? FALLBACK_TEXT,
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks: [],
    usage: agentResponse?.usage,
  };
}
