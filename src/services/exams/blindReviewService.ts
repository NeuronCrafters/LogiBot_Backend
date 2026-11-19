import { and, asc, eq, inArray } from "drizzle-orm";
import type { AnyDbClient, DbClient } from "../../db/client";
import {
  accounts,
  blindReviews,
  examAuditLog,
  examQuestions,
  examSubmissions,
  exams,
  exerciseAttempts,
  studentProfiles,
  type Exam,
} from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { quizAudience } from "../notifications/notificationService";
import { canManageExam, examState } from "./examService";
import type { ObjectiveResult, QuestionSnapshot } from "./examGrading";
import { finalizeSubmission } from "./examSubmissionService";
import { createBlindReviewsFor } from "./blindReviewRows";

type StaffUser = NonNullable<import("express").Request["user"]>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RUBRIC = [0, 0.5, 1] as const;
export const MAX_COMMENT_LENGTH = 2000;

async function loadManagedExam(db: AnyDbClient, user: StaffUser, examId: string) {
  if (!UUID.test(examId)) throw new AppError("exams.notFound", 404);
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) throw new AppError("exams.notFound", 404);
  if (!canManageExam(exam, user)) throw new AppError("auth.accessDeniedCapital", 403);
  return exam;
}

/** Grading starts once the exam is closed: while open, arrival order could identify students. */
async function prepareClosedExam(db: AnyDbClient, exam: Exam, now: Date) {
  const state = examState(exam, now);
  if (state !== "closed" && state !== "released") throw new AppError("exams.reviewNotAvailable", 409);
  const open = await db.select({ id: examSubmissions.id }).from(examSubmissions)
    .where(and(eq(examSubmissions.examId, exam.id), eq(examSubmissions.status, "in_progress")));
  for (const submission of open) await finalizeSubmission(db, submission.id, "exam_closed", now);
  const submitted = await db.select({ id: examSubmissions.id }).from(examSubmissions)
    .where(and(eq(examSubmissions.examId, exam.id), eq(examSubmissions.status, "submitted")));
  for (const submission of submitted) await createBlindReviewsFor(db, submission.id);
}

/**
 * Anonymous grading list (RNF02): per essay question, only { id, code, text, score, comment }.
 * Never the student, class, submission time, duration or objective results.
 */
export async function getBlindReview(db: AnyDbClient, user: StaffUser, examId: string, now = new Date()) {
  const exam = await loadManagedExam(db, user, examId);
  await prepareClosedExam(db, exam, now);
  const questions = await db.select().from(examQuestions)
    .where(and(eq(examQuestions.examId, examId), eq(examQuestions.type, "essay"))).orderBy(asc(examQuestions.orderIndex));
  const rows = questions.length
    ? await db.select({ review: blindReviews, answers: examSubmissions.answers }).from(blindReviews)
      .innerJoin(examSubmissions, eq(examSubmissions.id, blindReviews.submissionId))
      .where(inArray(blindReviews.examQuestionId, questions.map((question) => question.id)))
      .orderBy(asc(blindReviews.displayOrder))
    : [];
  let reviewed = 0;
  const result = questions.map((question) => {
    const snapshot = question.snapshot as QuestionSnapshot;
    const items = rows.filter((row) => row.review.examQuestionId === question.id).map(({ review, answers }) => {
      const answer = (answers as Record<string, { text?: unknown }>)[question.id];
      if (review.score !== null) reviewed++;
      return { id: review.id, code: review.code, text: answer && typeof answer.text === "string" ? answer.text : "", score: review.score, comment: review.comment };
    });
    return {
      examQuestionId: question.id,
      position: question.orderIndex + 1,
      statement: snapshot.statement,
      language: snapshot.language,
      criteria: snapshot.content.type === "essay" ? snapshot.content.criteria : "",
      weight: question.weight,
      items,
    };
  });
  return { examId, title: exam.title, released: exam.status === "released", reviewed, total: rows.length, questions: result };
}

/** Saves one grade (0, 0.5 or 1) and comment; locked after release; audited. */
export async function saveReview(db: DbClient, user: StaffUser, reviewId: string, body: unknown, now = new Date()) {
  if (!UUID.test(reviewId)) throw new AppError("exams.reviewNotFound", 404);
  const [row] = await db.select({ review: blindReviews, exam: exams }).from(blindReviews)
    .innerJoin(examQuestions, eq(examQuestions.id, blindReviews.examQuestionId))
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(eq(blindReviews.id, reviewId)).limit(1);
  if (!row) throw new AppError("exams.reviewNotFound", 404);
  if (!canManageExam(row.exam, user)) throw new AppError("auth.accessDeniedCapital", 403);
  if (row.exam.status === "released") throw new AppError("exams.reviewLocked", 409);
  const payload = (body && typeof body === "object" ? body : {}) as { score?: unknown; comment?: unknown };
  const score = payload.score;
  if (typeof score !== "number" || (RUBRIC as readonly number[]).indexOf(score) === -1) throw new AppError("exams.reviewInvalid", 400);
  const comment = payload.comment === undefined ? "" : payload.comment;
  if (typeof comment !== "string" || comment.length > MAX_COMMENT_LENGTH) throw new AppError("exams.reviewInvalid", 400);
  await db.transaction(async (tx) => {
    await tx.update(blindReviews).set({ score, comment: comment.trim(), reviewedBy: user.id, reviewedAt: now }).where(eq(blindReviews.id, reviewId));
    await tx.insert(examAuditLog).values({ examId: row.exam.id, actorId: user.id, action: "review", targetId: reviewId, details: { score }, createdAt: now });
  });
  return { id: reviewId, code: row.review.code, score, comment: comment.trim() };
}

/** 10 × (sum of weight × credit) / (sum of weights); credit is 1/0 for objective questions and the rubric for essays. */
export function computeGrade(items: Array<{ weight: number; credit: number }>): number {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return 0;
  const earned = items.reduce((sum, item) => sum + item.weight * item.credit, 0);
  return Math.round((1000 * earned) / total) / 100;
}

/**
 * Releases grades only when the exam is closed and every essay is graded. Grades are
 * stored, attempts enter the analytics (RF60) and the grading is locked from now on.
 */
export async function releaseResults(db: DbClient, user: StaffUser, examId: string, now = new Date()) {
  const exam = await loadManagedExam(db, user, examId);
  if (exam.status === "released") throw new AppError("exams.alreadyReleased", 409);
  await prepareClosedExam(db, exam, now);
  const questions = await db.select().from(examQuestions).where(eq(examQuestions.examId, examId)).orderBy(asc(examQuestions.orderIndex));
  const submissions = await db.select().from(examSubmissions).where(and(eq(examSubmissions.examId, examId), eq(examSubmissions.status, "submitted")));
  const reviews = submissions.length
    ? await db.select().from(blindReviews).where(inArray(blindReviews.submissionId, submissions.map((submission) => submission.id)))
    : [];
  const pending = reviews.filter((review) => review.score === null).length;
  if (pending) throw new AppError({ key: "exams.reviewsPending", params: { pending } }, 409);

  const profiles = submissions.length
    ? await db.select({ accountId: studentProfiles.accountId, classId: studentProfiles.classId }).from(studentProfiles)
      .where(inArray(studentProfiles.accountId, submissions.map((submission) => submission.studentId)))
    : [];
  await db.transaction(async (tx) => {
    for (const submission of submissions) {
      const objective = (submission.objectiveResults ?? {}) as Record<string, ObjectiveResult>;
      const answers = (submission.answers ?? {}) as Record<string, unknown>;
      const events = (submission.events ?? {}) as Record<string, unknown[]>;
      const credits = questions.map((question) => {
        const review = reviews.filter((item) => item.submissionId === submission.id && item.examQuestionId === question.id)[0];
        const credit = question.type === "essay" ? (review ? review.score ?? 0 : 0) : objective[question.id]?.correct ? 1 : 0;
        return { question, credit, review };
      });
      const grade = computeGrade(credits.map(({ question, credit }) => ({ weight: question.weight, credit })));
      await tx.update(examSubmissions).set({ grade }).where(eq(examSubmissions.id, submission.id));
      const profile = profiles.filter((item) => item.accountId === submission.studentId)[0];
      const examDurationMs = submission.submittedAt ? +submission.submittedAt - +submission.startedAt : null;
      if (credits.length) {
        await tx.insert(exerciseAttempts).values(credits.map(({ question, credit, review }) => {
          const snapshot = question.snapshot as QuestionSnapshot;
          return {
            studentId: submission.studentId,
            classId: profile ? profile.classId : null,
            disciplineId: exam.disciplineId,
            mode: "exam",
            exerciseType: question.type,
            exerciseId: `bank:${question.questionId ?? question.id}`,
            exerciseVersion: question.questionVersion,
            source: "bank",
            subject: snapshot.subject ?? "exam",
            concepts: snapshot.concepts,
            attemptNumber: 1,
            isCorrect: credit === 1,
            hintsUsed: 0,
            durationMs: null,
            engineVersion: "exam-1",
            submittedState: answers[question.id] ?? null,
            result: { examId, examQuestionId: question.id, credit, examDurationMs, details: question.type === "essay" ? { score: review?.score ?? 0 } : objective[question.id]?.details ?? {} },
            events: events[question.id] ?? [],
            createdAt: now,
          };
        }));
      }
    }
    await tx.update(exams).set({ status: "released", releasedAt: now, releasedBy: user.id, updatedAt: now }).where(eq(exams.id, examId));
    await tx.insert(examAuditLog).values({ examId, actorId: user.id, action: "release", details: { submissions: submissions.length }, createdAt: now });
  });
  return { examId, released: true, submissions: submissions.length, studentIds: submissions.map((submission) => submission.studentId) };
}

/** Identified results, only after release (RF57). */
export async function getResults(db: AnyDbClient, user: StaffUser, examId: string) {
  const exam = await loadManagedExam(db, user, examId);
  if (exam.status !== "released") throw new AppError("exams.notReleased", 409);
  const questions = await db.select().from(examQuestions).where(eq(examQuestions.examId, examId));
  const audience = await quizAudience(db, exam);
  const submissions = await db.select({ submission: examSubmissions, name: accounts.name })
    .from(examSubmissions).innerJoin(accounts, eq(accounts.id, examSubmissions.studentId))
    .where(eq(examSubmissions.examId, examId));
  const reviews = submissions.length
    ? await db.select().from(blindReviews).where(inArray(blindReviews.submissionId, submissions.map((row) => row.submission.id)))
    : [];
  const missingIds = audience.filter((id) => !submissions.some((row) => row.submission.studentId === id));
  const missing = missingIds.length
    ? await db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, missingIds))
    : [];
  const objectiveQuestions = questions.filter((question) => question.type !== "essay");
  const essayQuestions = questions.filter((question) => question.type === "essay");
  type ResultRow = {
    studentId: string; name: string; status: "submitted" | "missed"; objectiveCorrect: number; objectiveTotal: number;
    essayPoints: number; essayTotal: number; grade: number | null; durationMs: number | null; submittedAt: Date | null; submitReason: string | null;
  };
  const rows: ResultRow[] = submissions.map(({ submission, name }) => {
    const objective = (submission.objectiveResults ?? {}) as Record<string, ObjectiveResult>;
    const essayPoints = essayQuestions.reduce((sum, question) => {
      const review = reviews.filter((item) => item.submissionId === submission.id && item.examQuestionId === question.id)[0];
      return sum + (review?.score ?? 0);
    }, 0);
    return {
      studentId: submission.studentId, name, status: "submitted",
      objectiveCorrect: objectiveQuestions.filter((question) => objective[question.id]?.correct).length, objectiveTotal: objectiveQuestions.length,
      essayPoints, essayTotal: essayQuestions.length, grade: submission.grade,
      durationMs: submission.submittedAt ? +submission.submittedAt - +submission.startedAt : null,
      submittedAt: submission.submittedAt, submitReason: submission.submitReason,
    };
  });
  missing.forEach((student) => rows.push({
    studentId: student.id, name: student.name, status: "missed", objectiveCorrect: 0, objectiveTotal: objectiveQuestions.length,
    essayPoints: 0, essayTotal: essayQuestions.length, grade: null, durationMs: null, submittedAt: null, submitReason: null,
  }));
  return { examId, title: exam.title, releasedAt: exam.releasedAt, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) };
}
