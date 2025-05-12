import { Request, Response } from "express";
import { LogsCourseAccuracyService } from "../../../../services/Log/Course/Individual/LogsCourseAccuracyService";

export async function LogsCourseAccuracyController(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const data = await LogsCourseAccuracyService(id);
        return res.status(200).json(data);
    } catch (error: any) {
        console.error("Erro em LogsCourseAccuracyController:", error);
        return res.status(500).json({ message: "Erro ao buscar acertos e erros do curso.", error: error.message });
    }
}