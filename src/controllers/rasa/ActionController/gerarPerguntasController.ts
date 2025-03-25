import { Request, Response } from "express";
import { gerarPerguntasService } from "../../../services/rasa/ActionService/gerarPerguntasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";

export async function gerarPerguntasController(req: Request, res: Response) {
  try {
    const { pergunta } = req.body;
    const userId = "user";
    const session = getSession(userId);

    const result = await gerarPerguntasService(pergunta, session);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao gerar perguntas", error: error.message });
  }
}
