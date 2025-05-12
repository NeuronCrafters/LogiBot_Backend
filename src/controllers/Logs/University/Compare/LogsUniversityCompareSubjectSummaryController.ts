import { Request, Response } from "express";
import { LogsUniversityCompareSubjectSummaryService } from "@/services/Log/University/LogsUniversityCompareSubjectSummaryService";

export async function LogsUniversityCompareSubjectSummaryController(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: "Formato inválido" });

    const data = await LogsUniversityCompareSubjectSummaryService(ids);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
