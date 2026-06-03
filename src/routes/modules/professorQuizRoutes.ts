import { Router } from "express";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { getDb } from "../../db/client";
import {
  accounts,
  disciplines,
  professorDisciplines,
  professorQuizAnswers,
  professorQuizAttempts,
  professorQuizQuestions,
  professorQuizzes,
} from "../../db/schema";

export const professorQuizRouter = Router();

professorQuizRouter.use(requireAuth);
professorQuizRouter.use(requireRoles(["professor", "course-coordinator", "admin"]));

// ── List professor's quizzes ──────────────────────────────────────────────────
professorQuizRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { disciplineId } = req.query;
    const db = getDb();

    const rows = await db
      .select({
        id: professorQuizzes.id,
        title: professorQuizzes.title,
        topic: professorQuizzes.topic,
        description: professorQuizzes.description,
        disciplineId: professorQuizzes.disciplineId,
        disciplineName: disciplines.name,
        createdAt: professorQuizzes.createdAt,
        questionCount: count(professorQuizQuestions.id),
      })
      .from(professorQuizzes)
      .leftJoin(disciplines, eq(professorQuizzes.disciplineId, disciplines.id))
      .leftJoin(
        professorQuizQuestions,
        eq(professorQuizQuestions.quizId, professorQuizzes.id),
      )
      .where(
        disciplineId
          ? and(
              eq(professorQuizzes.professorId, req.user!.id),
              eq(professorQuizzes.disciplineId, String(disciplineId)),
            )
          : eq(professorQuizzes.professorId, req.user!.id),
      )
      .groupBy(
        professorQuizzes.id,
        disciplines.name,
      )
      .orderBy(desc(professorQuizzes.createdAt));

    return res.json(rows);
  }),
);

// ── Create quiz ───────────────────────────────────────────────────────────────
professorQuizRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title, disciplineId, topic, description } = req.body as {
      title?: string;
      disciplineId?: string;
      topic?: string;
      description?: string;
    };

    if (!title?.trim()) throw new AppError("title é obrigatório", 400);
    if (!disciplineId) throw new AppError("disciplineId é obrigatório", 400);
    if (!topic?.trim()) throw new AppError("topic é obrigatório", 400);

    const db = getDb();

    const [quiz] = await db
      .insert(professorQuizzes)
      .values({
        professorId: req.user!.id,
        disciplineId,
        title: title.trim(),
        topic: topic.trim(),
        description: description?.trim() ?? null,
      })
      .returning();

    return res.status(201).json(quiz);
  }),
);

// ── Update quiz metadata ──────────────────────────────────────────────────────
professorQuizRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!existing) throw new AppError("Quiz não encontrado", 404);
    if (existing.professorId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("Acesso negado", 403);

    const { title, topic, description, disciplineId } = req.body as {
      title?: string;
      topic?: string;
      description?: string;
      disciplineId?: string;
    };

    const [updated] = await db
      .update(professorQuizzes)
      .set({
        title: title?.trim() ?? existing.title,
        topic: topic?.trim() ?? existing.topic,
        description: description !== undefined ? (description?.trim() ?? null) : existing.description,
        disciplineId: disciplineId ?? existing.disciplineId,
        updatedAt: new Date(),
      })
      .where(eq(professorQuizzes.id, req.params.id))
      .returning();

    return res.json(updated);
  }),
);

// ── Delete quiz ───────────────────────────────────────────────────────────────
professorQuizRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!existing) throw new AppError("Quiz não encontrado", 404);
    if (existing.professorId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("Acesso negado", 403);

    await db.delete(professorQuizzes).where(eq(professorQuizzes.id, req.params.id));

    return res.json({ success: true });
  }),
);

// ── List questions ────────────────────────────────────────────────────────────
professorQuizRouter.get(
  "/:id/questions",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [quiz] = await db
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (quiz.professorId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("Acesso negado", 403);

    const questions = await db
      .select()
      .from(professorQuizQuestions)
      .where(eq(professorQuizQuestions.quizId, req.params.id))
      .orderBy(asc(professorQuizQuestions.orderIndex));

    return res.json(questions);
  }),
);

// ── Add question ──────────────────────────────────────────────────────────────
professorQuizRouter.post(
  "/:id/questions",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [quiz] = await db
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (quiz.professorId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("Acesso negado", 403);

    const { question, options, correctOption, explanation, orderIndex } =
      req.body as {
        question?: string;
        options?: string[];
        correctOption?: string;
        explanation?: string;
        orderIndex?: number;
      };

    if (!question?.trim()) throw new AppError("question é obrigatório", 400);
    if (!Array.isArray(options) || options.length < 2)
      throw new AppError("options deve ter ao menos 2 alternativas", 400);
    if (!correctOption?.trim()) throw new AppError("correctOption é obrigatório", 400);

    const [currentMax] = await db
      .select({ max: sql<number>`coalesce(max(${professorQuizQuestions.orderIndex}), -1)` })
      .from(professorQuizQuestions)
      .where(eq(professorQuizQuestions.quizId, req.params.id));

    const [q] = await db
      .insert(professorQuizQuestions)
      .values({
        quizId: req.params.id,
        question: question.trim(),
        options,
        correctOption: correctOption.trim().toUpperCase(),
        explanation: explanation?.trim() ?? null,
        orderIndex: orderIndex ?? (Number(currentMax?.max ?? -1) + 1),
      })
      .returning();

    return res.status(201).json(q);
  }),
);

// ── Update question ───────────────────────────────────────────────────────────
professorQuizRouter.put(
  "/:id/questions/:qId",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(professorQuizQuestions)
      .where(
        and(
          eq(professorQuizQuestions.id, req.params.qId),
          eq(professorQuizQuestions.quizId, req.params.id),
        ),
      )
      .limit(1);

    if (!existing) throw new AppError("Pergunta não encontrada", 404);

    const [quiz] = await db
      .select({ professorId: professorQuizzes.professorId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (quiz?.professorId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("Acesso negado", 403);

    const { question, options, correctOption, explanation, orderIndex } =
      req.body as {
        question?: string;
        options?: string[];
        correctOption?: string;
        explanation?: string;
        orderIndex?: number;
      };

    const [updated] = await db
      .update(professorQuizQuestions)
      .set({
        question: question?.trim() ?? existing.question,
        options: options ?? existing.options,
        correctOption: correctOption?.trim().toUpperCase() ?? existing.correctOption,
        explanation: explanation !== undefined ? (explanation?.trim() ?? null) : existing.explanation,
        orderIndex: orderIndex ?? existing.orderIndex,
      })
      .where(eq(professorQuizQuestions.id, req.params.qId))
      .returning();

    return res.json(updated);
  }),
);

// ── Delete question ───────────────────────────────────────────────────────────
professorQuizRouter.delete(
  "/:id/questions/:qId",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [quiz] = await db
      .select({ professorId: professorQuizzes.professorId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (quiz.professorId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("Acesso negado", 403);

    await db
      .delete(professorQuizQuestions)
      .where(
        and(
          eq(professorQuizQuestions.id, req.params.qId),
          eq(professorQuizQuestions.quizId, req.params.id),
        ),
      );

    return res.json({ success: true });
  }),
);

// ── Quiz results (professor view) ─────────────────────────────────────────────
professorQuizRouter.get(
  "/:id/results",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [quiz] = await db
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId, title: professorQuizzes.title, topic: professorQuizzes.topic })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (quiz.professorId !== req.user!.id && !req.user!.role.includes("admin"))
      throw new AppError("Acesso negado", 403);

    const attempts = await db
      .select({
        attemptId: professorQuizAttempts.id,
        studentId: professorQuizAttempts.studentId,
        studentName: accounts.name,
        score: professorQuizAttempts.score,
        totalQuestions: professorQuizAttempts.totalQuestions,
        completedAt: professorQuizAttempts.completedAt,
      })
      .from(professorQuizAttempts)
      .innerJoin(accounts, eq(professorQuizAttempts.studentId, accounts.id))
      .where(eq(professorQuizAttempts.quizId, req.params.id))
      .orderBy(desc(professorQuizAttempts.completedAt));

    return res.json({ quiz, attempts });
  }),
);
