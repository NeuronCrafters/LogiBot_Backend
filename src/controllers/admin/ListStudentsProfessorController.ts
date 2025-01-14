import { Request, Response } from "express";
import { ListStudentsProfessorService } from "../../services/admin/ListStudentsProfessorService";

class ListStudentsProfessorController {
  async handle(req: Request, res: Response) {
    const { professorId } = req.params;
    const listStudentsProfessorService = new ListStudentsProfessorService();

    try {
      const userRole = req.user?.role;
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar." });
      }

      const professorWithStudents = await listStudentsProfessorService.execute(professorId);
      return res.json(professorWithStudents);
    } catch (error) {
      console.error("Erro ao listar alunos do professor:", error);
      return res.status(500).json({ error: error.message });
    }
  }
}

export { ListStudentsProfessorController };
