import { createHash } from "crypto";
import { AppError } from "../../exceptions/AppError";
import {
  getDashboardInsightsModel,
  askDashboardInsightsAgent,
} from "../ai/dashboardInsightsAgentService";
import { getSummary, type Filters } from "../analytics/analyticsService";
import {
  getEffortMatrix,
  getLearningJourney,
  getProficiencyRadar,
  getSessionDetails,
  getTopicPerformance,
} from "./dashboardService";

export const DASHBOARD_INSIGHT_CHARTS = [
  "usage",
  "accuracy",
  "chat-topics",
  "general-score",
  "proficiency-radar",
  "effort-matrix",
  "learning-journey",
  "access-pattern",
] as const;

export type DashboardInsightChart =
  (typeof DASHBOARD_INSIGHT_CHARTS)[number];

type InsightResponse = {
  insight: string;
  generatedAt: string;
  cached: boolean;
  model: string;
  chart?: DashboardInsightChart;
};

type CacheEntry = Omit<InsightResponse, "cached"> & { expiresAt: number };

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Omit<InsightResponse, "cached">>>();

const CHART_CONTEXT: Record<
  DashboardInsightChart,
  { title: string; description: string }
> = {
  usage: {
    title: "Tempo de uso diário",
    description:
      "Mostra tempo total e distribuição diária de uso. Tempo elevado não prova aprendizagem; deve ser interpretado junto ao desempenho.",
  },
  accuracy: {
    title: "Acertos e erros",
    description:
      "Compara respostas corretas e incorretas para indicar a taxa geral de acerto.",
  },
  "chat-topics": {
    title: "Assuntos mais acessados no chat",
    description:
      "Mostra a frequência de dúvidas por assunto. Frequência não significa necessariamente dificuldade.",
  },
  "general-score": {
    title: "Avaliação geral de desempenho",
    description:
      "Resume em escala de 0 a 10 a média das taxas de acerto dos tópicos com atividade.",
  },
  "proficiency-radar": {
    title: "Proficiência por assunto",
    description:
      "Compara a taxa de acerto entre assuntos para revelar forças e conteúdos que pedem revisão.",
  },
  "effort-matrix": {
    title: "Matriz desempenho versus esforço",
    description:
      "Relaciona tempo de uso e taxa de acerto. Os dados mostram associação, não causalidade.",
  },
  "learning-journey": {
    title: "Jornada de aprendizagem",
    description:
      "Mostra a evolução da taxa de acerto por posição da tentativa de quiz.",
  },
  "access-pattern": {
    title: "Padrão de acesso",
    description:
      "Resume dias e horários das sessões para apoiar decisões sobre acompanhamento e disponibilidade.",
  },
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function hash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function anonymize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(anonymize);
  if (value && typeof value === "object") {
    const blocked = /^(name|email|userId|studentId|accountId|id)$/i;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !blocked.test(key))
        .map(([key, item]) => [key, anonymize(item)]),
    );
  }
  return value;
}

function scopeLabel(filters: Filters) {
  if (filters.studentId) return "aluno selecionado";
  if (filters.classId) return "turma selecionada";
  if (filters.disciplineId) return "disciplina selecionada";
  if (filters.courseId) return "curso selecionado";
  return "universidade selecionada";
}

function disciplineNote(filters: Filters) {
  return filters.disciplineId
    ? "No recorte por disciplina, desempenho considera apenas quizzes da disciplina; tempo de uso, sessões e chat representam a atividade geral dos alunos das turmas vinculadas."
    : undefined;
}

function containsUsefulData(value: unknown): boolean {
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.some(containsUsefulData);
  if (value && typeof value === "object")
    return Object.values(value as Record<string, unknown>).some(
      containsUsefulData,
    );
  return false;
}

async function chartData(chart: DashboardInsightChart, filters: Filters) {
  if (chart === "usage") {
    const summary = await getSummaryForFilters(filters);
    return {
      totalUsageSeconds: summary.usageTimeInSeconds,
      dailyUsageMinutes: summary.dailyUsage.map((item) => ({
        date: item.date,
        minutes: Number(item.usage.toFixed(1)),
      })),
    };
  }
  if (chart === "accuracy") {
    const summary = await getSummaryForFilters(filters);
    const total = summary.totalCorrectAnswers + summary.totalWrongAnswers;
    return {
      correct: summary.totalCorrectAnswers,
      wrong: summary.totalWrongAnswers,
      accuracy: total
        ? Number(((summary.totalCorrectAnswers / total) * 100).toFixed(1))
        : 0,
    };
  }
  if (chart === "chat-topics") {
    const summary = await getSummaryForFilters(filters);
    return { topicFrequency: summary.subjectCounts };
  }
  if (chart === "general-score") {
    const topics = await getTopicPerformance(filters);
    const active = topics.filter(
      (item) => item.successPercentage > 0 || item.errorPercentage > 0,
    );
    return {
      score: active.length
        ? Number(
            (
              active.reduce(
                (total, item) => total + item.successPercentage,
                0,
              ) /
              active.length /
              10
            ).toFixed(2),
          )
        : 0,
      topicCount: active.length,
    };
  }
  if (chart === "proficiency-radar")
    return getProficiencyRadar(filters);
  if (chart === "effort-matrix") {
    const matrix = await getEffortMatrix(filters);
    return {
      averages: matrix.averages,
      points: matrix.points.map((point, index) => ({
        entity: `entidade_${String(index + 1).padStart(2, "0")}`,
        performance: point.performance,
        effortMinutes: point.effort,
      })),
    };
  }
  if (chart === "learning-journey")
    return getLearningJourney(filters);
  if (chart === "access-pattern") {
    const sessions = await getSessionDetails(filters);
    const durations = sessions.map(
      (session) =>
        (new Date(session.endTime).getTime() -
          new Date(session.startTime).getTime()) /
        60_000,
    );
    const pattern: Record<string, number> = {};
    for (const session of sessions) {
      const date = new Date(session.startTime);
      const key = `${date.getUTCDay()}-${date.getUTCHours()}`;
      pattern[key] = (pattern[key] || 0) + 1;
    }
    return {
      sessionCount: sessions.length,
      averageDurationMinutes: durations.length
        ? Number(
            (
              durations.reduce((total, duration) => total + duration, 0) /
              durations.length
            ).toFixed(1),
          )
        : 0,
      dayHourFrequency: Object.entries(pattern).map(([key, frequency]) => {
        const [day, hour] = key.split("-").map(Number);
        return { day, hour, frequency };
      }),
    };
  }
  throw new AppError("Gráfico de insight inválido.", 400);
}

async function getSummaryForFilters(filters: Filters) {
  if (!filters.universityId)
    throw new AppError("universityId é obrigatório.", 400);
  return getSummary({
    universityId: filters.universityId,
    courseId: filters.courseId,
    classId: filters.classId,
    studentId: filters.studentId,
    disciplineId: filters.disciplineId,
  });
}

function chartPrompt(
  chart: DashboardInsightChart,
  filters: Filters,
  data: unknown,
) {
  const context = CHART_CONTEXT[chart];
  return `Você é um assistente de análise pedagógica para professores.

Analise exclusivamente os dados fornecidos, em português do Brasil, sem inventar fatos, sem diagnosticar alunos e sem afirmar causalidade. Quando a amostra for pequena ou ambígua, declare a limitação. Não solicite nem suponha nomes, e-mails ou outras informações pessoais.

Gráfico: ${context.title}
Escopo: ${scopeLabel(filters)}
Significado: ${context.description}
${disciplineNote(filters) ? `Observação de escopo: ${disciplineNote(filters)}` : ""}

Dados:
${JSON.stringify(anonymize(data))}

Responda em Markdown, com no máximo 350 palavras, usando exatamente:
## Leitura principal
## Evidências nos dados
## Pontos de atenção
## Ações recomendadas

Faça recomendações concretas, proporcionais às evidências e úteis para planejamento pedagógico.`;
}

function overviewPrompt(
  filters: Filters,
  datasets: Array<{
    chart: DashboardInsightChart;
    title: string;
    description: string;
    data: unknown;
  }>,
) {
  return `Você é um assistente de análise pedagógica para professores.

Produza uma visão integrada exclusivamente a partir dos dados abaixo. Não invente fatos, não diagnostique alunos, não exponha indivíduos e não confunda associação com causalidade. Aponte limitações e possíveis contradições entre métricas.

Escopo: ${scopeLabel(filters)}
${disciplineNote(filters) ? `Observação de escopo: ${disciplineNote(filters)}` : ""}

Gráficos:
${JSON.stringify(anonymize(datasets))}

Responda em Markdown, com no máximo 700 palavras, usando exatamente:
## Resumo executivo
## Evidências combinadas
## Prioridades pedagógicas
## Plano de ação
## Cuidados na interpretação

No plano de ação, forneça de 3 a 5 ações priorizadas, mensuráveis e compatíveis com os dados.`;
}

async function generateCached(
  keyPayload: unknown,
  force: boolean,
  generate: () => Promise<Omit<InsightResponse, "cached">>,
) {
  const key = hash(keyPayload);
  const now = Date.now();
  const cached = cache.get(key);
  if (!force && cached && cached.expiresAt > now) {
    const { expiresAt: _expiresAt, ...response } = cached;
    return { ...response, cached: true };
  }

  const running = inFlight.get(key);
  if (running) return { ...(await running), cached: false };

  const promise = generate();
  inFlight.set(key, promise);
  try {
    const response = await promise;
    cache.set(key, { ...response, expiresAt: now + CACHE_TTL_MS });
    return { ...response, cached: false };
  } finally {
    inFlight.delete(key);
  }
}

export async function generateChartInsight(input: {
  chart: DashboardInsightChart;
  filters: Filters;
  force?: boolean;
}): Promise<InsightResponse> {
  const data = await chartData(input.chart, input.filters);
  if (!containsUsefulData(data))
    throw new AppError("Não há dados suficientes para gerar este insight.", 422);
  const model = getDashboardInsightsModel();

  return generateCached(
    { type: "chart", chart: input.chart, filters: input.filters, model, data },
    Boolean(input.force),
    async () => {
      const response = await askDashboardInsightsAgent(
        chartPrompt(input.chart, input.filters, data),
      );
      return {
        insight: response.text,
        generatedAt: new Date().toISOString(),
        model: response.model,
        chart: input.chart,
      };
    },
  );
}

export async function generateOverviewInsight(input: {
  filters: Filters;
  force?: boolean;
}): Promise<InsightResponse> {
  const charts = DASHBOARD_INSIGHT_CHARTS.filter(
    (chart) => chart !== "access-pattern" || Boolean(input.filters.studentId),
  );
  const datasets = (
    await Promise.all(
      charts.map(async (chart) => {
        const data = await chartData(chart, input.filters);
        return {
          chart,
          title: CHART_CONTEXT[chart].title,
          description: CHART_CONTEXT[chart].description,
          data,
        };
      }),
    )
  ).filter((item) => containsUsefulData(item.data));

  if (!datasets.length)
    throw new AppError(
      "Não há dados suficientes para gerar a análise geral.",
      422,
    );
  const model = getDashboardInsightsModel();

  return generateCached(
    { type: "overview", filters: input.filters, model, datasets },
    Boolean(input.force),
    async () => {
      const response = await askDashboardInsightsAgent(
        overviewPrompt(input.filters, datasets),
      );
      return {
        insight: response.text,
        generatedAt: new Date().toISOString(),
        model: response.model,
      };
    },
  );
}

export function isDashboardInsightChart(
  value: unknown,
): value is DashboardInsightChart {
  return DASHBOARD_INSIGHT_CHARTS.includes(value as DashboardInsightChart);
}

export function __resetDashboardInsightsCacheForTests() {
  cache.clear();
  inFlight.clear();
}
