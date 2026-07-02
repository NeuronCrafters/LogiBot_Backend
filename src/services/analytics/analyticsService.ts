import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  analysisSessions,
  answerAttempts,
  answerQuestions,
  classDisciplines,
  classes,
  courses,
  professorQuizAnswers,
  professorQuizAttempts,
  professorQuizzes,
  studentProfiles,
  userAnalyses,
} from "../../db/schema";
import { normalizeSubjectFromMessage } from "../../utils/normalizeSubject";

export type Filters = {
  universityId?: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
  disciplineId?: string;
  startDate?: string;
  endDate?: string;
};

export function formatSeconds(seconds: number) {
  const totalSeconds = Math.max(
    0,
    Math.round(Number.isFinite(seconds) ? seconds : 0),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return {
    totalSeconds,
    hours,
    minutes,
    seconds: secs,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(secs)}`,
    humanized:
      hours > 0
        ? `${hours}h ${minutes}min ${secs}s`
        : minutes > 0
          ? `${minutes}min ${secs}s`
          : `${secs}s`,
  };
}

export function emptySubjectCounts() {
  return {
    variaveis: 0,
    listas: 0,
    condicionais: 0,
    verificacoes: 0,
    operadores_logicos: 0,
    funcoes: 0,
    repeticao: 0,
  };
}

export function analysisWhere(filters: Filters) {
  const conditions = [];
  if (filters.universityId)
    conditions.push(eq(userAnalyses.schoolId, filters.universityId));
  if (filters.courseId)
    conditions.push(eq(userAnalyses.courseId, filters.courseId));
  if (filters.classId)
    conditions.push(eq(userAnalyses.classId, filters.classId));
  if (filters.studentId)
    conditions.push(eq(userAnalyses.userId, filters.studentId));
  return conditions.length ? and(...conditions) : undefined;
}

export async function resolveAnalysisWhere(filters: Filters) {
  const conditions = [];
  if (filters.universityId)
    conditions.push(eq(userAnalyses.schoolId, filters.universityId));
  if (filters.courseId)
    conditions.push(eq(userAnalyses.courseId, filters.courseId));
  if (filters.classId)
    conditions.push(eq(userAnalyses.classId, filters.classId));
  if (filters.studentId)
    conditions.push(eq(userAnalyses.userId, filters.studentId));

  if (filters.disciplineId) {
    const classRows = await getDb()
      .select({ classId: classDisciplines.classId })
      .from(classDisciplines)
      .where(eq(classDisciplines.disciplineId, filters.disciplineId));
    const classIds = [...new Set(classRows.map((row) => row.classId))];
    if (!classIds.length) return eq(userAnalyses.classId, "");
    conditions.push(inArray(userAnalyses.classId, classIds));
  }

  return conditions.length ? and(...conditions) : undefined;
}

export async function queryQuestions(filters: Filters) {
  if (filters.disciplineId) {
    const conditions = [
      eq(professorQuizzes.disciplineId, filters.disciplineId),
    ];
    if (filters.universityId)
      conditions.push(eq(studentProfiles.schoolId, filters.universityId));
    if (filters.courseId)
      conditions.push(eq(studentProfiles.courseId, filters.courseId));
    if (filters.classId)
      conditions.push(eq(studentProfiles.classId, filters.classId));
    if (filters.studentId)
      conditions.push(eq(professorQuizAttempts.studentId, filters.studentId));

    return getDb()
      .select({
        userId: professorQuizAttempts.studentId,
        subject: professorQuizzes.topic,
        isCorrect: professorQuizAnswers.isCorrect,
        timestamp: professorQuizAttempts.completedAt,
      })
      .from(professorQuizAnswers)
      .innerJoin(
        professorQuizAttempts,
        eq(professorQuizAttempts.id, professorQuizAnswers.attemptId),
      )
      .innerJoin(
        professorQuizzes,
        eq(professorQuizzes.id, professorQuizAttempts.quizId),
      )
      .innerJoin(
        studentProfiles,
        eq(studentProfiles.accountId, professorQuizAttempts.studentId),
      )
      .where(and(...conditions));
  }

  return getDb()
    .select({
      userId: userAnalyses.userId,
      subject: answerQuestions.subject,
      isCorrect: answerQuestions.isCorrect,
      timestamp: answerQuestions.timestamp,
    })
    .from(answerQuestions)
    .innerJoin(answerAttempts, eq(answerAttempts.id, answerQuestions.attemptId))
    .innerJoin(
      analysisSessions,
      eq(analysisSessions.id, answerAttempts.sessionId),
    )
    .innerJoin(userAnalyses, eq(userAnalyses.id, analysisSessions.analysisId))
    .where(await resolveAnalysisWhere(filters));
}

export function aggregateByCategory(
  rows: { subject: string; isCorrect: boolean }[],
) {
  const map: Record<string, { correct: number; wrong: number }> = {};
  for (const row of rows) {
    const category = normalizeSubjectFromMessage(row.subject) || row.subject;
    if (!map[category]) map[category] = { correct: 0, wrong: 0 };
    if (row.isCorrect) map[category].correct++;
    else map[category].wrong++;
  }
  return map;
}

export async function getSummary(filters: {
  universityId: string;
  courseId?: string;
  classId?: string;
  studentId?: string;
  disciplineId?: string;
}) {
  const db = getDb();
  const analyses = await db
    .select()
    .from(userAnalyses)
    .where(await resolveAnalysisWhere(filters));
  if (!analyses.length) return getEmptySummary();

  const analysisIds = analyses.map((analysis) => analysis.id);
  const sessions = await db
    .select()
    .from(analysisSessions)
    .where(inArray(analysisSessions.analysisId, analysisIds))
    .orderBy(desc(analysisSessions.sessionStart));

  const analysisUserMap = new Map(
    analyses.map((analysis) => [
      analysis.id,
      { userId: analysis.userId, name: analysis.name },
    ]),
  );
  const subjectCounts = emptySubjectCounts();
  let totalCorrectAnswers = 0;
  let totalWrongAnswers = 0;
  let totalUsageTime = 0;
  const processedSessions: Array<{
    date: string;
    sessionStart: Date | null;
    sessionEnd: Date | null;
    sessionDuration: number;
    userId: string;
    userName: string;
    usage: number;
    formatted: string;
  }> = [];

  if (filters.disciplineId) {
    const questions = await queryQuestions(filters);
    totalCorrectAnswers = questions.filter((item) => item.isCorrect).length;
    totalWrongAnswers = questions.length - totalCorrectAnswers;
  }

  for (const analysis of analyses) {
    if (!filters.disciplineId) {
      totalCorrectAnswers += analysis.totalCorrectAnswers;
      totalWrongAnswers += analysis.totalWrongAnswers;
    }
    totalUsageTime += analysis.totalUsageTime || 0;
  }

  for (const session of sessions) {
    const chatCounts = (session.subjectCountsChat || {}) as Record<
      string,
      number
    >;
    for (const [key, value] of Object.entries(chatCounts)) {
      const normalized = normalizeSubjectFromMessage(key) || key;
      if (normalized in subjectCounts)
        subjectCounts[normalized as keyof typeof subjectCounts] += Number(
          value || 0,
        );
    }

    if (session.sessionStart && session.sessionEnd && session.sessionDuration) {
      const info = analysisUserMap.get(session.analysisId);
      const date = new Date(session.sessionStart).toISOString().split("T")[0];
      processedSessions.push({
        date,
        sessionStart: session.sessionStart,
        sessionEnd: session.sessionEnd,
        sessionDuration: session.sessionDuration,
        userId: info?.userId || "",
        userName: info?.name || "",
        usage: session.sessionDuration / 60,
        formatted: formatSeconds(session.sessionDuration).formatted,
      });
    }
  }

  return {
    totalCorrectAnswers,
    totalWrongAnswers,
    usageTimeInSeconds: totalUsageTime,
    usageTime: formatSeconds(totalUsageTime),
    subjectCounts,
    sessions: processedSessions,
    dailyUsage: buildDailyUsage(processedSessions),
    users: filters.studentId ? analyses[0] || null : null,
  };
}

export function buildDailyUsage(
  sessions: Array<{ date: string; sessionDuration: number }>,
) {
  const byDay: Record<
    string,
    { date: string; usage: number; formatted: string }
  > = {};
  for (const session of sessions) {
    if (!byDay[session.date])
      byDay[session.date] = {
        date: session.date,
        usage: 0,
        formatted: "00:00:00",
      };
    byDay[session.date].usage += session.sessionDuration / 60;
    byDay[session.date].formatted = formatSeconds(
      Math.round(byDay[session.date].usage * 60),
    ).formatted;
  }
  return Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date));
}

export function getEmptySummary() {
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

export async function summaryByEntity(entity: string, id: string) {
  if (entity === "university" || entity === "universities")
    return getSummary({ universityId: id });
  if (entity === "course" || entity === "courses") {
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.courseId, id))
      .limit(1);
    return analysis
      ? getSummary({ universityId: analysis.schoolId, courseId: id })
      : getEmptySummary();
  }
  if (entity === "class" || entity === "classes") {
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.classId, id))
      .limit(1);
    return analysis
      ? getSummary({
          universityId: analysis.schoolId,
          courseId: analysis.courseId,
          classId: id,
        })
      : getEmptySummary();
  }
  if (entity === "discipline" || entity === "disciplines") {
    const [discipline] = await getDb()
      .select({
        courseId: courses.id,
        universityId: courses.universityId,
      })
      .from(classDisciplines)
      .innerJoin(classes, eq(classes.id, classDisciplines.classId))
      .innerJoin(courses, eq(courses.id, classes.courseId))
      .where(eq(classDisciplines.disciplineId, id))
      .limit(1);
    return discipline
      ? getSummary({
          universityId: discipline.universityId,
          courseId: discipline.courseId,
          disciplineId: id,
        })
      : getEmptySummary();
  }
  if (entity === "student" || entity === "students") {
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.userId, id))
      .limit(1);
    return analysis
      ? getSummary({
          universityId: analysis.schoolId,
          courseId: analysis.courseId,
          classId: analysis.classId,
          studentId: id,
        })
      : getEmptySummary();
  }
  return getEmptySummary();
}
