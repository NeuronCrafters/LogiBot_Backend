import { Request, Response } from "express";
import { LogsUniversityAccuracyService } from "@/services/Log/University/LogsUniversityAccuracyService";

export async function LogsUniversityAccuracyController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await LogsUniversityAccuracyService(id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
