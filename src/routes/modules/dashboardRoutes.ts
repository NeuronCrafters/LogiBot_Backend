import { Router } from "express";
import { asc, eq, gte, inArray, isNotNull, lte, and } from "drizzle-orm";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { getDb } from "../../db/client";
import { analysisSessions, answerAttempts, userAnalyses } from "../../db/schema";
import { aggregateByCategory, analysisWhere, queryQuestions, type Filters } from "../routeHelpers";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRoles(["admin", "professor", "course-coordinator"]));

dashboardRouter.post("/topic-performance", asyncHandler(async (req, res) => {
  const byCategory = aggregateByCategory(await queryQuestions(req.body));
  return res.json(Object.entries(byCategory).map(([topic, values]) => {
    const total = values.correct + values.wrong;
    return { topic, successPercentage: total ? Number(((values.correct / total) * 100).toFixed(1)) : 0, errorPercentage: total ? Number(((values.wrong / total) * 100).toFixed(1)) : 0 };
  }));
}));

dashboardRouter.post("/proficiency-radar", asyncHandler(async (req, res) => {
  const byCategory = aggregateByCategory(await queryQuestions(req.body));
  const labels = Object.keys(byCategory).sort();
  return res.json({ labels, data: labels.map((label) => {
    const total = byCategory[label].correct + byCategory[label].wrong;
    return total ? Number(((byCategory[label].correct / total) * 100).toFixed(1)) : 0;
  }) });
}));

dashboardRouter.post("/effort-matrix", asyncHandler(async (req, res) => {
  const where = analysisWhere(req.body);
  const rows = where ? await getDb().select().from(userAnalyses).where(where) : await getDb().select().from(userAnalyses);
  if (!rows.length) return res.json({ points: [], averages: { avgPerformance: 0, avgEffort: 0 } });
  const points = rows.map((row) => {
    const total = row.totalCorrectAnswers + row.totalWrongAnswers;
    return { name: row.name, performance: total ? Number(((row.totalCorrectAnswers / total) * 100).toFixed(1)) : 0, effort: Number(((row.totalUsageTime || 0) / 60).toFixed(1)) };
  });
  return res.json({ points, averages: { avgPerformance: Number((points.reduce((sum, point) => sum + point.performance, 0) / points.length).toFixed(1)), avgEffort: Number((points.reduce((sum, point) => sum + point.effort, 0) / points.length).toFixed(1)) } });
}));

dashboardRouter.post("/learning-journey", asyncHandler(async (req, res) => {
  const rows = await getDb()
    .select({
      userId: userAnalyses.userId,
      createdAt: answerAttempts.createdAt,
      totalCorrectAnswers: answerAttempts.totalCorrectAnswers,
      totalWrongAnswers: answerAttempts.totalWrongAnswers,
    })
    .from(answerAttempts)
    .innerJoin(analysisSessions, eq(analysisSessions.id, answerAttempts.sessionId))
    .innerJoin(userAnalyses, eq(userAnalyses.id, analysisSessions.analysisId))
    .where(analysisWhere(req.body))
    .orderBy(asc(userAnalyses.userId), asc(answerAttempts.createdAt));

  if (!rows.length) return res.json({ labels: [], data: [] });

  const attemptsByStudent = new Map<string, typeof rows>();
  for (const row of rows) {
    const attempts = attemptsByStudent.get(row.userId) ?? [];
    attempts.push(row);
    attemptsByStudent.set(row.userId, attempts);
  }

  const attemptsByPosition: { total: number; count: number }[] = [];
  for (const attempts of attemptsByStudent.values()) {
    attempts.forEach((attempt, index) => {
      const answers = attempt.totalCorrectAnswers + attempt.totalWrongAnswers;
      if (!answers) return;
      if (!attemptsByPosition[index]) attemptsByPosition[index] = { total: 0, count: 0 };
      attemptsByPosition[index].total += (attempt.totalCorrectAnswers / answers) * 100;
      attemptsByPosition[index].count += 1;
    });
  }

  const labels: string[] = [];
  const data: number[] = [];
  attemptsByPosition.forEach((attempt, index) => {
    if (!attempt?.count) return;
    labels.push(`Quiz ${index + 1}`);
    data.push(Number((attempt.total / attempt.count).toFixed(1)));
  });
  return res.json({ labels, data });
}));

dashboardRouter.post("/session-details", asyncHandler(async (req, res) => {
  const filters = req.body as Filters & { startDate?: string; endDate?: string };
  const analyses = await getDb().select({ id: userAnalyses.id }).from(userAnalyses).where(analysisWhere(filters));
  if (!analyses.length) return res.json([]);
  const conditions = [inArray(analysisSessions.analysisId, analyses.map((item) => item.id)), isNotNull(analysisSessions.sessionEnd)];
  if (filters.startDate) conditions.push(gte(analysisSessions.sessionStart, new Date(filters.startDate)));
  if (filters.endDate) conditions.push(lte(analysisSessions.sessionStart, new Date(filters.endDate)));
  const rows = await getDb().select({ startTime: analysisSessions.sessionStart, endTime: analysisSessions.sessionEnd }).from(analysisSessions).where(and(...conditions));
  return res.json(rows);
}));

dashboardRouter.post("/access-pattern", asyncHandler(async (req, res) => {
  const analyses = await getDb().select({ id: userAnalyses.id }).from(userAnalyses).where(analysisWhere(req.body));
  if (!analyses.length) return res.json([]);
  const sessions = await getDb().select({ sessionStart: analysisSessions.sessionStart }).from(analysisSessions).where(inArray(analysisSessions.analysisId, analyses.map((item) => item.id)));
  const pattern: Record<string, number> = {};
  for (const session of sessions) {
    const date = new Date(session.sessionStart);
    const key = `${date.getUTCDay()}-${date.getUTCHours()}`;
    pattern[key] = (pattern[key] || 0) + 1;
  }
  return res.json(Object.entries(pattern).map(([key, count]) => [...key.split("-").map(Number), count]));
}));
