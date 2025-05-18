import { Request, Response } from "express";
import { LogsCourseAccuracyCompareService } from "../../../../services/Logs/Course/Compare/LogsCourseAccuracyCompareService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseCompareAccuracyController(req: Request, res: Response) {
    try {
        const { courseIds } = req.body;
        if (!Array.isArray(courseIds) || !courseIds.length) {
            return res.status(400).json({ message: "Cursos não fornecidos corretamente" });
        }

        const data = await LogsCourseAccuracyCompareService(courseIds);
        return res.status(200).json(data);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro em LogsCourseCompareAccuracyController:", error);
        return res.status(500).json({ message: "Erro ao comparar acertos e erros entre cursos" });
    }
}