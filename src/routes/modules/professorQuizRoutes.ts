import { getFrontendOrigin } from "../../config/env";
import { notifyQuizPublished, notifySafely } from "../../services/notifications/notificationService";
import { getLanguage, normalizeLanguage } from "../../i18n";
import { Router } from "express";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
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
import { generateAiQuiz } from "../../services/quiz/quizAiGenerationService";
import { canManageQuiz } from "../../services/quiz/quizPermissionService";

export const professorQuizRouter = Router();

professorQuizRouter.use(requireAuth);
professorQuizRouter.use(requireRoles(["professor", "course-coordinator", "admin"]));

type AuthUser = NonNullable<import("express").Request["user"]>;

// ── List quizzes (professor → own; coordinator → disciplines; admin → all) ────
professorQuizRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { disciplineId } = req.query;
    const user = req.user!;
    const db = getDb();
    const isAdmin = user.role.includes("admin");
    const isCoordinator = user.role.includes("course-coordinator");

    // Build the ownership/access filter
    let baseFilter;
    if (isAdmin) {
      baseFilter = disciplineId
        ? eq(professorQuizzes.disciplineId, String(disciplineId))
        : undefined;
    } else if (isCoordinator) {
      const coordDisciplines = user.disciplines ?? [];
      const allowedDisciplines = disciplineId
        ? [String(disciplineId)].filter((d) => coordDisciplines.includes(d))
        : coordDisciplines;
      if (!allowedDisciplines.length) return res.json([]);
      baseFilter = inArray(professorQuizzes.disciplineId, allowedDisciplines);
    } else {
      // Professor — own quizzes only
      baseFilter = disciplineId
        ? and(
            eq(professorQuizzes.professorId, user.id),
            eq(professorQuizzes.disciplineId, String(disciplineId)),
          )
        : eq(professorQuizzes.professorId, user.id);
    }

    const rows = await db
      .select({
        id: professorQuizzes.id,
        title: professorQuizzes.title,
        language: professorQuizzes.language,
        topic: professorQuizzes.topic,
        description: professorQuizzes.description,
        disciplineId: professorQuizzes.disciplineId,
        disciplineName: disciplines.name,
        status: professorQuizzes.status,
        createdAt: professorQuizzes.createdAt,
        questionCount: count(professorQuizQuestions.id),
      })
      .from(professorQuizzes)
      .leftJoin(disciplines, eq(professorQuizzes.disciplineId, disciplines.id))
      .leftJoin(
        professorQuizQuestions,
        eq(professorQuizQuestions.quizId, professorQuizzes.id),
      )
      .where(baseFilter)
      .groupBy(professorQuizzes.id, disciplines.name)
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

    if (!title?.trim()) throw new AppError("quiz.titleRequired", 400);
    if (!disciplineId) throw new AppError("quiz.disciplineRequired", 400);
    if (!topic?.trim()) throw new AppError("quiz.topicRequired", 400);

    const language = req.body.language === undefined ? getLanguage() : normalizeLanguage(req.body.language);
    if (!language) throw new AppError("language.invalid", 400);
    const db = getDb();

    const [quiz] = await db
      .insert(professorQuizzes)
      .values({
        professorId: req.user!.id,
        language,
        disciplineId,
        title: title.trim(),
        topic: topic.trim(),
        description: description?.trim() ?? null,
      })
      .returning();

    return res.status(201).json(quiz);
  }),
);

// ── Generate quiz with AI ─────────────────────────────────────────────────────
professorQuizRouter.post(
  "/generate-ai",
  asyncHandler(async (req, res) => {
    const {
      disciplineId,
      theme,
      questionCount,
      documentIds,
      title,
      description,
    } = req.body as {
      disciplineId?: string;
      theme?: string;
      questionCount?: number;
      documentIds?: string[];
      title?: string;
      description?: string;
    };

    if (!disciplineId) throw new AppError("quiz.disciplineRequired", 400);
    if (!theme?.trim()) throw new AppError("quiz.themeFieldRequired", 400);
    if (!questionCount) throw new AppError("quiz.questionCountRequired", 400);
    if (!Array.isArray(documentIds) || !documentIds.length)
      throw new AppError("quiz.documentIdsRequired", 400);

    const language = req.body.language === undefined ? getLanguage() : normalizeLanguage(req.body.language);
    if (!language) throw new AppError("language.invalid", 400);
    const result = await generateAiQuiz({
      language,
      user: req.user!,
      disciplineId,
      theme: theme.trim(),
      questionCount: Number(questionCount),
      documentIds,
      title,
      description,
    });

    return res.status(201).json(result);
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

    if (!existing) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(existing, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

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

    if (!existing) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(existing, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

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
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(quiz, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

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
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(quiz, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

    const { question, options, correctOption, explanation, orderIndex } =
      req.body as {
        question?: string;
        options?: string[];
        correctOption?: string;
        explanation?: string;
        orderIndex?: number;
      };

    if (!question?.trim()) throw new AppError("quiz.questionRequired", 400);
    if (!Array.isArray(options) || options.length < 2)
      throw new AppError("quiz.minimumOptions", 400);
    if (!correctOption?.trim()) throw new AppError("quiz.correctOptionRequired", 400);

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

    if (!existing) throw new AppError("quiz.questionNotFound", 404);

    const [quiz] = await db
      .select({ professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz || !canManageQuiz(quiz, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

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
      .select({ professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(quiz, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

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

// ── Publish / unpublish ───────────────────────────────────────────────────────
professorQuizRouter.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [quiz] = await db
      .select()
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(quiz, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

    const [questionCount] = await db
      .select({ count: count(professorQuizQuestions.id) })
      .from(professorQuizQuestions)
      .where(eq(professorQuizQuestions.quizId, req.params.id));

    if (!questionCount?.count || Number(questionCount.count) === 0)
      throw new AppError("quiz.addQuestionsBeforePublish", 400);

    const [updated] = await db
      .update(professorQuizzes)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(professorQuizzes.id, req.params.id))
      .returning();

    await notifySafely("quiz_published", () => notifyQuizPublished(db, updated.id, getFrontendOrigin(req.get("origin"))));
    return res.json(updated);
  }),
);

professorQuizRouter.post(
  "/:id/unpublish",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [quiz] = await db
      .select()
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(quiz, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

    const [updated] = await db
      .update(professorQuizzes)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(professorQuizzes.id, req.params.id))
      .returning();

    return res.json(updated);
  }),
);

// ── Quiz results (professor view) ─────────────────────────────────────────────
professorQuizRouter.get(
  "/:id/results",
  asyncHandler(async (req, res) => {
    const db = getDb();
    const [quiz] = await db
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId, title: professorQuizzes.title, topic: professorQuizzes.topic })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);
    if (!canManageQuiz(quiz, req.user!)) throw new AppError("auth.accessDeniedCapital", 403);

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
