import { Request, Response } from "express";
import { LogsStudentSubjectSummaryService } from "../../../../services/Logs/Student/Individual/LogsStudentSubjectSummaryService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentSubjectSummaryController(req: Request, res: Response) {
    const { id } = req.params;
    try {
        if (!id) {
            return res.status(400).json({ message: "ID do estudante é obrigatório" });
        }

        const result = await LogsStudentSubjectSummaryService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsStudentSubjectSummaryController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}