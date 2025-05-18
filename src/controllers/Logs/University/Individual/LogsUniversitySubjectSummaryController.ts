import { Request, Response } from "express";
import { LogsUniversitySubjectSummaryService } from "../../../../services/Logs/University/Individual/LogsUniversitySubjectSummaryService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsUniversitySubjectSummaryController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID da universidade é obrigatório" });
    }

    const data = await LogsUniversitySubjectSummaryService(id);
    return res.status(200).json(data);
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Erro em LogsUniversitySubjectSummaryController:", error);
    return res.status(500).json({ message: "Erro ao buscar resumo de assuntos da universidade" });
  }
}