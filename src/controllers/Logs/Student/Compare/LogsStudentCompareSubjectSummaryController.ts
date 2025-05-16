import { Request, Response } from "express";
import { LogsStudentCompareSubjectSummaryService } from "../../../../services/Logs/Student/Compare/LogsStudentCompareSubjectSummaryService";

export async function LogsStudentCompareSubjectSummaryController(req: Request, res: Response) {
    const { ids } = req.body;
    const result = await LogsStudentCompareSubjectSummaryService(ids);
    return res.status(200).json(result);
}