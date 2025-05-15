import { Request, Response } from "express";
import { LogsClassCompareAccuracyService } from "../../../../services/Logs/Class/Compare/LogsClassCompareAccuracyService";

export async function LogsClassCompareAccuracyController(req: Request, res: Response) {
    const { classIds } = req.body;
    if (!Array.isArray(classIds) || !classIds.length) {
        return res.status(400).json({ message: "Turmas não fornecidas corretamente" });
    }

    const result = await LogsClassCompareAccuracyService(classIds);
    return res.status(200).json(result);
}