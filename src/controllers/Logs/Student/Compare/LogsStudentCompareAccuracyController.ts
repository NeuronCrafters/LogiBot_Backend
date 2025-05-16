import { Request, Response } from "express";
import { LogsStudentCompareAccuracyService } from "../../../../services/Logs/Student/Compare/LogsStudentCompareAccuracyService";

export async function LogsStudentCompareAccuracyController(req: Request, res: Response) {
    const { ids } = req.body;
    const result = await LogsStudentCompareAccuracyService(ids);
    return res.status(200).json(result);
}