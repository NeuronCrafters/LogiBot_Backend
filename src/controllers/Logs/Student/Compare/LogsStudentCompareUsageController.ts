import { Request, Response } from "express";
import { LogsStudentCompareUsageService } from "../../../../services/Logs/Student/Compare/LogsStudentCompareUsageService";

export async function LogsStudentCompareUsageController(req: Request, res: Response) {
    const { ids } = req.body;
    const result = await LogsStudentCompareUsageService(ids);
    return res.status(200).json(result);
}