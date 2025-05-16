import { Request, Response } from "express";
import { LogsStudentUsageService } from "../../../../services/Logs/Student/Individual/LogsStudentUsageService";
import {AppError} from "exceptions/AppError";

export async function LogsStudentUsageController(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const result = await LogsStudentUsageService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        return res.status(500).json({ message: "Erro inesperado" });
    }
}
