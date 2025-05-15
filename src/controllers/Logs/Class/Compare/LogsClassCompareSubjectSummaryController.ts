import { Request, Response } from "express";
import { LogsClassCompareSubjectSummaryService } from "../../../../services/Logs/Class/Compare/LogsClassCompareSubjectSummaryService";

export async function LogsClassCompareSubjectSummaryController(req: Request, res: Response) {
    const { classIds } = req.body;
    if (!Array.isArray(classIds) || !classIds.length) {
        return res.status(400).json({ message: "Turmas não fornecidas corretamente" });
    }

    const result = await LogsClassCompareSubjectSummaryService(classIds);
    return res.status(200).json(result);
}
