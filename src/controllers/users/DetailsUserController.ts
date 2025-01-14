import { Request, Response } from "express";
import { DetailsUserService } from "../../services/users/DetailsUserService";

class DetailsUserController {
  async handle(req: Request, res: Response) {
    try {
      const { id, role } = req.user;

      console.log("ID do usuário:", id, "Role:", role);

      const detailsUserService = new DetailsUserService();
      const userDetails = await detailsUserService.detailsUser(id, role);

      return res.json(userDetails);
    } catch (error) {
      console.error("Erro ao buscar detalhes do usuário:", error);
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export { DetailsUserController };
