import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  analysisSessions,
  answerAttempts,
  professorQuizAttempts,
  professorQuizDisciplines,
  professorQuizzes,
  studentProfiles,
  userAnalyses,
} from "../../db/schema";
import {
  aggregateByCategory,
  queryQuestions,
  resolveAnalysisWhere,
  type Filters,
} from "../analytics/analyticsService";

export async function getTopicPerformance(filters: Filters) {
  const byCategory = aggregateByCategory(await queryQuestions(filters));
  return Object.entries(byCategory).map(([topic, values]) => {
    const total = values.correct + values.wrong;
    return {
      topic,
      successPercentage: total
        ? Number(((values.correct / total) * 100).toFixed(1))
        : 0,
      errorPercentage: total
        ? Number(((values.wrong / total) * 100).toFixed(1))
        : 0,
    };
  });
}

export async function getProficiencyRadar(filters: Filters) {
  const byCategory = aggregateByCategory(await queryQuestions(filters));
  const labels = Object.keys(byCategory).sort();
  return {
    labels,
    data: labels.map((label) => {
      const total = byCategory[label].correct + byCategory[label].wrong;
      return total
        ? Number(((byCategory[label].correct / total) * 100).toFixed(1))
        : 0;
    }),
  };
}

export async function getEffortMatrix(filters: Filters) {
  const where = await resolveAnalysisWhere(filters);
  const rows = where
    ? await getDb().select().from(userAnalyses).where(where)
    : await getDb().select().from(userAnalyses);
  if (!rows.length)
    return { points: [], averages: { avgPerformance: 0, avgEffort: 0 } };

  const questions = await queryQuestions(filters);
  const performanceByUser = new Map<
    string,
    { correct: number; wrong: number }
  >();
  for (const question of questions) {
    const current = performanceByUser.get(question.userId) ?? {
      correct: 0,
      wrong: 0,
    };
    if (question.isCorrect) current.correct += 1;
    else current.wrong += 1;
    performanceByUser.set(question.userId, current);
  }

  const points = rows.map((row) => {
    const performance = performanceByUser.get(row.userId) ?? {
      correct: 0,
      wrong: 0,
    };
    const total = performance.correct + performance.wrong;
    return {
      name: row.name,
      performance: total
        ? Number(((performance.correct / total) * 100).toFixed(1))
        : 0,
      effort: Number(((row.totalUsageTime || 0) / 60).toFixed(1)),
    };
  });

  return {
    points,
    averages: {
      avgPerformance: Number(
        (
          points.reduce((sum, point) => sum + point.performance, 0) /
          points.length
        ).toFixed(1),
      ),
      avgEffort: Number(
        (
          points.reduce((sum, point) => sum + point.effort, 0) / points.length
        ).toFixed(1),
      ),
    },
  };
}

export async function getLearningJourney(filters: Filters) {
  if (filters.disciplineId) {
    // Mesma ressalva de queryQuestions: filtra por qualquer disciplina
    // vinculada ao quiz, nao so a "dona".
    const conditions = [
      eq(professorQuizDisciplines.disciplineId, filters.disciplineId),
    ];
    if (filters.studentId)
      conditions.push(eq(professorQuizAttempts.studentId, filters.studentId));

    const rows = await getDb()
      .select({
        userId: professorQuizAttempts.studentId,
        createdAt: professorQuizAttempts.completedAt,
        totalCorrectAnswers: professorQuizAttempts.score,
        totalQuestions: professorQuizAttempts.totalQuestions,
        classId: studentProfiles.classId,
        courseId: studentProfiles.courseId,
        universityId: studentProfiles.schoolId,
      })
      .from(professorQuizAttempts)
      .innerJoin(
        professorQuizzes,
        eq(professorQuizzes.id, professorQuizAttempts.quizId),
      )
      .innerJoin(
        professorQuizDisciplines,
        eq(professorQuizDisciplines.quizId, professorQuizzes.id),
      )
      .innerJoin(
        studentProfiles,
        eq(studentProfiles.accountId, professorQuizAttempts.studentId),
      )
      .where(and(...conditions))
      .orderBy(
        asc(professorQuizAttempts.studentId),
        asc(professorQuizAttempts.completedAt),
      );

    const scopedRows = rows.filter(
      (row) =>
        (!filters.universityId || row.universityId === filters.universityId) &&
        (!filters.courseId || row.courseId === filters.courseId) &&
        (!filters.classId || row.classId === filters.classId),
    );
    return aggregateJourney(
      scopedRows.map((row) => ({
        userId: row.userId,
        createdAt: row.createdAt,
        totalCorrectAnswers: row.totalCorrectAnswers,
        totalWrongAnswers: Math.max(
          0,
          row.totalQuestions - row.totalCorrectAnswers,
        ),
      })),
    );
  }

  const rows = await getDb()
    .select({
      userId: userAnalyses.userId,
      createdAt: answerAttempts.createdAt,
      totalCorrectAnswers: answerAttempts.totalCorrectAnswers,
      totalWrongAnswers: answerAttempts.totalWrongAnswers,
    })
    .from(answerAttempts)
    .innerJoin(
      analysisSessions,
      eq(analysisSessions.id, answerAttempts.sessionId),
    )
    .innerJoin(userAnalyses, eq(userAnalyses.id, analysisSessions.analysisId))
    .where(await resolveAnalysisWhere(filters))
    .orderBy(asc(userAnalyses.userId), asc(answerAttempts.createdAt));

  return aggregateJourney(rows);
}

function aggregateJourney(
  rows: Array<{
    userId: string;
    createdAt: Date;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
  }>,
) {
  if (!rows.length) return { labels: [], data: [] };

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
      if (!attemptsByPosition[index])
        attemptsByPosition[index] = { total: 0, count: 0 };
      attemptsByPosition[index].total +=
        (attempt.totalCorrectAnswers / answers) * 100;
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

  return { labels, data };
}

export async function getSessionDetails(
  filters: Filters & { startDate?: string; endDate?: string },
) {
  const analyses = await getDb()
    .select({ id: userAnalyses.id })
    .from(userAnalyses)
    .where(await resolveAnalysisWhere(filters));
  if (!analyses.length) return [];

  const conditions = [
    inArray(
      analysisSessions.analysisId,
      analyses.map((item) => item.id),
    ),
    isNotNull(analysisSessions.sessionEnd),
  ];
  if (filters.startDate)
    conditions.push(
      gte(analysisSessions.sessionStart, new Date(filters.startDate)),
    );
  if (filters.endDate)
    conditions.push(
      lte(analysisSessions.sessionStart, new Date(filters.endDate)),
    );

  return getDb()
    .select({
      startTime: analysisSessions.sessionStart,
      endTime: analysisSessions.sessionEnd,
    })
    .from(analysisSessions)
    .where(and(...conditions));
}

export async function getAccessPattern(filters: Filters) {
  const analyses = await getDb()
    .select({ id: userAnalyses.id })
    .from(userAnalyses)
    .where(await resolveAnalysisWhere(filters));
  if (!analyses.length) return [];

  const sessions = await getDb()
    .select({ sessionStart: analysisSessions.sessionStart })
    .from(analysisSessions)
    .where(
      inArray(
        analysisSessions.analysisId,
        analyses.map((item) => item.id),
      ),
    );

  const pattern: Record<string, number> = {};
  for (const session of sessions) {
    const date = new Date(session.sessionStart);
    const key = `${date.getUTCDay()}-${date.getUTCHours()}`;
    pattern[key] = (pattern[key] || 0) + 1;
  }
  return Object.entries(pattern).map(([key, count]) => [
    ...key.split("-").map(Number),
    count,
  ]);
}
