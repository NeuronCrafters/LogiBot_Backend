import { Request, Response } from "express";
import { LogsStudentSubjectSummaryService } from "../../../../services/Logs/Student/Individual/LogsStudentSubjectSummaryService";

export async function LogsStudentSubjectSummaryController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsStudentSubjectSummaryService(id);
    return res.status(200).json(result);
}