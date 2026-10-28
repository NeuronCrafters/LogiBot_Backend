import axios from "axios";
import { assertOpenRouterSuccess, getOpenRouterConfig, prepareOpenRouterMessages } from "./openRouterConfig";
import { AppError } from "../../exceptions/AppError";
import { logger } from "../../logger";
import { withAgentRetry } from "../../utils/agentRetry";

function getConfig() {
  const config = getOpenRouterConfig();
  if (!config) throw new AppError("insights.aiNotConfigured", 503);
  const timeoutValue = Number(process.env.DASHBOARD_INSIGHTS_TIMEOUT_MS || 90000);
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0
    ? Math.min(timeoutValue, 180000)
    : 90000;
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

export async function askDashboardInsightsAgent(prompt: string) {
  const config = getConfig();

  try {
    return await withAgentRetry(
      async () => {
        const response = await axios.post(
          config.endpoint,
          {
            model: config.model,
            messages: prepareOpenRouterMessages("insights", [{ role: "user", content: prompt }]),
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

        const providerModel =
          typeof response.data?.model === "string" ? response.data.model : null;
        logger.info("DashboardInsights", "Insight gerado pela OpenRouter.", {
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

    logger.error("DashboardInsights", "Falha ao consultar a OpenRouter.", {
      status: error?.response?.status,
      message: error?.response?.data?.message || error?.message,
    });
    throw new AppError("insights.aiUnavailable",
      503,
    );
  }
}
