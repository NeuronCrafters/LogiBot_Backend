import { Request, Response } from "express";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { AppError } from "../../../exceptions/AppError";

// Lista de todos os assuntos principais disponíveis
const mainSubjects = [
  "variaveis",
  "listas",
  "condicionais",
  "verificacoes",
  "tipos",
  "funcoes",
  "loops"
];

// Assuntos que são subcategorias de "tipos"
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

    // Verifica se as respostas são um array
    if (!Array.isArray(respostas)) {
      return res.status(400).json({
        message: "As respostas são obrigatórias e devem estar em um array.",
      });
    }

    const userId = req.user.id;
    const email = req.user.email;
    const role = req.user.role;

    // Obtém a sessão atual do usuário
    const session = getSession(userId);

    // Verifica se a sessão tem perguntas e gabarito
    if (!session?.lastAnswerKeys?.length || !session?.lastQuestions?.length) {
      return res.status(400).json({
        message: "Sessão inválida: perguntas ou gabarito ausentes.",
      });
    }

    // Garante que o UserAnalysis exista
    let ua = await UserAnalysis.findOne({ userId, email }).exec();
    if (!ua) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    // Validação extra: Garante que o array de sessões exista
    if (!ua.sessions) {
      ua.sessions = [];
    }

    // Verificar se precisamos criar uma nova sessão
    const needsNewSession = ua.sessions.length === 0 ||
        (ua.sessions[ua.sessions.length - 1].sessionEnd !== undefined);

    if (needsNewSession) {
      console.log("Criando nova sessão para o usuário", userId);
      // Criar nova sessão com subjectCountsChat inicializado corretamente
      ua.sessions.push({
        sessionStart: new Date(),
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0,
        subjectCountsChat: {
          variaveis: 0,
          tipos: 0,
          funcoes: 0,
          loops: 0,
          verificacoes: 0
        },
        answerHistory: []
      });

      // É importante salvar aqui para criar a nova sessão antes de continuar
      await ua.save();

      // Recarregar o usuário para garantir que temos a versão mais recente
      ua = await UserAnalysis.findOne({ userId, email }).exec();
      if (!ua) {
        throw new AppError("Erro ao recarregar dados do usuário após criar sessão", 500);
      }
    }

    // Chama o serviço para verificar as respostas e atualizar o UserAnalysis
    const result = await verificarRespostasService(
        respostas,
        userId,
        email,
        session,
        role
    );

    // Retorna o resultado da verificação
    return res.status(200).json(result);
  } catch (error: any) {
    // Se for um erro da nossa classe AppError, retorna o erro com o status adequado
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    // Log de erro inesperado
    console.error("Erro no controller de verificação de respostas:", error);

    // Retorna um erro genérico para falhas internas do servidor
    return res.status(500).json({
      message: error.message || "Erro ao verificar respostas",
    });
  }
}