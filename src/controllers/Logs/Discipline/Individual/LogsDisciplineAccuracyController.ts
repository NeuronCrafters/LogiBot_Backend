import { Request, Response } from "express";
import { LogsDisciplineAccuracyService } from "../../../../services/Logs/Discipline/Individual/LogsDisciplineAccuracyService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineAccuracyController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!id) {
            throw new AppError("ID da disciplina é obrigatório", 400);
        }

        const result = await LogsDisciplineAccuracyService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsDisciplineAccuracyController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}