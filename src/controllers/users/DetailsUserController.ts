import { Request, Response } from "express";
import { AppError } from "../../exceptions/AppError";
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
      const { id, role } = req.user as { id: string; role: string[] | string };

      const primaryRole = getPrimaryRole(role);

      const detailsUserService = new DetailsUserService();
      const userDetails = await detailsUserService.detailsUser(id, primaryRole);

      return res.json(userDetails);
    } catch (error: any) {
      console.error("Erro ao buscar detalhes do usuário:", error);
      const status = error instanceof AppError ? error.statusCode : 500;
      return res.status(status).json({ error: error.message });
    }
  }
}

export { DetailsUserController };
