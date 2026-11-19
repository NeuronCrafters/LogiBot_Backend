import { randomUUID } from "crypto";
import { asc, eq, inArray } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import {
  accounts,
  analysisSessions,
  answerAttempts,
  answerQuestions,
  classes,
  courses,
  disciplines,
  professorQuizAnswers,
  professorQuizAttempts,
  professorQuizQuestions,
  professorQuizzes,
  studentProfiles,
  universities,
  userAnalyses,
} from "../../db/schema";
import { sandboxEmail } from "./sandboxConfig";

/** Periods offered in the Dev area: 0 means the structure only, with no activity at all. */
export const DEMO_PERIODS = [0, 7, 15, 30, 90, 180, 365] as const;
export type DemoPeriod = (typeof DEMO_PERIODS)[number];
export const isDemoPeriod = (value: unknown): value is DemoPeriod => (DEMO_PERIODS as readonly unknown[]).indexOf(value) !== -1;

const TOPICS = ["variaveis", "condicionais", "listas", "funcoes", "operadores_logicos"] as const;
const DAY = 86400000;
const BATCH = 500;

/** Small seeded generator: the same period always produces the same data, so bugs can be reproduced. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Chance of a right answer: each institution has its own level and a weaker subject, every
 * student a personal offset, and everyone improves a little over the period.
 */
export function answerChance(institutionIndex: number, studentOffset: number, topic: string, progress: number): number {
  const base = institutionIndex === 0 ? 0.64 : 0.55;
  const weak = (institutionIndex === 0 && topic === "funcoes") || (institutionIndex === 1 && topic === "condicionais") ? -0.15 : 0;
  return Math.min(0.97, Math.max(0.08, base + weak + studentOffset + 0.12 * progress));
}

async function insertInBatches<T>(rows: T[], insert: (batch: T[]) => Promise<unknown>) {
  for (let index = 0; index < rows.length; index += BATCH) await insert(rows.slice(index, index + BATCH));
}

export interface DemoSummary { days: number; students: number; sessions: number; answers: number; quizzes: number; quizAttempts: number }

/** Fills the test database with activity over the last `days` days (the structure must already exist). */
export async function generateDemoData(db: AnyDbClient, days: DemoPeriod, now = new Date()): Promise<DemoSummary> {
  const summary: DemoSummary = { days, students: 0, sessions: 0, answers: 0, quizzes: 0, quizAttempts: 0 };
  if (days === 0) return summary;
  const random = seededRandom(days * 7919);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  const institutionRows = await db.select({ id: universities.id }).from(universities).orderBy(asc(universities.name));
  const institutionIndex = (id: string) => Math.max(0, institutionRows.findIndex((row) => row.id === id));
  const students = await db
    .select({
      id: accounts.id, name: accounts.name, email: accounts.email,
      schoolId: studentProfiles.schoolId, schoolName: universities.name,
      courseId: studentProfiles.courseId, courseName: courses.name,
      classId: studentProfiles.classId, className: classes.name,
    })
    .from(studentProfiles)
    .innerJoin(accounts, eq(accounts.id, studentProfiles.accountId))
    .innerJoin(universities, eq(universities.id, studentProfiles.schoolId))
    .innerJoin(courses, eq(courses.id, studentProfiles.courseId))
    .innerJoin(classes, eq(classes.id, studentProfiles.classId))
    .orderBy(asc(accounts.email));
  summary.students = students.length;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Quizzes: one per subject in the first subject of every course, published across the period.
  const [professor] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, sandboxEmail("professor"))).limit(1);
  const courseIds = Array.from(new Set(students.map((student) => student.courseId)));
  const courseDisciplines = courseIds.length
    ? await db.select({ id: disciplines.id, courseId: disciplines.courseId }).from(disciplines).where(inArray(disciplines.courseId, courseIds)).orderBy(asc(disciplines.name))
    : [];
  const quizzesByCourse: Record<string, Array<{ id: string; topic: string; releasedAt: number; questions: string[] }>> = {};
  if (professor) {
    for (const courseId of courseIds) {
      const discipline = courseDisciplines.find((row) => row.courseId === courseId);
      if (!discipline) continue;
      quizzesByCourse[courseId] = [];
      const quizCount = Math.max(1, Math.min(TOPICS.length * 2, Math.round(days / 14)));
      for (let index = 0; index < quizCount; index++) {
        const topic = TOPICS[index % TOPICS.length];
        const releasedAt = today - Math.round((days - 1) * (1 - (index + 0.5) / quizCount)) * DAY;
        const [quiz] = await db.insert(professorQuizzes).values({
          professorId: professor.id, disciplineId: discipline.id, title: `Quiz ${index + 1} · ${topic}`, topic, status: "published",
          language: "pt-BR", createdAt: new Date(releasedAt), updatedAt: new Date(releasedAt),
        }).returning({ id: professorQuizzes.id });
        const questions = await db.insert(professorQuizQuestions).values(Array.from({ length: 5 }, (_item, order) => ({
          quizId: quiz.id, question: `Pergunta ${order + 1} sobre ${topic}`, options: ["A", "B", "C", "D"], correctOption: "A", orderIndex: order,
        }))).returning({ id: professorQuizQuestions.id });
        quizzesByCourse[courseId].push({ id: quiz.id, topic, releasedAt, questions: questions.map((row) => row.id) });
        summary.quizzes++;
      }
    }
  }

  for (const student of students) {
    const institution = institutionIndex(student.schoolId);
    const offset = (random() - 0.5) * 0.24;
    const activity = 0.25 + random() * 0.45;
    let usage = 0;
    let correct = 0;
    let wrong = 0;
    const quizCounts: Record<string, number> = {};
    const [analysis] = await db.insert(userAnalyses).values({
      userId: student.id, name: student.name, email: student.email,
      schoolId: student.schoolId, schoolName: student.schoolName, courseId: student.courseId, courseName: student.courseName,
      classId: student.classId, className: student.className,
    }).returning({ id: userAnalyses.id });

    const sessionRows: Array<typeof analysisSessions.$inferInsert> = [];
    for (let back = days - 1; back >= 0; back--) {
      if (random() > activity) continue;
      const start = new Date(today - back * DAY + between(8, 21) * 3600000 + between(0, 59) * 60000);
      if (start.getTime() > now.getTime()) continue;
      const duration = between(5, 55) * 60;
      const chat: Record<string, number> = {};
      for (let index = between(0, 3); index > 0; index--) { const topic = pick(TOPICS); chat[topic] = (chat[topic] ?? 0) + 1; }
      sessionRows.push({
        analysisId: analysis.id, sessionStart: start, sessionEnd: new Date(start.getTime() + duration * 1000), sessionDuration: duration,
        durationSource: "recorded", lastActivityAt: new Date(start.getTime() + duration * 1000), subjectCountsChat: chat,
      });
      usage += duration;
    }
    const sessions: Array<{ id: string; sessionStart: Date }> = [];
    await insertInBatches(sessionRows, async (batch) => sessions.push(...await db.insert(analysisSessions).values(batch).returning({ id: analysisSessions.id, sessionStart: analysisSessions.sessionStart })));
    summary.sessions += sessions.length;

    // Practice answers inside about half of the sessions (ids made here so everything goes in batches).
    const attemptRows: Array<typeof answerAttempts.$inferInsert> = [];
    const questionRows: Array<typeof answerQuestions.$inferInsert> = [];
    for (const session of sessions) {
      if (random() > 0.5) continue;
      const progress = days > 1 ? 1 - (today - session.sessionStart.getTime()) / ((days - 1) * DAY) : 1;
      const answers = Array.from({ length: between(4, 8) }, () => {
        const topic = pick(TOPICS);
        return { topic, isCorrect: random() < answerChance(institution, offset, topic, Math.max(0, progress)) };
      });
      const right = answers.filter((answer) => answer.isCorrect).length;
      const attempt = { id: randomUUID() };
      attemptRows.push({ id: attempt.id, sessionId: session.id, totalCorrectAnswers: right, totalWrongAnswers: answers.length - right, createdAt: new Date(session.sessionStart.getTime() + 5 * 60000) });
      answers.forEach((answer, index) => {
        questionRows.push({
          attemptId: attempt.id, level: "medio", subject: answer.topic, question: `Questão de prática ${index + 1}`,
          selectedOption: answer.isCorrect ? "A" : "B", isCorrect: answer.isCorrect, timestamp: new Date(session.sessionStart.getTime() + (6 + index) * 60000),
        });
        quizCounts[answer.topic] = (quizCounts[answer.topic] ?? 0) + 1;
      });
      correct += right;
      wrong += answers.length - right;
    }
    await insertInBatches(attemptRows, (batch) => db.insert(answerAttempts).values(batch));
    await insertInBatches(questionRows, (batch) => db.insert(answerQuestions).values(batch));
    summary.answers += questionRows.length;

    // Professor quizzes of the student's course, answered a few days after being published.
    const quizAttemptRows: Array<typeof professorQuizAttempts.$inferInsert> = [];
    const quizAnswerRows: Array<typeof professorQuizAnswers.$inferInsert> = [];
    for (const quiz of quizzesByCourse[student.courseId] ?? []) {
      if (random() > 0.8) continue;
      const completedAt = Math.min(now.getTime(), quiz.releasedAt + between(0, 3) * DAY + between(9, 20) * 3600000);
      const progress = days > 1 ? 1 - (today - completedAt) / ((days - 1) * DAY) : 1;
      const results = quiz.questions.map(() => random() < answerChance(institution, offset, quiz.topic, Math.max(0, progress)));
      const score = results.filter(Boolean).length;
      const attemptId = randomUUID();
      quizAttemptRows.push({ id: attemptId, quizId: quiz.id, studentId: student.id, score, totalQuestions: quiz.questions.length, completedAt: new Date(completedAt) });
      quiz.questions.forEach((questionId, index) => quizAnswerRows.push({ attemptId, questionId, selectedOption: results[index] ? "A" : "B", isCorrect: results[index] }));
      summary.quizAttempts++;
    }
    await insertInBatches(quizAttemptRows, (batch) => db.insert(professorQuizAttempts).values(batch));
    await insertInBatches(quizAnswerRows, (batch) => db.insert(professorQuizAnswers).values(batch));

    await db.update(userAnalyses).set({ totalUsageTime: usage, totalCorrectAnswers: correct, totalWrongAnswers: wrong, subjectCountsQuiz: quizCounts }).where(eq(userAnalyses.id, analysis.id));
  }
  return summary;
}
