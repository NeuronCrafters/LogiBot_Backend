import { Request, Response } from "express";
import { LogsClassUsageService } from "services/Logs/Class/Individual/LogsClassUsageService";

export async function LogsClassUsageController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsClassUsageService(id);
    return res.status(200).json(result);
}
