import axios from "axios";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import { withAgentRetry } from "../../utils/agentRetry";

function getConfig() {
  const endpoint = process.env.DASHBOARD_INSIGHTS_AGENT_ENDPOINT?.trim();
  const accessKey = process.env.DASHBOARD_INSIGHTS_AGENT_ACCESS_KEY?.trim();
  const timeoutValue = Number(
    process.env.DASHBOARD_INSIGHTS_TIMEOUT_MS || 90_000,
  );
  const timeoutMs =
    Number.isFinite(timeoutValue) && timeoutValue > 0
      ? Math.min(timeoutValue, 180_000)
      : 90_000;

  if (!endpoint || !accessKey) {
    throw new AppError(
      "O serviço de insights de IA não está configurado.",
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

export async function askDashboardInsightsAgent(prompt: string) {
  const config = getConfig();

  try {
    // Retenta em cold start do agente dedicado (timeout/rede/401/429/5xx),
    // usando a mesma política compartilhada do chatbot e do quiz.
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

        const providerModel =
          typeof response.data?.model === "string" ? response.data.model : null;
        if (providerModel && !providerModel.includes("gpt-oss-20b")) {
          logger.warn("DashboardInsights", "Agent respondeu com modelo inesperado.", {
            providerModel,
          });
        }

        logger.info("DashboardInsights", "Insight gerado pelo Agent dedicado.", {
          providerModel,
          promptTokens: response.data?.usage?.prompt_tokens,
          completionTokens: response.data?.usage?.completion_tokens,
        });

        return { text };
      },
      {
        onRetry: ({ attempt, error }) => {
          logger.warn("DashboardInsights", "Tentativa falhou, retentando...", {
            attempt,
            status: error?.response?.status,
            message: error?.response?.data?.message || error?.message,
          });
        },
      },
    );
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    logger.error("DashboardInsights", "Falha ao consultar Agent dedicado.", {
      status: error?.response?.status,
      message: error?.response?.data?.message || error?.message,
    });
    throw new AppError(
      "Não foi possível gerar o insight de IA agora. Tente novamente.",
      503,
    );
  }
}
