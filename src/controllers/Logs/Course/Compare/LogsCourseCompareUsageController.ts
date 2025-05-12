import { Request, Response } from "express";
import { LogsCourseUsageCompareService } from "services/Logs/Course/Compare/LogsCourseUsageCompareService";

export async function LogsCourseCompareUsageController(req: Request, res: Response) {
    try {
        const { courseIds } = req.body;
        const data = await LogsCourseUsageCompareService(courseIds);
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Erro em LogsCourseCompareUsageController:", error);
        return res.status(500).json({ message: "Erro ao comparar tempo de uso entre cursos.", error: error.message });
    }
}