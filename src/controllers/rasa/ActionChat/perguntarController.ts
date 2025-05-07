import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";

export async function actionPerguntarController(req: Request, res: Response) {
  const { text } = req.body;
  const senderId = req.user?.id || "user";

  if (!text) {
    return res.status(400).json({ error: "Texto da mensagem é obrigatório." });
  }

  try {
    const result = await actionPerguntarService(text, senderId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ message: "Erro ao conversar com o assistente", error: error.message });
  }
}
