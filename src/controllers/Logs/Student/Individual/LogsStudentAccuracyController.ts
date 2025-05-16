import { Request, Response } from "express";
import { LogsStudentAccuracyService } from "../../../../services/Logs/Student/Individual/LogsStudentAccuracyService";

export async function LogsStudentAccuracyController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsStudentAccuracyService(id);
    return res.status(200).json(result);
}