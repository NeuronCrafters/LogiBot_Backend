import { getLanguage, t } from "../../i18n";
import { createHash } from "crypto";
import { AppError } from "../../exceptions/AppError";
import { askDashboardInsightsAgent } from "../ai/dashboardInsightsAgentService";
import { getSummary, type Filters } from "../analytics/analyticsService";
import {
  getEffortMatrix,
  getLearningJourney,
  getProficiencyRadar,
  getSessionDetails,
  getTopicPerformance,
} from "./dashboardService";
import { chatSatisfaction, examResults, weeklyEngagement } from "./dashboardComparisonService";
import type { Feature } from "../features/featureService";

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

/**
 * Feature each chart comes from. With the feature turned off for the person, the chart's data is
 * never read nor sent to the model, also inside the overall and A × B analyses.
 */
type Released = Partial<Record<Feature, boolean>>;
const CHART_FEATURE: Partial<Record<string, Feature>> = {
  accuracy: "quiz", "general-score": "quiz", "proficiency-radar": "quiz", "effort-matrix": "quiz", "learning-journey": "quiz",
  "chat-topics": "chat",
  "topic-difference": "quiz", "radar-overlay": "quiz", "performance-distribution": "quiz", "exam-results": "exams", "chat-satisfaction": "chat",
};
const chartReleased = (chart: string, released: Released) => { const feature = CHART_FEATURE[chart]; return !feature || released[feature] !== false; };
function assertChartReleased(chart: string, released: Released) {
  if (!chartReleased(chart, released)) throw new AppError("features.unavailable", 403);
}

type InsightResponse = {
  insight: string;
  generatedAt: string;
  cached: boolean;
  language: import("../../i18n").Language;
  chart?: DashboardInsightChart;
};

type CacheEntry = Omit<InsightResponse, "cached"> & { expiresAt: number };

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<Omit<InsightResponse, "cached">>>();

const CHART_CONTEXT = {
  "usage": { title: "insights.charts.usage.title", description: "insights.charts.usage.description" },
  "accuracy": { title: "insights.charts.accuracy.title", description: "insights.charts.accuracy.description" },
  "chat-topics": { title: "insights.charts.chat-topics.title", description: "insights.charts.chat-topics.description" },
  "general-score": { title: "insights.charts.general-score.title", description: "insights.charts.general-score.description" },
  "proficiency-radar": { title: "insights.charts.proficiency-radar.title", description: "insights.charts.proficiency-radar.description" },
  "effort-matrix": { title: "insights.charts.effort-matrix.title", description: "insights.charts.effort-matrix.description" },
  "learning-journey": { title: "insights.charts.learning-journey.title", description: "insights.charts.learning-journey.description" },
  "access-pattern": { title: "insights.charts.access-pattern.title", description: "insights.charts.access-pattern.description" }
} as const;

function getChartContext(chart: DashboardInsightChart) {
  return { title: t(CHART_CONTEXT[chart].title), description: t(CHART_CONTEXT[chart].description) };
}

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
  if (filters.studentId) return t("insights.scope.student");
  if (filters.classId) return t("insights.scope.class");
  if (filters.disciplineId) return t("insights.scope.discipline");
  if (filters.courseId) return t("insights.scope.course");
  return t("insights.scope.university");
}

function disciplineNote(filters: Filters) {
  return filters.disciplineId
    ? t("insights.disciplineNote")
    : undefined;
}

function containsUsefulData(value: unknown): boolean {
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.some(containsUsefulData);
  if (value && typeof value === "object") {
    const series = value as { labels?: unknown[]; data?: unknown[] };
    if (Array.isArray(series.labels) && Array.isArray(series.data) && series.labels.length > 0)
      return series.data.some((item) => typeof item === "number" && Number.isFinite(item));
    return Object.values(value as Record<string, unknown>).some(containsUsefulData);
  }
  return false;
}

async function chartData(chart: DashboardInsightChart, filters: Filters) {
  if (chart === "usage") {
    const summary = await getSummaryForFilters(filters);
    return {
      totalUsageSeconds: summary.usageTimeInSeconds,
      observedUsageSeconds: summary.observedUsageTimeInSeconds ?? 0,
      ongoingSessions: summary.ongoingSessionCount ?? 0,
      estimatedUsageSeconds: summary.estimatedUsageTimeInSeconds ?? 0,
      estimatedSessionCount: summary.estimatedSessionCount ?? 0,
      undeterminedSessionCount: summary.undeterminedSessionCount ?? 0,
      ...(summary.estimatedSessionCount ? { measurementNote: "Includes elapsed time estimated from recorded activity; not a direct measurement of active time." } : {}),
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
  throw new AppError("insights.chartInvalid", 400);
}

async function getSummaryForFilters(filters: Filters) {
  if (!filters.universityId)
    throw new AppError("insights.universityRequired", 400);
  return getSummary({
    universityId: filters.universityId,
    courseId: filters.courseId,
    classId: filters.classId,
    studentId: filters.studentId,
    disciplineId: filters.disciplineId,
    startDate: filters.startDate,
    endDate: filters.endDate,
  });
}

function chartPrompt(
  chart: DashboardInsightChart,
  filters: Filters,
  data: unknown,
) {
  const context = getChartContext(chart);
  return t("insights.chartPrompt", {
    title: context.title, scope: scopeLabel(filters), description: context.description,
    note: disciplineNote(filters) ? t("insights.scopeNote", { note: disciplineNote(filters)! }) : "",
    data: JSON.stringify(anonymize(data)),
  });
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
  return t("insights.overviewPrompt", {
    scope: scopeLabel(filters),
    note: disciplineNote(filters) ? t("insights.scopeNote", { note: disciplineNote(filters)! }) : "",
    data: JSON.stringify(anonymize(datasets)),
  });
}

async function generateCached(
  keyPayload: unknown,
  force: boolean,
  generate: () => Promise<Omit<InsightResponse, "cached">>,
) {
  const key = hash({ language: getLanguage(), payload: keyPayload });
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
  released?: Released;
}): Promise<InsightResponse> {
  assertChartReleased(input.chart, input.released ?? {});
  const data = await chartData(input.chart, input.filters);
  if (!containsUsefulData(data))
    throw new AppError("insights.dataInsufficient", 422);

  return generateCached(
    { type: "chart", chart: input.chart, filters: input.filters, data },
    Boolean(input.force),
    async () => {
      const response = await askDashboardInsightsAgent(
        chartPrompt(input.chart, input.filters, data),
      );
      return {
        insight: response.text,
        language: getLanguage(),
        generatedAt: new Date().toISOString(),
        chart: input.chart,
      };
    },
  );
}

/** Data of every chart for one selection (the same set the overall analysis uses). */
async function overviewDatasets(filters: Filters, released: Released = {}) {
  const charts = DASHBOARD_INSIGHT_CHARTS.filter((chart) => (chart !== "access-pattern" || Boolean(filters.studentId)) && chartReleased(chart, released));
  return (await Promise.all(charts.map(async (chart) => ({
    chart, title: getChartContext(chart).title, description: getChartContext(chart).description, data: await chartData(chart, filters),
  })))).filter((item) => containsUsefulData(item.data));
}

/**
 * Analysis of both selections together (A × B): the model receives both sets of charts and is
 * asked to compare them. Names are never sent, only the kind of each selection.
 */
export async function generateComparisonInsight(input: { a: Filters; b: Filters; force?: boolean; released?: Released }): Promise<InsightResponse> {
  const [a, b] = await Promise.all([overviewDatasets(input.a, input.released), overviewDatasets(input.b, input.released)]);
  if (!a.length || !b.length) throw new AppError("insights.comparisonDataInsufficient", 422);
  return generateCached(
    { type: "comparison", a: input.a, b: input.b, datasetsA: a, datasetsB: b },
    Boolean(input.force),
    async () => {
      const response = await askDashboardInsightsAgent(t("insights.comparisonPrompt", {
        scopeA: scopeLabel(input.a), scopeB: scopeLabel(input.b),
        dataA: JSON.stringify(anonymize(a)), dataB: JSON.stringify(anonymize(b)),
      }));
      return { insight: response.text, language: getLanguage(), generatedAt: new Date().toISOString() };
    },
  );
}

export async function generateOverviewInsight(input: {
  filters: Filters;
  force?: boolean;
  released?: Released;
}): Promise<InsightResponse> {
  const charts = DASHBOARD_INSIGHT_CHARTS.filter(
    (chart) => (chart !== "access-pattern" || Boolean(input.filters.studentId)) && chartReleased(chart, input.released ?? {}),
  );
  const datasets = (
    await Promise.all(
      charts.map(async (chart) => {
        const data = await chartData(chart, input.filters);
        return {
          chart,
          title: getChartContext(chart).title,
          description: getChartContext(chart).description,
          data,
        };
      }),
    )
  ).filter((item) => containsUsefulData(item.data));

  if (!datasets.length)
    throw new AppError("insights.overviewDataInsufficient",
      422,
    );

  return generateCached(
    { type: "overview", filters: input.filters, datasets },
    Boolean(input.force),
    async () => {
      const response = await askDashboardInsightsAgent(
        overviewPrompt(input.filters, datasets),
      );
      return {
        insight: response.text,
        language: getLanguage(),
        generatedAt: new Date().toISOString(),
      };
    },
  );
}

/* ── Analysis of one direct comparison chart (A × B) ─────────────────────── */

export const COMPARISON_INSIGHT_CHARTS = [
  "topic-difference",
  "radar-overlay",
  "performance-distribution",
  "exam-results",
  "weekly-engagement",
  "chat-satisfaction",
] as const;
export type ComparisonInsightChart = (typeof COMPARISON_INSIGHT_CHARTS)[number];
export const isComparisonInsightChart = (value: unknown): value is ComparisonInsightChart =>
  (COMPARISON_INSIGHT_CHARTS as readonly unknown[]).indexOf(value) !== -1;

const BANDS = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 100]];

/** Same numbers the chart shows, computed here for both selections (never taken from the browser). */
async function comparisonChartData(chart: ComparisonInsightChart, filters: Filters) {
  if (chart === "topic-difference") {
    return (await getTopicPerformance(filters)).map((row) => ({ topic: row.topic, successPercentage: row.successPercentage }));
  }
  if (chart === "radar-overlay") return getProficiencyRadar(filters);
  if (chart === "performance-distribution") {
    const values = (await getEffortMatrix(filters)).points
      .map((point) => point.performance)
      .filter((value): value is number => typeof value === "number");
    return {
      assessedStudents: values.length,
      bands: BANDS.map(([from, to], index) => ({
        band: `${from}-${to}%`,
        students: values.filter((value) => value >= from && (index === BANDS.length - 1 ? value <= to : value < to)).length,
      })),
    };
  }
  if (chart === "exam-results") {
    const result = await examResults(filters);
    return { ...result, exams: result.exams.map((exam, index) => ({ ...exam, title: `prova_${index + 1}` })) };
  }
  if (chart === "weekly-engagement") return weeklyEngagement(filters);
  return chatSatisfaction(filters);
}

function comparisonHasData(chart: ComparisonInsightChart, data: unknown) {
  if (chart === "chat-satisfaction") return (data as { available: boolean }).available;
  if (chart === "performance-distribution") return (data as { assessedStudents: number }).assessedStudents > 0;
  if (chart === "exam-results") return (data as { exams: unknown[] }).exams.length > 0;
  if (chart === "weekly-engagement") return (data as { weeks: unknown[] }).weeks.length > 0;
  return containsUsefulData(data);
}

export async function generateComparisonChartInsight(input: { chart: ComparisonInsightChart; a: Filters; b: Filters; force?: boolean; released?: Released }): Promise<InsightResponse> {
  assertChartReleased(input.chart, input.released ?? {});
  const [a, b] = await Promise.all([comparisonChartData(input.chart, input.a), comparisonChartData(input.chart, input.b)]);
  if (!comparisonHasData(input.chart, a) || !comparisonHasData(input.chart, b)) throw new AppError("insights.comparisonDataInsufficient", 422);
  return generateCached(
    { type: "comparison-chart", chart: input.chart, a: input.a, b: input.b, dataA: a, dataB: b },
    Boolean(input.force),
    async () => {
      const response = await askDashboardInsightsAgent(t("insights.comparisonChartPrompt", {
        title: t(`insights.compareCharts.${input.chart}.title` as never),
        description: t(`insights.compareCharts.${input.chart}.description` as never),
        scopeA: scopeLabel(input.a), scopeB: scopeLabel(input.b),
        dataA: JSON.stringify(anonymize(a)), dataB: JSON.stringify(anonymize(b)),
      }));
      return { insight: response.text, language: getLanguage(), generatedAt: new Date().toISOString() };
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
