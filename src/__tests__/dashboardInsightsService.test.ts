const askDashboardInsightsAgent = jest.fn();
const getSummary = jest.fn();
const getEffortMatrix = jest.fn();
const getLearningJourney = jest.fn();
const getProficiencyRadar = jest.fn();
const getSessionDetails = jest.fn();
const getTopicPerformance = jest.fn();

jest.mock("../services/ai/dashboardInsightsAgentService", () => ({
  askDashboardInsightsAgent: (...args: unknown[]) =>
    askDashboardInsightsAgent(...args),
}));

jest.mock("../services/analytics/analyticsService", () => ({
  getSummary: (...args: unknown[]) => getSummary(...args),
}));

jest.mock("../services/dashboard/dashboardService", () => ({
  getEffortMatrix: (...args: unknown[]) => getEffortMatrix(...args),
  getLearningJourney: (...args: unknown[]) => getLearningJourney(...args),
  getProficiencyRadar: (...args: unknown[]) => getProficiencyRadar(...args),
  getSessionDetails: (...args: unknown[]) => getSessionDetails(...args),
  getTopicPerformance: (...args: unknown[]) => getTopicPerformance(...args),
}));

import {
  __resetDashboardInsightsCacheForTests,
  generateChartInsight,
  generateOverviewInsight,
} from "../services/dashboard/dashboardInsightsService";

const filters = {
  universityId: "00000000-0000-4000-8000-000000000101",
  courseId: "00000000-0000-4000-8000-000000000102",
};

describe("dashboardInsightsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetDashboardInsightsCacheForTests();
    askDashboardInsightsAgent.mockResolvedValue({
      text: "## Leitura principal\nInsight",
    });
    getSummary.mockResolvedValue({
      totalCorrectAnswers: 8,
      totalWrongAnswers: 2,
      usageTimeInSeconds: 3600,
      dailyUsage: [{ date: "2026-06-18", usage: 60 }],
      subjectCounts: { variaveis: 4 },
    });
    getTopicPerformance.mockResolvedValue([
      { topic: "variaveis", successPercentage: 80, errorPercentage: 20 },
    ]);
    getProficiencyRadar.mockResolvedValue({
      labels: ["variaveis"],
      data: [80],
    });
    getEffortMatrix.mockResolvedValue({
      points: [{ name: "Ana Silva", performance: 80, effort: 60 }],
      averages: { avgPerformance: 80, avgEffort: 60 },
    });
    getLearningJourney.mockResolvedValue({
      labels: ["Quiz 1"],
      data: [80],
    });
    getSessionDetails.mockResolvedValue([
      {
        startTime: new Date("2026-06-18T10:00:00Z"),
        endTime: new Date("2026-06-18T11:00:00Z"),
      },
    ]);
  });

  it("reutiliza o cache por 15 minutos e permite forçar regeneração", async () => {
    const first = await generateChartInsight({
      chart: "accuracy",
      filters,
    });
    const second = await generateChartInsight({
      chart: "accuracy",
      filters,
    });
    const forced = await generateChartInsight({
      chart: "accuracy",
      filters,
      force: true,
    });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(forced.cached).toBe(false);
    expect(askDashboardInsightsAgent).toHaveBeenCalledTimes(2);
  });

  it("expira o cache depois de 15 minutos", async () => {
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    await generateChartInsight({ chart: "accuracy", filters });
    now.mockReturnValue(1_000 + 15 * 60 * 1000 + 1);
    await generateChartInsight({ chart: "accuracy", filters });

    expect(askDashboardInsightsAgent).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it("deduplica requisições simultâneas idênticas", async () => {
    let resolveAgent!: (value: { text: string }) => void;
    askDashboardInsightsAgent.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAgent = resolve;
        }),
    );

    const first = generateChartInsight({ chart: "accuracy", filters });
    const second = generateChartInsight({ chart: "accuracy", filters });
    while (!resolveAgent) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    resolveAgent({
      text: "## Leitura principal\nInsight",
    });

    await Promise.all([first, second]);
    expect(askDashboardInsightsAgent).toHaveBeenCalledTimes(1);
  });

  it("remove nomes dos dados enviados ao Agent", async () => {
    await generateChartInsight({ chart: "effort-matrix", filters });
    const prompt = askDashboardInsightsAgent.mock.calls[0][0] as string;

    expect(prompt).not.toContain("Ana Silva");
    expect(prompt).toContain("entidade_01");
  });

  it("não inclui padrão de acesso no overview sem aluno selecionado", async () => {
    await generateOverviewInsight({ filters });
    expect(getSessionDetails).not.toHaveBeenCalled();
  });

  it("retorna 422 quando não existem dados úteis", async () => {
    getTopicPerformance.mockResolvedValue([]);

    await expect(
      generateChartInsight({ chart: "general-score", filters }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
