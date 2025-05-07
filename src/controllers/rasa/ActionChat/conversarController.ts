import { Request, Response } from "express";
import { conversarService } from "../../../services/rasa/ActionChat/conversarService";

export async function conversarController(req: Request, res: Response) {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "Texto é obrigatório" });

  try {
    const data = await conversarService(text);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao conversar com o bot" });
  }
}
