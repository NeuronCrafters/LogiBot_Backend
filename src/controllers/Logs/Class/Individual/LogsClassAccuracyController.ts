import { Request, Response } from "express";
import { LogsClassAccuracyService } from "services/Logs/Class/Individual/LogsClassAccuracyService";

export async function LogsClassAccuracyController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsClassAccuracyService(id);
    return res.status(200).json(result);
}
