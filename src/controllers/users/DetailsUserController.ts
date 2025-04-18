import { Request, Response } from "express";
import { DetailsUserService } from "../../services/users/DetailsUserService";

function getPrimaryRole(roles: string[] | string): string {
  const priority = ["admin", "course-coordinator", "professor", "student"];

  if (Array.isArray(roles)) {
    for (const role of priority) {
      if (roles.includes(role)) return role;
    }
    return roles[0];
  }

  return roles;
}

class DetailsUserController {
  async handle(req: Request, res: Response) {
    try {
      const { id, role } = req.user;

      const primaryRole = getPrimaryRole(role);

      // const roleAsString = Array.isArray(role) ? role[0] : role;

      const detailsUserService = new DetailsUserService();
      const userDetails = await detailsUserService.detailsUser(id, primaryRole);

      return res.json(userDetails);
    } catch (error) {
      console.error("Erro ao buscar detalhes do usuário:", error);
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  }
}

export { DetailsUserController };
