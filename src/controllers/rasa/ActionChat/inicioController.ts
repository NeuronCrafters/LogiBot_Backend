import { Request, Response } from "express";
import { inicioService } from "../../../services/rasa/ActionChat/inicioService";

export async function inicioController(req: Request, res: Response) {
  try {
    const data = await inicioService();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao iniciar caminho" });
  }
}
