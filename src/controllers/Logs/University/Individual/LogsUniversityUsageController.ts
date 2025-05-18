import { Request, Response } from "express";
import { LogsUniversityUsageService } from "../../../../services/Logs/University/Individual/LogsUniversityUsageService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityUsageController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID da universidade é obrigatório" });
    }

    const data = await LogsUniversityUsageService(id);
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Erro em LogsUniversityUsageController:", error);
    return res.status(500).json({ message: "Erro ao buscar tempo de uso da universidade" });
  }
}