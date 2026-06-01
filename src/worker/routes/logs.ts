import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import {
  accounts,
  analysisSessions,
  classDisciplines,
  professorCourses,
  professorDisciplines,
  studentDisciplines,
  studentProfiles,
  userAnalyses,
} from "../../db/schema";
import { getDb } from "../db/client";
import { HttpError } from "../errors";
import { requireAuth, requireRoles } from "../http/auth";
import type { AppBindings } from "../types";

export const logsRoutes = new Hono<AppBindings>();

logsRoutes.use("/logs/*", requireAuth);
logsRoutes.use("/logs/*", requireRoles(["admin", "professor", "course-coordinator"]));

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatSeconds(seconds: number) {
  const s = Math.max(0, Math.round(isNaN(seconds) ? 0 : seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    totalSeconds: s,
    hours: h,
    minutes: m,
    seconds: sec,
    formatted: `${pad(h)}:${pad(m)}:${pad(sec)}`,
    humanized: h > 0 ? `${h}h ${m}min ${sec}s` : m > 0 ? `${m}min ${sec}s` : `${sec}s`,
  };
}

function emptySubjectCounts() {
  return { variaveis: 0, listas: 0, condicionais: 0, verificacoes: 0, operadores_logicos: 0, funcoes: 0, repeticao: 0 };
}

function mergeSubjectCounts(target: Record<string, number>, chat: Record<string, unknown>) {
  // Map new-style keys (from normalizeSubjectFromMessage) to old-style response keys
  target.variaveis += ((chat.variaveis as number) ?? 0) + ((chat.tipos as number) ?? 0);
  target.funcoes += (chat.funcoes as number) ?? 0;
  target.verificacoes += (chat.verificacoes as number) ?? 0;
  target.repeticao += ((chat.repeticao as number) ?? 0) + ((chat.loops as number) ?? 0);
  // listas, condicionais, operadores_logicos not tracked by current normalizer — keep at 0
}

function buildDailyUsage(sessions: { date: string; sessionStart: Date | null; sessionEnd: Date | null; sessionDuration: number; userId: string; userName: string }[]) {
  const byDay: Record<string, { date: string; usage: number; formatted: string; sessions: typeof sessions }> = {};
  for (const s of sessions) {
    if (!s.date) continue;
    if (!byDay[s.date]) byDay[s.date] = { date: s.date, usage: 0, formatted: "00:00:00", sessions: [] };
    byDay[s.date].usage += s.sessionDuration / 60;
    byDay[s.date].sessions.push(s);
  }
  for (const day of Object.values(byDay)) {
    day.formatted = formatSeconds(Math.round(day.usage * 60)).formatted;
  }
  return Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date));
}

async function getSummary(db: ReturnType<typeof getDb>, filters: { universityId: string; courseId?: string; classId?: string; studentId?: string }) {
  const conds = [eq(userAnalyses.schoolId, filters.universityId)];
  if (filters.courseId) conds.push(eq(userAnalyses.courseId, filters.courseId));
  if (filters.classId) conds.push(eq(userAnalyses.classId, filters.classId));
  if (filters.studentId) conds.push(eq(userAnalyses.userId, filters.studentId));

  const analyses = await db.select().from(userAnalyses).where(and(...conds));
  if (!analyses.length) return getEmptySummary();

  const analysisIds = analyses.map((a) => a.id);
  const sessionRows = await db
    .select()
    .from(analysisSessions)
    .where(and(inArray(analysisSessions.analysisId, analysisIds)))
    .orderBy(desc(analysisSessions.sessionStart));

  // Build analysis→name lookup
  const analysisUserMap = new Map(analyses.map((a) => [a.id, { userId: a.userId, name: a.name }]));

  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const subjectCounts = emptySubjectCounts();
  const processedSessions: { date: string; sessionStart: Date | null; sessionEnd: Date | null; sessionDuration: number; userId: string; userName: string; usage: number; formatted: string }[] = [];

  for (const a of analyses) {
    totalCorrectAnswers += a.totalCorrectAnswers;
    totalWrongAnswers += a.totalWrongAnswers;
    totalUsageTime += a.totalUsageTime ?? 0;
  }

  for (const s of sessionRows) {
    if (s.subjectCountsChat) mergeSubjectCounts(subjectCounts, s.subjectCountsChat as Record<string, unknown>);

    if (s.sessionStart && s.sessionEnd && s.sessionDuration) {
      const info = analysisUserMap.get(s.analysisId);
      const date = new Date(s.sessionStart).toISOString().split("T")[0];
      processedSessions.push({
        date,
        sessionStart: s.sessionStart,
        sessionEnd: s.sessionEnd,
        sessionDuration: s.sessionDuration,
        usage: s.sessionDuration / 60,
        formatted: formatSeconds(s.sessionDuration).formatted,
        userId: info?.userId ?? "",
        userName: info?.name ?? "",
      });
    }
  }

  const users = filters.studentId ? analyses[0] ?? null : null;

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    usageTime: formatSeconds(totalUsageTime),
    subjectCounts,
    sessions: processedSessions,
    dailyUsage: buildDailyUsage(processedSessions),
    users,
  };
}

function getEmptySummary() {
  return {
    totalCorrectAnswers: 0,
    totalWrongAnswers: 0,
    usageTimeInSeconds: 0,
    usageTime: formatSeconds(0),
    subjectCounts: emptySubjectCounts(),
    sessions: [],
    dailyUsage: [],
    users: null,
  };
}

// ────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────

// POST /logs/student/summary/filtered
logsRoutes.post("/logs/student/summary/filtered", async (c) => {
  const { universityId, courseId, classId, studentId } =
    await c.req.json<{ universityId?: string; courseId?: string; classId?: string; studentId?: string }>();
  const user = c.get("user")!;
  const db = getDb(c.env);

  if (!universityId) throw new HttpError("universityId e obrigatorio", 400);

  const isAdmin = user.role.includes("admin");
  const isCoordinator = user.role.includes("course-coordinator");
  const isProfessor = user.role.includes("professor");

  if (!isAdmin) {
    if (isCoordinator) {
      const userCourses = Array.isArray(user.courses) ? (user.courses as string[]) : [];
      if (courseId && !userCourses.includes(courseId)) {
        throw new HttpError("Acesso negado", 403);
      }
    } else if (isProfessor) {
      if (!courseId || !classId) throw new HttpError("Acesso negado", 403);

      const profDiscs = await db
        .select({ id: professorDisciplines.disciplineId })
        .from(professorDisciplines)
        .where(eq(professorDisciplines.professorId, user.id));

      if (!profDiscs.length) throw new HttpError("Acesso negado", 403);

      const discIds = profDiscs.map((d) => d.id);
      const classDiscs = await db
        .select()
        .from(classDisciplines)
        .where(and(eq(classDisciplines.classId, classId), inArray(classDisciplines.disciplineId, discIds)));

      if (!classDiscs.length) throw new HttpError("Acesso negado. Professor nao leciona nesta turma.", 403);

      if (studentId) {
        const [student] = await db
          .select({ id: userAnalyses.id })
          .from(userAnalyses)
          .where(and(eq(userAnalyses.userId, studentId), eq(userAnalyses.schoolId, universityId), eq(userAnalyses.courseId, courseId!), eq(userAnalyses.classId, classId!)))
          .limit(1);
        if (!student) throw new HttpError("Aluno nao encontrado nesta turma.", 404);
      }
    } else {
      throw new HttpError("Acesso negado", 403);
    }
  }

  const summary = await getSummary(db, { universityId, courseId, classId, studentId });
  return c.json(summary);
});

// GET /logs/university/:universityId/summary (admin only)
logsRoutes.get("/logs/university/:universityId/summary", requireRoles(["admin"]), async (c) => {
  const { universityId } = c.req.param();
  const db = getDb(c.env);
  const summary = await getSummary(db, { universityId });
  return c.json(summary);
});

// GET /logs/course/:courseId/summary
logsRoutes.get("/logs/course/:courseId/summary", async (c) => {
  const { courseId } = c.req.param();
  const user = c.get("user")!;

  if (!user.role.includes("admin")) {
    const userCourses = Array.isArray(user.courses) ? (user.courses as string[]) : [];
    if (!userCourses.includes(courseId)) throw new HttpError("Acesso negado", 403);
  }

  const db = getDb(c.env);
  // schoolId filter omitted — courseId already scopes the data
  const analyses = await db.select().from(userAnalyses).where(eq(userAnalyses.courseId, courseId));
  if (!analyses.length) return c.json(getEmptySummary());
  const universityId = analyses[0].schoolId;
  const summary = await getSummary(db, { universityId, courseId });
  return c.json(summary);
});

// GET /logs/class/:classId/summary
logsRoutes.get("/logs/class/:classId/summary", async (c) => {
  const { classId } = c.req.param();
  const user = c.get("user")!;
  const db = getDb(c.env);

  if (!user.role.includes("admin")) {
    const userClasses = Array.isArray(user.classes) ? (user.classes as string[]) : [];
    if (!userClasses.includes(classId)) {
      // professors might teach a discipline in a class they're not explicitly assigned to
      const profDiscs = await db.select({ id: professorDisciplines.disciplineId }).from(professorDisciplines).where(eq(professorDisciplines.professorId, user.id));
      if (profDiscs.length) {
        const discIds = profDiscs.map((d) => d.id);
        const link = await db.select().from(classDisciplines).where(and(eq(classDisciplines.classId, classId), inArray(classDisciplines.disciplineId, discIds))).limit(1);
        if (!link.length) throw new HttpError("Acesso negado", 403);
      } else {
        throw new HttpError("Acesso negado", 403);
      }
    }
  }

  const analyses = await db.select().from(userAnalyses).where(eq(userAnalyses.classId, classId));
  if (!analyses.length) return c.json(getEmptySummary());
  const universityId = analyses[0].schoolId;
  const courseId = analyses[0].courseId;
  const summary = await getSummary(db, { universityId, courseId, classId });
  return c.json(summary);
});

// GET /logs/professor/students
logsRoutes.get("/logs/professor/students", async (c) => {
  const user = c.get("user")!;
  const db = getDb(c.env);
  const summary = c.req.query("summary") === "true";

  // Get professor's disciplines → students enrolled in those disciplines
  const profDiscRows = await db
    .select({ disciplineId: professorDisciplines.disciplineId })
    .from(professorDisciplines)
    .where(eq(professorDisciplines.professorId, user.id));

  if (!profDiscRows.length) return c.json({ students: [] });

  const discIds = profDiscRows.map((r) => r.disciplineId);
  const studentDiscRows = await db
    .select({ studentId: studentDisciplines.studentId })
    .from(studentDisciplines)
    .where(inArray(studentDisciplines.disciplineId, discIds));

  if (!studentDiscRows.length) return c.json({ students: [] });

  const studentIds = [...new Set(studentDiscRows.map((r) => r.studentId))];

  const studentAccounts = await db
    .select({ id: accounts.id, name: accounts.name, email: accounts.email, photo: accounts.photo })
    .from(accounts)
    .where(inArray(accounts.id, studentIds));

  if (summary) return c.json({ students: studentAccounts });

  // Include stats
  const analyses = await db
    .select()
    .from(userAnalyses)
    .where(inArray(userAnalyses.userId, studentIds));

  const analysisMap = new Map(analyses.map((a) => [a.userId, a]));

  const students = studentAccounts.map((acc) => {
    const a = analysisMap.get(acc.id);
    return {
      ...acc,
      totalCorrectAnswers: a?.totalCorrectAnswers ?? 0,
      totalWrongAnswers: a?.totalWrongAnswers ?? 0,
      totalUsageTime: a?.totalUsageTime ?? 0,
      usageTime: formatSeconds(a?.totalUsageTime ?? 0),
      className: a?.className ?? null,
      courseName: a?.courseName ?? null,
    };
  });

  return c.json({ students });
});

// GET /logs/professor/students/:studentId
logsRoutes.get("/logs/professor/students/:studentId", async (c) => {
  const { studentId } = c.req.param();
  const user = c.get("user")!;
  const db = getDb(c.env);

  // Verify professor teaches this student
  if (!user.role.includes("admin")) {
    const profDiscRows = await db
      .select({ disciplineId: professorDisciplines.disciplineId })
      .from(professorDisciplines)
      .where(eq(professorDisciplines.professorId, user.id));

    if (!profDiscRows.length) throw new HttpError("Acesso negado", 403);

    const discIds = profDiscRows.map((r) => r.disciplineId);
    const studentDisc = await db
      .select()
      .from(studentDisciplines)
      .where(and(eq(studentDisciplines.studentId, studentId), inArray(studentDisciplines.disciplineId, discIds)))
      .limit(1);

    if (!studentDisc.length) throw new HttpError("Acesso negado", 403);
  }

  const [analysis] = await db
    .select()
    .from(userAnalyses)
    .where(eq(userAnalyses.userId, studentId))
    .limit(1);

  if (!analysis) return c.json(getEmptySummary());

  const summary = await getSummary(db, { universityId: analysis.schoolId, courseId: analysis.courseId, classId: analysis.classId, studentId });
  return c.json(summary);
});

// GET /logs/professor/students-stats
logsRoutes.get("/logs/professor/students-stats", async (c) => {
  const user = c.get("user")!;
  const db = getDb(c.env);

  const profDiscRows = await db
    .select({ disciplineId: professorDisciplines.disciplineId })
    .from(professorDisciplines)
    .where(eq(professorDisciplines.professorId, user.id));

  if (!profDiscRows.length) return c.json({ totalStudents: 0, avgCorrect: 0, avgWrong: 0, avgUsageTime: 0 });

  const discIds = profDiscRows.map((r) => r.disciplineId);
  const studentDiscRows = await db
    .select({ studentId: studentDisciplines.studentId })
    .from(studentDisciplines)
    .where(inArray(studentDisciplines.disciplineId, discIds));

  if (!studentDiscRows.length) return c.json({ totalStudents: 0, avgCorrect: 0, avgWrong: 0, avgUsageTime: 0 });

  const studentIds = [...new Set(studentDiscRows.map((r) => r.studentId))];
  const analyses = await db
    .select({ totalCorrectAnswers: userAnalyses.totalCorrectAnswers, totalWrongAnswers: userAnalyses.totalWrongAnswers, totalUsageTime: userAnalyses.totalUsageTime })
    .from(userAnalyses)
    .where(inArray(userAnalyses.userId, studentIds));

  const n = analyses.length || 1;
  return c.json({
    totalStudents: studentIds.length,
    avgCorrect: parseFloat((analyses.reduce((s, a) => s + a.totalCorrectAnswers, 0) / n).toFixed(1)),
    avgWrong: parseFloat((analyses.reduce((s, a) => s + a.totalWrongAnswers, 0) / n).toFixed(1)),
    avgUsageTime: parseFloat((analyses.reduce((s, a) => s + (a.totalUsageTime ?? 0), 0) / n).toFixed(1)),
  });
});
