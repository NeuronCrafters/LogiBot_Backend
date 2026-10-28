import { Router } from "express";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { getDb } from "../../db/client";
import { saveStudentQuizResult } from "../../db/repositories/authRepository";
import {
  accounts,
  classDisciplines,
  disciplines,
  professorQuizAnswers,
  professorQuizAttempts,
  professorQuizQuestions,
  professorQuizzes,
  studentProfiles,
} from "../../db/schema";
import { checkAnswers } from "../../services/quiz/quizService";

export const quizRouter = Router();
quizRouter.use(requireAuth);

// ── Student hub: list available quizzes for the student's class ───────────────
quizRouter.get(
  "/student/hub",
  asyncHandler(async (req, res) => {
    if (!req.user!.role.includes("student"))
      throw new AppError("quiz.hubStudentsOnly", 403);

    const db = getDb();

    const [profile] = await db
      .select({ classId: studentProfiles.classId })
      .from(studentProfiles)
      .where(eq(studentProfiles.accountId, req.user!.id))
      .limit(1);

    if (!profile) throw new AppError("quiz.studentProfileNotFound", 404);

    const disciplineRows = await db
      .select({ disciplineId: classDisciplines.disciplineId })
      .from(classDisciplines)
      .where(eq(classDisciplines.classId, profile.classId));

    const disciplineIds = disciplineRows.map((r) => r.disciplineId);

    if (!disciplineIds.length) return res.json([]);

    const quizzes = await db
      .select({
        id: professorQuizzes.id,
        title: professorQuizzes.title,
        language: professorQuizzes.language,
        topic: professorQuizzes.topic,
        description: professorQuizzes.description,
        disciplineId: professorQuizzes.disciplineId,
        disciplineName: disciplines.name,
        createdAt: professorQuizzes.createdAt,
      })
      .from(professorQuizzes)
      .innerJoin(disciplines, eq(professorQuizzes.disciplineId, disciplines.id))
      .where(
        and(
          inArray(professorQuizzes.disciplineId, disciplineIds),
          eq(professorQuizzes.status, "published"),
        ),
      )
      .orderBy(desc(professorQuizzes.createdAt));

    if (!quizzes.length) return res.json([]);

    // Fetch question counts
    const questionCounts = await db
      .select({
        quizId: professorQuizQuestions.quizId,
      })
      .from(professorQuizQuestions)
      .where(
        inArray(
          professorQuizQuestions.quizId,
          quizzes.map((q) => q.id),
        ),
      );

    const countMap: Record<string, number> = {};
    for (const row of questionCounts) {
      countMap[row.quizId] = (countMap[row.quizId] ?? 0) + 1;
    }

    // Fetch student's best attempt per quiz
    const attempts = await db
      .select({
        quizId: professorQuizAttempts.quizId,
        score: professorQuizAttempts.score,
        totalQuestions: professorQuizAttempts.totalQuestions,
      })
      .from(professorQuizAttempts)
      .where(eq(professorQuizAttempts.studentId, req.user!.id))
      .orderBy(desc(professorQuizAttempts.score));

    const bestAttemptMap: Record<string, { score: number; totalQuestions: number }> = {};
    for (const a of attempts) {
      if (!bestAttemptMap[a.quizId] || a.score > bestAttemptMap[a.quizId].score) {
        bestAttemptMap[a.quizId] = { score: a.score, totalQuestions: a.totalQuestions };
      }
    }

    const result = quizzes.map((q) => ({
      ...q,
      questionCount: countMap[q.id] ?? 0,
      attempted: !!bestAttemptMap[q.id],
      bestScore: bestAttemptMap[q.id]?.score,
      bestTotalQuestions: bestAttemptMap[q.id]?.totalQuestions,
    }));

    return res.json(result);
  }),
);

// ── Get single quiz with questions (no answer keys) ───────────────────────────
quizRouter.get(
  "/student/:id",
  asyncHandler(async (req, res) => {
    if (!req.user!.role.includes("student"))
      throw new AppError("quiz.studentsOnly", 403);

    const db = getDb();

    const [quiz] = await db
      .select({
        id: professorQuizzes.id,
        title: professorQuizzes.title,
        language: professorQuizzes.language,
        topic: professorQuizzes.topic,
        description: professorQuizzes.description,
        disciplineId: professorQuizzes.disciplineId,
        disciplineName: disciplines.name,
      })
      .from(professorQuizzes)
      .innerJoin(disciplines, eq(professorQuizzes.disciplineId, disciplines.id))
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);

    const questions = await db
      .select({
        id: professorQuizQuestions.id,
        question: professorQuizQuestions.question,
        options: professorQuizQuestions.options,
        orderIndex: professorQuizQuestions.orderIndex,
      })
      .from(professorQuizQuestions)
      .where(eq(professorQuizQuestions.quizId, req.params.id))
      .orderBy(asc(professorQuizQuestions.orderIndex));

    return res.json({ ...quiz, questions });
  }),
);

// ── Submit quiz attempt ───────────────────────────────────────────────────────
quizRouter.post(
  "/student/:id/attempt",
  asyncHandler(async (req, res) => {
    if (!req.user!.role.includes("student"))
      throw new AppError("quiz.answersStudentsOnly", 403);

    const answers = req.body.answers as Record<string, string> | undefined;
    if (!answers || typeof answers !== "object" || Array.isArray(answers))
      throw new AppError("quiz.answersObjectRequired", 400);

    const db = getDb();

    const [quiz] = await db
      .select({
        id: professorQuizzes.id,
        title: professorQuizzes.title,
        language: professorQuizzes.language,
        topic: professorQuizzes.topic,
      })
      .from(professorQuizzes)
      .where(eq(professorQuizzes.id, req.params.id))
      .limit(1);

    if (!quiz) throw new AppError("quiz.notFound", 404);

    const questions = await db
      .select()
      .from(professorQuizQuestions)
      .where(eq(professorQuizQuestions.quizId, req.params.id))
      .orderBy(asc(professorQuizQuestions.orderIndex));

    if (!questions.length)
      throw new AppError("quiz.noPublishedQuestions", 400);

    const result = checkAnswers(questions, answers);

    // Save attempt
    const [attempt] = await db
      .insert(professorQuizAttempts)
      .values({
        quizId: quiz.id,
        studentId: req.user!.id,
        score: result.correct,
        totalQuestions: questions.length,
      })
      .returning();

    // Save per-question answers
    if (result.detalhes.length) {
      await db.insert(professorQuizAnswers).values(
        questions.map((q, i) => ({
          attemptId: attempt.id,
          questionId: q.id,
          selectedOption: result.detalhes[i].selected,
          isCorrect: result.detalhes[i].isCorrect,
        })),
      );
    }

    // Feed analytics pipeline so dashboard charts stay up-to-date
    await saveStudentQuizResult(db, {
      userId: req.user!.id,
      email: req.user!.email,
      subject: quiz.topic,
      level: "",
      totalCorrectAnswers: result.correct,
      totalWrongAnswers: result.wrong,
      detalhes: result.detalhes.map((d) => ({
        question: d.question,
        selected: d.selected,
        isCorrect: d.isCorrect,
        explanation: d.explanation,
      })),
    });

    return res.json({
      attemptId: attempt.id,
      score: result.correct,
      totalQuestions: questions.length,
      detalhes: result.detalhes,
    });
  }),
);

// ── Quiz history for a user ───────────────────────────────────────────────────
quizRouter.get(
  "/history/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (
      userId !== req.user!.id &&
      !req.user!.role.includes("admin") &&
      !req.user!.role.includes("professor") &&
      !req.user!.role.includes("course-coordinator")
    ) {
      throw new AppError("auth.accessDeniedCapital", 403);
    }

    const db = getDb();

    const rows = await db
      .select({
        attemptId: professorQuizAttempts.id,
        quizId: professorQuizAttempts.quizId,
        quizTitle: professorQuizzes.title,
        language: professorQuizzes.language,
        topic: professorQuizzes.topic,
        disciplineName: disciplines.name,
        score: professorQuizAttempts.score,
        totalQuestions: professorQuizAttempts.totalQuestions,
        completedAt: professorQuizAttempts.completedAt,
      })
      .from(professorQuizAttempts)
      .innerJoin(professorQuizzes, eq(professorQuizAttempts.quizId, professorQuizzes.id))
      .innerJoin(disciplines, eq(professorQuizzes.disciplineId, disciplines.id))
      .where(eq(professorQuizAttempts.studentId, userId))
      .orderBy(desc(professorQuizAttempts.completedAt));

    return res.json(
      rows.map((r) => ({
        quizId: r.quizId,
        attemptId: r.attemptId,
        title: r.quizTitle,
        topic: r.topic,
        disciplineName: r.disciplineName,
        score: r.score,
        totalQuestions: r.totalQuestions,
        completedAt: r.completedAt,
      })),
    );
  }),
);
