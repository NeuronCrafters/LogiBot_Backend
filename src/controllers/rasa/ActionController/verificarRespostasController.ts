import { Request, Response } from "express";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";

export async function verificarRespostasController(req: Request, res: Response) {
  try {
    const { respostas } = req.body;

    if (!respostas || !Array.isArray(respostas)) {
      return res.status(400).json({ message: "As respostas são obrigatórias e devem estar em um array." });
    }

    const userId = req.user.id;
    const email = req.user.email;
    const session = getSession(userId);

    const result = await verificarRespostasService(respostas, userId, email, session);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao verificar respostas", error: error.message });
  }
}
