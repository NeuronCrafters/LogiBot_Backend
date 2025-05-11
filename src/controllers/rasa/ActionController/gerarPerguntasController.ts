import { Request, Response } from "express";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { gerarPerguntasService } from "../../../services/rasa/ActionService/gerarPerguntasService";

export async function gerarPerguntasController(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const { pergunta } = req.body;

    if (!pergunta) {
      return res.status(400).json({ message: "A pergunta é obrigatória." });
    }

    const session = getSession(userId);

    // Chamada ao service
    const { perguntas, gabarito, nivel, assunto } = await gerarPerguntasService(pergunta, session);

    // Atualiza a sessão
    session.lastQuestions = perguntas.map((p) => p.question);
    session.lastAnswerKeys = gabarito;
    session.lastSubject = assunto;
    session.nivelAtual = nivel;

    return res.status(200).json({ questions: perguntas });
  } catch (error: any) {
    console.error("❌ Erro ao gerar perguntas:", error);
    return res.status(500).json({
      message: "Erro ao gerar perguntas",
      error: error.message || "Erro interno",
    });
  }
}
