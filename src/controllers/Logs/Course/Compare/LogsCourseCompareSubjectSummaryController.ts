import { Request, Response } from "express";
import { LogsCourseSubjectSummaryCompareService } from "services/Logs/Course/Compare/LogsCourseSubjectSummaryCompareService";

export async function LogsCourseCompareSubjectSummaryController(req: Request, res: Response) {
    try {
        const { courseIds } = req.body;
        const data = await LogsCourseSubjectSummaryCompareService(courseIds);
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Erro em LogsCourseCompareSubjectSummaryController:", error);
        return res.status(500).json({ message: "Erro ao comparar assuntos entre cursos.", error: error.message });
    }
}
