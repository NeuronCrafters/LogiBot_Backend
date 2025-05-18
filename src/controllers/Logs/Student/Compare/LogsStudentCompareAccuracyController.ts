import { Request, Response } from "express";
import { LogsStudentCompareAccuracyService } from "../../../../services/Logs/Student/Compare/LogsStudentCompareAccuracyService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentCompareAccuracyController(req: Request, res: Response) {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) {
            return res.status(400).json({ message: "IDs de estudantes não fornecidos corretamente" });
        }

        const result = await LogsStudentCompareAccuracyService(ids);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsStudentCompareAccuracyController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}