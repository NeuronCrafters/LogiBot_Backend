import { Request, Response } from "express";
import { LogsCourseUsageService } from "../../../../services/Log/Course/Individual/LogsCourseUsageService";

export async function LogsCourseUsageController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const data = await LogsCourseUsageService(id);
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Erro em LogsCourseUsageController:", error);
        return res.status(500).json({ message: "Erro ao buscar tempo de uso do curso.", error: error.message });
    }
}