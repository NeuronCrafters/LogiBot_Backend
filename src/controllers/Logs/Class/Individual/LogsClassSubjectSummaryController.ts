import { Request, Response } from "express";
import { LogsClassSubjectSummaryService } from "../../../../services/Logs/Class/Individual/LogsClassSubjectSummaryService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsClassSubjectSummaryController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "ID da turma é obrigatório" });
        }

        const result = await LogsClassSubjectSummaryService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsClassSubjectSummaryController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}