import { Request, Response } from "express";
import { LogsStudentAccuracyService } from "../../../../services/Logs/Student/Individual/LogsStudentAccuracyService";
import {AppError} from "exceptions/AppError";

export async function LogsStudentAccuracyController(req: Request, res: Response) {
    const { id } = req.params;
    try {
        const result = await LogsStudentAccuracyService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        return res.status(500).json({ message: "Erro inesperado" });
    }
}
