import { Request, Response } from "express";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { gerarPerguntasService } from "../../../services/rasa/ActionService/gerarPerguntasService";
import { AppError } from "../../../exceptions/AppError";

export async function gerarPerguntasController(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const { pergunta } = req.body;

    if (!pergunta) {
      return res.status(400).json({ message: "O subassunto é obrigatório." });
    }

    // obtém (ou inicializa) a sessão Rasa do usuário
    const session = getSession(userId);
    if (!session) {
      throw new AppError("Sessão não encontrada para o usuário.", 400);
    }

    // gera perguntas (e dispara o salvamento no FaqStore em background)
    const { perguntas, gabarito, nivel, assunto } =
        await gerarPerguntasService(pergunta, session);

    // atualiza a sessão para uso posterior
    session.lastQuestions  = perguntas.map((q) => q.question);
    session.lastAnswerKeys = gabarito;
    session.lastSubject    = assunto;
    session.nivelAtual     = nivel;

    // retorna apenas as perguntas ao cliente
    return res.status(200).json({ questions: perguntas });
  } catch (error: any) {
    console.error("❌ Erro ao gerar perguntas:", error);
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Erro ao gerar perguntas",
      error: error.message || "Erro interno",
    });
  }
}
