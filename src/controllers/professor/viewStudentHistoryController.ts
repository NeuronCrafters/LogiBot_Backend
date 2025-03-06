import { Request, Response } from "express";
import { ViewStudentHistoryService } from "../../services/professor/viewStudentHistoryService";

class ViewStudentHistoryController {
  async handle(req: Request, res: Response) {
    const { professorId, studentId } = req.params;

    const viewStudentHistoryService = new ViewStudentHistoryService();

    try {
      const history = await viewStudentHistoryService.execute(professorId, studentId);
      return res.status(200).json(history);
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({ message: error.message });
    }
  }
}

export { ViewStudentHistoryController };
