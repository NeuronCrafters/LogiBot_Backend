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
  professorQuizDisciplines,
  professorQuizQuestions,
  professorQuizzes,
} from "../../db/schema";
import { generateAiQuiz } from "../../services/quiz/quizAiGenerationService";
import {
  linkQuizToDisciplines,
  listLinkedDisciplines,
  unlinkQuizFromDiscipline,
} from "../../services/quiz/quizDisciplineService";
import {
  assertProfessorCanManageDiscipline,
  canManageQuiz,
} from "../../services/quiz/quizPermissionService";

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

    // Um quiz pode estar vinculado a varias disciplinas agora, entao a
    // restricao por disciplina (coordenador, ou ?disciplineId= explicito) e
    // resolvida primeiro contra professor_quiz_disciplines, virando uma
    // lista de quiz ids — evita duplicar linhas no join principal abaixo
    // (que continua exibindo so a disciplina "dona" pra cada quiz).
    let allowedQuizIds: string[] | null = null;

    if (isCoordinator) {
      const coordDisciplines = user.disciplines ?? [];
      const targetDisciplines = disciplineId
        ? [String(disciplineId)].filter((d) => coordDisciplines.includes(d))
        : coordDisciplines;
      if (!targetDisciplines.length) return res.json([]);

      const linkRows = await db
        .select({ quizId: professorQuizDisciplines.quizId })
        .from(professorQuizDisciplines)
        .where(inArray(professorQuizDisciplines.disciplineId, targetDisciplines));
      allowedQuizIds = [...new Set(linkRows.map((row) => row.quizId))];
      if (!allowedQuizIds.length) return res.json([]);
    } else if (disciplineId) {
      const linkRows = await db
        .select({ quizId: professorQuizDisciplines.quizId })
        .from(professorQuizDisciplines)
        .where(eq(professorQuizDisciplines.disciplineId, String(disciplineId)));
      allowedQuizIds = [...new Set(linkRows.map((row) => row.quizId))];
      if (!allowedQuizIds.length) return res.json([]);
    }

    const conditions = [];
    if (!isAdmin && !isCoordinator) {
      conditions.push(eq(professorQuizzes.professorId, user.id));
    }
    if (allowedQuizIds) {
      conditions.push(inArray(professorQuizzes.id, allowedQuizIds));
    }
    const baseFilter = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: professorQuizzes.id,
        title: professorQuizzes.title,
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

    // Um quiz pode estar vinculado a varias disciplinas — busca todas de
    // uma vez (nao só a "dona" acima) pra exibir na lista.
    const quizIds = rows.map((row) => row.id);
    const disciplineLinks = quizIds.length
      ? await db
          .select({
            quizId: professorQuizDisciplines.quizId,
            disciplineId: disciplines.id,
            disciplineName: disciplines.name,
          })
          .from(professorQuizDisciplines)
          .innerJoin(
            disciplines,
            eq(disciplines.id, professorQuizDisciplines.disciplineId),
          )
          .where(inArray(professorQuizDisciplines.quizId, quizIds))
      : [];

    const disciplinesByQuiz = new Map<
      string,
      { id: string; name: string }[]
    >();
    for (const link of disciplineLinks) {
      const list = disciplinesByQuiz.get(link.quizId) ?? [];
      list.push({ id: link.disciplineId, name: link.disciplineName });
      disciplinesByQuiz.set(link.quizId, list);
    }

    const result = rows.map((row) => ({
      ...row,
      disciplines: disciplinesByQuiz.get(row.id) ?? [
        { id: row.disciplineId, name: row.disciplineName },
      ],
    }));

    return res.json(result);
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

    await assertProfessorCanManageDiscipline(req.user!, disciplineId);

    const db = getDb();

    const quiz = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(professorQuizzes)
        .values({
          professorId: req.user!.id,
          disciplineId,
          title: title.trim(),
          topic: topic.trim(),
          description: description?.trim() ?? null,
        })
        .returning();

      await tx
        .insert(professorQuizDisciplines)
        .values({ quizId: created.id, disciplineId });

      return created;
    });

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

    if (!disciplineId) throw new AppError("disciplineId é obrigatório", 400);
    if (!theme?.trim()) throw new AppError("theme é obrigatório", 400);
    if (!questionCount) throw new AppError("questionCount é obrigatório", 400);
    if (!Array.isArray(documentIds) || !documentIds.length)
      throw new AppError("documentIds deve ser uma lista não vazia", 400);

    const result = await generateAiQuiz({
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

    if (!existing) throw new AppError("Quiz não encontrado", 404);
    if (!(await canManageQuiz(existing, req.user!)))
      throw new AppError("Acesso negado", 403);

    const { title, topic, description } = req.body as {
      title?: string;
      topic?: string;
      description?: string;
    };

    const [updated] = await db
      .update(professorQuizzes)
      .set({
        title: title?.trim() ?? existing.title,
        topic: topic?.trim() ?? existing.topic,
        description: description !== undefined ? (description?.trim() ?? null) : existing.description,
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
    if (!(await canManageQuiz(existing, req.user!)))
      throw new AppError("Acesso negado", 403);

    await db.delete(professorQuizzes).where(eq(professorQuizzes.id, req.params.id));

    return res.json({ success: true });
  }),
);

// ── Disciplinas vinculadas ao quiz (compartilhar sem duplicar) ─────────────────
professorQuizRouter.get(
  "/:id/disciplines",
  asyncHandler(async (req, res) => {
    return res.json({
      disciplineIds: await listLinkedDisciplines(req.user!, req.params.id),
    });
  }),
);

professorQuizRouter.post(
  "/:id/disciplines",
  asyncHandler(async (req, res) => {
    const disciplineIds = Array.isArray(req.body.disciplineIds)
      ? req.body.disciplineIds
      : [];
    return res.status(201).json(
      await linkQuizToDisciplines(req.user!, req.params.id, disciplineIds),
    );
  }),
);

professorQuizRouter.delete(
  "/:id/disciplines/:disciplineId",
  asyncHandler(async (req, res) => {
    return res.json(
      await unlinkQuizFromDiscipline(
        req.user!,
        req.params.id,
        req.params.disciplineId,
      ),
    );
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

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (!(await canManageQuiz(quiz, req.user!)))
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
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (!(await canManageQuiz(quiz, req.user!)))
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
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz || !(await canManageQuiz(quiz, req.user!)))
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
      .select({ id: professorQuizzes.id, professorId: professorQuizzes.professorId, disciplineId: professorQuizzes.disciplineId })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (!(await canManageQuiz(quiz, req.user!)))
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

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (!(await canManageQuiz(quiz, req.user!)))
      throw new AppError("Acesso negado", 403);

    const [questionCount] = await db
      .select({ count: count(professorQuizQuestions.id) })
      .from(professorQuizQuestions)
      .where(eq(professorQuizQuestions.quizId, req.params.id));

    if (!questionCount?.count || Number(questionCount.count) === 0)
      throw new AppError("Adicione ao menos uma pergunta antes de publicar", 400);

    const [updated] = await db
      .update(professorQuizzes)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(professorQuizzes.id, req.params.id))
      .returning();

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

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (!(await canManageQuiz(quiz, req.user!)))
      throw new AppError("Acesso negado", 403);

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

    if (!quiz) throw new AppError("Quiz não encontrado", 404);
    if (!(await canManageQuiz(quiz, req.user!)))
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
