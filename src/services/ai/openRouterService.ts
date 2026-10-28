import axios from "axios";
import { logger } from "../../logger";
import { isRetryableAgentError, withAgentRetry } from "../../utils/agentRetry";

import { StringDecoder } from "string_decoder";
import {
  assertOpenRouterSuccess,
  getOpenRouterConfig,
  prepareOpenRouterMessages,
  type AgentMessage,
} from "./openRouterConfig";
export type { AgentMessage } from "./openRouterConfig";

type AgentResponse = {
  text: string;
  provider: "openrouter";
  usage?: unknown;
};

type AgentTarget = {
  id: string;
  endpoint: string;
  accessKey: string;
  model: string;
};

type AgentSlot = {
  target: AgentTarget;
  queuedMs: number;
  release: () => void;
};

type QueuedAgentRequest = {
  enqueuedAt: number;
  resolve: (slot: AgentSlot) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  cleanup: () => void;
};

type AgentRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  queueTimeoutMs?: number;
  includeChatPrompt?: boolean;
};

type StreamAgentOptions = AgentRequestOptions & {
  onToken?: (text: string) => void | Promise<void>;
};

const agentInFlightById = new Map<string, number>();
const agentQueue: QueuedAgentRequest[] = [];
let agentCursor = 0;

function getAgentTargets(): AgentTarget[] {
  const config = getOpenRouterConfig();
  return config ? [{ id: "openrouter", ...config }] : [];
}

function getMaxConcurrencyPerAgent() {
  const value = Number(process.env.OPENROUTER_MAX_CONCURRENCY || 5);
  return Number.isInteger(value) && value > 0 ? value : 5;
}

function getMaxQueueSize() {
  const value = Number(process.env.OPENROUTER_QUEUE_MAX_SIZE || 100);
  return Number.isInteger(value) && value >= 0 ? value : 100;
}

function getQueueTimeoutMs() {
  const value = Number(process.env.OPENROUTER_QUEUE_TIMEOUT_MS || 600_000);
  return Number.isFinite(value) && value > 0 ? value : 600_000;
}

function getAgentInFlightCount(agentId: string) {
  return agentInFlightById.get(agentId) || 0;
}

function incrementAgentInFlightCount(agentId: string) {
  agentInFlightById.set(agentId, getAgentInFlightCount(agentId) + 1);
}

function decrementAgentInFlightCount(agentId: string) {
  const next = Math.max(0, getAgentInFlightCount(agentId) - 1);
  if (next === 0) {
    agentInFlightById.delete(agentId);
    return;
  }
  agentInFlightById.set(agentId, next);
}

function pickAgentTarget(
  targets: AgentTarget[],
  options?: { requireCapacity?: boolean },
) {
  if (!targets.length) return null;
  const maxConcurrency = getMaxConcurrencyPerAgent();

  const start = agentCursor % targets.length;
  let selected: AgentTarget | null = null;

  for (let offset = 0; offset < targets.length; offset += 1) {
    const candidate = targets[(start + offset) % targets.length];
    const candidateLoad = getAgentInFlightCount(candidate.id);
    if (options?.requireCapacity && candidateLoad >= maxConcurrency) continue;
    if (!selected || candidateLoad < getAgentInFlightCount(selected.id)) {
      selected = candidate;
    }
  }

  if (!selected) return null;

  agentCursor = (targets.findIndex((target) => target.id === selected.id) + 1) %
    targets.length;

  return selected;
}

function reserveAgentSlot(target: AgentTarget, queuedMs: number): AgentSlot {
  incrementAgentInFlightCount(target.id);
  return {
    target,
    queuedMs,
    release: () => releaseAgentSlot(target.id),
  };
}

function dispatchAgentQueue() {
  while (agentQueue.length) {
    const target = pickAgentTarget(getAgentTargets(), { requireCapacity: true });
    if (!target) return;

    const queued = agentQueue.shift()!;
    clearTimeout(queued.timer);
    queued.cleanup();

    const queuedMs = Date.now() - queued.enqueuedAt;
    logger.info("OpenRouter", "Dequeued Agent request.", {
      agentId: target.id,
      queuedMs,
      queueDepth: agentQueue.length,
    });

    queued.resolve(reserveAgentSlot(target, queuedMs));
  }
}

function releaseAgentSlot(agentId: string) {
  decrementAgentInFlightCount(agentId);
  dispatchAgentQueue();
}

async function acquireAgentSlot(
  targets: AgentTarget[],
  options?: { queueTimeoutMs?: number; signal?: AbortSignal },
): Promise<AgentSlot> {
  options?.signal?.throwIfAborted();
  const target = pickAgentTarget(targets, { requireCapacity: true });
  if (target) return reserveAgentSlot(target, 0);

  if (agentQueue.length >= getMaxQueueSize()) {
    throw new Error("fila de Agents cheia");
  }

  return new Promise((resolve, reject) => {
    const enqueuedAt = Date.now();
    const timer = setTimeout(() => {
      const index = agentQueue.findIndex((item) => item.timer === timer);
      if (index >= 0) agentQueue.splice(index, 1);
      cleanup();
      reject(new Error("tempo maximo na fila de Agents excedido"));
    }, options?.queueTimeoutMs ?? getQueueTimeoutMs());

    const onAbort = () => {
      const index = agentQueue.findIndex((item) => item.timer === timer);
      if (index >= 0) agentQueue.splice(index, 1);
      clearTimeout(timer);
      cleanup();
      reject(options.signal.reason);
    };
    const cleanup = () => options?.signal?.removeEventListener("abort", onAbort);
    options?.signal?.addEventListener("abort", onAbort, { once: true });
    agentQueue.push({ enqueuedAt, resolve, reject, timer, cleanup });

    logger.info("OpenRouter", "Queued Agent request.", {
      queuePosition: agentQueue.length,
      queueDepth: agentQueue.length,
      configuredAgents: targets.length,
      concurrencyPerAgent: getMaxConcurrencyPerAgent(),
    });
  });
}

function getTimeoutMs() {
  const value = Number(process.env.OPENROUTER_TIMEOUT_MS || 180_000);
  const configured = Number.isFinite(value) && value > 0 ? value : 180_000;
  const cap = Number(process.env.OPENROUTER_TIMEOUT_CAP_MS || 300_000);
  const timeoutCap = Number.isFinite(cap) && cap > 0 ? cap : 300_000;
  return Math.min(configured, timeoutCap);
}

export function isOpenRouterConfigured() {
  return getAgentTargets().length > 0;
}

function extractResponseText(data: any) {
  const text =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.message?.content ||
    data?.answer ||
    data?.response;

  return typeof text === "string" ? text.trim() : "";
}

function extractStreamDelta(data: any) {
  const delta =
    data?.choices?.[0]?.delta?.content ??
    data?.choices?.[0]?.text ??
    data?.delta?.content ??
    data?.message?.content;

  return typeof delta === "string" ? delta : "";
}

function parseSsePayloads(buffer: string) {
  const payloads: string[] = [];
  let remaining = buffer;

  for (;;) {
    const separatorIndex = remaining.search(/\r?\n\r?\n/);
    if (separatorIndex < 0) break;

    const rawEvent = remaining.slice(0, separatorIndex);
    const match = remaining.slice(separatorIndex).match(/^\r?\n\r?\n/);
    remaining = remaining.slice(separatorIndex + (match?.[0].length || 2));

    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();

    if (data) payloads.push(data);
  }

  return { payloads, remaining };
}

export async function askOpenRouter(
  messages: AgentMessage[],
  options?: AgentRequestOptions,
): Promise<AgentResponse | null> {
  const targets = getAgentTargets();

  if (!targets.length) return null;

  const preparedMessages = options?.includeChatPrompt === false
    ? messages
    : prepareOpenRouterMessages("chat", messages);
  const timeout = Math.min(options?.timeoutMs ?? getTimeoutMs(), getTimeoutMs());
  let slot: AgentSlot;
  try {
    slot = await acquireAgentSlot(targets, {
      queueTimeoutMs: options?.queueTimeoutMs,
      signal: options?.signal,
    });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    logger.warn("OpenRouter", "Agent request rejected before provider call.", {
      message: error instanceof Error ? error.message : String(error),
      queueDepth: agentQueue.length,
      configuredAgents: targets.length,
    });
    return null;
  }

  const target = slot.target;

  try {
    // Retenta a requisição dentro do mesmo slot (sem re-enfileirar) para
    // absorver falhas transitórias de rede, limite de taxa e indisponibilidade.
    const response = await withAgentRetry(
      async () => {
        const response = await axios.post(
          target.endpoint,
          { model: target.model, messages: preparedMessages },
          {
            headers: {
              Authorization: `Bearer ${target.accessKey}`,
              "Content-Type": "application/json",
            },
            timeout,
            signal: options?.signal,
          },
        );
        assertOpenRouterSuccess(response.data);
        return response;
      },
      {
        signal: options?.signal,
        onRetry: ({ attempt, error }) => {
          logger.warn("OpenRouter", "Tentativa falhou, retentando...", {
            agentId: target.id,
            attempt,
            status: error?.response?.status,
            message: error?.response?.data?.message || error?.message,
          });
        },
      },
    );

    const text = extractResponseText(response.data);
    if (!text) {
      logger.warn("OpenRouter", "Agent response did not include text.");
      return null;
    }

    logger.info("OpenRouter", "Agent responded.", {
      agentId: target.id,
      queuedMs: slot.queuedMs,
      model: response.data?.model,
      promptTokens: response.data?.usage?.prompt_tokens,
      completionTokens: response.data?.usage?.completion_tokens,
    });
    return { text, provider: "openrouter" };
  } catch (error: any) {
    if (options?.signal?.aborted) throw error;
    const status = error?.response?.status;
    logger.error("OpenRouter", "Failed to call OpenRouter.", {
      agentId: target.id,
      queuedMs: slot.queuedMs,
      status,
      message: error?.response?.data?.message || error?.message,
      responseData: error?.response?.data?.error?.message,
    });
    return null;
  } finally {
    slot.release();
  }
}

export async function streamOpenRouter(
  messages: AgentMessage[],
  options: StreamAgentOptions = {},
): Promise<AgentResponse | null> {
  const targets = getAgentTargets();

  if (!targets.length) return null;

  const preparedMessages = options?.includeChatPrompt === false
    ? messages
    : prepareOpenRouterMessages("chat", messages);
  const timeout = Math.min(options.timeoutMs ?? getTimeoutMs(), getTimeoutMs());
  let slot: AgentSlot;
  try {
    slot = await acquireAgentSlot(targets, {
      queueTimeoutMs: options.queueTimeoutMs,
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    logger.warn("OpenRouter", "Streaming Agent request rejected before provider call.", {
      message: error instanceof Error ? error.message : String(error),
      queueDepth: agentQueue.length,
      configuredAgents: targets.length,
    });
    return null;
  }

  const target = slot.target;
  // Uma vez que tokens já foram enviados ao cliente não dá para reiniciar o
  // stream; o retry só é permitido antes do primeiro token.
  let emittedTokens = false;

  try {
    return await withAgentRetry(
      async () => {
        let text = "";
        let usage: unknown;
        let buffer = "";
        const decoder = new StringDecoder("utf8");
        let completed = false;
        let tokenCount = 0;
        const providerStartedAt = Date.now();

        const response = await axios.post(
          target.endpoint,
          {
            model: target.model,
            messages: preparedMessages,
            stream: true,
            stream_options: { include_usage: true },
          },
          {
            headers: {
              Authorization: `Bearer ${target.accessKey}`,
              Accept: "text/event-stream",
              "Content-Type": "application/json",
            },
            responseType: "stream",
            timeout,
            signal: options.signal,
          },
        );

        for await (const chunk of response.data as AsyncIterable<Buffer | string>) {
          buffer += Buffer.isBuffer(chunk) ? decoder.write(chunk) : chunk;
          const parsed = parseSsePayloads(buffer);
          buffer = parsed.remaining;

          for (const payload of parsed.payloads) {
            if (payload === "[DONE]") {
              completed = true;
              continue;
            }

            let data: any;
            try {
              data = JSON.parse(payload);
            } catch {
              continue;
            }

            assertOpenRouterSuccess(data);
            if (data?.usage) usage = data.usage;

            const delta = extractStreamDelta(data);
            if (!delta) continue;

            text += delta;
            tokenCount += 1;
            if (tokenCount === 1) {
              emittedTokens = true;
              logger.info("OpenRouter", "Streaming Agent first token received.", {
                agentId: target.id,
                queuedMs: slot.queuedMs,
                elapsedMs: Date.now() - providerStartedAt,
              });
            }
            await options.onToken?.(delta);
          }
        }

        if (!completed) {
          throw Object.assign(new Error("Stream da OpenRouter encerrado antes de [DONE]."), {
            response: { status: 502 },
          });
        }
        const finalText = text.trim();
        if (!finalText) {
          logger.warn("OpenRouter", "Streaming Agent response did not include text.", {
            agentId: target.id,
            queuedMs: slot.queuedMs,
          });
          return null;
        }

        logger.info("OpenRouter", "Streaming Agent responded.", {
          agentId: target.id,
          queuedMs: slot.queuedMs,
          tokenCount,
          usage,
        });

        return { text: finalText, provider: "openrouter", usage };
      },
      {
        signal: options.signal,
        isRetryable: (error) =>
          !emittedTokens &&
          !options.signal?.aborted &&
          isRetryableAgentError(error),
        onRetry: ({ attempt, error }) => {
          logger.warn("OpenRouter", "Streaming: tentativa falhou, retentando...", {
            agentId: target.id,
            attempt,
            status: error?.response?.status,
            message: error?.response?.data?.message || error?.message,
          });
        },
      },
    );
  } catch (error: any) {
    if (options.signal?.aborted || error?.name === "CanceledError" || error?.code === "ERR_CANCELED") {
      logger.warn("OpenRouter", "Streaming Agent request aborted.", {
        agentId: target.id,
        queuedMs: slot.queuedMs,
      });
      throw error;
    }

    if (emittedTokens) throw error;

    const status = error?.response?.status;
    logger.error("OpenRouter", "Failed to stream OpenRouter.", {
      agentId: target.id,
      queuedMs: slot.queuedMs,
      status,
      message: error?.response?.data?.message || error?.message,
      responseData: error?.response?.data?.error?.message,
    });
    return null;
  } finally {
    slot.release();
  }
}
