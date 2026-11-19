const askDashboardInsightsAgent = jest.fn();
const getSummary = jest.fn();
const getEffortMatrix = jest.fn();
const getLearningJourney = jest.fn();
const getProficiencyRadar = jest.fn();
const getSessionDetails = jest.fn();
const getTopicPerformance = jest.fn();
const examResults = jest.fn();
const weeklyEngagement = jest.fn();
const chatSatisfaction = jest.fn();

jest.mock("../services/dashboard/dashboardComparisonService", () => ({
  examResults: (...args: unknown[]) => examResults(...args),
  weeklyEngagement: (...args: unknown[]) => weeklyEngagement(...args),
  chatSatisfaction: (...args: unknown[]) => chatSatisfaction(...args),
}));

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
  generateComparisonInsight,
  generateComparisonChartInsight,
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

  it("permite analisar proficiência zero quando existem respostas", async () => {
    getProficiencyRadar.mockResolvedValue({ labels: ["linguagem Python"], data: [0] });
    await expect(generateChartInsight({ chart: "proficiency-radar", filters })).resolves.toMatchObject({ chart: "proficiency-radar" });
    expect(askDashboardInsightsAgent).toHaveBeenCalledTimes(1);
  });

  it("retorna 422 quando não existem dados úteis", async () => {
    getTopicPerformance.mockResolvedValue([]);

    await expect(
      generateChartInsight({ chart: "general-score", filters }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

import { withLanguage, getLanguage } from "../i18n";

describe("cache de insights por idioma", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetDashboardInsightsCacheForTests();
    getSummary.mockResolvedValue({ totalCorrectAnswers:8,totalWrongAnswers:2,usageTimeInSeconds:3600,dailyUsage:[{date:'2026-06-18',usage:60}],subjectCounts:{variaveis:4} });
    askDashboardInsightsAgent.mockImplementation(async () => {
      const language=getLanguage();
      await Promise.resolve();
      return {text:language};
    });
  });
  it("separa resultados e deduplicação PT/EN/ES simultâneos", async () => {
    const languages=['pt-BR','en-US','es-ES'] as const;
    const results=await Promise.all(languages.map(language=>withLanguage(language,()=>generateChartInsight({chart:'accuracy',filters}))));
    expect(results.map(result=>result.insight)).toEqual([...languages]);
    expect(askDashboardInsightsAgent).toHaveBeenCalledTimes(3);
    for(const language of languages) {
      const cached=await withLanguage(language,()=>generateChartInsight({chart:'accuracy',filters}));
      expect(cached.cached).toBe(true);
      expect(cached.insight).toBe(language);
      expect(cached.language).toBe(language);
    }
    expect(askDashboardInsightsAgent).toHaveBeenCalledTimes(3);
    const prompts=askDashboardInsightsAgent.mock.calls.map(call=>call[0]);
    expect(prompts[0]).toContain('## Leitura principal');
    expect(prompts[1]).toContain('## Main findings');
    expect(prompts[2]).toContain('## Lectura principal');
  });

  it("compara as duas seleções numa única análise, sem nomes", async () => {
    const other = { universityId: "00000000-0000-4000-8000-000000000201" };
    await generateComparisonInsight({ a: filters, b: other });
    expect(askDashboardInsightsAgent).toHaveBeenCalledTimes(1);
    const prompt = askDashboardInsightsAgent.mock.calls[0][0] as string;
    expect(prompt).toContain("## Diferenças principais");
    expect(prompt).toContain("Seleção A");
    expect(prompt).toContain("Seleção B");
    expect(prompt).not.toContain("Ana Silva");
    // Same pair again comes from the cache.
    expect((await generateComparisonInsight({ a: filters, b: other })).cached).toBe(true);
  });

  it("recusa a comparação quando uma das seleções não tem dados", async () => {
    getSummary.mockResolvedValue({ totalCorrectAnswers: 0, totalWrongAnswers: 0, usageTimeInSeconds: 0, dailyUsage: [], subjectCounts: {} });
    getTopicPerformance.mockResolvedValue([]);
    getProficiencyRadar.mockResolvedValue({ labels: [], data: [] });
    getEffortMatrix.mockResolvedValue({ points: [], averages: { avgPerformance: 0, avgEffort: 0 } });
    getLearningJourney.mockResolvedValue({ labels: [], data: [] });
    await expect(generateComparisonInsight({ a: filters, b: { universityId: "00000000-0000-4000-8000-000000000201" } })).rejects.toMatchObject({ statusCode: 422, code: "insights.comparisonDataInsufficient" });
  });

  describe("análise de um gráfico de comparação", () => {
    const other = { universityId: "00000000-0000-4000-8000-000000000201", courseId: "00000000-0000-4000-8000-000000000202" };

    it("envia os dados das duas seleções, sem nomes, com o roteiro do gráfico", async () => {
      const sideA = { exams: [{ title: "Prova da Zuleica", releasedAt: "2026-11-01", expected: 10, submitted: 9, submissionRate: 0.9, averageGrade: 7.5 }], expected: 10, submitted: 9, submissionRate: 0.9, averageGrade: 7.5 };
      const sideB = { exams: [{ title: "Outra prova", releasedAt: "2026-11-02", expected: 12, submitted: 6, submissionRate: 0.5, averageGrade: 6 }], expected: 12, submitted: 6, submissionRate: 0.5, averageGrade: 6 };
      examResults.mockImplementation(async (selection: { courseId?: string }) => (selection.courseId === filters.courseId ? sideA : sideB));
      const result = await generateComparisonChartInsight({ chart: "exam-results", a: filters, b: other });
      expect(result.insight).toBeTruthy();
      const prompt = askDashboardInsightsAgent.mock.calls[0][0] as string;
      expect(prompt).toContain("Resultados das provas");
      expect(prompt).toContain("## Principais diferenças");
      expect(prompt).toContain("\"submissionRate\":0.9");
      // Exam titles may carry names: they are replaced by neutral labels.
      expect(prompt).not.toContain("Zuleica");
      expect(prompt).toContain("prova_1");
      expect((await generateComparisonChartInsight({ chart: "exam-results", a: filters, b: other })).cached).toBe(true);
    });

    it("conta alunos por faixa no gráfico de distribuição", async () => {
      getEffortMatrix
        .mockResolvedValueOnce({ points: [{ name: "Zuleica", performance: 90, effort: 10 }, { name: "Zenóbia", performance: 30, effort: 5 }], averages: { avgPerformance: 60, avgEffort: 7 } })
        .mockResolvedValueOnce({ points: [{ name: "Zacarias", performance: 100, effort: 3 }], averages: { avgPerformance: 100, avgEffort: 3 } });
      await generateComparisonChartInsight({ chart: "performance-distribution", a: filters, b: other });
      const prompt = askDashboardInsightsAgent.mock.calls[0][0] as string;
      expect(prompt).toContain("\"assessedStudents\":2");
      expect(prompt).toContain("{\"band\":\"80-100%\",\"students\":1}");
      expect(prompt).not.toMatch(/Zuleica|Zenóbia|Zacarias/);
    });

    it("recusa quando uma seleção não tem dados (satisfação oculta em grupo pequeno)", async () => {
      chatSatisfaction.mockResolvedValueOnce({ available: true, total: 9, up: 5, partial: 2, down: 2, score: 0.67, byTopic: [] }).mockResolvedValueOnce({ available: false, reason: "small", total: 2, minGroupSize: 5 });
      await expect(generateComparisonChartInsight({ chart: "chat-satisfaction", a: filters, b: other })).rejects.toMatchObject({ statusCode: 422, code: "insights.comparisonDataInsufficient" });
      expect(askDashboardInsightsAgent).not.toHaveBeenCalled();
    });
  });
});
