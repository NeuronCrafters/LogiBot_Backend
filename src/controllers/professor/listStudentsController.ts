import { Request, Response } from "express";
import { ListStudentsService } from "../../services/professor/listStudentsService";

class ListStudentsController {
  async handle(req: Request, res: Response) {
    const { professorId } = req.params;

    try {
      const listStudentsService = new ListStudentsService();
      const students = await listStudentsService.execute(professorId);

      return res.json(students);
    } catch (error) {
      console.error("Erro ao listar alunos:", error);
      return res.status(500).json({ error: error.message });
    }
  }
}

export { ListStudentsController };
