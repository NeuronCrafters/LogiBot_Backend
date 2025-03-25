import { Request, Response } from "express";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import jwt from "jsonwebtoken";

export async function verificarRespostasController(req: Request, res: Response) {
  try {
    const { respostas } = req.body;
    if (!respostas) {
      return res.status(400).json({ message: "As respostas são obrigatórias." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Token não fornecido." });
    }

    const token = authHeader.split(" ")[1];
    const userData: any = jwt.verify(token, process.env.JWT_SECRET as string);
    const userId = userData.id;
    const email = userData.email;

    const session = getSession(userId);
    const result = await verificarRespostasService(respostas, userId, email, session);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Erro ao verificar respostas", error: error.message });
  }
}
