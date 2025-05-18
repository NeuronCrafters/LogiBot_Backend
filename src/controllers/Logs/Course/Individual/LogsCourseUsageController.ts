import { Request, Response } from "express";
import { LogsCourseUsageService } from "../../../../services/Logs/Course/Individual/LogsCourseUsageService";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsCourseUsageController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "ID do curso é obrigatório" });
        }

        const data = await LogsCourseUsageService(id);
        return res.status(200).json(data);
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Erro em LogsCourseUsageController:", error);
        return res.status(500).json({ message: "Erro ao buscar tempo de uso do curso" });
    }
}