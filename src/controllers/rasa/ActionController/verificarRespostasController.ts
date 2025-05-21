import { Request, Response } from "express";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { AppError } from "../../../exceptions/AppError";

const mainSubjects = [
  "variaveis",
  "listas",
  "condicionais",
  "verificacoes",
  "tipos",
  "funcoes",
  "loops"
];

const typeSubjects = [
  "textos",
  "caracteres",
  "numeros",
  "operadores_matematicos",
  "operadores_logicos",
  "operadores_ternarios",
  "soma",
  "subtracao",
  "multiplicacao",
  "divisao_inteira",
  "divisao_resto",
  "divisao_normal"
];

export async function verificarRespostasController(req: Request, res: Response) {
  try {
    const { respostas } = req.body;

    if (!Array.isArray(respostas)) {
      return res.status(400).json({
        message: "As respostas são obrigatórias e devem estar em um array.",
      });
    }

    const userId = req.user.id;
    const email = req.user.email;
    const role = req.user.role;

    const session = getSession(userId);

    if (!session?.lastAnswerKeys?.length || !session?.lastQuestions?.length) {
      return res.status(400).json({
        message: "Sessão inválida: perguntas ou gabarito ausentes.",
      });
    }

    let ua = await UserAnalysis.findOne({ userId, email }).exec();
    if (!ua) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    if (!ua.sessions) {
      ua.sessions = [];
    }

    const needsNewSession = ua.sessions.length === 0 ||
        (ua.sessions[ua.sessions.length - 1].sessionEnd !== undefined);

    if (needsNewSession) {
      console.log("Criando nova sessão para o usuário", userId);
      ua.sessions.push({
        sessionStart: new Date(),
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0,
        answerHistory: []
      });

      await ua.save();

      ua = await UserAnalysis.findOne({ userId, email }).exec();
      if (!ua) {
        throw new AppError("Erro ao recarregar dados do usuário após criar sessão", 500);
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
        message: error.message,
      });
    }

    console.error("Erro no controller de verificação de respostas:", error);

    return res.status(500).json({
      message: error.message || "Erro ao verificar respostas",
    });
  }
}