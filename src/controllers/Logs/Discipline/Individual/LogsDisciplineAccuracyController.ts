import { Request, Response } from "express";
import { LogsDisciplineAccuracyService } from "../../../../services/Logs/Discipline/Individual/LogsDisciplineAccuracyService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineAccuracyController(req: Request, res: Response) {
    try {
        const { id: disciplineId } = req.params;

        if (!disciplineId) {
            throw new AppError("ID da disciplina é obrigatório", 400);
        }

        const result = await LogsDisciplineAccuracyService(disciplineId);
        return res.status(200).json(result);
    } catch (error) {
        const status = error instanceof AppError ? error.statusCode : 500;
        return res.status(status).json({
            message: error instanceof AppError ? error.message : "Erro interno do servidor",
        });
    }
}
