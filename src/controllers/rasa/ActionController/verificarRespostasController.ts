import { Request, Response } from "express";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";

export async function verificarRespostasController(req: Request, res: Response) {
  try {
    const { respostas } = req.body;

    // Validação da estrutura das respostas
    if (!respostas || !Array.isArray(respostas)) {
      return res.status(400).json({
        message: "As respostas são obrigatórias e devem estar em um array.",
      });
    }

    // Recupera os dados do usuário autenticado
    const userId = req.user.id;
    const email = req.user.email;
    const role = req.user.role; // <-- nova linha

    // Recupera a sessão da memória temporária
    const session = getSession(userId);

    // Garante que os dados esperados da sessão estão disponíveis
    if (
      !session?.lastAnswerKeys?.length ||
      !session?.lastQuestions?.length
    ) {
      return res.status(400).json({
        message: "Sessão inválida: perguntas ou gabarito ausentes.",
      });
    }

    // Chama o serviço principal para verificar as respostas
    const result = await verificarRespostasService(respostas, userId, email, session, role);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Erro no controller de verificação de respostas:", error);
    return res.status(500).json({
      message: "Erro ao verificar respostas",
      error: error.message || "Erro interno",
    });
  }
}
