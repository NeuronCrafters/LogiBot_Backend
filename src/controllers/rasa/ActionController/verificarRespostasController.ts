import { Request, Response } from "express";
import { RasaVerificationService } from "../../../services/rasa/ActionService/RasaVerificationService";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { AppError } from "../../../exceptions/AppError";
import { QuizResultData } from "../../../services/rasa/types/QuizResultData";

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

    if (useRasaVerification) {
      try {
        const rasaService = new RasaVerificationService();
        const rasaDisponivel = await rasaService.testarConexaoRasa();

        if (rasaDisponivel) {
          const resultadoRasa = await rasaService.verificarRespostasComRasa(userId, respostas);

          const isStudent = Array.isArray(role) ? role.includes("student") : role === "student";
          if (isStudent) {
            await ensureUserAnalysisSession(userId, email);
            await salvarResultadoNoBanco(resultadoRasa, respostas, userId, email);
          }

          return res.status(200).json({ ...resultadoRasa, source: "rasa_humanized" });
        }
      } catch (rasaError: any) {
        console.error("Erro no Rasa, fallback:", rasaError.message);
      }
    }

    await ensureUserAnalysisSession(userId, email);
    const result = await verificarRespostasService(respostas, userId, email, session, role);
    return res.status(200).json({ ...result, source: "traditional" });

  } catch (error: any) {
    console.error("Erro:", error);
    return res.status(500).json({ message: error.message });
  }
}

async function ensureUserAnalysisSession(userId: string, email: string): Promise<void> {
  let ua = await UserAnalysis.findOne({ userId, email }).exec();

  if (!ua) throw new AppError("Usuário não encontrado.", 404);

  if (!ua.sessions || ua.sessions.length === 0 || ua.sessions[ua.sessions.length - 1].sessionEnd) {
    ua.sessions = ua.sessions || [];
    ua.sessions.push({
      sessionStart: new Date(),
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      subjectCountsChat: { variaveis: 0, tipos: 0, funcoes: 0, loops: 0, verificacoes: 0 },
      answerHistory: []
    });
    await ua.save();
  }
}

async function salvarResultadoNoBanco(
  resultadoRasa: QuizResultData,
  respostas: string[],
  userId: string,
  email: string
): Promise<void> {
  const ua = await UserAnalysis.findOne({ userId, email }).exec();
  if (!ua) throw new AppError("Usuário não encontrado.", 404);
  const lastSessionIndex = ua.sessions.length - 1;

  const newAttempt = {
    questions: resultadoRasa.detalhes.questions.map(question => ({
      level: question.level,
      subject: question.subject,
      selectedOption: {
        question: question.selectedOption.question,
        isCorrect: question.selectedOption.isCorrect,
        isSelected: question.selectedOption.isSelected,
      },
      correctAnswer: question.correctAnswer,
      totalCorrectAnswers: question.totalCorrectAnswers,
      totalWrongAnswers: question.totalWrongAnswers,
      timestamp: new Date(question.timestamp),
    })),
    totalCorrectWrongAnswersSession: {
      totalCorrectAnswers: resultadoRasa.totalCorrectAnswers,
      totalWrongAnswers: resultadoRasa.totalWrongAnswers
    }
  };

  ua.sessions[lastSessionIndex].answerHistory = ua.sessions[lastSessionIndex].answerHistory || [];
  ua.sessions[lastSessionIndex].answerHistory.push(newAttempt);
  ua.sessions[lastSessionIndex].totalCorrectAnswers += resultadoRasa.totalCorrectAnswers;
  ua.sessions[lastSessionIndex].totalWrongAnswers += resultadoRasa.totalWrongAnswers;
  ua.totalCorrectWrongAnswers.totalCorrectAnswers += resultadoRasa.totalCorrectAnswers;
  ua.totalCorrectWrongAnswers.totalWrongAnswers += resultadoRasa.totalWrongAnswers;

  ua.markModified(`sessions.${lastSessionIndex}.answerHistory`);
  ua.markModified(`subjectCountsQuiz`);
  await ua.save();
}
