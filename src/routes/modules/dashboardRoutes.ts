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
  isDashboardInsightChart,
} from "../../services/dashboard/dashboardInsightsService";
import { assertDashboardScopeAccess } from "../../services/dashboard/dashboardPermissionService";
import { AppError } from "../../exceptions/AppError";
import type { Filters } from "../../services/analytics/analyticsService";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseInsightFilters(value: unknown): Filters {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError("filters deve ser um objeto", 400);

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
      throw new AppError(`${key} inválido`, 400);
    filters[key] = raw[key];
  }
  for (const key of ["startDate", "endDate"] as const) {
    if (raw[key] === undefined || raw[key] === "") continue;
    if (
      typeof raw[key] !== "string" ||
      Number.isNaN(new Date(raw[key]).getTime())
    )
      throw new AppError(`${key} inválido`, 400);
    filters[key] = raw[key];
  }

  if (!filters.universityId)
    throw new AppError("universityId é obrigatório", 400);
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
      throw new AppError("chart inválido", 400);
    const filters = parseInsightFilters(req.body?.filters);
    await assertDashboardScopeAccess(req.user!, filters);
    return res.json(
      await generateChartInsight({
        chart: req.body.chart,
        filters,
        force: req.body.force === true,
      }),
    );
  }),
);

dashboardRouter.post(
  "/insights/overview",
  asyncHandler(async (req, res) => {
    const filters = parseInsightFilters(req.body?.filters);
    await assertDashboardScopeAccess(req.user!, filters);
    return res.json(
      await generateOverviewInsight({
        filters,
        force: req.body.force === true,
      }),
    );
  }),
);

dashboardRouter.post(
  "/topic-performance",
  asyncHandler(async (req, res) => {
    return res.json(await getTopicPerformance(req.body));
  }),
);

dashboardRouter.post(
  "/proficiency-radar",
  asyncHandler(async (req, res) => {
    return res.json(await getProficiencyRadar(req.body));
  }),
);

dashboardRouter.post(
  "/effort-matrix",
  asyncHandler(async (req, res) => {
    return res.json(await getEffortMatrix(req.body));
  }),
);

dashboardRouter.post(
  "/learning-journey",
  asyncHandler(async (req, res) => {
    return res.json(await getLearningJourney(req.body));
  }),
);

dashboardRouter.post(
  "/session-details",
  asyncHandler(async (req, res) => {
    return res.json(await getSessionDetails(req.body));
  }),
);

dashboardRouter.post(
  "/access-pattern",
  asyncHandler(async (req, res) => {
    return res.json(await getAccessPattern(req.body));
  }),
);
