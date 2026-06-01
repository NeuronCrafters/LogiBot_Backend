import { Hono } from "hono";
import { saveStudentQuizResult } from "../../db/repositories/authRepository";
import { getDb } from "../db/client";
import { HttpError } from "../errors";
import { requireAuth } from "../http/auth";
import { getRuntimeSession } from "../services/sessionMemory";
import { generateQuiz, getCategories, getLevels, getSubcategories, verifyQuizAnswers, type ResultDetail } from "../services/quiz";
import type { AppBindings } from "../types";

export const quizRoutes = new Hono<AppBindings>();

quizRoutes.use("/quiz/*", requireAuth);

quizRoutes.get("/quiz/levels", (c) => c.json({ buttons: getLevels() }));

quizRoutes.post("/quiz/set-level", async (c) => {
  const { nivel } = await c.req.json<{ nivel?: string }>();
  const user = c.get("user");
  if (!user?.id || !nivel) {
    throw new HttpError("UserId e nivel sao obrigatorios.", 400);
  }

  const session = getRuntimeSession(user.id);
  session.nivelAtual = nivel;

  return c.json({
    message: `Nivel definido como ${nivel}.`,
    categories: getCategories(),
  });
});

quizRoutes.post("/quiz/subcategories", async (c) => {
  const { category } = await c.req.json<{ category?: string }>();
  if (!category) {
    throw new HttpError("O campo 'category' e obrigatorio.", 400);
  }

  return c.json({ buttons: getSubcategories(category) });
});

quizRoutes.post("/quiz/generate", async (c) => {
  const { subtopic } = await c.req.json<{ subtopic?: string }>();
  const user = c.get("user");
  if (!user?.id || !subtopic) {
    throw new HttpError("UserId e subtopic sao obrigatorios.", 400);
  }

  const session = getRuntimeSession(user.id);
  if (!session.nivelAtual) {
    throw new HttpError("O nivel do usuario precisa ser definido.", 400);
  }

  const quiz = generateQuiz(subtopic, session.nivelAtual);
  session.lastSubject = subtopic;
  session.lastFullQuestions = quiz.questions;
  session.lastAnswerKeys = quiz.answer_keys;

  const questionsForStudent = quiz.questions.map(({ question, options }) => ({ question, options }));
  return c.json({
    success: true,
    assunto: quiz.subject,
    nivel: quiz.level,
    questions: questionsForStudent,
  });
});

quizRoutes.post("/quiz/verify", async (c) => {
  const { answers } = await c.req.json<{ answers?: string[] }>();
  const user = c.get("user");
  if (!user?.id || !Array.isArray(answers)) {
    throw new HttpError("UserId e um array de 'answers' sao obrigatorios.", 400);
  }

  const session = getRuntimeSession(user.id);
  if (!session.lastAnswerKeys.length || !session.lastFullQuestions.length) {
    throw new HttpError("Nenhum quiz ativo para verificar. Por favor, inicie um novo.", 400);
  }

  const result = verifyQuizAnswers(answers, session.lastAnswerKeys, session.lastFullQuestions);
  if (user.role.includes("student")) {
    await saveQuizResult(c.env, user.id, user.email, result, session.lastSubject, session.nivelAtual);
  }

  session.lastSubject = null;
  session.lastFullQuestions = [];
  session.lastAnswerKeys = [];

  return c.json({ success: true, ...result });
});

async function saveQuizResult(
  env: AppBindings["Bindings"],
  userId: string,
  email: string,
  result: { detalhes: ResultDetail[]; totalCorrectAnswers: number; totalWrongAnswers: number },
  subject: string | null,
  level: string | null,
) {
  const db = getDb(env);
  const saved = await saveStudentQuizResult(db, {
    userId,
    email,
    subject: subject || "Assunto nao definido",
    level: level || "Nivel nao definido",
    totalCorrectAnswers: result.totalCorrectAnswers,
    totalWrongAnswers: result.totalWrongAnswers,
    detalhes: result.detalhes,
  });

  if (!saved) {
    throw new HttpError("analise de usuario nao encontrada.", 404);
  }
}
