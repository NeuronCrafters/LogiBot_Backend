import { Request, Response } from "express";
import { sendOpcaoEListarSubopcoesService } from "../../../services/rasa/ActionService/sendOpcaoEListarSubopcoesService";
import { getSession } from "../../../services/rasa/types/sessionMemory";

export async function sendOpcaoEListarSubopcoesController(req: Request, res: Response) {
  try {
    const { categoria } = req.body;
    const userId = req.user.id;
    const session = getSession(userId);

    session.lastSubject = categoria;

    const result = await sendOpcaoEListarSubopcoesService(categoria);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao obter as subopções", error: error.message });
  }
}
