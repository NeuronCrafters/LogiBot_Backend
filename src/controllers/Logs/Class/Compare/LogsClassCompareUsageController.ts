import { Request, Response } from "express";
import { LogsClassCompareUsageService } from "../../../../services/Logs/Class/Compare/LogsClassCompareUsageService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassCompareUsageController(req: Request, res: Response) {
    try {
        const { classIds } = req.body;
        if (!Array.isArray(classIds) || !classIds.length) {
            return res.status(400).json({ message: "Turmas não fornecidas corretamente" });
        }

        const result = await LogsClassCompareUsageService(classIds);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsClassCompareUsageController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}