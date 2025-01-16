import { Request, Response } from "express";
import { ListProfessorsService } from "../../services/admin/ListProfessorsService";

class ListProfessorsController {
  async handle(req: Request, res: Response) {
    const listProfessorsService = new ListProfessorsService();

    try {
      const userRoles = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role];

      if (!userRoles.includes("admin") && !userRoles.includes("course-coordinator")) {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores ou coordenadores de curso podem acessar." });
      }

      const professors = await listProfessorsService.execute();
      return res.json(professors);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { ListProfessorsController };
