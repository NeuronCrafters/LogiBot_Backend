import { Request, Response } from "express";
import { LogsDisciplineCompareUsageService } from "../../../../services/Logs/Discipline/Compare/LogsDisciplineCompareUsageService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineCompareUsageController(req: Request, res: Response) {
    try {
        const { disciplineIds } = req.body;
        if (!Array.isArray(disciplineIds) || !disciplineIds.length) {
            return res.status(400).json({ message: "Disciplinas não fornecidas corretamente" });
        }

        const result = await LogsDisciplineCompareUsageService(disciplineIds);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsDisciplineCompareUsageController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}