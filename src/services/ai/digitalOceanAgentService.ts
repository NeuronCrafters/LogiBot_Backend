import axios from "axios";
import { logger } from "../../logger";

type ChatRole = "system" | "user" | "assistant";

function convertSystemMessages(messages: AgentMessage[]): AgentMessage[] {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content);
  const rest = messages.filter((m) => m.role !== "system");

  if (!systemParts.length) return rest;

  const systemText = systemParts.join("\n\n");
  const firstUserIdx = rest.findIndex((m) => m.role === "user");

  if (firstUserIdx === -1) {
    return [{ role: "user", content: systemText }, ...rest];
  }

  const converted = [...rest];
  converted[firstUserIdx] = {
    role: "user",
    content: `${systemText}\n\n${converted[firstUserIdx].content}`,
  };
  return converted;
}

export type AgentMessage = {
  role: ChatRole;
  content: string;
};

type AgentResponse = {
  text: string;
  provider: "digitalocean-agent";
};

type AgentTarget = {
  id: string;
  endpoint: string;
  accessKey: string;
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
};

type AgentRequestOptions = {
  timeoutMs?: number;
  queueTimeoutMs?: number;
};

const MAX_AGENT_TARGETS = 5;
const agentInFlightById = new Map<string, number>();
const agentQueue: QueuedAgentRequest[] = [];
let agentCursor = 0;

function normalizeAgentEndpoint(value?: string) {
  const base = value?.trim().replace(/\/+$/, "");
  if (!base) return undefined;
  return base.endsWith("/chat/completions")
    ? base
    : `${base}/api/v1/chat/completions`;
}

function pushAgentTarget(
  targets: AgentTarget[],
  id: string,
  endpoint?: string,
  accessKey?: string,
) {
  if (targets.length >= MAX_AGENT_TARGETS) return;

  const normalizedEndpoint = normalizeAgentEndpoint(endpoint);
  const normalizedAccessKey = accessKey?.trim();
  if (!normalizedEndpoint || !normalizedAccessKey) return;

  if (targets.some((target) => target.endpoint === normalizedEndpoint)) return;

  targets.push({
    id,
    endpoint: normalizedEndpoint,
    accessKey: normalizedAccessKey,
  });
}

function getAgentTargets() {
  const targets: AgentTarget[] = [];

  for (let index = 1; index <= MAX_AGENT_TARGETS; index += 1) {
    pushAgentTarget(
      targets,
      `agent-${index}`,
      process.env[`DIGITALOCEAN_AGENT_${index}_ENDPOINT`],
      process.env[`DIGITALOCEAN_AGENT_${index}_ACCESS_KEY`],
    );
  }

  return targets;
}

function getMaxConcurrencyPerAgent() {
  const value = Number(process.env.DIGITALOCEAN_AGENT_CONCURRENCY_PER_AGENT || 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function getMaxQueueSize() {
  const value = Number(process.env.DIGITALOCEAN_AGENT_QUEUE_MAX_SIZE || 100);
  return Number.isInteger(value) && value >= 0 ? value : 100;
}

function getQueueTimeoutMs() {
  const value = Number(process.env.DIGITALOCEAN_AGENT_QUEUE_TIMEOUT_MS || 600_000);
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

    const queuedMs = Date.now() - queued.enqueuedAt;
    logger.info("DigitalOceanAgent", "Dequeued Agent request.", {
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
  options?: { queueTimeoutMs?: number },
): Promise<AgentSlot> {
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
      reject(new Error("tempo maximo na fila de Agents excedido"));
    }, options?.queueTimeoutMs ?? getQueueTimeoutMs());

    agentQueue.push({ enqueuedAt, resolve, reject, timer });

    logger.info("DigitalOceanAgent", "Queued Agent request.", {
      queuePosition: agentQueue.length,
      queueDepth: agentQueue.length,
      configuredAgents: targets.length,
      concurrencyPerAgent: getMaxConcurrencyPerAgent(),
    });
  });
}

function getTimeoutMs() {
  const value = Number(process.env.DIGITALOCEAN_AGENT_TIMEOUT_MS || 180_000);
  const configured = Number.isFinite(value) && value > 0 ? value : 180_000;
  const cap = Number(process.env.DIGITALOCEAN_AGENT_TIMEOUT_CAP_MS || 300_000);
  const timeoutCap = Number.isFinite(cap) && cap > 0 ? cap : 300_000;
  return Math.min(configured, timeoutCap);
}

export function isDigitalOceanAgentConfigured() {
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

export async function askDigitalOceanAgent(
  messages: AgentMessage[],
  options?: AgentRequestOptions,
): Promise<AgentResponse | null> {
  const targets = getAgentTargets();

  if (!targets.length) return null;

  const sanitizedMessages = convertSystemMessages(messages);
  const timeout = Math.min(options?.timeoutMs ?? getTimeoutMs(), getTimeoutMs());
  let slot: AgentSlot;
  try {
    slot = await acquireAgentSlot(targets, {
      queueTimeoutMs: options?.queueTimeoutMs,
    });
  } catch (error) {
    logger.warn("DigitalOceanAgent", "Agent request rejected before provider call.", {
      message: error instanceof Error ? error.message : String(error),
      queueDepth: agentQueue.length,
      configuredAgents: targets.length,
    });
    return null;
  }

  const target = slot.target;

  try {
    const response = await axios.post(
      target.endpoint,
      { messages: sanitizedMessages },
      {
        headers: {
          Authorization: `Bearer ${target.accessKey}`,
          "Content-Type": "application/json",
        },
        timeout,
      },
    );

    const text = extractResponseText(response.data);
    if (!text) {
      logger.warn("DigitalOceanAgent", "Agent response did not include text.");
      return null;
    }

    logger.info("DigitalOceanAgent", "Agent responded.", {
      agentId: target.id,
      queuedMs: slot.queuedMs,
      model: response.data?.model,
      promptTokens: response.data?.usage?.prompt_tokens,
      completionTokens: response.data?.usage?.completion_tokens,
    });
    return { text, provider: "digitalocean-agent" };
  } catch (error: any) {
    const status = error?.response?.status;
    logger.error("DigitalOceanAgent", "Failed to call DigitalOcean Agent.", {
      agentId: target.id,
      queuedMs: slot.queuedMs,
      status,
      message: error?.response?.data?.message || error?.message,
      responseData: JSON.stringify(error?.response?.data),
    });
    return null;
  } finally {
    slot.release();
  }
}
