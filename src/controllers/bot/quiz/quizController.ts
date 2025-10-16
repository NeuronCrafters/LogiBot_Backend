// src/controllers/bot/quiz/quizController.ts

import { Request, Response } from 'express';
import { getSession } from '../../../services/rasa/types/sessionMemory';
import { UserAnalysis } from '../../../models/UserAnalysis';
import { AppError } from '../../../exceptions/AppError';
import {
  getLevelsService,
  getCategoriesService,
  getSubcategoriesService,
  generateQuizService,
  verifyQuizAnswersService
} from '../../../services/bot/quiz/quizService';

// --- Controllers de Menu (Fluxo Otimizado) ---

export async function listLevelsController(req: Request, res: Response) {
  try {
    const levels = getLevelsService();
    // Endpoint para a tela inicial de escolha de nível.
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

    // Conforme solicitado, já retorna o próximo passo (lista de categorias).
    const categories = getCategoriesService();

    res.status(200).json({
      message: `Nível definido como ${nivel}.`,
      categories: categories // Retorna a lista de categorias para o frontend.
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
    // Conforme solicitado, retorna as subcategorias para a escolha final.
    const subcategories = getSubcategoriesService(category);
    res.status(200).json({ buttons: subcategories });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
}

// --- Controllers de Lógica do Quiz ---

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
      return res.status(400).json({ message: "O nível do usuário precisa ser definido antes de gerar um quiz." });
    }

    const quiz = generateQuizService(subtopic, level);

    // Armazena informações na sessão para a verificação
    session.lastSubject = subtopic;
    session.lastFullQuestions = quiz.questions;
    session.lastAnswerKeys = quiz.answer_keys;

    // Remove informações sensíveis (gabarito, explicações) antes de enviar ao frontend
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

    // Salva o resultado no banco de dados para o histórico do aluno
    const isStudent = Array.isArray(req.user.role) ? req.user.role.includes("student") : req.user.role === "student";
    if (isStudent) {
      await saveResultToDB(userId, req.user.email, result, session.lastSubject, session.nivelAtual);
    }

    // Limpa a sessão para evitar reenvio do mesmo quiz
    session.lastSubject = null;
    session.lastFullQuestions = [];
    session.lastAnswerKeys = [];

    return res.status(200).json({ success: true, ...result });

  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
}

// --- Função Auxiliar ---

async function saveResultToDB(userId: string, email: string, result: any, subject: string | null, level: string | null) {
  const ua = await UserAnalysis.findOne({ userId, email }).exec();
  if (!ua) throw new AppError("Análise de usuário não encontrada.", 404);

  if (!ua.sessions.length || ua.sessions[ua.sessions.length - 1].sessionEnd) {
    ua.sessions.push({ sessionStart: new Date(), answerHistory: [] } as any);
  }
  const si = ua.sessions.length - 1;

  ua.sessions[si].answerHistory.push({
    questions: result.detalhes.map((d: any) => ({
      ...d,
      subject: subject || 'desconhecido',
      level: level || 'desconhecido',
      timestamp: new Date(),
    })),
    totalCorrectWrongAnswersSession: {
      totalCorrectAnswers: result.totalCorrectAnswers,
      totalWrongAnswers: result.totalWrongAnswers,
    },
  });

  ua.sessions[si].totalCorrectAnswers = (ua.sessions[si].totalCorrectAnswers || 0) + result.totalCorrectAnswers;
  ua.sessions[si].totalWrongAnswers = (ua.sessions[si].totalWrongAnswers || 0) + result.totalWrongAnswers;
  ua.totalCorrectWrongAnswers.totalCorrectAnswers += result.totalCorrectAnswers;
  ua.totalCorrectWrongAnswers.totalWrongAnswers += result.totalWrongAnswers;

  ua.markModified(`sessions`);
  await ua.save();
}