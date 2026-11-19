import { and, asc, count, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { AnyDbClient, DbClient } from "../../db/client";
import { assessmentQuestions, classDisciplines, disciplines, examQuestions, examSubmissions, exams } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { assertProfessorCanManageDiscipline, canManageQuiz } from "../quiz/quizPermissionService";
import { quizAudience } from "../notifications/notificationService";
import type { QuestionSnapshot } from "./examGrading";
import { finalizeSubmission } from "./examSubmissionService";

type StaffUser = NonNullable<import("express").Request["user"]>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EXAM_LIMITS = { title: 200, instructions: 2000, maxQuestions: 100, minTimeLimit: 1, maxTimeLimit: 600 };

export interface ExamIssue { field: string; code: string; params: Record<string, string | number> }

/** Per-field validation failure, returned as a list so the form can mark each field. */
export class ExamValidationError extends Error {
  readonly issues: ExamIssue[];
  constructor(issues: ExamIssue[]) {
    super("exams.invalid");
    this.issues = issues;
  }
}

export type ExamState = "draft" | "scheduled" | "open" | "closed" | "released";

/** Effective state: a published exam is closed once its closing time has passed. */
export function examState(exam: { status: string; opensAt: Date | null; closesAt: Date | null }, now: Date): ExamState {
  if (exam.status === "draft" || exam.status === "released") return exam.status as ExamState;
  if (exam.status === "closed" || (exam.closesAt && now >= exam.closesAt)) return "closed";
  if (exam.opensAt && now < exam.opensAt) return "scheduled";
  return "open";
}

export const canManageExam = (exam: { ownerId: string; disciplineId: string }, user: StaffUser) =>
  canManageQuiz({ professorId: exam.ownerId, disciplineId: exam.disciplineId }, user);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function parseDate(value: unknown, field: string, issues: ExamIssue[]): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || isNaN(+date)) { issues.push({ field, code: "DATE_INVALID", params: {} }); return null; }
  return date;
}

interface ExamInput {
  title: string;
  instructions: string | null;
  disciplineId: string;
  classId: string | null;
  shuffle: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  timeLimitMinutes: number | null;
  questionIds: string[];
}

/** Checks the form and that every question is an active bank question of the same discipline. */
async function validateExamInput(db: AnyDbClient, user: StaffUser, raw: unknown): Promise<ExamInput> {
  const body = isRecord(raw) ? raw : {};
  const issues: ExamIssue[] = [];
  const title = text(body.title);
  if (!title) issues.push({ field: "title", code: "REQUIRED", params: {} });
  else if (title.length > EXAM_LIMITS.title) issues.push({ field: "title", code: "TOO_LONG", params: { max: EXAM_LIMITS.title } });
  const instructions = text(body.instructions);
  if (instructions.length > EXAM_LIMITS.instructions) issues.push({ field: "instructions", code: "TOO_LONG", params: { max: EXAM_LIMITS.instructions } });

  const disciplineId = typeof body.disciplineId === "string" && UUID.test(body.disciplineId) ? body.disciplineId : "";
  if (!disciplineId) issues.push({ field: "disciplineId", code: "REQUIRED", params: {} });
  const classId = typeof body.classId === "string" && body.classId ? body.classId : null;
  if (classId && !UUID.test(classId)) issues.push({ field: "classId", code: "CLASS_OUTSIDE_DISCIPLINE", params: {} });

  const opensAt = parseDate(body.opensAt, "opensAt", issues);
  const closesAt = parseDate(body.closesAt, "closesAt", issues);
  if (opensAt && closesAt && closesAt <= opensAt) issues.push({ field: "closesAt", code: "WINDOW_INVALID", params: {} });

  const rawLimit = body.timeLimitMinutes;
  const timeLimitMinutes = rawLimit === null || rawLimit === undefined || rawLimit === "" ? null : Number(rawLimit);
  if (timeLimitMinutes !== null && (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < EXAM_LIMITS.minTimeLimit || timeLimitMinutes > EXAM_LIMITS.maxTimeLimit)) {
    issues.push({ field: "timeLimitMinutes", code: "TIME_LIMIT_RANGE", params: { min: EXAM_LIMITS.minTimeLimit, max: EXAM_LIMITS.maxTimeLimit } });
  }

  const questionIds = Array.isArray(body.questionIds) ? body.questionIds.filter((id): id is string => typeof id === "string") : [];
  if (questionIds.length === 0) issues.push({ field: "questionIds", code: "QUESTIONS_REQUIRED", params: {} });
  else if (questionIds.length > EXAM_LIMITS.maxQuestions) issues.push({ field: "questionIds", code: "TOO_MANY_QUESTIONS", params: { max: EXAM_LIMITS.maxQuestions } });
  else if (new Set(questionIds).size !== questionIds.length || questionIds.some((id) => !UUID.test(id))) issues.push({ field: "questionIds", code: "QUESTIONS_INVALID", params: {} });

  if (disciplineId && classId && UUID.test(classId)) {
    const [link] = await db.select({ classId: classDisciplines.classId }).from(classDisciplines)
      .where(and(eq(classDisciplines.classId, classId), eq(classDisciplines.disciplineId, disciplineId))).limit(1);
    if (!link) issues.push({ field: "classId", code: "CLASS_OUTSIDE_DISCIPLINE", params: {} });
  }
  if (disciplineId && questionIds.length && !issues.some((issue) => issue.field === "questionIds")) {
    const found = await db.select({ id: assessmentQuestions.id }).from(assessmentQuestions)
      .where(and(inArray(assessmentQuestions.id, questionIds), eq(assessmentQuestions.disciplineId, disciplineId), isNull(assessmentQuestions.archivedAt)));
    const available = found.map((row) => row.id);
    questionIds.forEach((id, index) => {
      if (available.indexOf(id) === -1) issues.push({ field: "questionIds", code: "QUESTION_UNAVAILABLE", params: { position: index + 1 } });
    });
  }
  if (issues.length) throw new ExamValidationError(issues);
  await assertProfessorCanManageDiscipline(user, disciplineId);
  return { title, instructions: instructions || null, disciplineId, classId, shuffle: body.shuffle === true, opensAt, closesAt, timeLimitMinutes, questionIds };
}

async function loadExam(db: AnyDbClient, user: StaffUser, id: string) {
  if (!UUID.test(id)) throw new AppError("exams.notFound", 404);
  const [exam] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
  if (!exam) throw new AppError("exams.notFound", 404);
  if (!canManageExam(exam, user)) throw new AppError("auth.accessDeniedCapital", 403);
  return exam;
}

export async function createExam(db: AnyDbClient, user: StaffUser, body: unknown) {
  const input = await validateExamInput(db, user, body);
  const { questionIds, ...fields } = input;
  const [created] = await db.insert(exams).values({ ...fields, ownerId: user.id, draftQuestionIds: questionIds }).returning({ id: exams.id });
  return getManagedExam(db, user, created.id);
}

/** Only drafts can change; a published exam keeps its questions (create a new exam instead). */
export async function updateExam(db: AnyDbClient, user: StaffUser, id: string, body: unknown) {
  const exam = await loadExam(db, user, id);
  if (exam.status !== "draft") throw new AppError("exams.notDraft", 409);
  const input = await validateExamInput(db, user, body);
  const { questionIds, ...fields } = input;
  await db.update(exams).set({ ...fields, draftQuestionIds: questionIds, updatedAt: new Date() }).where(eq(exams.id, id));
  return getManagedExam(db, user, id);
}

export async function deleteExam(db: AnyDbClient, user: StaffUser, id: string) {
  const exam = await loadExam(db, user, id);
  if (exam.status !== "draft") throw new AppError("exams.notDraft", 409);
  await db.delete(exams).where(eq(exams.id, id));
}

/** Copies each question (with its answers) into the exam and opens it to the class. */
export async function publishExam(db: DbClient, user: StaffUser, id: string, now = new Date()) {
  const exam = await loadExam(db, user, id);
  if (exam.status !== "draft") throw new AppError("exams.notDraft", 409);
  const input = await validateExamInput(db, user, { ...exam, questionIds: exam.draftQuestionIds, opensAt: exam.opensAt?.toISOString(), closesAt: exam.closesAt?.toISOString() });
  if (input.closesAt && input.closesAt <= now) throw new ExamValidationError([{ field: "closesAt", code: "CLOSES_IN_PAST", params: {} }]);
  const rows = await db.select().from(assessmentQuestions).where(inArray(assessmentQuestions.id, input.questionIds));
  await db.transaction(async (tx) => {
    await tx.insert(examQuestions).values(input.questionIds.map((questionId, orderIndex) => {
      const question = rows.filter((row) => row.id === questionId)[0];
      const snapshot: QuestionSnapshot = {
        statement: question.statement,
        language: question.language as QuestionSnapshot["language"],
        subject: question.subject,
        concepts: question.concepts,
        content: question.content as QuestionSnapshot["content"],
      };
      return { examId: id, questionId, questionVersion: question.version, orderIndex, type: question.type, weight: question.weight, snapshot };
    }));
    await tx.update(exams).set({ status: "published", publishedAt: now, updatedAt: now }).where(eq(exams.id, id));
  });
  return getManagedExam(db, user, id);
}

/** Closes the exam now; open attempts are submitted with what was saved (decision of the course). */
export async function closeExam(db: DbClient, user: StaffUser, id: string, now = new Date()) {
  const exam = await loadExam(db, user, id);
  if (exam.status !== "published") throw new AppError("exams.notPublished", 409);
  await db.update(exams).set({ status: "closed", closedAt: now, updatedAt: now }).where(eq(exams.id, id));
  const open = await db.select({ id: examSubmissions.id }).from(examSubmissions)
    .where(and(eq(examSubmissions.examId, id), eq(examSubmissions.status, "in_progress")));
  for (const submission of open) await finalizeSubmission(db, submission.id, "exam_closed", now);
  return getManagedExam(db, user, id);
}

async function submissionCounts(db: AnyDbClient, examIds: string[]) {
  const counts: Record<string, { submitted: number; inProgress: number }> = {};
  examIds.forEach((id) => { counts[id] = { submitted: 0, inProgress: 0 }; });
  if (!examIds.length) return counts;
  const rows = await db.select({ examId: examSubmissions.examId, status: examSubmissions.status, total: count() })
    .from(examSubmissions).where(inArray(examSubmissions.examId, examIds)).groupBy(examSubmissions.examId, examSubmissions.status);
  rows.forEach((row) => {
    if (row.status === "submitted") counts[row.examId].submitted = Number(row.total);
    else counts[row.examId].inProgress = Number(row.total);
  });
  return counts;
}

/** Professor: own exams; coordinator: also coordinated disciplines; admin: all. */
export async function listManagedExams(db: AnyDbClient, user: StaffUser, now = new Date()) {
  const conditions: SQL[] = [];
  if (!user.role.includes("admin")) {
    const coordinated = user.role.includes("course-coordinator") ? user.disciplines ?? [] : [];
    const own = eq(exams.ownerId, user.id);
    conditions.push(coordinated.length ? (or(own, inArray(exams.disciplineId, coordinated)) as SQL) : own);
  }
  const rows = await db.select({ exam: exams, disciplineName: disciplines.name })
    .from(exams).innerJoin(disciplines, eq(disciplines.id, exams.disciplineId))
    .where(conditions.length ? and(...conditions) : undefined).orderBy(desc(exams.createdAt));
  const counts = await submissionCounts(db, rows.map((row) => row.exam.id));
  return rows.map(({ exam, disciplineName }) => ({
    id: exam.id, title: exam.title, disciplineId: exam.disciplineId, disciplineName, classId: exam.classId,
    state: examState(exam, now), opensAt: exam.opensAt, closesAt: exam.closesAt, timeLimitMinutes: exam.timeLimitMinutes,
    questionCount: exam.status === "draft" ? exam.draftQuestionIds.length : null, ...counts[exam.id], createdAt: exam.createdAt,
  }));
}

/** Details for the professor. Results stay hidden until release (phase 6): only counts here. */
export async function getManagedExam(db: AnyDbClient, user: StaffUser, id: string, now = new Date()) {
  const exam = await loadExam(db, user, id);
  const [discipline] = await db.select({ name: disciplines.name }).from(disciplines).where(eq(disciplines.id, exam.disciplineId)).limit(1);
  let questions: Array<{ questionId: string | null; type: string; statement: string; weight: number; version: number | null }>;
  if (exam.status === "draft") {
    const rows = exam.draftQuestionIds.length
      ? await db.select().from(assessmentQuestions).where(inArray(assessmentQuestions.id, exam.draftQuestionIds))
      : [];
    questions = exam.draftQuestionIds.map((questionId) => {
      const row = rows.filter((item) => item.id === questionId)[0];
      return row
        ? { questionId, type: row.type, statement: row.statement, weight: row.weight, version: row.version }
        : { questionId, type: "unavailable", statement: "", weight: 0, version: null };
    });
  } else {
    const rows = await db.select().from(examQuestions).where(eq(examQuestions.examId, id)).orderBy(asc(examQuestions.orderIndex));
    questions = rows.map((row) => ({ questionId: row.questionId, type: row.type, statement: (row.snapshot as QuestionSnapshot).statement, weight: row.weight, version: row.questionVersion }));
  }
  const counts = (await submissionCounts(db, [id]))[id];
  const audience = (await quizAudience(db, exam)).length;
  return {
    id: exam.id, title: exam.title, instructions: exam.instructions, disciplineId: exam.disciplineId, disciplineName: discipline ? discipline.name : "",
    classId: exam.classId, shuffle: exam.shuffle, state: examState(exam, now), opensAt: exam.opensAt, closesAt: exam.closesAt,
    timeLimitMinutes: exam.timeLimitMinutes, publishedAt: exam.publishedAt, closedAt: exam.closedAt, questions, audience, ...counts,
    totalWeight: questions.reduce((sum, question) => sum + question.weight, 0),
  };
}

