import { Request, Response } from "express";
import { ListProfessorsByUniversityService } from "../../../services/admin/admin/ListProfessorsByUniversityService";

class ListProfessorsByUniversityController {
  async handle(req: Request, res: Response) {
    const { schoolId } = req.params;
    const roles = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role];

    if (!roles.includes("admin")) {
      return res.status(403).json({ error: "Apenas administradores podem acessar esta rota." });
    }

    const service = new ListProfessorsByUniversityService();
    const professors = await service.execute(schoolId);

    return res.status(200).json(professors);
  }
}

export { ListProfessorsByUniversityController };
