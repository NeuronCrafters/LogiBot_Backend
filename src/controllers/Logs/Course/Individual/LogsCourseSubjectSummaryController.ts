import { Request, Response } from "express";
import { LogsCourseSubjectSummaryService } from "../../../../services/Log/Course/Individual/LogsCourseSubjectSummaryService";

export async function LogsCourseSubjectSummaryController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const data = await LogsCourseSubjectSummaryService(id);
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Erro em LogsCourseSubjectSummaryController:", error);
        return res.status(500).json({ message: "Erro ao buscar resumo de assuntos do curso.", error: error.message });
    }
}