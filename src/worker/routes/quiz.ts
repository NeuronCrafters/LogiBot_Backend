import { Hono } from "hono";
import { ObjectId } from "mongodb";
import { collections } from "../db/collections";
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
  const db = await getDb(env);
  const col = collections(db);
  const userAnalysis = await col.userAnalyses.findOne({ userId, email });
  if (!userAnalysis?._id) {
    throw new HttpError("analise de usuario nao encontrada.", 404);
  }

  const sessions = userAnalysis.sessions || [];
  const currentSession = sessions.at(-1) || {};
  currentSession.totalCorrectAnswers = Number(currentSession.totalCorrectAnswers || 0) + result.totalCorrectAnswers;
  currentSession.totalWrongAnswers = Number(currentSession.totalWrongAnswers || 0) + result.totalWrongAnswers;

  const attempt = {
    questions: result.detalhes.map((detail) => ({
      level: level || "Nivel nao definido",
      subject: subject || "Assunto nao definido",
      selectedOption: {
        question: detail.question,
        isCorrect: detail.isCorrect,
        isSelected: detail.selected,
      },
      totalCorrectAnswers: detail.isCorrect ? 1 : 0,
      totalWrongAnswers: detail.isCorrect ? 0 : 1,
      timestamp: new Date(),
    })),
    totalCorrectWrongAnswersSession: {
      totalCorrectAnswers: result.totalCorrectAnswers,
      totalWrongAnswers: result.totalWrongAnswers,
    },
  };

  const answerHistory = Array.isArray(currentSession.answerHistory) ? currentSession.answerHistory : [];
  answerHistory.push(attempt);
  currentSession.answerHistory = answerHistory;

  if (!sessions.length) sessions.push(currentSession);

  await col.userAnalyses.updateOne(
    { _id: new ObjectId(String(userAnalysis._id)) },
    {
      $set: { sessions },
      $inc: {
        "totalCorrectWrongAnswers.totalCorrectAnswers": result.totalCorrectAnswers,
        "totalCorrectWrongAnswers.totalWrongAnswers": result.totalWrongAnswers,
      },
    },
  );
}
