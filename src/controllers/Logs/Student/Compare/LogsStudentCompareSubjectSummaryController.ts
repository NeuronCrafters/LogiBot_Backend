import { Request, Response } from "express";
import { LogsStudentCompareSubjectSummaryService } from "../../../../services/Logs/Student/Compare/LogsStudentCompareSubjectSummaryService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareSubjectSummaryController(req: Request, res: Response) {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) {
            return res.status(400).json({ message: "IDs de estudantes não fornecidos corretamente" });
        }

        const result = await LogsStudentCompareSubjectSummaryService(ids);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsStudentCompareSubjectSummaryController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}