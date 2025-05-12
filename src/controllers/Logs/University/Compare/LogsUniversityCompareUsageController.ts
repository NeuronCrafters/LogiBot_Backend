import { Request, Response } from "express";
import { LogsUniversityCompareUsageService } from "services/Logs/University/Compare/LogsUniversityCompareUsageService"

export async function LogsUniversityCompareUsageController(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ message: "Formato inválido" });

    const data = await LogsUniversityCompareUsageService(ids);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
