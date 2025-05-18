import { Request, Response } from "express";
import { LogsUniversityAccuracyService } from "../../../../services/Logs/University/Individual/LogsUniversityAccuracyService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityAccuracyController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID da universidade é obrigatório" });
    }

    const data = await LogsUniversityAccuracyService(id);
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Erro em LogsUniversityAccuracyController:", error);
    return res.status(500).json({ message: "Erro ao buscar acertos e erros da universidade" });
  }
}