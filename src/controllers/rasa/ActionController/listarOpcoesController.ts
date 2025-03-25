import { Request, Response } from "express";
import { listarOpcoesService } from "../../../services/rasa/ActionService/listarOpcoesService";

export async function listarOpcoesController(req: Request, res: Response) {
  try {
    const result = await listarOpcoesService();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao obter as opções", error: error.message });
  }
}
