import { getDb } from "../../db/client";
import { featuresFor, requireFeature } from "../../services/features/featureService";
import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import {
  getAccessPattern,
  getEffortMatrix,
  getLearningJourney,
  getProficiencyRadar,
  getSessionDetails,
  getTopicPerformance,
} from "../../services/dashboard/dashboardService";
import {
  generateChartInsight,
  generateOverviewInsight,
  generateComparisonInsight,
  generateComparisonChartInsight,
  isComparisonInsightChart,
  isDashboardInsightChart,
} from "../../services/dashboard/dashboardInsightsService";
import { chatSatisfaction, examResults, weeklyEngagement } from "../../services/dashboard/dashboardComparisonService";
import { assertDashboardScopeAccess } from "../../services/dashboard/dashboardPermissionService";
import { AppError } from "../../exceptions/AppError";
import { parseScopeFilters, requireDashboardScope } from "../../http/dashboardScope";
import type { Filters } from "../../services/analytics/analyticsService";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseInsightFilters(value: unknown): Filters {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("insights.filtersObjectRequired", 400);

  const raw = value as Record<string, unknown>;
  const filters: Filters = {};
  for (const key of [
    "universityId",
    "courseId",
    "classId",
    "studentId",
    "disciplineId",
  ] as const) {
    if (raw[key] === undefined || raw[key] === "") continue;
    if (typeof raw[key] !== "string" || !UUID_PATTERN.test(raw[key]))
      throw new AppError({ key: "validation.fieldInvalid", params: { value0: key } }, 400);
    filters[key] = raw[key];
  }
  for (const key of ["startDate", "endDate"] as const) {
    if (raw[key] === undefined || raw[key] === "") continue;
    if (
      typeof raw[key] !== "string" ||
      Number.isNaN(new Date(raw[key]).getTime())
    )
      throw new AppError({ key: "validation.fieldInvalid", params: { value0: key } }, 400);
    filters[key] = raw[key];
  }

  if (!filters.universityId)
    throw new AppError("insights.universityFieldRequired", 400);
  return filters;
}

export const dashboardRouter = Router();

dashboardRouter.use(
  requireAuth,
  requireRoles(["admin", "professor", "course-coordinator"]),
);

dashboardRouter.post(
  "/insights/chart",
  asyncHandler(async (req, res) => {
    if (!isDashboardInsightChart(req.body?.chart))
      throw new AppError("insights.chartFieldInvalid", 400);
    const filters = parseInsightFilters(req.body?.filters);
    await assertDashboardScopeAccess(req.user!, filters);
    return res.json(
      await generateChartInsight({
        chart: req.body.chart,
        filters,
        force: req.body.force === true,
        released: await featuresFor(getDb(), req.user!),
      }),
    );
  }),
);

dashboardRouter.post(
  "/insights/comparison",
  asyncHandler(async (req, res) => {
    const a = parseInsightFilters(req.body?.a);
    const b = parseInsightFilters(req.body?.b);
    // Both selections must be inside the person's scope.
    await assertDashboardScopeAccess(req.user!, a);
    await assertDashboardScopeAccess(req.user!, b);
    return res.json(await generateComparisonInsight({ a, b, force: req.body.force === true, released: await featuresFor(getDb(), req.user!) }));
  }),
);

// Analysis of one direct comparison chart; both selections must be inside the person's scope.
dashboardRouter.post(
  "/insights/comparison-chart",
  asyncHandler(async (req, res) => {
    if (!isComparisonInsightChart(req.body?.chart)) throw new AppError("insights.chartFieldInvalid", 400);
    const a = parseInsightFilters(req.body?.a);
    const b = parseInsightFilters(req.body?.b);
    await assertDashboardScopeAccess(req.user!, a);
    await assertDashboardScopeAccess(req.user!, b);
    return res.json(await generateComparisonChartInsight({ chart: req.body.chart, a, b, force: req.body.force === true, released: await featuresFor(getDb(), req.user!) }));
  }),
);

// Data of the new comparison charts, one selection per request, with the scope checked.
for (const [path, load, feature] of [
  ["/compare/exams", examResults, "exams"],
  ["/compare/engagement", weeklyEngagement, null],
  ["/compare/chat-satisfaction", chatSatisfaction, "chat"],
] as const) {
  // Data of a turned-off feature is never sent, whatever screen asks for it.
  dashboardRouter.post(path, requireFeature(() => feature), asyncHandler(async (req, res) => {
    const filters = parseInsightFilters(req.body);
    await assertDashboardScopeAccess(req.user!, filters);
    return res.json(await load(filters));
  }));
}

dashboardRouter.post(
  "/insights/overview",
  asyncHandler(async (req, res) => {
    const filters = parseInsightFilters(req.body?.filters);
    await assertDashboardScopeAccess(req.user!, filters);
    return res.json(
      await generateOverviewInsight({
        filters,
        force: req.body.force === true,
        released: await featuresFor(getDb(), req.user!),
      }),
    );
  }),
);

dashboardRouter.post(
  "/topic-performance",
  requireFeature("quiz"),
  requireDashboardScope((req) => parseScopeFilters(req.body)),
  asyncHandler(async (_req, res) => res.json(await getTopicPerformance(res.locals.scope))),
);

dashboardRouter.post(
  "/proficiency-radar",
  requireFeature("quiz"),
  requireDashboardScope((req) => parseScopeFilters(req.body)),
  asyncHandler(async (_req, res) => res.json(await getProficiencyRadar(res.locals.scope))),
);

dashboardRouter.post(
  "/effort-matrix",
  requireFeature("quiz"),
  requireDashboardScope((req) => parseScopeFilters(req.body)),
  asyncHandler(async (_req, res) => res.json(await getEffortMatrix(res.locals.scope))),
);

dashboardRouter.post(
  "/learning-journey",
  requireFeature("quiz"),
  requireDashboardScope((req) => parseScopeFilters(req.body)),
  asyncHandler(async (_req, res) => res.json(await getLearningJourney(res.locals.scope))),
);

dashboardRouter.post(
  "/session-details",
  requireDashboardScope((req) => parseScopeFilters(req.body)),
  asyncHandler(async (_req, res) => res.json(await getSessionDetails(res.locals.scope))),
);

dashboardRouter.post(
  "/access-pattern",
  requireDashboardScope((req) => parseScopeFilters(req.body)),
  asyncHandler(async (_req, res) => res.json(await getAccessPattern(res.locals.scope))),
);
