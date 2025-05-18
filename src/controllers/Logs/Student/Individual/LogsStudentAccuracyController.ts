import { Request, Response } from "express";
import { LogsStudentAccuracyService } from "../../../../services/Logs/Student/Individual/LogsStudentAccuracyService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentAccuracyController(req: Request, res: Response) {
    const { id } = req.params;
    try {
        if (!id) {
            return res.status(400).json({ message: "ID do estudante é obrigatório" });
        }

        const result = await LogsStudentAccuracyService(id);
        return res.status(200).json(result);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro no LogsStudentAccuracyController:", error);
        return res.status(500).json({ message: "Erro interno do servidor" });
    }
}