import { Request, Response } from "express";
import { LogsUniversityCompareUsageService } from "../../../../services/Logs/University/Compare/LogsUniversityCompareUsageService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversityCompareUsageController(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "Universidades não fornecidas corretamente" });
    }

    const data = await LogsUniversityCompareUsageService(ids);
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Erro em LogsUniversityCompareUsageController:", error);
    return res.status(500).json({ message: "Erro ao comparar tempo de uso entre universidades" });
  }
}