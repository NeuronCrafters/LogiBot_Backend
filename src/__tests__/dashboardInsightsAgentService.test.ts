import { askDashboardInsightsAgent } from "../services/ai/dashboardInsightsAgentService";

describe("dashboardInsightsAgentService", () => {
  const originalEndpoint = process.env.DASHBOARD_INSIGHTS_AGENT_ENDPOINT;
  const originalAccessKey = process.env.DASHBOARD_INSIGHTS_AGENT_ACCESS_KEY;

  afterEach(() => {
    if (originalEndpoint === undefined)
      delete process.env.DASHBOARD_INSIGHTS_AGENT_ENDPOINT;
    else process.env.DASHBOARD_INSIGHTS_AGENT_ENDPOINT = originalEndpoint;
    if (originalAccessKey === undefined)
      delete process.env.DASHBOARD_INSIGHTS_AGENT_ACCESS_KEY;
    else process.env.DASHBOARD_INSIGHTS_AGENT_ACCESS_KEY = originalAccessKey;
  });

  it("retorna 503 quando o Agent dedicado não está configurado", async () => {
    delete process.env.DASHBOARD_INSIGHTS_AGENT_ENDPOINT;
    delete process.env.DASHBOARD_INSIGHTS_AGENT_ACCESS_KEY;

    await expect(askDashboardInsightsAgent("teste")).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
