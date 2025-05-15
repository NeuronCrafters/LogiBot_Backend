import { Request, Response } from "express";
import { LogsClassCompareUsageService } from "../../../../services/Logs/Class/Compare/LogsClassCompareUsageService";

export async function LogsClassCompareUsageController(req: Request, res: Response) {
    const { classIds } = req.body;
    if (!Array.isArray(classIds) || !classIds.length) {
        return res.status(400).json({ message: "Turmas não fornecidas corretamente" });
    }

    const result = await LogsClassCompareUsageService(classIds);
    return res.status(200).json(result);
}