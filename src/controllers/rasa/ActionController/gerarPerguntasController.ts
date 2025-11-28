import { Request, Response } from "express";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { gerarPerguntasService } from "../../../services/rasa/ActionService/gerarPerguntasService";

export async function gerarPerguntasController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { pergunta } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    if (!pergunta || typeof pergunta !== "string" || !pergunta.trim()) {
      return res.status(400).json({ message: "A pergunta (subtópico) é obrigatória." });
    }


    const session = getSession(userId);

    const resultado = await gerarPerguntasService(pergunta.trim(), session);

    session.lastQuestions = resultado.perguntas.map(p => p.question);
    session.lastAnswerKeys = resultado.gabarito;
    session.lastSubject = resultado.assunto;
    session.nivelAtual = resultado.nivel;

    return res.status(200).json({
      success: true,
      assunto: resultado.assunto,
      nivel: resultado.nivel,
      questions: resultado.perguntas,
      metadata: resultado.metadata || null,
    });
  } catch (error: any) {
    console.error(" Erro ao gerar perguntas no controller:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Erro interno ao gerar perguntas.",
    });
  }
}
