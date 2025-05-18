import { Request, Response } from "express";
import { LogsClassAccuracyService } from "../../../../services/Logs/Class/Individual/LogsClassAccuracyService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassAccuracyController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "ID da turma é obrigatório" });
        }

        const result = await LogsClassAccuracyService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsClassAccuracyController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}