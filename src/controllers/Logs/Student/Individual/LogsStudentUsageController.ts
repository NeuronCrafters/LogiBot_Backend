import { Request, Response } from "express";
import { LogsStudentUsageService } from "../../../../services/Logs/Student/Individual/LogsStudentUsageService";

export async function LogsStudentUsageController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsStudentUsageService(id);
    return res.status(200).json(result);
}