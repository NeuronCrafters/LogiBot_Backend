import { Request, Response } from "express";
import { LogsDisciplineCompareAccuracyService } from "../../../../services/Logs/Discipline/Compare/LogsDisciplineCompareAccuracyService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineCompareAccuracyController(req: Request, res: Response) {
    try {
        const { disciplineIds } = req.body;
        if (!Array.isArray(disciplineIds) || !disciplineIds.length) {
            return res.status(400).json({ message: "Disciplinas não fornecidas corretamente" });
        }

        const result = await LogsDisciplineCompareAccuracyService(disciplineIds);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsDisciplineCompareAccuracyController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}