import { Request, Response } from "express";
import { verificarRespostasService } from "services/rasa/ActionService/verificarRespostasService";
import { getSession } from "services/rasa/types/sessionMemory";
import { UserAnalysis } from "@/models/UserAnalysis";
import { AppError } from "exceptions/AppError";

export async function verificarRespostasController(req: Request, res: Response) {
  try {
    const { respostas } = req.body;
    if (!Array.isArray(respostas)) {
      return res.status(400).json({
        message: "As respostas são obrigatórias e devem estar em um array.",
      });
    }

    const userId = req.user.id;
    const email  = req.user.email;
    const role   = req.user.role;

    const session = getSession(userId);
    if (!session?.lastAnswerKeys?.length || !session?.lastQuestions?.length) {
      return res.status(400).json({
        message: "Sessão inválida: perguntas ou gabarito ausentes.",
      });
    }

    // 🔹 Garante que exista uma sessão ativa no UserAnalysis
    const ua = await UserAnalysis.findOne({ userId, email });
    if (ua) {
      const ua = await UserAnalysis.findOne({ userId, email });
      if (ua) {
        const ultimaSessao = ua.sessions.at(-1);
        if (!ultimaSessao || ultimaSessao.sessionEnd) {
          ua.sessions.push({
            sessionStart: new Date(),
            totalCorrectAnswers: 0,
            totalWrongAnswers: 0,
            sessionDuration: 0,
            frequency: new Map(),
            quizHistory: [],
          });
          await ua.save();
        }
      }
    }


    const result = await verificarRespostasService(
        respostas,
        userId,
        email,
        session,
        role
    );

    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        message: error.message
      });
    }
    console.error("Erro no controller de verificação de respostas:", error);
    return res.status(500).json({
      message: error.message || "Erro ao verificar respostas"
    });
  }
}
