import { Request, Response } from "express";
import { LogStudentService } from "../../services/Logs/LogStudentService";

class LogStudentController {
  private logStudentService = new LogStudentService();

  async getStudentLogs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      const result = await this.logStudentService.getStudentLogs(
        req.user,
        id,
        startDate as string,
        endDate as string
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res
        .status(error.statusCode || 500)
        .json({ message: error.message });
    }
  }
}

export { LogStudentController };
