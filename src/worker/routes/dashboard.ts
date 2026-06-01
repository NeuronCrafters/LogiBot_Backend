import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import {
  analysisSessions,
  answerAttempts,
  answerQuestions,
  userAnalyses,
} from "../../db/schema";
import { subcategories } from "../../services/bot/quiz/quizData";
import { getDb } from "../db/client";
import { requireAuth, requireRoles } from "../http/auth";
import type { AppBindings } from "../types";

export const dashboardRoutes = new Hono<AppBindings>();

dashboardRoutes.use("/dashboard/*", requireAuth);
dashboardRoutes.use("/dashboard/*", requireRoles(["admin", "professor", "course-coordinator"]));

// subcategory (e.g. "o_que_são_variáveis") → category (e.g. "variáveis")
const subcategoryToCategory: Record<string, string> = {};
for (const [category, subs] of Object.entries(subcategories)) {
  for (const sub of subs) subcategoryToCategory[sub] = category;
}

type Filters = {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
};

function analysisWhere(f: Filters) {
  const conds = [];
  if (f.universityId) conds.push(eq(userAnalyses.schoolId, f.universityId));
  if (f.courseId) conds.push(eq(userAnalyses.courseId, f.courseId));
  if (f.classId) conds.push(eq(userAnalyses.classId, f.classId));
  if (f.studentId) conds.push(eq(userAnalyses.userId, f.studentId));
  return conds.length > 0 ? and(...conds) : undefined;
}

// Queries answer_questions joined all the way up to user_analyses
async function queryQuestions(db: ReturnType<typeof getDb>, f: Filters) {
  return db
    .select({ subject: answerQuestions.subject, isCorrect: answerQuestions.isCorrect, timestamp: answerQuestions.timestamp })
    .from(answerQuestions)
    .innerJoin(answerAttempts, eq(answerAttempts.id, answerQuestions.attemptId))
    .innerJoin(analysisSessions, eq(analysisSessions.id, answerAttempts.sessionId))
    .innerJoin(userAnalyses, eq(userAnalyses.id, analysisSessions.analysisId))
    .where(analysisWhere(f));
}

// Aggregates questions by category → {correct, wrong}
function aggregateByCategory(rows: { subject: string; isCorrect: boolean }[]) {
  const map: Record<string, { correct: number; wrong: number }> = {};
  for (const row of rows) {
    const cat = subcategoryToCategory[row.subject] ?? row.subject;
    if (!map[cat]) map[cat] = { correct: 0, wrong: 0 };
    if (row.isCorrect) map[cat].correct++;
    else map[cat].wrong++;
  }
  return map;
}

// POST /dashboard/topic-performance
dashboardRoutes.post("/dashboard/topic-performance", async (c) => {
  const filters = await c.req.json<Filters>();
  const db = getDb(c.env);
  const rows = await queryQuestions(db, filters);
  const byCategory = aggregateByCategory(rows);

  const result = Object.entries(byCategory).map(([topic, { correct, wrong }]) => {
    const total = correct + wrong;
    return {
      topic,
      successPercentage: total > 0 ? parseFloat(((correct / total) * 100).toFixed(1)) : 0,
      errorPercentage: total > 0 ? parseFloat(((wrong / total) * 100).toFixed(1)) : 0,
    };
  });

  return c.json(result.sort((a, b) => a.successPercentage - b.successPercentage));
});

// POST /dashboard/proficiency-radar
dashboardRoutes.post("/dashboard/proficiency-radar", async (c) => {
  const filters = await c.req.json<Filters>();
  const db = getDb(c.env);
  const rows = await queryQuestions(db, filters);
  const byCategory = aggregateByCategory(rows);

  const sorted = Object.keys(byCategory).sort();
  return c.json({
    labels: sorted,
    data: sorted.map((cat) => {
      const { correct, wrong } = byCategory[cat];
      const total = correct + wrong;
      return total > 0 ? parseFloat(((correct / total) * 100).toFixed(1)) : 0;
    }),
  });
});

// POST /dashboard/effort-matrix
dashboardRoutes.post("/dashboard/effort-matrix", async (c) => {
  const filters = await c.req.json<Filters>();
  const db = getDb(c.env);

  const users = await db
    .select({
      name: userAnalyses.name,
      className: userAnalyses.className,
      totalUsageTime: userAnalyses.totalUsageTime,
      totalCorrectAnswers: userAnalyses.totalCorrectAnswers,
      totalWrongAnswers: userAnalyses.totalWrongAnswers,
    })
    .from(userAnalyses)
    .where(analysisWhere(filters));

  if (users.length === 0) {
    return c.json({ points: [], averages: { avgPerformance: 0, avgEffort: 0 } });
  }

  const toPoint = (u: (typeof users)[number], name?: string) => {
    const total = u.totalCorrectAnswers + u.totalWrongAnswers;
    return {
      name: name ?? u.name,
      performance: parseFloat((total > 0 ? (u.totalCorrectAnswers / total) * 100 : 0).toFixed(1)),
      effort: parseFloat(((u.totalUsageTime ?? 0) / 60).toFixed(1)),
    };
  };
  const jitter = (v: number, max: number) =>
    parseFloat((v + (Math.random() * max * 2 - max)).toFixed(1));

  // Single student + class: show student vs class average
  if (filters.studentId && filters.classId && users.length >= 1) {
    const student = users[0];
    const classUsers = await db
      .select({ totalUsageTime: userAnalyses.totalUsageTime, totalCorrectAnswers: userAnalyses.totalCorrectAnswers, totalWrongAnswers: userAnalyses.totalWrongAnswers })
      .from(userAnalyses)
      .where(eq(userAnalyses.classId, filters.classId));

    const classAvgPerf = classUsers.length > 0
      ? classUsers.reduce((s, u) => { const t = u.totalCorrectAnswers + u.totalWrongAnswers; return s + (t > 0 ? (u.totalCorrectAnswers / t) * 100 : 0); }, 0) / classUsers.length
      : 0;
    const classAvgEffort = classUsers.length > 0
      ? classUsers.reduce((s, u) => s + (u.totalUsageTime ?? 0) / 60, 0) / classUsers.length
      : 0;

    const orig = toPoint(student);
    const studentPoint = { ...orig, effort: jitter(orig.effort, 0.05), performance: jitter(orig.performance, 0.5), originalEffort: orig.effort, originalPerformance: orig.performance };
    const avgPoint = { name: `Média da Turma (${student.className ?? "Turma"})`, performance: parseFloat(classAvgPerf.toFixed(1)), effort: parseFloat(classAvgEffort.toFixed(1)), isAverage: true };

    return c.json({ points: [studentPoint, avgPoint], averages: { avgPerformance: avgPoint.performance, avgEffort: avgPoint.effort } });
  }

  let totalPerf = 0;
  let totalEff = 0;
  const points = users.map((u) => {
    const p = toPoint(u);
    totalPerf += p.performance;
    totalEff += p.effort;
    return { ...p, effort: jitter(p.effort, 0.05), performance: jitter(p.performance, 0.5), originalEffort: p.effort, originalPerformance: p.performance };
  });

  const avgPerformance = parseFloat((totalPerf / users.length).toFixed(1));
  const avgEffort = parseFloat((totalEff / users.length).toFixed(1));
  const averageName = filters.classId ? "Média da Turma" : filters.courseId ? "Média do Curso" : filters.universityId ? "Média da Universidade" : "Média do Grupo";
  points.push({ name: averageName, performance: avgPerformance, effort: avgEffort, isAverage: true } as typeof points[number] & { isAverage: boolean });

  return c.json({ points, averages: { avgPerformance, avgEffort } });
});

// POST /dashboard/learning-journey
dashboardRoutes.post("/dashboard/learning-journey", async (c) => {
  const filters = await c.req.json<Filters>();
  const db = getDb(c.env);
  const rows = await (db
    .select({ isCorrect: answerQuestions.isCorrect })
    .from(answerQuestions)
    .innerJoin(answerAttempts, eq(answerAttempts.id, answerQuestions.attemptId))
    .innerJoin(analysisSessions, eq(analysisSessions.id, answerAttempts.sessionId))
    .innerJoin(userAnalyses, eq(userAnalyses.id, analysisSessions.analysisId))
    .where(analysisWhere(filters))
    .orderBy(asc(answerQuestions.timestamp)));

  if (rows.length === 0) return c.json({ labels: [], data: [] });

  const numBlocks = rows.length < 20 ? Math.max(1, Math.floor(rows.length / 4)) : 5;
  const blockSize = Math.ceil(rows.length / numBlocks);
  const labels: string[] = [];
  const data: number[] = [];

  for (let i = 0; i < rows.length; i += blockSize) {
    const block = rows.slice(i, i + blockSize);
    if (!block.length) continue;
    const correct = block.filter((q) => q.isCorrect).length;
    data.push(parseFloat(((correct / block.length) * 100).toFixed(1)));
    const start = i + 1;
    const end = i + block.length;
    labels.push(start === end ? `Questão ${start}` : `Questões ${start}-${end}`);
  }

  return c.json({ labels, data });
});

// POST /dashboard/session-details
dashboardRoutes.post("/dashboard/session-details", async (c) => {
  const { universityId, courseId, classId, studentId, startDate, endDate } =
    await c.req.json<Filters & { startDate?: string; endDate?: string }>();
  const db = getDb(c.env);

  const analyses = await db
    .select({ id: userAnalyses.id })
    .from(userAnalyses)
    .where(analysisWhere({ universityId, courseId, classId, studentId }));

  if (!analyses.length) return c.json([]);

  const analysisIds = analyses.map((a) => a.id);
  const sessionConds: ReturnType<typeof eq>[] = [
    inArray(analysisSessions.analysisId, analysisIds) as ReturnType<typeof eq>,
    isNotNull(analysisSessions.sessionEnd) as ReturnType<typeof eq>,
  ];

  if (startDate && endDate) {
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    sessionConds.push(gte(analysisSessions.sessionStart, new Date(startDate)) as ReturnType<typeof eq>);
    sessionConds.push(lte(analysisSessions.sessionStart, end) as ReturnType<typeof eq>);
  }

  const sessions = await db
    .select({ startTime: analysisSessions.sessionStart, endTime: analysisSessions.sessionEnd })
    .from(analysisSessions)
    .where(and(...sessionConds));

  return c.json(sessions);
});

// POST /dashboard/access-pattern
dashboardRoutes.post("/dashboard/access-pattern", async (c) => {
  const filters = await c.req.json<Filters>();
  const db = getDb(c.env);

  const analyses = await db
    .select({ id: userAnalyses.id })
    .from(userAnalyses)
    .where(analysisWhere(filters));

  if (!analyses.length) return c.json([]);

  const analysisIds = analyses.map((a) => a.id);
  const sessions = await db
    .select({ sessionStart: analysisSessions.sessionStart })
    .from(analysisSessions)
    .where(and(inArray(analysisSessions.analysisId, analysisIds), isNotNull(analysisSessions.sessionStart)));

  // Group [dayOfWeek, hour] → count, using UTC-3 (Brazil standard time)
  const pattern: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.sessionStart) continue;
    const d = new Date(s.sessionStart);
    const localHour = (d.getUTCHours() - 3 + 24) % 24;
    const localDay = new Date(d.getTime() - 3 * 60 * 60 * 1000).getUTCDay();
    const key = `${localDay}-${localHour}`;
    pattern[key] = (pattern[key] ?? 0) + 1;
  }

  const result: [number, number, number][] = Object.entries(pattern).map(([key, value]) => {
    const [day, hour] = key.split("-").map(Number);
    return [day, hour, value];
  });

  return c.json(result);
});
