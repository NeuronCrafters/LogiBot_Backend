import { Request, Response } from "express";
import { LogsDisciplineCompareUsageService } from "../../../../services/Logs/Discipline/Compare/LogsDisciplineCompareUsageService";

export async function LogsDisciplineCompareUsageController(req: Request, res: Response) {
    const { disciplineIds } = req.body;

    const result = await LogsDisciplineCompareUsageService(disciplineIds);

    return res.status(200).json(result);
}