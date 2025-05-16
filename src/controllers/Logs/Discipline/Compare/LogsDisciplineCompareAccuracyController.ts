import { Request, Response } from "express";
import { LogsDisciplineCompareAccuracyService } from "../../../../services/Logs/Discipline/Compare/LogsDisciplineCompareAccuracyService";

export async function LogsDisciplineCompareAccuracyController(req: Request, res: Response) {
    const { disciplineIds } = req.body;

    const result = await LogsDisciplineCompareAccuracyService(disciplineIds);

    return res.status(200).json(result);
}