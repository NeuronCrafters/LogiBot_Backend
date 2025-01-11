import { Request, Response } from "express";
import { ViewStudentHistoryService } from "../../services/professor/viewStudentHistoryService";

class ViewStudentHistoryController {
  async handle(req: Request, res: Response) {
    const { studentId } = req.params;

    const viewStudentHistoryService = new ViewStudentHistoryService();
    try {
      const history = await viewStudentHistoryService.execute(studentId);
      return res.json(history);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { ViewStudentHistoryController };
