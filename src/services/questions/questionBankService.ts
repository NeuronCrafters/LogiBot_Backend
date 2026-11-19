import { randomBytes } from "crypto";
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { assessmentQuestions, disciplines, professorQuizQuestions, professorQuizzes } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { QUESTION_TYPES, checkQuestion, type LineIdFactory, type QuestionIssue, type NormalizedQuestion } from "../logic/questionCore";
import { assertProfessorCanManageDiscipline, canManageQuiz } from "../quiz/quizPermissionService";

type BankUser = NonNullable<import("express").Request["user"]>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUIZ_LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Validation failure with the per-field issues, so the form can point at each field. */
export class QuestionValidationError extends Error {
  readonly issues: QuestionIssue[];
  constructor(issues: QuestionIssue[]) {
    super("questions.invalid");
    this.issues = issues;
  }
}

/** Random, unordered line ids: ordered ids would reveal a Parsons solution to students. */
export function randomLineIds(): LineIdFactory {
  const used: string[] = [];
  return () => {
    let id = "";
    do id = "ln" + randomBytes(5).toString("hex");
    while (used.indexOf(id) !== -1);
    used.push(id);
    return id;
  };
}

const isAdmin = (user: BankUser) => user.role.includes("admin");
const isCoordinator = (user: BankUser) => user.role.includes("course-coordinator");

export function canManageQuestion(question: { ownerId: string; disciplineId: string }, user: BankUser): boolean {
  return canManageQuiz({ professorId: question.ownerId, disciplineId: question.disciplineId }, user);
}

const selection = {
  id: assessmentQuestions.id,
  ownerId: assessmentQuestions.ownerId,
  disciplineId: assessmentQuestions.disciplineId,
  disciplineName: disciplines.name,
  type: assessmentQuestions.type,
  version: assessmentQuestions.version,
  weight: assessmentQuestions.weight,
  language: assessmentQuestions.language,
  subject: assessmentQuestions.subject,
  concepts: assessmentQuestions.concepts,
  statement: assessmentQuestions.statement,
  content: assessmentQuestions.content,
  sourceQuizQuestionId: assessmentQuestions.sourceQuizQuestionId,
  practiceEnabled: assessmentQuestions.practiceEnabled,
  createdAt: assessmentQuestions.createdAt,
  updatedAt: assessmentQuestions.updatedAt,
};

/** Professor: own questions; coordinator: own + coordinated disciplines; admin: all. Archived ones are hidden. */
export async function listQuestions(db: AnyDbClient, user: BankUser, filters: { disciplineId?: unknown; type?: unknown }) {
  const conditions: SQL[] = [isNull(assessmentQuestions.archivedAt)];
  if (typeof filters.disciplineId === "string" && filters.disciplineId) {
    if (!UUID.test(filters.disciplineId)) return [];
    conditions.push(eq(assessmentQuestions.disciplineId, filters.disciplineId));
  }
  if (typeof filters.type === "string" && filters.type) {
    if ((QUESTION_TYPES as readonly string[]).indexOf(filters.type) === -1) return [];
    conditions.push(eq(assessmentQuestions.type, filters.type));
  }
  if (!isAdmin(user)) {
    const coordinated = isCoordinator(user) ? user.disciplines ?? [] : [];
    const own = eq(assessmentQuestions.ownerId, user.id);
    conditions.push(coordinated.length ? (or(own, inArray(assessmentQuestions.disciplineId, coordinated)) as SQL) : own);
  }
  return db
    .select(selection)
    .from(assessmentQuestions)
    .innerJoin(disciplines, eq(disciplines.id, assessmentQuestions.disciplineId))
    .where(and(...conditions))
    .orderBy(desc(assessmentQuestions.updatedAt));
}

async function findActive(db: AnyDbClient, id: string) {
  if (!UUID.test(id)) throw new AppError("questions.notFound", 404);
  const [row] = await db
    .select(selection)
    .from(assessmentQuestions)
    .innerJoin(disciplines, eq(disciplines.id, assessmentQuestions.disciplineId))
    .where(and(eq(assessmentQuestions.id, id), isNull(assessmentQuestions.archivedAt)))
    .limit(1);
  if (!row) throw new AppError("questions.notFound", 404);
  return row;
}

export async function getQuestion(db: AnyDbClient, user: BankUser, id: string) {
  const row = await findActive(db, id);
  if (!canManageQuestion(row, user)) throw new AppError("auth.accessDeniedCapital", 403);
  return row;
}

function validate(body: Record<string, unknown>): NormalizedQuestion {
  const result = checkQuestion(
    { type: body.type, statement: body.statement, weight: body.weight, subject: body.subject, concepts: body.concepts, language: body.language, content: body.content },
    randomLineIds(),
  );
  if (result.ok === false) throw new QuestionValidationError(result.issues);
  return result.question;
}

export const PRACTICE_TYPES = ["truth_table", "translation", "parsons"];
/** Only workbench-compatible types can be offered for practice. */
const practiceFlag = (body: Record<string, unknown>, type: string) => body.practiceEnabled === true && PRACTICE_TYPES.indexOf(type) !== -1;

function requireDiscipline(body: Record<string, unknown>): string {
  if (typeof body.disciplineId !== "string" || !UUID.test(body.disciplineId)) {
    throw new QuestionValidationError([{ field: "disciplineId", code: "REQUIRED", params: {} }]);
  }
  return body.disciplineId;
}

export async function createQuestion(db: AnyDbClient, user: BankUser, body: Record<string, unknown>) {
  const disciplineId = requireDiscipline(body);
  const question = validate(body);
  await assertProfessorCanManageDiscipline(user, disciplineId);
  const [created] = await db
    .insert(assessmentQuestions)
    .values({ ownerId: user.id, disciplineId, ...question, content: question.content, practiceEnabled: practiceFlag(body, question.type) })
    .returning({ id: assessmentQuestions.id });
  return findActive(db, created.id);
}

/** Editing creates a new version; exams (phase 5) keep a snapshot of the version they used. */
export async function updateQuestion(db: AnyDbClient, user: BankUser, id: string, body: Record<string, unknown>) {
  const current = await getQuestion(db, user, id);
  if (body.type !== undefined && body.type !== current.type) throw new AppError("questions.typeLocked", 400);
  const disciplineId = body.disciplineId === undefined ? current.disciplineId : requireDiscipline(body);
  const question = validate({ ...body, type: current.type });
  if (disciplineId !== current.disciplineId) await assertProfessorCanManageDiscipline(user, disciplineId);
  await db
    .update(assessmentQuestions)
    .set({ ...question, disciplineId, content: question.content, practiceEnabled: practiceFlag(body, question.type), version: sql`${assessmentQuestions.version} + 1`, updatedAt: new Date() })
    .where(eq(assessmentQuestions.id, current.id));
  return findActive(db, current.id);
}

export async function archiveQuestion(db: AnyDbClient, user: BankUser, id: string) {
  const current = await getQuestion(db, user, id);
  await db.update(assessmentQuestions).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(assessmentQuestions.id, current.id));
}

/** Copies the questions of an existing quiz into the bank (as quiz questions). Already imported ones are skipped. */
export async function importQuizQuestions(db: AnyDbClient, user: BankUser, quizId: string) {
  if (!UUID.test(quizId)) throw new AppError("quiz.notFound", 404);
  const [quiz] = await db.select().from(professorQuizzes).where(eq(professorQuizzes.id, quizId)).limit(1);
  if (!quiz) throw new AppError("quiz.notFound", 404);
  if (!canManageQuiz(quiz, user)) throw new AppError("auth.accessDeniedCapital", 403);

  const questions = await db
    .select()
    .from(professorQuizQuestions)
    .where(eq(professorQuizQuestions.quizId, quizId))
    .orderBy(asc(professorQuizQuestions.orderIndex));
  const already = questions.length
    ? await db
      .select({ source: assessmentQuestions.sourceQuizQuestionId })
      .from(assessmentQuestions)
      .where(and(
        eq(assessmentQuestions.ownerId, user.id),
        isNull(assessmentQuestions.archivedAt),
        inArray(assessmentQuestions.sourceQuizQuestionId, questions.map((question) => question.id)),
      ))
    : [];
  const skip = already.map((row) => row.source);

  let imported = 0;
  let invalid = 0;
  for (const source of questions) {
    if (skip.indexOf(source.id) !== -1) continue;
    const correct = QUIZ_LETTERS.indexOf(String(source.correctOption).trim().toUpperCase());
    const result = checkQuestion({
      type: "quiz",
      statement: source.question,
      weight: 1,
      subject: quiz.topic,
      concepts: [],
      language: quiz.language ?? "pt-BR",
      content: { options: source.options, correct },
    }, randomLineIds());
    if (result.ok === false) { invalid++; continue; }
    await db.insert(assessmentQuestions).values({
      ownerId: user.id,
      disciplineId: quiz.disciplineId,
      ...result.question,
      content: result.question.content,
      sourceQuizQuestionId: source.id,
    });
    imported++;
  }
  return { imported, skipped: skip.length, invalid };
}
