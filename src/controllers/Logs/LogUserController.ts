import { Request, Response } from "express";
import { LogUserService } from "../../services/Logs/LogUserService";

class LogUserController {
  private logUserService = new LogUserService();

  async getUserLogs(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      const result = await this.logUserService.getUserLogs(
        req.user,
        userId,
        startDate as string,
        endDate as string
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { LogUserController };
