import { Request, Response } from "express";
import { LogsCourseAccuracyCompareService } from "services/Logs/Course/Compare/LogsCourseAccuracyCompareService";

export async function LogsCourseCompareAccuracyController(req: Request, res: Response) {
    try {
        const { courseIds } = req.body;
        const data = await LogsCourseAccuracyCompareService(courseIds);
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Erro em LogsCourseCompareAccuracyController:", error);
        return res.status(500).json({ message: "Erro ao comparar acertos e erros entre cursos.", error: error.message });
    }
}