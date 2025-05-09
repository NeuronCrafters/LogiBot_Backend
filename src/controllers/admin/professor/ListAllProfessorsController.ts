import { Request, Response } from "express";
import { ListAllProfessorsService } from "../../../services/admin/professor/ListAllProfessorsService";

class ListAllProfessorsController {
  async handle(req: Request, res: Response) {
    const roles = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role];

    if (!roles.includes("admin")) {
      return res.status(403).json({ error: "Apenas administradores podem acessar esta rota." });
    }

    const service = new ListAllProfessorsService();
    const professors = await service.execute();
    return res.json(professors);
  }
}

export { ListAllProfessorsController };
