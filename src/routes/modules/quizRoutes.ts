import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { getDb } from "../../db/client";
import { saveStudentQuizResult } from "../../db/repositories/authRepository";
import { analysisSessions, answerAttempts, answerQuestions, userAnalyses } from "../../db/schema";
import {
  generateQuiz,
  getCategories,
  getLevels,
  getRuntimeSession,
  getSubcategories,
  verifyQuizAnswers,
} from "../routeHelpers";

export const quizRouter = Router();

quizRouter.use(requireAuth);

quizRouter.get("/levels", (_req, res) => res.json({ buttons: getLevels() }));

quizRouter.post("/level", (req, res, next) => {
  try {
    const level = String(req.body.level || req.body.nivel || "");
    if (!level) throw new AppError("level e obrigatorio", 400);
    getRuntimeSession(req.user!.id).nivelAtual = level;
    return res.json({ responses: [{ text: `Nivel definido: ${level}` }], level, nivel: level });
  } catch (error) {
    return next(error);
  }
});

quizRouter.get("/categories", (_req, res) => res.json({ buttons: getCategories() }));

quizRouter.post("/subcategories", (req, res, next) => {
  try {
    const category = String(req.body.category || req.body.categoria || "");
    return res.json({ buttons: getSubcategories(category) });
  } catch (error) {
    return next(error);
  }
});

quizRouter.post("/questions", (req, res, next) => {
  try {
    const subtopic = String(req.body.subtopic || req.body.pergunta || "");
    const session = getRuntimeSession(req.user!.id);
    if (!session.nivelAtual) throw new AppError("defina um nivel antes de gerar perguntas", 400);
    const quiz = generateQuiz(subtopic, session.nivelAtual);
    session.lastSubject = subtopic;
    session.lastFullQuestions = quiz.questions;
    session.lastQuestions = quiz.questions.map((question) => question.question);
    session.lastAnswerKeys = quiz.answer_keys;
    return res.json({ perguntas: quiz.questions, gabarito: quiz.answer_keys, nivel: session.nivelAtual, assunto: subtopic });
  } catch (error) {
    return next(error);
  }
});

quizRouter.get("/answer-key", (req, res) => {
  const session = getRuntimeSession(req.user!.id);
  return res.json({ answer_keys: session.lastAnswerKeys, gabarito: session.lastAnswerKeys, assunto: session.lastSubject });
});

quizRouter.get("/history/:userId", asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId !== req.user!.id && !req.user!.role.includes("admin") && !req.user!.role.includes("professor") && !req.user!.role.includes("course-coordinator")) {
    throw new AppError("acesso negado", 403);
  }

  const rows = await getDb()
    .select({
      attemptId: answerAttempts.id,
      score: answerAttempts.totalCorrectAnswers,
      wrong: answerAttempts.totalWrongAnswers,
      completedAt: answerAttempts.createdAt,
      subject: answerQuestions.subject,
      level: answerQuestions.level,
    })
    .from(answerAttempts)
    .innerJoin(analysisSessions, eq(answerAttempts.sessionId, analysisSessions.id))
    .innerJoin(userAnalyses, eq(analysisSessions.analysisId, userAnalyses.id))
    .leftJoin(answerQuestions, eq(answerQuestions.attemptId, answerAttempts.id))
    .where(eq(userAnalyses.userId, userId))
    .orderBy(desc(answerAttempts.createdAt));

  const attempts = new Map<string, {
    quizId: string;
    title: string;
    score: number;
    totalQuestions: number;
    completedAt: Date;
  }>();

  for (const row of rows) {
    if (attempts.has(row.attemptId)) continue;
    attempts.set(row.attemptId, {
      quizId: row.attemptId,
      title: row.subject ? `Quiz ${row.subject}` : "Quiz Pratico",
      score: row.score,
      totalQuestions: row.score + row.wrong,
      completedAt: row.completedAt,
    });
  }

  return res.json(Array.from(attempts.values()));
}));

quizRouter.post("/answers", asyncHandler(async (req, res) => {
  const answers = (req.body.answers || req.body.respostas) as string[];
  if (!Array.isArray(answers)) throw new AppError("answers deve ser uma lista", 400);
  const session = getRuntimeSession(req.user!.id);
  if (!session.lastAnswerKeys.length || !session.lastFullQuestions.length) throw new AppError("Nenhum quiz ativo para verificar. Por favor, inicie um novo.", 400);
  const result = verifyQuizAnswers(answers, session.lastAnswerKeys, session.lastFullQuestions);
  if (req.user!.role.includes("student")) {
    await saveStudentQuizResult(getDb(), {
      userId: req.user!.id,
      email: req.user!.email,
      subject: session.lastSubject || "",
      level: session.nivelAtual || "",
      totalCorrectAnswers: result.totalCorrectAnswers,
      totalWrongAnswers: result.totalWrongAnswers,
      detalhes: result.detalhes,
    });
  }
  session.lastAnswerKeys = [];
  session.lastQuestions = [];
  session.lastFullQuestions = [];
  return res.json({ ...result, subject: session.lastSubject || "", nivel: session.nivelAtual || "", source: "local" });
}));
