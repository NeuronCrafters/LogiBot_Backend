import { Request, Response } from "express";
import { listarNiveisService } from "../../../services/rasa/ActionService/listarNiveisService";

export async function listarNiveisController(req: Request, res: Response) {
  try {
    const result = await listarNiveisService();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao obter os níveis", error: error.message });
  }
}