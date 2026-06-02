import axios from "axios";
import { logger } from "../../logger";

type ChatRole = "system" | "user" | "assistant";

export type AgentMessage = {
  role: ChatRole;
  content: string;
};

type AgentResponse = {
  text: string;
  provider: "digitalocean-agent";
};

function getAgentEndpoint() {
  const base = process.env.DIGITALOCEAN_AGENT_ENDPOINT?.trim().replace(/\/+$/, "");
  if (!base) return undefined;
  return base.endsWith("/chat/completions") ? base : `${base}/api/v1/chat/completions`;
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

export async function askDigitalOceanAgent(messages: AgentMessage[]): Promise<AgentResponse | null> {
  const endpoint = getAgentEndpoint();
  const accessKey = getAgentAccessKey();

  if (!endpoint || !accessKey) return null;

  try {
    const response = await axios.post(
      endpoint,
      {
        messages,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${accessKey}`,
          "Content-Type": "application/json",
        },
        timeout: getTimeoutMs(),
      },
    );

    const text = extractResponseText(response.data);
    if (!text) {
      logger.warn("DigitalOceanAgent", "Agent response did not include text.");
      return null;
    }

    return { text, provider: "digitalocean-agent" };
  } catch (error: any) {
    logger.error("DigitalOceanAgent", "Failed to call DigitalOcean Agent.", {
      status: error?.response?.status,
      message: error?.response?.data?.message || error?.message,
    });
    return null;
  }
}
