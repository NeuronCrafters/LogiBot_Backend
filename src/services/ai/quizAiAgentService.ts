import axios from "axios";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import { withAgentRetry } from "../../utils/agentRetry";

function getConfig() {
  const endpoint = process.env.QUIZ_AI_AGENT_ENDPOINT?.trim();
  const accessKey = process.env.QUIZ_AI_AGENT_ACCESS_KEY?.trim();
  const timeoutValue = Number(process.env.QUIZ_AI_GENERATION_TIMEOUT_MS || 300_000);
  const timeoutMs =
    Number.isFinite(timeoutValue) && timeoutValue > 0
      ? Math.min(timeoutValue, 300_000)
      : 300_000;

  if (!endpoint || !accessKey) {
    throw new AppError(
      "O serviço de geração de quiz por IA não está configurado.",
      503,
    );
  }

  const normalizedEndpoint = endpoint
    .replace(/\/+$/, "")
    .replace(/(?<!\/api\/v1)\/chat\/completions$/, "");
  return {
    endpoint: normalizedEndpoint.endsWith("/api/v1")
      ? `${normalizedEndpoint}/chat/completions`
      : normalizedEndpoint.endsWith("/api/v1/chat/completions")
        ? normalizedEndpoint
        : `${normalizedEndpoint}/api/v1/chat/completions`,
    accessKey,
    timeoutMs,
  };
}

function extractText(data: any) {
  const value =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.message?.content ||
    data?.answer ||
    data?.response;
  return typeof value === "string" ? value.trim() : "";
}

export async function askQuizAiAgent(prompt: string) {
  const config = getConfig();

  try {
    // Retenta em cold start do agente dedicado (timeout/rede/401/429/5xx),
    // usando a mesma política compartilhada do chatbot e dos insights.
    return await withAgentRetry(
      async () => {
        const response = await axios.post(
          config.endpoint,
          { messages: [{ role: "user", content: prompt }] },
          {
            headers: {
              Authorization: `Bearer ${config.accessKey}`,
              "Content-Type": "application/json",
            },
            timeout: config.timeoutMs,
          },
        );

        const text = extractText(response.data);
        if (!text)
          throw new Error("O Agent não retornou uma resposta utilizável.");

        logger.info("QuizAI", "Quiz gerado pelo Agent dedicado.", {
          providerModel: response.data?.model,
          promptTokens: response.data?.usage?.prompt_tokens,
          completionTokens: response.data?.usage?.completion_tokens,
        });

        return { text, provider: "quiz-ai-agent" };
      },
      {
        onRetry: ({ attempt, error }) => {
          logger.warn("QuizAI", "Tentativa falhou, retentando...", {
            attempt,
            status: error?.response?.status,
            message: error?.response?.data?.message || error?.message,
          });
        },
      },
    );
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    logger.error("QuizAI", "Falha ao consultar Agent dedicado.", {
      status: error?.response?.status,
      message: error?.response?.data?.message || error?.message,
    });
    throw new AppError(
      "Não foi possível gerar o quiz com IA agora. Tente novamente.",
      503,
    );
  }
}
