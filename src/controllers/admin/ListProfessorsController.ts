import { Request, Response } from "express";
import { ListProfessorsService } from "../../services/admin/ListProfessorsService";

class ListProfessorsController {
  async handle(req: Request, res: Response) {
    const listProfessorsService = new ListProfessorsService();

    try {
      const userRole = req.user?.role;
      if (userRole !== "admin") {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar." });
      }

      const professors = await listProfessorsService.execute();
      return res.json(professors);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export { ListProfessorsController };
