import { Request, Response } from "express";
import { LogsDisciplineSubjectSummaryService } from "../../../../services/Logs/Discipline/Individual/LogsDisciplineSubjectSummaryService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineSubjectSummaryController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "ID da disciplina é obrigatório" });
        }

        const result = await LogsDisciplineSubjectSummaryService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsDisciplineSubjectSummaryController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}