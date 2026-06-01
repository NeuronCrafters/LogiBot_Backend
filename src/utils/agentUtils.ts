import axios from "axios";
import dotenv from "dotenv";
import { AppError } from "../exceptions/AppError";

dotenv.config();

const DEFAULT_CLOUDFLARE_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

interface CloudflareAiConfig {
  accountId: string;
  token: string;
  model: string;
}

interface AgentConfig {
  url: string;
  key: string;
}

function getCloudflareAiConfig(): CloudflareAiConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AUTH_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL || DEFAULT_CLOUDFLARE_AI_MODEL;

  if (!accountId || !token) {
    throw new AppError("Cloudflare Workers AI nao configurado.", 500);
  }

  return { accountId, token, model };
}

export function getApiConfigs(): AgentConfig[] {
  try {
    const config = getCloudflareAiConfig();
    return [{
      url: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.model}`,
      key: config.token,
    }];
  } catch {
    return [];
  }
}

function normalizeCloudflareAiResponse(data: any) {
  const content =
    data?.result?.response ||
    data?.response ||
    data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new AppError("resposta invalida do Cloudflare Workers AI.", 500);
  }

  return {
    data: {
      ...data,
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    },
  };
}

export async function makeRequestWithFallback(body: any): Promise<any> {
  const config = getCloudflareAiConfig();
  const model = body.model?.startsWith("@cf/") ? body.model : config.model;
  const { model: _ignoredModel, ...payload } = body;
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    return normalizeCloudflareAiResponse(response.data);
  } catch (error: any) {
    const message =
      error.response?.data?.errors?.[0]?.message ||
      error.response?.data?.error ||
      error.message;

    throw new AppError(`falha ao se comunicar com o Cloudflare Workers AI: ${message}`, 500);
  }
}
