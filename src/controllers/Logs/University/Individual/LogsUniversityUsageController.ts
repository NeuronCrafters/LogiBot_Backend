import { Request, Response } from "express";
import { LogsUniversityUsageService } from "services/Logs/University/Individual/LogsUniversityUsageService";

export async function LogsUniversityUsageController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await LogsUniversityUsageService(id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
