import { Request, Response } from "express";
import { conversarService } from "../../../services/rasa/ActionChat/conversarService";

export async function conversarController(req: Request, res: Response) {
  try {
    const data = await conversarService();
    res.status(200).json(data);
  } catch (error) {
    console.error("Erro no conversarController:", error);
    res.status(500).json({ error: "Erro ao conversar com o bot" });
  }
}
