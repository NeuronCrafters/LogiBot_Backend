import { Request, Response } from "express";
import { ListStudentsProfessorService } from "../../../services/admin/students/ListStudentsProfessorService"

class ListStudentsProfessorController {
  async handle(req: Request, res: Response) {
    const { professorId } = req.params;
    const listStudentsProfessorService = new ListStudentsProfessorService();

    try {
      const userRoles = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role];

      if (!userRoles.includes("admin") && !userRoles.includes("course-coordinator")) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores ou coordenadores de curso podem acessar." });
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
