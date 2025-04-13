import { Request, Response } from "express";
import { LogUserService } from "../../services/Logs/LogUserService";

class LogUserController {
  private LogUserService = new LogUserService();

  async getUserLogs(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const result = await this.LogUserService.getUserLogs(req.user, userId);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { LogUserController };