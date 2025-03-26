import { Request, Response } from "express";
import { getGabaritoService } from "../../../services/rasa/ActionService/getGabaritoService";
import { getSession } from "../../../services/rasa/types/sessionMemory";

export async function getGabaritoController(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const session = getSession(userId);

    const result = getGabaritoService(session);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao obter o gabarito", error: error.message });
  }
}
