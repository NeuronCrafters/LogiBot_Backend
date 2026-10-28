import axios from "axios";
import { assertOpenRouterSuccess, getOpenRouterConfig, prepareOpenRouterMessages } from "./openRouterConfig";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import { withAgentRetry } from "../../utils/agentRetry";

function getConfig() {
  const config = getOpenRouterConfig();
  if (!config) throw new AppError("O serviço de geração de quiz por IA não está configurado. Defina OPENROUTER_API_KEY e OPENROUTER_MODEL.", 503);
  const timeoutValue = Number(process.env.QUIZ_AI_GENERATION_TIMEOUT_MS || 300000);
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0
    ? Math.min(timeoutValue, 300000)
    : 300000;
  return { ...config, timeoutMs };
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
    return await withAgentRetry(
      async () => {
        const response = await axios.post(
          config.endpoint,
          {
            model: config.model,
            messages: prepareOpenRouterMessages("quiz", [{ role: "user", content: prompt }]),
          },
          {
            headers: {
              Authorization: `Bearer ${config.accessKey}`,
              "Content-Type": "application/json",
            },
            timeout: config.timeoutMs,
          },
        );

        assertOpenRouterSuccess(response.data);
        const text = extractText(response.data);
        if (!text)
          throw new Error("A OpenRouter não retornou uma resposta utilizável.");

        logger.info("QuizAI", "Quiz gerado pela OpenRouter.", {
          providerModel: response.data?.model,
          promptTokens: response.data?.usage?.prompt_tokens,
          completionTokens: response.data?.usage?.completion_tokens,
        });

        return { text, provider: "openrouter" };
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

    logger.error("QuizAI", "Falha ao consultar a OpenRouter.", {
      status: error?.response?.status,
      message: error?.response?.data?.message || error?.message,
    });
    throw new AppError(
      "Não foi possível gerar o quiz com IA agora. Tente novamente.",
      503,
    );
  }
}
