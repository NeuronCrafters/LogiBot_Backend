import { Request, Response } from "express";
import { LogsDisciplineCompareSubjectsSummaryService } from "../../../../services/Logs/Discipline/Compare/LogsDisciplineCompareSubjectsSummaryService";

export async function LogsDisciplineCompareSubjectsSummaryController(req: Request, res: Response) {
    const { disciplineIds } = req.body;

    const result = await LogsDisciplineCompareSubjectsSummaryService(disciplineIds);

    return res.status(200).json(result);
}