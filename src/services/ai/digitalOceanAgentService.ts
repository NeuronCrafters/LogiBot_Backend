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

function getAgentEndpoint() {
  const base = process.env.DIGITALOCEAN_AGENT_ENDPOINT?.trim().replace(
    /\/+$/,
    "",
  );
  if (!base) return undefined;
  return base.endsWith("/chat/completions")
    ? base
    : `${base}/api/v1/chat/completions`;
}

function getAgentAccessKey() {
  return process.env.DIGITALOCEAN_AGENT_ACCESS_KEY?.trim();
}

function getTimeoutMs() {
  const value = Number(process.env.DIGITALOCEAN_AGENT_TIMEOUT_MS || 30000);
  return Number.isFinite(value) && value > 0 ? value : 30000;
}

export function isDigitalOceanAgentConfigured() {
  return Boolean(getAgentEndpoint() && getAgentAccessKey());
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
  options?: { timeoutMs?: number },
): Promise<AgentResponse | null> {
  const endpoint = getAgentEndpoint();
  const accessKey = getAgentAccessKey();

  if (!endpoint || !accessKey) return null;

  const sanitizedMessages = convertSystemMessages(messages);
  const timeout = options?.timeoutMs ?? getTimeoutMs();

  try {
    const response = await axios.post(
      endpoint,
      { messages: sanitizedMessages },
      {
        headers: {
          Authorization: `Bearer ${accessKey}`,
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
      model: response.data?.model,
      promptTokens: response.data?.usage?.prompt_tokens,
      completionTokens: response.data?.usage?.completion_tokens,
    });
    return { text, provider: "digitalocean-agent" };
  } catch (error: any) {
    logger.error("DigitalOceanAgent", "Failed to call DigitalOcean Agent.", {
      status: error?.response?.status,
      message: error?.response?.data?.message || error?.message,
      responseData: JSON.stringify(error?.response?.data),
    });
    return null;
  }
}
