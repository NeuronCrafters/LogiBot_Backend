import { readFileSync } from "fs";
import path from "path";

export type AgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterPurpose = "chat" | "quiz" | "insights";

const PROMPT_FILES: Record<OpenRouterPurpose, string> = {
  chat: "PROMPT_CHAT.md",
  quiz: "PROMPT_QUIZ.md",
  insights: "PROMPT_DASHBOARD_INSIGHTS.md",
};
const promptCache = new Map<OpenRouterPurpose, string>();

export function getOpenRouterConfig() {
  const accessKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();
  if (!accessKey || !model) return null;

  const base = (process.env.OPENROUTER_BASE_URL?.trim() ||
    "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const endpoint = base.endsWith("/chat/completions")
    ? base
    : `${base}/chat/completions`;

  return { endpoint, accessKey, model };
}

export function prepareOpenRouterMessages(
  purpose: OpenRouterPurpose,
  messages: AgentMessage[],
): AgentMessage[] {
  let prompt = promptCache.get(purpose);
  if (!prompt) {
    prompt = readFileSync(path.resolve(__dirname, "../../..", PROMPT_FILES[purpose]), "utf8").trim();
    if (!prompt) throw new Error(`Prompt vazio: ${PROMPT_FILES[purpose]}`);
    promptCache.set(purpose, prompt);
  }

  return [{ role: "system", content: prompt }, ...messages];
}

export function assertOpenRouterSuccess(data: any) {
  if (!data?.error && data?.choices?.[0]?.finish_reason !== "error") return;
  const code = Number(data?.error?.code);
  const status = Number.isInteger(code) && code >= 400 && code < 600 ? code : 502;
  const error = new Error(data?.error?.message || "Falha na resposta da OpenRouter.");
  throw Object.assign(error, { response: { status } });
}
