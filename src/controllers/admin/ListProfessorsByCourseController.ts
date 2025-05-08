import { Request, Response } from "express";
import { ListProfessorsByCourseService } from "../../services/admin/ListProfessorsByCourseService";

class ListProfessorsByCourseController {
  async handle(req: Request, res: Response) {
    const { courseId } = req.params;
    const roles = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role];

    if (!roles.includes("admin") && !roles.includes("course-coordinator")) {
      return res.status(403).json({ error: "Apenas administradores ou coordenadores de curso podem acessar esta rota." });
    }

    const service = new ListProfessorsByCourseService();
    const professors = await service.execute(courseId);

    return res.status(200).json(professors);
  }
}

export { ListProfessorsByCourseController };
