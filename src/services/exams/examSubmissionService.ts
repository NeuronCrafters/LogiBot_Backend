import { and, asc, count, eq, inArray, isNull, or } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { blindReviews, classDisciplines, disciplines, examQuestions, examSubmissions, exams, studentProfiles, type Exam, type ExamSubmission } from "../../db/schema";
import { getFrontendOrigin } from "../../config/env";
import { AppError } from "../../exceptions/AppError";
import { notifyExamSubmission, notifySafely } from "../notifications/notificationService";
import { createBlindReviewsFor } from "./blindReviewRows";
import { gradeAnswer, isAnswered, sanitizeAnswer, shuffle, studentQuestionView, type ExamAnswer, type ObjectiveResult, type QuestionSnapshot } from "./examGrading";

export type SubmitReason = "student" | "time_limit" | "exam_closed";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENTS_PER_QUESTION = 200;
const MAX_EVENT_TIME_MS = 24 * 60 * 60 * 1000;

interface Layout { questionOrder: string[]; lineOrders: Record<string, string[]> }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Same rule as the professor's view (kept here to avoid a circular import). */
function effectiveState(exam: Exam, now: Date): "draft" | "scheduled" | "open" | "closed" | "released" {
  if (exam.status === "draft" || exam.status === "released") return exam.status as "draft" | "released";
  if (exam.status === "closed" || (exam.closesAt && now >= exam.closesAt)) return "closed";
  if (exam.opensAt && now < exam.opensAt) return "scheduled";
  return "open";
}

async function questionsOf(db: AnyDbClient, examId: string) {
  return db.select().from(examQuestions).where(eq(examQuestions.examId, examId)).orderBy(asc(examQuestions.orderIndex));
}

/**
 * Grades the objective questions on the server and locks the submission. Idempotent:
 * only an attempt still in progress is changed. Results stay hidden until release.
 */
export async function finalizeSubmission(db: AnyDbClient, submissionId: string, reason: SubmitReason, now = new Date(), appUrl = getFrontendOrigin()): Promise<boolean> {
  const [submission] = await db.select().from(examSubmissions).where(eq(examSubmissions.id, submissionId)).limit(1);
  if (!submission || submission.status !== "in_progress") return false;
  const saved = isRecord(submission.answers) ? submission.answers : {};
  const results: Record<string, ObjectiveResult> = {};
  for (const question of await questionsOf(db, submission.examId)) {
    const content = (question.snapshot as QuestionSnapshot).content;
    const result = gradeAnswer(content, sanitizeAnswer(content, saved[question.id]));
    if (result) results[question.id] = result;
  }
  const updated = await db.update(examSubmissions)
    .set({ status: "submitted", submittedAt: now, submitReason: reason, objectiveResults: results })
    .where(and(eq(examSubmissions.id, submissionId), eq(examSubmissions.status, "in_progress")))
    .returning({ id: examSubmissions.id });
  if (!updated.length) return false;
  await createBlindReviewsFor(db, submissionId);
  await notifySafely("exam_submission", () => notifyExamSubmission(db, submission.examId, submission.studentId, appUrl));
  return true;
}

/** Finalizes an attempt whose own deadline or the exam closing time has passed. */
async function expireIfNeeded(db: AnyDbClient, exam: Exam, submission: ExamSubmission, now: Date): Promise<boolean> {
  if (submission.status !== "in_progress") return false;
  const timeUp = submission.deadlineAt !== null && now >= submission.deadlineAt;
  const closed = effectiveState(exam, now) === "closed";
  if (!timeUp && !closed) return false;
  const byTimeLimit = timeUp && exam.timeLimitMinutes !== null && (!exam.closesAt || submission.deadlineAt! < exam.closesAt) && exam.status !== "closed";
  return finalizeSubmission(db, submission.id, byTimeLimit ? "time_limit" : "exam_closed", now);
}

async function studentScope(db: AnyDbClient, studentId: string) {
  const [profile] = await db.select({ classId: studentProfiles.classId }).from(studentProfiles).where(eq(studentProfiles.accountId, studentId)).limit(1);
  if (!profile) return null;
  const rows = await db.select({ disciplineId: classDisciplines.disciplineId }).from(classDisciplines).where(eq(classDisciplines.classId, profile.classId));
  return { classId: profile.classId, disciplineIds: rows.map((row) => row.disciplineId) };
}

const visibleTo = (exam: Exam, scope: { classId: string; disciplineIds: string[] }) =>
  exam.status !== "draft" && (exam.classId ? exam.classId === scope.classId : scope.disciplineIds.indexOf(exam.disciplineId) !== -1);

async function loadVisibleExam(db: AnyDbClient, studentId: string, examId: string) {
  if (!UUID.test(examId)) throw new AppError("exams.notFound", 404);
  const scope = await studentScope(db, studentId);
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam || !scope || !visibleTo(exam, scope)) throw new AppError("exams.notFound", 404);
  return exam;
}

async function ownSubmission(db: AnyDbClient, examId: string, studentId: string) {
  const [submission] = await db.select().from(examSubmissions)
    .where(and(eq(examSubmissions.examId, examId), eq(examSubmissions.studentId, studentId))).limit(1);
  return submission;
}

/** Exams of the student's class with their own status; never any grade before release. */
export async function listStudentExams(db: AnyDbClient, studentId: string, now = new Date()) {
  const scope = await studentScope(db, studentId);
  if (!scope) return [];
  const rows = await db.select({ exam: exams, disciplineName: disciplines.name })
    .from(exams).innerJoin(disciplines, eq(disciplines.id, exams.disciplineId))
    .where(and(
      inArray(exams.status, ["published", "closed", "released"]),
      scope.disciplineIds.length
        ? or(eq(exams.classId, scope.classId), and(isNull(exams.classId), inArray(exams.disciplineId, scope.disciplineIds)))
        : eq(exams.classId, scope.classId),
    ));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.exam.id);
  const submissions = await db.select().from(examSubmissions).where(and(inArray(examSubmissions.examId, ids), eq(examSubmissions.studentId, studentId)));
  const questionCounts = await db.select({ examId: examQuestions.examId, total: count() }).from(examQuestions)
    .where(inArray(examQuestions.examId, ids)).groupBy(examQuestions.examId);

  const result = [];
  for (const { exam, disciplineName } of rows) {
    let submission = submissions.filter((item) => item.examId === exam.id)[0];
    if (submission && (await expireIfNeeded(db, exam, submission, now))) submission = await ownSubmission(db, exam.id, studentId);
    const state = effectiveState(exam, now);
    const status = submission
      ? submission.status === "submitted" ? (state === "released" ? "released" : "submitted") : "in_progress"
      : state === "scheduled" ? "upcoming" : state === "open" ? "available" : "missed";
    const total = questionCounts.filter((row) => row.examId === exam.id)[0];
    result.push({
      id: exam.id, title: exam.title, disciplineName, opensAt: exam.opensAt, closesAt: exam.closesAt,
      timeLimitMinutes: exam.timeLimitMinutes, questionCount: total ? Number(total.total) : 0, status,
      startedAt: submission ? submission.startedAt : null, submittedAt: submission ? submission.submittedAt : null,
      deadlineAt: submission && submission.status === "in_progress" ? submission.deadlineAt : null,
      grade: submission && exam.status === "released" ? submission.grade : null,
    });
  }
  const order: Record<string, number> = { in_progress: 0, available: 1, upcoming: 2, submitted: 3, released: 4, missed: 5 };
  return result.sort((a, b) => order[a.status] - order[b.status]);
}

function sanitizeAnswers(questions: Array<{ id: string; snapshot: unknown }>, raw: unknown): Record<string, ExamAnswer> {
  const answers: Record<string, ExamAnswer> = {};
  if (!isRecord(raw)) return answers;
  questions.forEach((question) => {
    const answer = sanitizeAnswer((question.snapshot as QuestionSnapshot).content, raw[question.id]);
    if (answer) answers[question.id] = answer;
  });
  return answers;
}

function sanitizeEvents(questions: Array<{ id: string }>, raw: unknown, previous: unknown): Record<string, Array<{ t: number; action: string }>> {
  const events: Record<string, Array<{ t: number; action: string }>> = isRecord(previous) ? (previous as Record<string, Array<{ t: number; action: string }>>) : {};
  if (!isRecord(raw)) return events;
  questions.forEach((question) => {
    const list = raw[question.id];
    if (!Array.isArray(list)) return;
    const current = events[question.id] ?? [];
    for (const item of list) {
      if (current.length >= MAX_EVENTS_PER_QUESTION) break;
      if (!isRecord(item) || typeof item.t !== "number" || item.t < 0 || item.t > MAX_EVENT_TIME_MS || typeof item.action !== "string" || !/^[a-z_]{1,30}$/.test(item.action)) continue;
      current.push({ t: Math.round(item.t), action: item.action });
    }
    events[question.id] = current;
  });
  return events;
}

async function attemptView(db: AnyDbClient, exam: Exam, submission: ExamSubmission, now: Date) {
  const questions = await questionsOf(db, exam.id);
  const layout = submission.layout as Layout;
  const byId: Record<string, (typeof questions)[number]> = {};
  questions.forEach((question) => { byId[question.id] = question; });
  return {
    examId: exam.id, title: exam.title, instructions: exam.instructions, status: "in_progress" as const,
    startedAt: submission.startedAt, deadlineAt: submission.deadlineAt, serverNow: now, closesAt: exam.closesAt, timeLimitMinutes: exam.timeLimitMinutes,
    questions: layout.questionOrder.filter((id) => byId[id]).map((id) =>
      studentQuestionView(byId[id].snapshot as QuestionSnapshot, id, byId[id].weight, layout.lineOrders[id])),
    answers: sanitizeAnswers(questions, submission.answers),
    lastSavedAt: submission.lastSavedAt,
  };
}

/**
 * Result after release (RF59): grade, outcome and points per question and the
 * professor's comments. The expected answers are never shown.
 */
async function releasedView(db: AnyDbClient, exam: Exam, submission: ExamSubmission) {
  const questions = await questionsOf(db, exam.id);
  const reviews = await db.select().from(blindReviews).where(eq(blindReviews.submissionId, submission.id));
  const order = (submission.layout as Layout).questionOrder;
  const objective = (submission.objectiveResults ?? {}) as Record<string, ObjectiveResult>;
  const answers = (submission.answers ?? {}) as Record<string, unknown>;
  const ordered = order.map((id) => questions.filter((question) => question.id === id)[0]).filter(Boolean);
  return {
    examId: exam.id, title: exam.title, status: "released" as const, grade: submission.grade, submittedAt: submission.submittedAt,
    submitReason: submission.submitReason, totalWeight: ordered.reduce((sum, question) => sum + question.weight, 0),
    questions: ordered.map((question, index) => {
      const snapshot = question.snapshot as QuestionSnapshot;
      const review = reviews.filter((item) => item.examQuestionId === question.id)[0];
      const credit = question.type === "essay" ? (review?.score ?? 0) : objective[question.id]?.correct ? 1 : 0;
      const answered = isAnswered(sanitizeAnswer(snapshot.content, answers[question.id]));
      return {
        position: index + 1, type: question.type, statement: snapshot.statement, language: snapshot.language, weight: question.weight,
        outcome: !answered ? "blank" : credit === 1 ? "correct" : credit > 0 ? "partial" : "incorrect",
        points: Math.round(question.weight * credit * 100) / 100,
        comment: question.type === "essay" ? review?.comment ?? "" : "",
      };
    }),
  };
}

const submittedView = (exam: Exam, submission: ExamSubmission) => ({
  examId: exam.id, title: exam.title, status: "submitted" as const, submittedAt: submission.submittedAt, submitReason: submission.submitReason,
});

/** Current attempt (without starting one). */
export async function getAttempt(db: AnyDbClient, studentId: string, examId: string, now = new Date()) {
  const exam = await loadVisibleExam(db, studentId, examId);
  let submission = await ownSubmission(db, examId, studentId);
  if (submission && (await expireIfNeeded(db, exam, submission, now))) submission = await ownSubmission(db, examId, studentId);
  if (!submission) {
    const [total] = await db.select({ total: count() }).from(examQuestions).where(eq(examQuestions.examId, examId));
    return {
      examId, title: exam.title, instructions: exam.instructions, status: "not_started" as const, state: effectiveState(exam, now),
      opensAt: exam.opensAt, closesAt: exam.closesAt, timeLimitMinutes: exam.timeLimitMinutes, questionCount: total ? Number(total.total) : 0, serverNow: now,
    };
  }
  if (submission.status === "submitted") return exam.status === "released" ? releasedView(db, exam, submission) : submittedView(exam, submission);
  return attemptView(db, exam, submission, now);
}

/** Starts the attempt once; the server fixes the start time, the deadline and the shuffled layout. */
export async function startExam(db: AnyDbClient, studentId: string, examId: string, now = new Date()) {
  const exam = await loadVisibleExam(db, studentId, examId);
  const existing = await ownSubmission(db, examId, studentId);
  if (existing) {
    if (await expireIfNeeded(db, exam, existing, now)) throw new AppError("exams.closed", 409);
    if (existing.status === "submitted") throw new AppError("exams.alreadySubmitted", 409);
    return attemptView(db, exam, existing, now);
  }
  const state = effectiveState(exam, now);
  if (state === "scheduled") throw new AppError("exams.notOpenYet", 409);
  if (state !== "open") throw new AppError("exams.closed", 409);

  const questions = await questionsOf(db, examId);
  const ids = questions.map((question) => question.id);
  const lineOrders: Record<string, string[]> = {};
  questions.forEach((question) => {
    const content = (question.snapshot as QuestionSnapshot).content;
    if (content.type === "parsons") lineOrders[question.id] = shuffle(content.lines.map((line) => line.id));
  });
  const limits = [exam.timeLimitMinutes ? new Date(+now + exam.timeLimitMinutes * 60000) : null, exam.closesAt].filter((date): date is Date => !!date);
  const deadlineAt = limits.length ? new Date(Math.min(...limits.map((date) => +date))) : null;
  await db.insert(examSubmissions)
    .values({ examId, studentId, startedAt: now, deadlineAt, layout: { questionOrder: exam.shuffle ? shuffle(ids) : ids, lineOrders }, answers: {}, events: {} })
    .onConflictDoNothing({ target: [examSubmissions.examId, examSubmissions.studentId] });
  const submission = await ownSubmission(db, examId, studentId);
  return attemptView(db, exam, submission, now);
}

async function inProgress(db: AnyDbClient, studentId: string, examId: string, now: Date) {
  const exam = await loadVisibleExam(db, studentId, examId);
  const submission = await ownSubmission(db, examId, studentId);
  if (!submission) throw new AppError("exams.notStarted", 409);
  return { exam, submission, expired: await expireIfNeeded(db, exam, submission, now) };
}

/** Autosave of the whole answer map. After the deadline nothing is saved anymore. */
export async function saveDraft(db: AnyDbClient, studentId: string, examId: string, body: unknown, now = new Date()) {
  const { exam, submission, expired } = await inProgress(db, studentId, examId, now);
  if (expired) throw new AppError("exams.timeUp", 409);
  if (submission.status === "submitted") throw new AppError("exams.alreadySubmitted", 409);
  const questions = await questionsOf(db, exam.id);
  const payload = isRecord(body) ? body : {};
  await db.update(examSubmissions).set({
    answers: sanitizeAnswers(questions, payload.answers),
    events: sanitizeEvents(questions, payload.events, submission.events),
    lastSavedAt: now,
  }).where(and(eq(examSubmissions.id, submission.id), eq(examSubmissions.status, "in_progress")));
  return { savedAt: now, deadlineAt: submission.deadlineAt, serverNow: now };
}

/** Single submission. If the deadline already passed, what was saved is what counts. */
export async function submitExam(db: AnyDbClient, studentId: string, examId: string, body: unknown, now = new Date(), appUrl = getFrontendOrigin()) {
  const { exam, submission, expired } = await inProgress(db, studentId, examId, now);
  if (!expired) {
    if (submission.status === "submitted") throw new AppError("exams.alreadySubmitted", 409);
    await saveDraft(db, studentId, examId, body, now);
    await finalizeSubmission(db, submission.id, "student", now, appUrl);
  }
  return submittedView(exam, await ownSubmission(db, examId, studentId));
}
