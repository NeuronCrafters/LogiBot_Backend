import { Request, Response } from "express";
import { AppError } from "../../exceptions/AppError";
import { DetailsUserService } from "../../services/users/DetailsUserService";

function getPrimaryRole(roles: string[] | string): string {
  const priority = ["admin", "course-coordinator", "professor", "student"];
  if (Array.isArray(roles)) {
    for (const r of priority) if (roles.includes(r)) return r;
    return roles[0];
  }
  return roles;
}

class DetailsUserController {
  async handle(req: Request, res: Response) {
    try {
      const { id, role } = req.user as { id: string; role: string[] | string };
      const primaryRole = getPrimaryRole(role);
      const svc = new DetailsUserService();
      const userDetails = await svc.detailsUser(id, primaryRole);
      return res.json(userDetails);
    } catch (err: any) {

      const status = err instanceof AppError ? err.statusCode : 500;
      return res.status(status).json({ error: err.message });
    }
  }
}

export { DetailsUserController };
