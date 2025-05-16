import { Request, Response } from "express";
import { LogsDisciplineUsageService } from "../../../../services/Logs/Discipline/Individual/LogsDisciplineUsageService";

export async function LogsDisciplineUsageController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsDisciplineUsageService(id);
    return res.status(200).json(result);
}