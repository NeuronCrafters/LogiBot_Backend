import { Request, Response } from "express";
import { ListStudentsService } from "../../services/admin/ListStudentsService";

class ListStudentsController {
  async handle(req: Request, res: Response) {
    const { professorId } = req.params;
    const listStudentsService = new ListStudentsService();

    try {
      const students = await listStudentsService.execute(professorId);
      return res.json(students);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { ListStudentsController };
