import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { entityFilters, parseScopeFilters, requireDashboardScope } from "../../http/dashboardScope";
import { getDb } from "../../db/client";
import {
  accounts,
  classDisciplines,
  professorClasses,
  professorDisciplines,
  studentProfiles,
  userAnalyses,
} from "../../db/schema";
import {
  getEmptySummary,
  getSummary,
  summaryByEntity,
} from "../../services/analytics/analyticsService";

export const logRouter = Router();

logRouter.use(
  requireAuth,
  requireRoles(["admin", "professor", "course-coordinator"]),
);

logRouter.post(
  "/students/summary",
  requireDashboardScope((req) => parseScopeFilters(req.body)),
  asyncHandler(async (_req, res) => {
    if (!res.locals.scope.universityId)
      throw new AppError("analytics.universityRequired", 400);
    return res.json(await getSummary(res.locals.scope));
  }),
);

logRouter.get(
  "/universities/:universityId/summary",
  requireRoles(["admin"]),
  asyncHandler(async (req, res) => {
    return res.json(
      await getSummary({ universityId: req.params.universityId }),
    );
  }),
);

logRouter.get(
  "/courses/:courseId/summary",
  requireDashboardScope((req) => entityFilters("courses", req.params.courseId)),
  asyncHandler(async (req, res) => {
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.courseId, req.params.courseId))
      .limit(1);
    return res.json(
      analysis
        ? await getSummary({
            universityId: analysis.schoolId,
            courseId: req.params.courseId,
          })
        : getEmptySummary(),
    );
  }),
);

logRouter.get(
  "/classes/:classId/summary",
  requireDashboardScope((req) => entityFilters("classes", req.params.classId)),
  asyncHandler(async (req, res) => {
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.classId, req.params.classId))
      .limit(1);
    return res.json(
      analysis
        ? await getSummary({
            universityId: analysis.schoolId,
            courseId: analysis.courseId,
            classId: req.params.classId,
          })
        : getEmptySummary(),
    );
  }),
);

logRouter.get(
  "/disciplines/:disciplineId/summary",
  requireDashboardScope((req) => entityFilters("disciplines", req.params.disciplineId)),
  asyncHandler(async (req, res) => {
    return res.json(
      await summaryByEntity("discipline", req.params.disciplineId),
    );
  }),
);

logRouter.get(
  "/professor/students",
  asyncHandler(async (req, res) => {
    const professorId = req.user!.id;
    const [directClassLinks, disciplineLinks] = await Promise.all([
      getDb()
        .select({ classId: professorClasses.classId })
        .from(professorClasses)
        .where(eq(professorClasses.professorId, professorId)),
      getDb()
        .select({ disciplineId: professorDisciplines.disciplineId })
        .from(professorDisciplines)
        .where(eq(professorDisciplines.professorId, professorId)),
    ]);

    const classIds = new Set(directClassLinks.map((link) => link.classId));
    if (disciplineLinks.length) {
      const classLinks = await getDb()
        .select({ classId: classDisciplines.classId })
        .from(classDisciplines)
        .where(
          inArray(
            classDisciplines.disciplineId,
            disciplineLinks.map((link) => link.disciplineId),
          ),
        );
      classLinks.forEach((link) => classIds.add(link.classId));
    }

    if (!classIds.size) return res.json({ students: [] });
    const studentRows = await getDb()
      .select({ studentId: studentProfiles.accountId })
      .from(studentProfiles)
      .where(inArray(studentProfiles.classId, [...classIds]));
    if (!studentRows.length) return res.json({ students: [] });

    const rows = await getDb()
      .select({
        id: accounts.id,
        name: accounts.name,
        email: accounts.email,
        photo: accounts.photo,
      })
      .from(accounts)
      .where(
        inArray(accounts.id, [
          ...new Set(studentRows.map((link) => link.studentId)),
        ]),
      );
    return res.json({ students: rows.map((row) => ({ ...row, _id: row.id })) });
  }),
);

logRouter.get(
  "/professor/students/:studentId",
  requireDashboardScope((req) => parseScopeFilters({ studentId: req.params.studentId, disciplineId: req.query.disciplineId })),
  asyncHandler(async (req, res) => {
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.userId, req.params.studentId))
      .limit(1);
    return res.json(
      analysis
        ? await getSummary({
            universityId: analysis.schoolId,
            courseId: analysis.courseId,
            classId: analysis.classId,
            studentId: req.params.studentId,
            disciplineId:
              typeof req.query.disciplineId === "string"
                ? req.query.disciplineId
                : undefined,
          })
        : getEmptySummary(),
    );
  }),
);

logRouter.get("/professor/student-stats", (_req, res) =>
  res.json({ totalStudents: 0, avgCorrect: 0, avgWrong: 0, avgUsageTime: 0 }),
);

logRouter.get(
  "/:entity/:id/accuracy",
  requireDashboardScope((req) => entityFilters(req.params.entity, req.params.id)),
  asyncHandler(async (req, res) => {
    const summary = await summaryByEntity(req.params.entity, req.params.id);
    const total = summary.totalCorrectAnswers + summary.totalWrongAnswers;
    return res.json({
      correct: summary.totalCorrectAnswers,
      wrong: summary.totalWrongAnswers,
      accuracy: total
        ? Number(((summary.totalCorrectAnswers / total) * 100).toFixed(1))
        : 0,
    });
  }),
);

logRouter.get(
  "/:entity/:id/usage",
  requireDashboardScope((req) => entityFilters(req.params.entity, req.params.id)),
  asyncHandler(async (req, res) => {
    const summary = await summaryByEntity(req.params.entity, req.params.id);
    return res.json({
      usageTime: summary.usageTime,
      usageTimeInSeconds: summary.usageTimeInSeconds,
      estimatedUsageTimeInSeconds: summary.estimatedUsageTimeInSeconds,
      estimatedSessionCount: summary.estimatedSessionCount,
      undeterminedSessionCount: summary.undeterminedSessionCount,
      dailyUsage: summary.dailyUsage,
    });
  }),
);

logRouter.get(
  "/:entity/:id/subjects/summary",
  requireDashboardScope((req) => entityFilters(req.params.entity, req.params.id)),
  asyncHandler(async (req, res) => {
    const summary = await summaryByEntity(req.params.entity, req.params.id);
    return res.json({ subjectCounts: summary.subjectCounts });
  }),
);
