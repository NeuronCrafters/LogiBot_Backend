import { Request, Response } from "express";
import { LogsDisciplineSubjectSummaryService } from "../../../../services/Logs/Discipline/Individual/LogsDisciplineSubjectSummaryService";

export async function LogsDisciplineSubjectSummaryController(req: Request, res: Response) {
    const { id } = req.params;
    const result = await LogsDisciplineSubjectSummaryService(id);
    return res.status(200).json(result);
}