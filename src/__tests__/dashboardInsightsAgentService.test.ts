import axios from "axios";
import { askDashboardInsightsAgent } from "../services/ai/dashboardInsightsAgentService";

jest.mock("axios");
const mockedPost = axios.post as jest.Mock;

describe("dashboardInsightsAgentService", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_MODEL = "test/model";
    // acelera o backoff nos testes
    process.env.AGENT_RETRY_DELAY_MS = "1";
    process.env.AGENT_MAX_ATTEMPTS = "3";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("retorna 503 quando o OpenRouter não está configurado", async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_MODEL;

    await expect(askDashboardInsightsAgent("teste")).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it("retenta em cold start (5xx) e retorna o texto no sucesso seguinte", async () => {
    mockedPost
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: "Insight ok" } }] },
      });

    const result = await askDashboardInsightsAgent("prompt");

    expect(result).toEqual({ text: "Insight ok" });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it("retenta em timeout de rede (agente dormindo)", async () => {
    mockedPost
      .mockRejectedValueOnce({ code: "ECONNABORTED", request: {} })
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: "Insight ok" } }] },
      });

    const result = await askDashboardInsightsAgent("prompt");

    expect(result).toEqual({ text: "Insight ok" });
    expect(mockedPost).toHaveBeenCalledTimes(2);
  });

  it("lança 503 após esgotar as tentativas", async () => {
    mockedPost.mockRejectedValue({ response: { status: 500 } });

    await expect(askDashboardInsightsAgent("prompt")).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(mockedPost).toHaveBeenCalledTimes(3);
  });
});
