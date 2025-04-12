import { Request, Response } from "express";
import { LogClassService } from "../../services/Logs/LogClassService";

class LogClassController {
  private logClassService = new LogClassService();

  async getClassLogs(req: Request, res: Response) {
    try {
      const { classId } = req.params;
      const result = await this.logClassService.getClassLogs(req.user, classId);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { LogClassController };