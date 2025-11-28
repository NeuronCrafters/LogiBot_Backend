import { Request, Response } from 'express';
import { getSession } from '../../../services/rasa/types/sessionMemory';
import { UserAnalysis, IUserAnalysis } from '../../../models/UserAnalysis';
import { AppError } from '../../../exceptions/AppError';
import {
  getLevelsService,
  getCategoriesService,
  getSubcategoriesService,
  generateQuizService,
  verifyQuizAnswersService
} from '../../../services/bot/quiz/quizService';
import { ResultDetail } from '../../../services/bot/quiz/quiz.types';

export async function listLevelsController(req: Request, res: Response) {
  try {
    const levels = getLevelsService();
    res.status(200).json({ buttons: levels });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function setLevelController(req: Request, res: Response) {
  try {
    const { nivel } = req.body;
    const userId = req.user?.id;
    if (!userId || !nivel) {
      return res.status(400).json({ message: "UserId e nível são obrigatórios." });
    }
    const session = getSession(userId);
    session.nivelAtual = nivel;
    const categories = getCategoriesService();
    res.status(200).json({
      message: `Nível definido como ${nivel}.`,
      categories: categories
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function listSubcategoriesController(req: Request, res: Response) {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ message: "O campo 'category' é obrigatório." });
    }
    const subcategories = getSubcategoriesService(category);
    res.status(200).json({ buttons: subcategories });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
}

export async function generateQuizController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { subtopic } = req.body;
    if (!userId || !subtopic) {
      return res.status(400).json({ message: "UserId e subtopic são obrigatórios." });
    }
    const session = getSession(userId);
    const level = session.nivelAtual;
    if (!level) {
      return res.status(400).json({ message: "O nível do usuário precisa ser definido." });
    }
    const quiz = generateQuizService(subtopic, level);
    session.lastSubject = subtopic;
    session.lastFullQuestions = quiz.questions;
    session.lastAnswerKeys = quiz.answer_keys;
    const questionsForStudent = quiz.questions.map(({ question, options }) => ({ question, options }));
    return res.status(200).json({
      success: true,
      assunto: quiz.subject,
      nivel: quiz.level,
      questions: questionsForStudent,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

export async function verifyQuizController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { answers } = req.body;
    if (!userId || !Array.isArray(answers)) {
      return res.status(400).json({ message: "UserId e um array de 'answers' são obrigatórios." });
    }
    const session = getSession(userId);
    if (!session.lastAnswerKeys || !session.lastFullQuestions) {
      return res.status(400).json({ message: "Nenhum quiz ativo para verificar. Por favor, inicie um novo." });
    }
    const result = verifyQuizAnswersService(answers, session.lastAnswerKeys, session.lastFullQuestions);
    const isStudent = Array.isArray(req.user.role) ? req.user.role.includes("student") : req.user.role === "student";
    if (isStudent) {
      await saveResultToDB(userId, req.user.email, result, session.lastSubject, session.nivelAtual);
    }
    session.lastSubject = null;
    session.lastFullQuestions = [];
    session.lastAnswerKeys = [];
    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

async function saveResultToDB(
  userId: string,
  email: string,
  result: { detalhes: ResultDetail[], totalCorrectAnswers: number, totalWrongAnswers: number },
  subject: string | null,
  level: string | null
) {
  console.log(`[saveResultToDB] 💾 Iniciando salvamento do quiz para: ${email}`);
  const userAnalysis = await UserAnalysis.findOne({ userId, email }).exec();

  if (!userAnalysis) {
    console.error(`[saveResultToDB]  ERRO: Análise de usuário não encontrada para ${email}`);
    throw new AppError("Análise de usuário não encontrada.", 404);
  }

  for (const detail of result.detalhes) {
    userAnalysis.addAnswerHistory(
      level || "Nível não definido",
      detail.question,
      subject || "Assunto não definido",
      detail.selected,
      detail.isCorrect
    );
  }

  const currentSession = userAnalysis.sessions.at(-1);
  if (currentSession) {
    currentSession.totalCorrectAnswers = (currentSession.totalCorrectAnswers || 0) + result.totalCorrectAnswers;
    currentSession.totalWrongAnswers = (currentSession.totalWrongAnswers || 0) + result.totalWrongAnswers;
  }

  userAnalysis.totalCorrectWrongAnswers.totalCorrectAnswers += result.totalCorrectAnswers;
  userAnalysis.totalCorrectWrongAnswers.totalWrongAnswers += result.totalWrongAnswers;

  if (subject) {
    userAnalysis.updateSubjectCountsQuiz(subject);
  }

  try {
    await userAnalysis.save();
    console.log(`[saveResultToDB] Resultado do quiz salvo com sucesso no DB para ${email}!`);
  } catch (error) {
    console.error(`[saveResultToDB] ERRO CRÍTICO ao salvar no banco de dados:`, error);
    throw new AppError("Falha ao salvar o resultado do quiz.", 500);
  }
}