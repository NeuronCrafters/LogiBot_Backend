import { Request, Response } from "express";
import { LogsClassSubjectSummaryService } from "../../../../services/Logs/Class/Individual/LogsClassSubjectSummaryService";

export async function LogsClassSubjectSummaryController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsClassSubjectSummaryService(id);
    return res.status(200).json(result);
}
