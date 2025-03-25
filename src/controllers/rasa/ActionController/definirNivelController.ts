import { Request, Response } from "express";
import { definirNivelService } from "../../../services/rasa/ActionService/definirNivelService";
import { getSession } from "../../../services/rasa/types/sessionMemory";

export async function definirNivelController(req: Request, res: Response) {
  try {
    const { nivel } = req.body;
    const userId = "user";

    const session = getSession(userId);
    const result = await definirNivelService(nivel);
    session.nivelAtual = nivel;

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao definir o nível", error: error.message });
  }
}
