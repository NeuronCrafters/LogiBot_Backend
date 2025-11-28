import { Request, Response } from "express";
import { RasaVerificationService } from "../../../services/rasa/ActionService/RasaVerificationService";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { AppError } from "../../../exceptions/AppError";
import { QuizResultData } from "../../../services/rasa/types/QuizResultData";

interface AnswerDetail {
  question: string;
  selectedOption: {
    question: string;
    isCorrect: string;
    isSelected: string;
  };
  correctOption: string;
  explanation: string;
}

export async function verificarRespostasController(req: Request, res: Response) {
  try {
    const { respostas, useRasaVerification = true } = req.body;
    if (!Array.isArray(respostas)) {
      return res.status(400).json({ message: "As respostas devem ser um array." });
    }

    const userId = req.user.id;
    const email = req.user.email;
    const role = req.user.role;
    const session = getSession(userId);
    if (!session?.lastAnswerKeys?.length || !session?.lastQuestions?.length) {
      return res.status(400).json({ message: "Sessão inválida: perguntas ou gabarito ausentes." });
    }

    let rawResult: QuizResultData & { source?: string };

    if (useRasaVerification) {
      try {
        const rasaService = new RasaVerificationService();
        if (await rasaService.testarConexaoRasa()) {
          rawResult = await rasaService.verificarRespostasComRasa(userId, respostas);
          const isStudent = Array.isArray(role) ? role.includes("student") : role === "student";
          if (isStudent) {
            await ensureUserAnalysisSession(userId, email);
            await salvarResultadoNoBanco(rawResult, respostas, userId, email);
          }
          return res.status(200).json(transformResult(rawResult));
        }
      } catch (rasaError: any) {

      }
    }

    rawResult = await verificarRespostasService(respostas, userId, email, session, role) as any;
    return res.status(200).json(transformResult(rawResult));

  } catch (error: any) {

    return res.status(500).json({ message: error.message });
  }
}

function transformResult(raw: QuizResultData) {
  let list: any[] = [];
  if (Array.isArray((raw as any).detalhes?.questions)) {
    list = (raw as any).detalhes.questions;
  } else if (Array.isArray((raw as any).detalhes)) {
    list = raw.detalhes as unknown as any[];
  }

  const fb1 = Array.isArray((raw as any).detailedFeedback)
    ? (raw as any).detailedFeedback
    : [];
  const fb2 = Array.isArray((raw as any).feedback)
    ? (raw as any).feedback
    : [];
  const feedbacks = fb1.length ? fb1 : fb2;

  const questions: AnswerDetail[] = list.map((d, i) => ({
    question: d.question,
    selectedOption: {
      question: d.question,
      isCorrect: String(d.selectedOption?.isCorrect ?? d.isCorrect ?? false),
      isSelected: d.selectedOption?.isSelected ?? d.selected ?? "",
    },
    correctOption: d.correctAnswer ?? d.correct ?? "",
    explanation: typeof d.explanation === "string"
      ? d.explanation
      : feedbacks[i] ?? "",
  }));

  return {
    totalCorrectAnswers: raw.totalCorrectAnswers,
    totalWrongAnswers: raw.totalWrongAnswers,
    detalhes: { questions },
  };
}

async function ensureUserAnalysisSession(userId: string, email: string): Promise<void> {
  const ua = await UserAnalysis.findOne({ userId, email }).exec();
  if (!ua) throw new AppError("Usuário não encontrado.", 404);
  if (!ua.sessions?.length || ua.sessions[ua.sessions.length - 1].sessionEnd) {
    ua.sessions = ua.sessions || [];
    ua.sessions.push({
      sessionStart: new Date(),
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      subjectCountsChat: { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 },
      answerHistory: [],
      lastActivityAt: undefined
    });
    await ua.save();
  }
}

async function salvarResultadoNoBanco(
  raw: any,
  respostas: string[],
  userId: string,
  email: string
): Promise<void> {
  const ua = await UserAnalysis.findOne({ userId, email }).exec();
  if (!ua) throw new AppError("Usuário não encontrado.", 404);
  const idx = ua.sessions.length - 1;

  const attempt = {
    questions: Array.isArray(raw.detalhes.questions)
      ? raw.detalhes.questions.map((d: any) => ({
        level: d.level,
        subject: d.subject,
        selectedOption: {
          question: d.question,
          isCorrect: d.selectedOption?.isCorrect ?? d.isCorrect,
          isSelected: d.selectedOption?.isSelected ?? d.selected,
        },
        totalCorrectAnswers: d.selectedOption?.isCorrect ?? d.isCorrect ? 1 : 0,
        totalWrongAnswers: d.selectedOption?.isCorrect ?? d.isCorrect ? 0 : 1,
        timestamp: new Date(d.timestamp),
      }))
      : [],
    totalCorrectWrongAnswersSession: {
      totalCorrectAnswers: raw.totalCorrectAnswers,
      totalWrongAnswers: raw.totalWrongAnswers,
    },
  };

  ua.sessions[idx].answerHistory = ua.sessions[idx].answerHistory || [];
  ua.sessions[idx].answerHistory.push(attempt);
  ua.sessions[idx].totalCorrectAnswers += raw.totalCorrectAnswers;
  ua.sessions[idx].totalWrongAnswers += raw.totalWrongAnswers;
  ua.totalCorrectWrongAnswers.totalCorrectAnswers += raw.totalCorrectAnswers;
  ua.totalCorrectWrongAnswers.totalWrongAnswers += raw.totalWrongAnswers;
  ua.markModified(`sessions.${idx}.answerHistory`);
  await ua.save();
}
