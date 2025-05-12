import { Request, Response } from "express";
import { LogsUniversitySubjectSummaryService } from "services/Logs/University/Individual/LogsUniversitySubjectSummaryService";

export async function LogsUniversitySubjectSummaryController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await LogsUniversitySubjectSummaryService(id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
