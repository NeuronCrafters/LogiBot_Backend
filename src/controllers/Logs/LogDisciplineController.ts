import { Request, Response } from "express";
import { LogDisciplineService } from "../../services/Logs/LogDisciplineService";

class LogDisciplineController {
  private disciplineLogService = new LogDisciplineService();

  async getDisciplineLogs(req: Request, res: Response) {
    try {
      const { disciplineId } = req.params;
      const { startDate, endDate } = req.query;
      const result = await this.disciplineLogService.getDisciplineLogs(
        req.user,
        disciplineId,
        startDate as string,
        endDate as string
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { LogDisciplineController };
