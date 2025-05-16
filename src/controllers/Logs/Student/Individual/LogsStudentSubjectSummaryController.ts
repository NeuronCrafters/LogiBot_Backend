import { Request, Response } from "express";
import { LogsStudentSubjectSummaryService } from "../../../../services/Logs/Student/Individual/LogsStudentSubjectSummaryService";
import {AppError} from "exceptions/AppError";

export async function LogsStudentSubjectSummaryController(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const result = await LogsStudentSubjectSummaryService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        return res.status(500).json({ message: "Erro inesperado" });
    }
}